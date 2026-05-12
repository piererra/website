<div align="center">

# ✦ Piererra

**Your go-to source for Android private server game info.**
Guides, changelogs, and updates — all in one place.

[![Live Site](https://img.shields.io/badge/Live%20Site-piererra.vercel.app-4975FE?style=for-the-badge&logo=vercel&logoColor=white)](https://piererra.vercel.app)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Hosted on GitHub](https://img.shields.io/badge/Hosted%20on-GitHub-181717?style=for-the-badge&logo=github)](https://github.com)

</div>

---

## 🎮 About

**Piererra** is a lightweight, fast, and fully static website built for the Android private server gaming community. No frameworks, no heavy dependencies — just clean HTML, CSS, and JavaScript, powered by a JSON file and a few Vercel serverless API routes.

Posts publish directly to GitHub and go **live in ~30 seconds** via Vercel's automatic deployment.

---

## ✨ Features

- 🌌 **Holographic hero** — animated gradient text with a breathing glow effect
- 🌫️ **Vanta.js FOG background** — real-time WebGL volumetric fog that responds to mouse, touch, and gyroscope
- 📰 **Post system** — publish guides, changelogs, and news with a rich-text editor
- ⭐ **Featured marquee** — toggle any post to appear in the scrolling featured bar
- 🔐 **Password-protected GM Command List** — multi-password support with expiry, stored in Upstash KV
- 🛡️ **Secure admin panel** — hidden URL admin page for managing posts and passwords
- 📱 **Mobile-first** — fully responsive on all screen sizes
- 🚀 **Auto-deploy** — push to GitHub → live on Vercel in seconds

---

## 🗂 File Structure

```
piererra/
│
├── index.html                  ← Main public site (single-page)
├── command-list.html           ← Password-protected GM command list page
├── admin-passage.html          ← Hidden admin panel (post editor + password manager)
│
├── css/
│   └── style.css               ← All styling for index.html
│
├── js/
│   ├── main.js                 ← All JavaScript for index.html (posts, hero, marquee)
│   └── commands.js             ← (legacy reference, logic now in api/commands.js)
│
├── json/
│   ├── data.json               ← Posts + games database (pushed to GitHub by admin)
│   ├── items.json              ← Item ID reference list for GM command modal
│   └── monsters.json           ← Monster ID reference list for GM command modal
│
├── api/
│   ├── save.js                 ← Serverless: admin login + GitHub push (writes data.json)
│   ├── passwords.js            ← Serverless: GM password verify/add/delete via Upstash KV
│   └── commands.js             ← Serverless: serves GM command data after token verification
│
├── vercel.json                 ← Vercel config: smart cache-control headers per file type
└── README.md                   ← This file
```

---

## 📄 File Descriptions

### Frontend

| File | Description |
|------|-------------|
| `index.html` | The main public-facing page. Renders posts, featured marquee, hero section, and game cards. Fetches `json/data.json` on load. |
| `command-list.html` | A password-protected page showing all GM commands. Unlocks via `/api/passwords`, then fetches command data from `/api/commands` using a short-lived HMAC token. Includes searchable Item ID and Monster ID modals. Shows password expiry banner after unlock. |
| `admin-passage.html` | The hidden admin panel. Requires username + password (verified via `/api/save`). Lets you write/edit/delete posts with a rich-text editor, manage featured posts, and manage GM command list passwords. Auto-logs out after 30 minutes of inactivity. |
| `css/style.css` | All styling for `index.html` — variables, layout, hero, post cards, marquee, modals, and responsive breakpoints. |
| `js/main.js` | All client-side JavaScript for `index.html` — fetches data, renders posts, handles the featured marquee, post modal, and Vanta.js background. |

### Data

| File | Description |
|------|-------------|
| `json/data.json` | Flat-file database for the public site. Contains `posts` (title, content, date, slug, featured, draft) and `games` arrays. Written by the admin panel via GitHub API. CDN-cached for 30 seconds. |
| `json/items.json` | Array of `{ id, name }` objects for every in-game item. Loaded by `command-list.html` for the Item ID reference modal. CDN-cached for 24 hours. |
| `json/monsters.json` | Array of `{ id, name, type, level }` objects for monsters (including MVP and Mini-boss flags). Loaded by `command-list.html` for the Monster ID reference modal. CDN-cached for 24 hours. |

### API (Vercel Serverless Functions)

| File | Description |
|------|-------------|
| `api/save.js` | Handles admin `login` and `save` actions. Verifies admin credentials from Vercel env vars. On save, uses the GitHub API to commit `data.json` directly to the repo. |
| `api/passwords.js` | Manages GM command list passwords stored in Upstash KV. Supports `verify` (public — checks a password, enforces IP rate limiting, and returns a 30-min HMAC token), `list`, `add`, and `delete` (admin-only). Passwords are salted SHA-256 hashed. |
| `api/commands.js` | Serves the GM command JSON data only after validating the HMAC session token issued by `/api/passwords`. Token is valid for 30 minutes. |

### Config

| File | Description |
|------|-------------|
| `vercel.json` | Smart cache-control per file type: HTML always `no-store`, `data.json` cached 30s on CDN, `items.json` and `monsters.json` cached 24h on CDN, API routes always `no-store`. |

---

## 🔑 Environment Variables

Set these in your Vercel project dashboard under **Settings → Environment Variables**:

| Variable | Used By | Description |
|----------|---------|-------------|
| `ADMIN_USERNAME` | `api/save.js`, `api/passwords.js` | Admin panel username |
| `ADMIN_PASSWORD` | `api/save.js`, `api/passwords.js` | Admin panel password |
| `GITHUB_TOKEN` | `api/save.js` | Personal access token with `repo` scope |
| `GITHUB_REPO` | `api/save.js` | Your repo in `username/repo-name` format |
| `GITHUB_FILE_PATH` | `api/save.js` | Path to data file, e.g. `json/data.json` |
| `STORAGE_KV_REST_API_URL` | `api/passwords.js` | Upstash KV REST URL |
| `STORAGE_KV_REST_API_TOKEN` | `api/passwords.js` | Upstash KV REST token |
| `TOKEN_SECRET` | `api/passwords.js`, `api/commands.js` | Secret for signing HMAC session tokens |
| `COMMANDS_DATA` | `api/commands.js` | JSON string of GM command categories and commands |

---

## 🚀 How It Works

```
Write a post in admin-passage.html
  → Click "Push to GitHub"
    → api/save.js commits data.json to GitHub
      → Vercel auto-deploys
        → Live in ~30 seconds ⚡
```

```
Visit command-list.html
  → Enter GM password
    → api/passwords.js checks IP rate limit + verifies password
      → Issues a 30-min HMAC token
        → api/commands.js validates token + returns COMMANDS_DATA
          → Commands render in the browser 🔐
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Markup | HTML5 |
| Styling | CSS3 (custom, no framework) |
| Logic | Vanilla JavaScript |
| Data | JSON (flat file database) |
| Background | Vanta.js FOG (WebGL) |
| Icons | Font Awesome 6 |
| Fonts | Sora + DM Sans (Google Fonts) |
| API | Vercel Serverless Functions (Node.js) |
| KV Store | Upstash KV (REST API) |
| Hosting | Vercel |
| Source | GitHub |

---

## 📦 Setup

1. **Fork or clone** this repo
2. Connect it to [Vercel](https://vercel.com) — import the GitHub repo and deploy
3. Set all **environment variables** in Vercel dashboard (see table above)
4. Create an **Upstash KV database** at [upstash.com](https://upstash.com) and copy the REST URL + token
5. Generate a **GitHub personal access token** with `repo` scope
6. Visit your live site at your Vercel URL

---

## 📋 Changelog

> Click any version to expand its changes.

---

<details>
<summary><strong>v1.4 — Security & Performance</strong> &nbsp;✦&nbsp; <em>Current version</em></summary>
<br>

**🔒 Security**
- Added IP-based rate limiting on `/api/passwords` verify — max 10 attempts per IP per 5 minutes, counter stored in Upstash KV with hashed IP (raw IP never stored)
- Tightened HMAC session token window from ~2 hours → **30 minutes** in both `api/passwords.js` and `api/commands.js`
- Added **admin auto-logout** after 30 minutes of inactivity in `admin-passage.html` — shows a sliding countdown warning with 30 seconds to cancel before signing out
- Lockout state on `command-list.html` lock screen now persists across page refreshes via `sessionStorage` (previously reset on refresh)

**⚡ Performance**
- Tuned `vercel.json` cache headers per file type:
  - `*.html` → `no-store` (always fresh, unchanged)
  - `json/data.json` → `s-maxage=30` (30s CDN cache, posts still live in ~30s after deploy)
  - `json/items.json` + `json/monsters.json` → `s-maxage=86400` (24h CDN cache, static reference data)
  - `/api/*` → `no-store` (explicitly blocked from any caching)

**🎨 UI**
- Replaced all emoji in `command-list.html` and `admin-passage.html` with Font Awesome icons for sharper, consistent rendering across all devices
- Removed online/offline status dot from featured marquee in `main.js` (no toggle UI existed anywhere)
- Styled expiry duration buttons in admin panel — now a 4-column grid with color-coded active states (green = no expiry, orange = short, blue = normal, purple = custom)
- Added password expiry banner on `command-list.html` after unlock — shows expiry date + days remaining pill that turns red when ≤1 day left

**🧹 Cleanup**
- Removed `"status"` field from `json/data.json` game objects (unused after marquee status dot removal)

</details>

---

<details>
<summary><strong>v1.3 — Bug Fixes & Code Cleanup</strong></summary>
<br>

- **Fixed** duplicate `let CMD_DATA`, `let GM_ITEMS`, `let GM_MONSTERS` declarations in `command-list.html` that caused a JavaScript crash in strict mode
- **Removed** dead `sha256hex()` function in `command-list.html` (leftover from old client-side password system, never called)
- **Fixed** duplicate `||` fallback in `getKV()` inside `api/passwords.js` (copy-paste error, same env var repeated)
- **Removed** stale `cmdPassword` and `cmdData` fields from `json/data.json` (remnants of the old password system, no longer used)
- **Removed** stale `data.cmdPassword` guard in `loadLocal()` inside the admin panel (legacy code from old client-side password architecture)
- **Renamed** admin panel from `73hjx82hzj2ihs2.html` → `admin-passage.html`

</details>

---

<details>
<summary><strong>v1.2 — GM Command List + Password System</strong></summary>
<br>

- Added `command-list.html` — password-protected page for GM commands
- Added `api/passwords.js` — full password management via Upstash KV (add, delete, list, verify with expiry support)
- Added `api/commands.js` — token-gated endpoint that serves GM command data
- Added Item ID modal with paginated, searchable list (loaded from `json/items.json`)
- Added Monster ID modal with MVP/Mini-boss badges (loaded from `json/monsters.json`)
- Added expiry system for GM passwords (1d / 3d / 7d / 14d / 30d / custom / no expiry)
- Added HMAC session token system — token valid for ~2 hours after unlock
- Password lock screen with attempt limiting and 30-second lockout after 5 failures

</details>

---

<details>
<summary><strong>v1.1 — Admin Panel</strong></summary>
<br>

- Added hidden admin panel (`admin-passage.html`) for managing posts without touching code
- Added `api/save.js` — serverless function for admin login and GitHub file push
- Added rich-text post editor with toolbar (bold, italic, headings, lists, links, images, blockquote, code)
- Added Visual / HTML toggle mode in editor
- Added post draft / publish workflow
- Added featured post toggle (controls marquee appearance on main site)
- Added Passwords tab in admin for managing GM command list access
- Added toast notification system in admin panel
- Added mobile-responsive admin layout (table → card view on small screens)

</details>

---

<details>
<summary><strong>v1.0 — Initial Release</strong></summary>
<br>

- Launched **Piererra** — static site for Android private server gaming community
- Built `index.html` as a single-page site with hero section, post cards, and featured marquee
- Built `css/style.css` — full custom styling with CSS variables, dark theme, and responsive breakpoints
- Built `js/main.js` — fetches `json/data.json`, renders posts, handles featured marquee and post modal
- Added Vanta.js FOG WebGL background (mouse/touch/gyroscope responsive)
- Added `json/data.json` as flat-file database for posts and games
- Deployed on Vercel with GitHub as source — auto-deploys on every push
- Added `vercel.json` with no-cache headers for HTML and JSON files

</details>

---

## 📄 License

This project is for personal/informational use only.

> © 2026 Piererra — For informational purposes only.
> All game names and trademarks belong to their respective owners.

---

<div align="center">

Made with 💙 for the Android private server gaming community

**[piererra.vercel.app](https://piererra.vercel.app)**

</div>
