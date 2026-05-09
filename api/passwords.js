// api/passwords.js — Password management via Upstash KV
const crypto = require('crypto');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://piererra.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function sha256(str) { return crypto.createHash('sha256').update(str).digest('hex'); }
function genSalt()   { return crypto.randomBytes(32).toString('hex'); }
function timingSafeEqual(a, b) {
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
}

// Supports both KV_REST_API_* and STORAGE_KV_REST_API_* env var names
function getKV() {
  return {
    url:   process.env.KV_REST_API_URL   || process.env.STORAGE_KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.STORAGE_KV_REST_API_TOKEN,
  };
}

async function kvGet(key) {
  const { url, token } = getKV();
  const res  = await fetch(`${url}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!data.result) return null;
  return JSON.parse(data.result);
}

async function kvSet(key, value, ttlSeconds = null) {
  const { url, token } = getKV();
  const cmd = ttlSeconds ? ['SET', key, JSON.stringify(value), 'EX', ttlSeconds] : ['SET', key, JSON.stringify(value)];
  const res = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify([cmd])
  });
  return res.ok;
}

async function kvDel(key) {
  const { url, token } = getKV();
  await fetch(`${url}/del/${encodeURIComponent(key)}`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
}

async function kvKeys(pattern) {
  const { url, token } = getKV();
  const res  = await fetch(`${url}/keys/${encodeURIComponent(pattern)}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data.result || [];
}

function verifyAdmin(username, password) {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  if (!envUser || !envPass) return false;
  return timingSafeEqual(sha256(username || ''), sha256(envUser)) &&
         timingSafeEqual(sha256(password || ''), sha256(envPass));
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { url: kvUrl, token: kvToken } = getKV();
  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'KV not configured. Connect Upstash to your project in Vercel Storage, then redeploy.' });
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const { action } = body;

  // ── verify (called from command-list.html) ──
  if (action === 'verify') {
    const { password } = body;
    if (!password) return res.status(400).json({ error: 'No password provided' });
    const keys = await kvKeys('cmdpw:*');
    if (!keys.length) return res.status(403).json({ error: 'No passwords configured' });
    for (const key of keys) {
      const pw = await kvGet(key);
      if (!pw || !pw.hash || !pw.salt) continue;
      if (pw.expiresAt && Date.now() > new Date(pw.expiresAt).getTime()) continue;
      if (timingSafeEqual(sha256(pw.salt + password), pw.hash)) {
        const secret   = process.env.TOKEN_SECRET || 'fallback';
        const hourSlot = Math.floor(Date.now() / (1000 * 60 * 60)).toString();
        const token    = crypto.createHmac('sha256', secret).update('unlock:' + hourSlot).digest('hex');
        const resp = { ok: true, token, label: pw.label || 'Password' };
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

  // ── admin actions — require credentials ──
  const { username, password: adminPass } = body;
  if (!verifyAdmin(username, adminPass)) {
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // list
  if (action === 'list') {
    const keys = await kvKeys('cmdpw:*');
    const passwords = [];
    for (const key of keys) {
      const pw = await kvGet(key);
      if (!pw) continue;
      passwords.push({
        id: key.replace('cmdpw:', ''),
        label: pw.label || 'Unnamed',
        expiresAt: pw.expiresAt || null,
        isExpired: pw.expiresAt ? Date.now() > new Date(pw.expiresAt).getTime() : false,
        createdAt: pw.createdAt || null,
      });
    }
    passwords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ ok: true, passwords });
  }

  // add
  if (action === 'add') {
    const { newPassword, label, expiryDays } = body;
    if (!newPassword)          return res.status(400).json({ error: 'No password provided' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Password too short (min 4 chars)' });
    const salt      = genSalt();
    const hash      = sha256(salt + newPassword);
    const id        = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const createdAt = new Date().toISOString();
    let expiresAt   = null;
    let ttlSeconds  = null;
    if (expiryDays && expiryDays > 0) {
      expiresAt  = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      ttlSeconds = (expiryDays + 7) * 24 * 60 * 60;
    }
    await kvSet(`cmdpw:${id}`, { hash, salt, label: label || 'Password', createdAt, expiresAt }, ttlSeconds);
    return res.status(200).json({ ok: true, id, label: label || 'Password', expiresAt, createdAt });
  }

  // delete
  if (action === 'delete') {
    const { id } = body;
    if (!id) return res.status(400).json({ error: 'No id provided' });
    await kvDel(`cmdpw:${id}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
};
