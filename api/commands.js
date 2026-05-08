// api/commands.js — Vercel Serverless Function
// Serves CMD_DATA only after verifying the command-list password hash.
// The commands never exist in any public file — stored in COMMANDS_DATA env var.

const crypto = require('crypto');

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://piererra.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Never cache this response
  res.setHeader('Cache-Control', 'no-store');
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

  const { salt, hash } = body;

  if (!salt || !hash) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  // Load the stored password config from data.json on GitHub
  // We re-fetch it here so password changes apply immediately
  const ghToken = process.env.GITHUB_TOKEN;
  const ghOwner = process.env.GITHUB_OWNER;
  const ghRepo  = process.env.GITHUB_REPO;

  let cmdPassword = null;
  try {
    const r = await fetch(
      `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/json/data.json`,
      {
        headers: {
          'Authorization': `token ${ghToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Piererra-Admin',
        }
      }
    );
    if (r.ok) {
      const file = await r.json();
      const decoded = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
      cmdPassword = decoded.cmdPassword || null;
    }
  } catch (e) {
    return res.status(500).json({ error: 'Could not load password config' });
  }

  // No password set
  if (!cmdPassword || !cmdPassword.hash || !cmdPassword.salt) {
    return res.status(403).json({ error: 'Password not set' });
  }

  // Verify: the client sends the stored salt+hash from data.json
  // We just confirm they match what's stored — the client already did SHA-256(salt+password)
  // Double-check server-side that the hash matches
  const storedHash = cmdPassword.hash;
  const storedSalt = cmdPassword.salt;

  // Timing-safe compare
  let hashMatch = false;
  try {
    hashMatch = crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(storedHash)
    );
  } catch {
    hashMatch = false;
  }

  let saltMatch = false;
  try {
    saltMatch = crypto.timingSafeEqual(
      Buffer.from(salt),
      Buffer.from(storedSalt)
    );
  } catch {
    saltMatch = false;
  }

  if (!hashMatch || !saltMatch) {
    // Delay to slow brute force
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Verified — serve commands ──
  const commandsData = process.env.COMMANDS_DATA;
  if (!commandsData) {
    return res.status(500).json({ error: 'COMMANDS_DATA env var not set' });
  }

  let parsed;
  try {
    parsed = JSON.parse(commandsData);
  } catch {
    return res.status(500).json({ error: 'COMMANDS_DATA is not valid JSON' });
  }

  return res.status(200).json({ ok: true, data: parsed });
};
