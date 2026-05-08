// api/save.js — Vercel Serverless Function
// Handles: admin login verification + GitHub push
// All secrets (GitHub token, admin credentials) live in Vercel Environment Variables.
// Nothing sensitive is ever sent to the browser.

const crypto = require('crypto');

// ── Timing-safe string compare to prevent timing attacks ──
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

// ── CORS headers ──
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://piererra.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  cors(res);

  // Handle preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { action, username, password } = body;

  // ── Verify admin credentials against env vars ──
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;

  if (!envUser || !envPass) {
    return res.status(500).json({ error: 'Server not configured. Set ADMIN_USERNAME and ADMIN_PASSWORD in Vercel env vars.' });
  }

  const userMatch = safeEqual(sha256(username || ''), sha256(envUser));
  const passMatch = safeEqual(sha256(password || ''), sha256(envPass));

  if (!userMatch || !passMatch) {
    // Small delay to slow brute force
    await new Promise(r => setTimeout(r, 500));
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // ── LOGIN only — just verify credentials ──
  if (action === 'login') {
    return res.status(200).json({ ok: true });
  }

  // ── SAVE — push data.json to GitHub ──
  if (action === 'save') {
    const { content } = body;

    if (!content) return res.status(400).json({ error: 'No content provided' });

    const ghToken = process.env.GITHUB_TOKEN;
    const ghOwner = process.env.GITHUB_OWNER;
    const ghRepo  = process.env.GITHUB_REPO;

    if (!ghToken || !ghOwner || !ghRepo) {
      return res.status(500).json({ error: 'GitHub env vars not set. Add GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO.' });
    }

    const apiUrl = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/json/data.json`;
    const headers = {
      'Authorization': `token ${ghToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Piererra-Admin',
    };

    // Get current SHA
    let sha = null;
    try {
      const getRes = await fetch(apiUrl, { headers });
      if (getRes.ok) sha = (await getRes.json()).sha;
    } catch (e) {
      return res.status(500).json({ error: 'Failed to fetch current file from GitHub' });
    }

    // Push updated file
    const encoded = Buffer.from(content).toString('base64');
    try {
      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: 'Update data via Piererra Admin',
          content: encoded,
          ...(sha ? { sha } : {}),
        }),
      });

      if (putRes.ok) {
        return res.status(200).json({ ok: true, message: 'Pushed to GitHub successfully' });
      } else {
        const err = await putRes.json();
        return res.status(500).json({ error: `GitHub error: ${err.message}` });
      }
    } catch (e) {
      return res.status(500).json({ error: 'Network error pushing to GitHub' });
    }
  }

  return res.status(400).json({ error: 'Unknown action' });
};
