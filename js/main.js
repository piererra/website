/* ============================================================
   PIERERRA — js/main.js
   ============================================================ */

let allData     = { posts: [], games: [] };
let sortedPosts = [];

// ── HELPERS ────────────────────────────────────────────────

function formatDate(str) {
  if (!str) return '';
  return new Date(str + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── LOAD DATA ──────────────────────────────────────────────

async function loadData() {
  try {
    const res = await fetch('json/data.json?v=' + Date.now());
    if (!res.ok) throw new Error();
    allData = await res.json();
    if (!allData.posts) allData.posts = [];
    if (!allData.games) allData.games = [];
  } catch (e) {
    allData = { posts: [], games: [] };
  }
  renderFeatured(allData.games);
  renderPosts(allData.posts);
  handleDeepLink();
}

// ── FEATURED MARQUEE ───────────────────────────────────────

function renderFeatured(games) {
  const track   = document.getElementById('marquee-track');
  const popular = games.filter(g => g.popular === true || g.popular === 'true');

  if (!popular.length) {
    track.innerHTML = '<span class="marquee-loading">No featured games yet</span>';
    return;
  }

  // Triplicate items so the seamless loop never shows a gap
  const items = popular.map(g => {
    const dot = g.status === 'online' ? '🟢' : '⚫';
    const tag = g.tag ? ' · ' + esc(g.tag) : '';
    return `<span class="mq-item" onclick='handleGameClick(${JSON.stringify(g).replace(/'/g, "&#39;")})'>${dot} ${esc(g.name)}${tag}</span><span class="mq-sep">✦</span>`;
  }).join('');

  track.innerHTML = items + items + items;
}

function handleGameClick(g) {
  if (g.url && g.url !== '#') { window.open(g.url, '_blank'); return; }
  const match = allData.posts.find(
    p => p.game && p.game.toLowerCase() === g.name.toLowerCase() && !p.draft
  );
  if (match) openPost(match);
}

// ── POSTS LIST ─────────────────────────────────────────────

function renderPosts(posts) {
  const container = document.getElementById('posts-list');
  const visible   = posts.filter(p => !p.draft);

  if (!visible.length) {
    container.innerHTML = '<div class="posts-empty">No posts yet. Check back soon.</div>';
    return;
  }

  sortedPosts = [...visible].sort((a, b) => new Date(b.date) - new Date(a.date));

  container.innerHTML = sortedPosts.map((post, i) => `
    <div class="post-item" onclick="openPost(sortedPosts[${i}])">
      <div class="post-content">
        <div class="post-game">${esc(post.game || '')}</div>
        <div class="post-title">${esc(post.title)}</div>
        <div class="post-date">${formatDate(post.date)}</div>
      </div>
      <div class="post-arrow">→</div>
    </div>
  `).join('');
}

// ── OPEN POST ──────────────────────────────────────────────

function openPost(post) {
  if (!post) return;

  const slug = post.slug || String(post.id);
  history.pushState({ postId: post.id }, '', '#post/' + slug);

  document.getElementById('pp-title').textContent = post.title || '';
  document.getElementById('pp-game').textContent  = post.game  || '';
  document.getElementById('pp-date').textContent  = formatDate(post.date);
  document.getElementById('pp-body').innerHTML    = post.content || '<p>No content yet.</p>';

  const idx  = sortedPosts.findIndex(p => p.id === post.id);
  const prev = idx > 0                      ? sortedPosts[idx - 1] : null;
  const next = idx < sortedPosts.length - 1 ? sortedPosts[idx + 1] : null;
  const nav  = document.getElementById('pp-nav');

  nav.innerHTML = (prev || next) ? `
    <div class="post-nav-label">More Posts</div>
    <div class="post-nav-links">
      ${prev ? `<div class="post-nav-link" onclick="openPost(sortedPosts[${idx - 1}])">
                  <div class="post-nav-dir">← Previous</div>
                  <div class="post-nav-title">${esc(prev.title)}</div>
                </div>` : ''}
      ${next ? `<div class="post-nav-link" onclick="openPost(sortedPosts[${idx + 1}])">
                  <div class="post-nav-dir">Next →</div>
                  <div class="post-nav-title">${esc(next.title)}</div>
                </div>` : ''}
    </div>` : '';

  document.getElementById('home-page').style.display = 'none';
  document.getElementById('post-page').style.display = 'block';
  document.title = (post.title || 'Post') + ' — Piererra';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── GO HOME ────────────────────────────────────────────────

function goHome() {
  document.getElementById('post-page').style.display = 'none';
  document.getElementById('home-page').style.display = 'block';
  history.pushState({}, '', location.pathname);
  document.title = 'Piererra — Android Private Server Games';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── DEEP LINK ──────────────────────────────────────────────

function handleDeepLink() {
  const hash = location.hash;
  if (!hash.startsWith('#post/')) return;
  const slug = hash.replace('#post/', '');
  const post = allData.posts.find(
    p => (p.slug === slug || String(p.id) === slug) && !p.draft
  );
  if (post) openPost(post);
}

window.addEventListener('popstate', () => {
  if (!location.hash.startsWith('#post/')) goHome();
  else handleDeepLink();
});

// ── BOOT ───────────────────────────────────────────────────
loadData();
