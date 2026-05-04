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

**Piererra** is a lightweight, fast, and fully static website built for the Android private server gaming community. No frameworks, no databases — just clean HTML, CSS, and JavaScript powered by a single JSON file.

Posts are written and managed through a custom-built admin panel and pushed directly to GitHub, going **live in ~30 seconds** via Vercel's automatic deployment.

---

## ✨ Features

- 🌌 **Holographic hero** — animated gradient text with a breathing glow effect
- 📰 **Post system** — publish guides, changelogs, and news with a rich text editor
- ⭐ **Featured marquee** — toggle any post to appear in the scrolling featured bar
- 🛠 **Custom admin panel** — full post editor with Visual / HTML mode toggle
- 🧹 **Clean paste** — strips foreign styles when copying text from other sites
- 🔗 **Link modal** — insert links with custom text, open-in-new-tab option, and remove button
- 🖼 **Image modal** — insert images with alt text, caption, and live preview
- 📱 **Mobile-first** — fully responsive on all screen sizes
- ⚡ **Zero backend** — everything runs from `data.json`, no server required
- 🚀 **Auto-deploy** — push to GitHub → live on Vercel in seconds

---

## 🗂 File Structure

```
piererra/
├── index.html          ← Main site (single-page)
├── admin.html          ← Admin panel (post editor)
├── css/
│   └── style.css       ← All styling
├── js/
│   └── main.js         ← All JavaScript
└── json/
    └── data.json       ← Posts database
```

---

## 🚀 How It Works

```
You write a post in admin.html
        ↓
Click "Push to GitHub"
        ↓
data.json updates in the repo
        ↓
Vercel detects the change
        ↓
Site is live in ~30 seconds ⚡
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom, no framework) |
| Logic | Vanilla JavaScript |
| Data | JSON (flat file database) |
| Icons | Font Awesome 6 |
| Fonts | Sora + DM Sans (Google Fonts) |
| Hosting | Vercel |
| Source | GitHub |

---

## ✏️ Admin Panel

The built-in admin panel at `/admin.html` lets you:

- ✅ Create, edit, and delete posts
- ✅ Toggle **Featured** on any post (shows in the marquee)
- ✅ Switch between **Visual** and **HTML** editor modes
- ✅ Insert links with custom text + open-in-new-tab
- ✅ Insert images with caption and live preview
- ✅ Save drafts or publish directly
- ✅ Push everything to GitHub with one button

> ⚠️ The admin panel is protected by a local password. Never commit your GitHub token to the repo.

---

## 📦 Setup

1. **Fork or clone** this repo
2. Connect it to [Vercel](https://vercel.com) — import the GitHub repo and deploy
3. Open `admin.html` in your browser
4. Enter your **GitHub token**, **username**, and **repo name** in the settings
5. Start writing posts!

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
