// api/passwords.js — Password management via Upstash KV REST API

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

function safeEqual(a, b) {
  try {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch { return false; }
}

function getKV() {
  return {
    url:   process.env.STORAGE_KV_REST_API_URL   || process.env.STORAGE_KV_REST_API_URL   || '',
    token: process.env.STORAGE_KV_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN || '',
  };
}

// ── KV REST helpers ────────────────────────────────────────
async function kvGet(key) {
  const { url, token } = getKV();
  const res  = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.result === null || data.result === undefined) return null;
  try { return JSON.parse(data.result); } catch { return null; }
}

async function kvSet(key, value, ttlSeconds = null) {
  const { url, token } = getKV();
  // Use pipeline for atomic SET + EXPIRE
  const cmds = [['SET', key, JSON.stringify(value)]];
  if (ttlSeconds) cmds.push(['EXPIRE', key, ttlSeconds]);
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return res.ok;
}

async function kvDel(key) {
  const { url, token } = getKV();
  await fetch(`${url}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
}

// Use SCAN to find all cmdpw:* keys (safer than KEYS in production)
async function kvScan(pattern) {
  const { url, token } = getKV();
  let keys = [];
  let cursor = 0;
  do {
    const res = await fetch(`${url}/scan/${cursor}?match=${encodeURIComponent(pattern)}&count=100`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.result) break;
    cursor = parseInt(data.result[0]) || 0;
    keys = keys.concat(data.result[1] || []);
  } while (cursor !== 0);
  return keys;
}

function verifyAdmin(username, password) {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  if (!envUser || !envPass) return false;
  return safeEqual(sha256(username || ''), sha256(envUser)) &&
         safeEqual(sha256(password || ''), sha256(envPass));
}

// ── Handler ───────────────────────────────────────────────
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

  const { url: kvUrl, token: kvToken } = getKV();
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'KV not configured. Check STORAGE_KV_REST_API_URL and STORAGE_KV_REST_API_TOKEN in Vercel env vars.' });
  }

  const { action } = body;

  // ── verify — called from command-list.html ──────────────
  if (action === 'verify') {
    const { password } = body;
    if (!password) return res.status(400).json({ error: 'No password provided' });

    let keys;
    try { keys = await kvScan('cmdpw:*'); }
    catch (e) { return res.status(500).json({ error: 'KV scan failed: ' + e.message }); }

    if (!keys.length) return res.status(403).json({ error: 'No passwords configured' });

    for (const key of keys) {
      let pw;
      try { pw = await kvGet(key); } catch { continue; }
      if (!pw || !pw.hash || !pw.salt) continue;
      if (pw.expiresAt && Date.now() > new Date(pw.expiresAt).getTime()) continue;

      const attempt = sha256(pw.salt + password);
      if (safeEqual(attempt, pw.hash)) {
        const secret   = process.env.TOKEN_SECRET || 'fallback';
        const hourSlot = Math.floor(Date.now() / (1000 * 60 * 60)).toString();
        const token    = crypto.createHmac('sha256', secret).update('unlock:' + hourSlot).digest('hex');
        const resp     = { ok: true, token, label: pw.label || 'Password' };
        if (pw.expiresAt) {
          resp.daysLeft  = Math.ceil((new Date(pw.expiresAt) - Date.now()) / (1000 * 60 * 60 * 24));
          resp.expiresAt = pw.expiresAt;
        }
        return res.status(200).json(resp);
      }
    }

    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // ── Admin-only actions require auth ─────────────────────
  const { username, password: adminPass } = body;
  if (!verifyAdmin(username, adminPass)) {
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── list ─────────────────────────────────────────────────
  if (action === 'list') {
    let keys;
    try { keys = await kvScan('cmdpw:*'); }
    catch (e) { return res.status(500).json({ error: 'KV scan failed: ' + e.message }); }

    const passwords = [];
    for (const key of keys) {
      let pw;
      try { pw = await kvGet(key); } catch { continue; }
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
    passwords.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return res.status(200).json({ ok: true, passwords });
  }

  // ── add ──────────────────────────────────────────────────
  if (action === 'add') {
    const { newPassword, label, expiryDays } = body;
    if (!newPassword) return res.status(400).json({ error: 'No password provided' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Password too short (min 4 chars)' });

    const salt      = genSalt();
    const hash      = sha256(salt + newPassword);
    const id        = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const createdAt = new Date().toISOString();
    const expiresAt = expiryDays && expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const ttlSeconds = expiresAt ? (expiryDays + 7) * 24 * 60 * 60 : null;

    await kvSet(`cmdpw:${id}`, { hash, salt, label: label || 'Password', createdAt, expiresAt }, ttlSeconds);
    return res.status(200).json({ ok: true, id, label, expiresAt, createdAt });
  }

  // ── delete ───────────────────────────────────────────────
  if (action === 'delete') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'No id provided' });
    await kvDel(`cmdpw:${id}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
