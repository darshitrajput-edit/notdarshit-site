# Darshit Playz — Video Editor Portfolio

A full portfolio website: public site with categories, a video viewer, and an
emoji reaction system, plus a private admin dashboard to add, edit, publish,
and delete your edits — all backed by a real server and a database file, not
hardcoded into the page.

## What's inside

```
darshit-portfolio/
├── server/              Express backend + JSON database
│   ├── server.js        App entry point
│   ├── db.js            Tiny file-based database (server/data/db.json)
│   ├── routes/          auth, projects, settings, upload
│   └── uploads/         Self-hosted thumbnails/videos land here
├── public/              The website itself (served by the backend)
│   ├── index.html       Public portfolio page
│   ├── admin.html        Private admin dashboard
│   ├── css/, js/
├── scripts/hash-password.js   One-time helper to set your admin password
└── .env.example
```

## 1. Install

You'll need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
```

## 2. Set up your admin login

```bash
cp .env.example .env
npm run create-admin
```

`create-admin` asks you to type a password and prints a line like:

```
ADMIN_PASSWORD_HASH=$2a$12$....
```

Paste that into your `.env` file. Also set `ADMIN_USERNAME` in `.env` to
whatever username you want to log in with, and set `JWT_SECRET` to a long
random string (the `.env.example` file shows a command that generates one).
Your real password is never stored anywhere — only its hash.

## 3. Run it

```bash
npm start
```

- Public site: http://localhost:4000
- Admin dashboard: http://localhost:4000/admin

For auto-restart while editing code: `npm run dev` (uses nodemon).

## 4. Replace the placeholder content

Everything the brief asked to be easy to replace lives in one of two places:

- **Log into `/admin` → Site Settings** to change your name, tagline, about
  text, profile photo, Gmail, Instagram, Discord invite, accent color, and
  skills — no code editing required.
- **Log into `/admin` → Portfolio Projects** to add/edit/delete edits,
  assign categories, upload thumbnails, and publish or unpublish.

The seed data (`server/data/db.json`) ships with one example project per
category and placeholder thumbnails so you can see the layout immediately —
delete or edit them from the admin dashboard.

## How the pieces work

**Categories** are defined in `server/data/db.json` under `categories`. To
add a new category, add `{ "slug": "your-slug", "name": "Your Category" }` to
that array (there's no UI for this yet, since the seven from the brief cover
most cases — ask if you'd like an admin screen for it too).

**Videos** can come from three sources, chosen per project in the admin form:
- **YouTube / Vimeo link** (recommended) — paste the normal watch URL or just
  the ID. This is what most real editor portfolios use: free hosting,
  adaptive streaming, no bandwidth cost to you.
- **Direct video URL** — if you already host files somewhere (Cloudflare
  Stream, Bunny, S3, etc.), paste the link.
- **Upload a file** — stores the file on the server itself under
  `server/uploads/videos`. Fine for a small number of clips on a VPS with
  enough disk space; it does **not** scale well for many/large videos on
  typical hosting platforms (see Deployment notes below), which is why
  YouTube/Vimeo is the recommended default.

**Reactions** (🔥 Best / 👍 Good / 👎 Bad) are stored per project in the
database. Each visitor gets a random ID saved in their browser; the server
hashes it before storing it, and remembers which reaction (if any) that
visitor left on each project, so refreshing the page or spamming the button
doesn't inflate the count. There's also a short per-IP rate limit as a second
layer. This isn't unbeatable (someone can clear their browser storage), but
it stops the "obvious repeated spam" the brief asked to guard against without
requiring visitor accounts.

**Admin auth** uses a signed login token (JWT) that expires after 12 hours by
default (`TOKEN_EXPIRY` in `.env`). There's a login attempt limiter to slow
down password guessing. This is a single-admin setup — there's no visitor
sign-up anywhere, and the admin routes all check the token server-side, not
just in the page.

## Deployment

This is a normal Node.js + Express app, so it runs on most hosts. A simple,
inexpensive path:

1. **Push this folder to a Git repo** (GitHub/GitLab).
2. **Deploy the backend** on something like Render, Railway, or a small VPS.
   Set the same environment variables from your `.env` in the host's
   dashboard (never commit `.env` itself).
3. Point your domain at it.

Two things to plan for as you grow:

- **Database**: `server/data/db.json` works well for a personal portfolio,
  but a JSON file doesn't survive most "serverless"/ephemeral hosts (the file
  resets on redeploy) and isn't built for concurrent writes at scale. If you
  outgrow it, `server/db.js` is the only file that touches storage — swap its
  `read`/`update` functions for calls to Postgres/MongoDB/etc. and every
  route stays the same. Managed free tiers exist on Supabase, Neon, and
  MongoDB Atlas if/when you need this.
- **Self-hosted video files**: if you use the "Upload a file" option, make
  sure your host has persistent disk storage (a VPS, or a platform with a
  persistent volume) and enough space/bandwidth — video files are large.
  For most editors, linking to YouTube/Vimeo avoids this entirely and is
  what's recommended above.

## Customizing the look

Colors, fonts, spacing, and the radius of cards all come from CSS variables
at the top of `public/css/style.css`:

```css
:root {
  --accent: #ff5c39;   /* also editable live from Site Settings */
  --bg: #0a0b0e;
  --surface: #14161c;
  ...
}
```

The design leans on a "timeline scrubber" strip under the header — a nod to
a video editor's timeline ruler — which doubles as a scroll-progress bar and
section navigator. It's in `.scrub` in the CSS and wired up in
`public/js/main.js`.

## Known limitations (by design, for a v1)

- Categories are edited in the JSON file, not the admin UI yet.
- No password-reset flow for the admin account — if you forget your
  password, run `npm run create-admin` again and update `.env`.
- The reaction "anti-spam" is browser-based, not account-based (see above).
- No automated image/video compression — upload reasonably-sized files, or
  use YouTube/Vimeo, which handle that for you.

None of these block using the site day-to-day; they're the natural places to
extend it later.
