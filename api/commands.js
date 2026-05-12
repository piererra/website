// api/commands.js — Serves CMD_DATA only after verifying session token
// Token is issued by /api/passwords after successful password verification

const crypto = require('crypto');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://piererra.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

// Must match TOKEN_WINDOW_MS in api/passwords.js
const TOKEN_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function isValidToken(token, secret) {
  const now = Math.floor(Date.now() / TOKEN_WINDOW_MS);
  // Accept current slot and previous slot (handles edge case at slot boundary)
  for (const slot of [now, now - 1]) {
    const expected = crypto
      .createHmac('sha256', secret)
      .update('unlock:' + slot.toString())
      .digest('hex');
    try {
      if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return true;
    } catch {}
  }
  return false;
}

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

  const { token } = body;
  const tokenSecret = process.env.TOKEN_SECRET;
  if (!tokenSecret) return res.status(500).json({ error: 'TOKEN_SECRET not configured' });
  if (!token)       return res.status(400).json({ error: 'No token provided' });

  if (!isValidToken(token, tokenSecret)) {
    return res.status(401).json({ error: 'Session expired. Please unlock again.' });
  }

  const commandsData = process.env.COMMANDS_DATA;
  if (!commandsData) return res.status(500).json({ error: 'COMMANDS_DATA not configured' });

  let parsed;
  try { parsed = JSON.parse(commandsData); }
  catch { return res.status(500).json({ error: 'COMMANDS_DATA is not valid JSON' }); }

  return res.status(200).json({ ok: true, data: parsed });
};
