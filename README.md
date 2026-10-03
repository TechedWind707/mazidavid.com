# mazidavid.com

One Vercel project serves five sites, picked by hostname (see `vercel.json`):

| Host | Folder | What |
|---|---|---|
| mazidavid.com | `hub/` | The front door: links to everything |
| work.mazidavid.com | `work/` | Portfolio / resume as a website (projects from the database) |
| me.mazidavid.com | `me/` | Personal board (markdown notes, tagged posts/photos, visitor wall) |
| services.mazidavid.com | `services/` | Mazi Services |
| work.mazidavid.com/admin | `admin/` | Login-protected editor for projects, notes and visitor notes |

`gallery.mazidavid.com` (photo-gallery repo, GitHub Pages) and `blog.mazidavid.com` (Hashnode) live elsewhere but share `assets/eco-nav.js`.

## How the data flows

- `assets/content.js` holds everything as a **fallback**. Pages render from it instantly.
- Then they call the API (`/api/projects`, `/api/board`) and re-render with live data from **Neon Postgres**.
- You edit the live data at **work.mazidavid.com/admin**.

## API (`api/`)

| Route | Who | What |
|---|---|---|
| `GET /api/projects` | public | visible projects |
| `GET /api/board` | public | board notes + approved visitor notes |
| `POST /api/board` | public | leave a visitor note (held for approval) |
| `GET/POST /api/auth` | you | login (password + 6-digit TOTP), logout |
| `/api/admin?r=projects\|notes\|visitors\|audit` | you | edit everything |

### Security, in one list
- Password stored as a **scrypt hash**; login also needs a **TOTP code** from your authenticator app; used codes can't be replayed.
- Session = **HMAC-signed `__Host-` cookie**: HttpOnly, Secure, SameSite=Strict, 8 hours, tied to your browser.
- **Rate limits**: 5 logins / 15 min per IP, 20 / hour overall; 3 visitor notes / hour per IP.
- **Origin checks + JSON-only bodies** on every change (stops cross-site request forgery).
- Admin page: strict **Content-Security-Policy**, `noindex`, can't be framed, only served on work.mazidavid.com.
- Database user `site_web` can only read/write these five tables (it can't create or drop anything).
- Visitor notes are plain text, no links, and invisible until approved. IPs are stored only as keyed hashes.
- Every login and change is logged (Admin → Activity).

### Environment variables (Vercel → Settings → Environment Variables)
| Name | What |
|---|---|
| `DATABASE_URL` | Neon connection string for the `site_web` role |
| `ADMIN_PASSWORD_HASH` | from `npm run secrets` |
| `ADMIN_TOTP_SECRET` | from `npm run secrets` (also goes in your authenticator app) |
| `SESSION_SECRET` | from `npm run secrets`; changing it logs everyone out |

Change your password: `npm run secrets -- "your new long password" --keep-totp`, then update `ADMIN_PASSWORD_HASH` (and `SESSION_SECRET`) in Vercel and redeploy.

## Run locally
```powershell
npm install
$env:DATABASE_URL="..."; $env:ADMIN_ORIGINS="http://localhost:3000"; $env:PUBLIC_ORIGINS="http://localhost:3000"
$env:SESSION_SECRET="..."; $env:ADMIN_PASSWORD_HASH="..."; $env:ADMIN_TOTP_SECRET="..."
node scripts/dev-server.mjs
```

## Resume
`assets/David-Nsofor-Resume.pdf`, built from `scripts/resume-source.html` (print it to PDF from Chrome, Letter size). `/resume` and the old `/Downloads/...` link both redirect to it.
