// api/passwords.js — Password management via Upstash KV
// Actions: list, add, delete, verify
// Each password stored as cmdpw:<id> in KV with optional TTL for auto-expiry

const crypto = require('crypto');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://piererra.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function genSalt() {
  return crypto.randomBytes(32).toString('hex');
}

function timingSafeEqual(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch { return false; }
}

// ── Upstash KV REST helpers ──────────────────────────────────
async function kvGet(key) {
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  const data = await res.json();
  if (!data.result) return null;
  return JSON.parse(data.result);
}

async function kvSet(key, value, ttlSeconds = null) {
  const body = ttlSeconds
    ? ['SET', key, JSON.stringify(value), 'EX', ttlSeconds]
    : ['SET', key, JSON.stringify(value)];
  const res = await fetch(`${process.env.KV_REST_API_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([body])
  });
  return res.ok;
}

async function kvDel(key) {
  await fetch(`${process.env.KV_REST_API_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
}

async function kvKeys(pattern) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/keys/${encodeURIComponent(pattern)}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` }
  });
  const data = await res.json();
  return data.result || [];
}

// ── Verify admin credentials ──────────────────────────────────
function verifyAdmin(username, password) {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  if (!envUser || !envPass) return false;
  return timingSafeEqual(sha256(username || ''), sha256(envUser)) &&
         timingSafeEqual(sha256(password || ''), sha256(envPass));
}

// ── Handler ───────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { action } = body;

  // ── ACTION: verify password (called from command-list.html unlock) ──
  if (action === 'verify') {
    const { password } = body;
    if (!password) return res.status(400).json({ error: 'No password provided' });

    // Get all password keys
    const keys = await kvKeys('cmdpw:*');
    if (!keys.length) return res.status(403).json({ error: 'No passwords configured' });

    for (const key of keys) {
      const pw = await kvGet(key);
      if (!pw || !pw.hash || !pw.salt) continue;

      // Check expiry (belt-and-suspenders, KV TTL also handles it)
      if (pw.expiresAt && Date.now() > new Date(pw.expiresAt).getTime()) continue;

      // Verify: SHA-256(salt + password)
      const attempt = sha256(pw.salt + password);
      if (timingSafeEqual(attempt, pw.hash)) {
        // Issue session token
        const tokenSecret = process.env.TOKEN_SECRET || 'fallback';
        const hourSlot = Math.floor(Date.now() / (1000 * 60 * 60)).toString();
        const token = crypto.createHmac('sha256', tokenSecret).update('unlock:' + hourSlot).digest('hex');

        const response = { ok: true, token, label: pw.label || 'Password' };
        if (pw.expiresAt) {
          const daysLeft = Math.ceil((new Date(pw.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24));
          response.daysLeft = daysLeft;
          response.expiresAt = pw.expiresAt;
        }
        return res.status(200).json(response);
      }
    }

    await new Promise(r => setTimeout(r, 500)); // slow brute force
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // ── All other actions require admin auth ──
  const { username, password: adminPass } = body;
  if (!verifyAdmin(username, adminPass)) {
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── ACTION: list — get all stored passwords ──
  if (action === 'list') {
    const keys = await kvKeys('cmdpw:*');
    const passwords = [];
    for (const key of keys) {
      const pw = await kvGet(key);
      if (!pw) continue;
      const isExpired = pw.expiresAt && Date.now() > new Date(pw.expiresAt).getTime();
      passwords.push({
        id: key.replace('cmdpw:', ''),
        label: pw.label || 'Unnamed',
        expiresAt: pw.expiresAt || null,
        isExpired,
        createdAt: pw.createdAt || null,
      });
    }
    // Sort by creation date newest first
    passwords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ ok: true, passwords });
  }

  // ── ACTION: add — create a new password ──
  if (action === 'add') {
    const { newPassword, label, expiryDays } = body;
    if (!newPassword) return res.status(400).json({ error: 'No password provided' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Password too short (min 4 chars)' });

    const salt = genSalt();
    const hash = sha256(salt + newPassword);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const createdAt = new Date().toISOString();

    let expiresAt = null;
    let ttlSeconds = null;

    if (expiryDays && expiryDays > 0) {
      expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      // Auto-delete from KV 7 days AFTER expiry
      ttlSeconds = (expiryDays + 7) * 24 * 60 * 60;
    }

    const entry = { hash, salt, label: label || 'Password', createdAt, expiresAt };
    await kvSet(`cmdpw:${id}`, entry, ttlSeconds);

    return res.status(200).json({
      ok: true,
      id,
      label: entry.label,
      expiresAt,
      createdAt,
      message: 'Password added successfully'
    });
  }

  // ── ACTION: delete — remove a password ──
  if (action === 'delete') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'No id provided' });
    await kvDel(`cmdpw:${id}`);
    return res.status(200).json({ ok: true, message: 'Password deleted' });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
