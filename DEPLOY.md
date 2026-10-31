# Deploying SemaChat

Zero npm dependencies. Node 22+ recommended (needed for SQLite storage; Node 18+ works with JSON storage).

## Quick start (Docker + automatic HTTPS)
    cp .env.example .env        # fill it in (see below)
    # edit Caddyfile: put your domain in place of your-domain.example
    docker compose up -d

The Client app is served at `/` and the Developer Console at `/console` (separate pages). Set `SEMACHAT_CONSOLE_HOST` to serve the console and `/api/admin/*` only on a separate hostname.

## Plain Node
    NODE_ENV=production SEMACHAT_SECRET=... SEMACHAT_ADMIN_EMAILS=you@company.com SMTP_HOST=... SMTP_USER=login1@wavehub.co.ke SMTP_PASS=... node backend/server.js

## Safe by default
In `NODE_ENV=production` the server **refuses to start** while any of these is still in demo state: `SEMACHAT_SECRET` (24+ chars), the developer email list (`SEMACHAT_ADMIN_EMAILS`), or the email sender (otherwise anyone can sign in with the public demo code 123ABC). `SEMACHAT_ALLOW_DEMO=1` overrides this for staging only. Outside production it starts but prints what is still demo.

## Environment variables
| Variable | Purpose |
|---|---|
| `SEMACHAT_SECRET` | Signs sessions, OTP hashes and the M-Pesa callback key |
| `SEMACHAT_ADMIN_EMAILS` | Developer Console: the emails allowed in (comma separated). They sign in with an emailed code, no password |
| `SEMACHAT_DB` | Storage: `/data/semachat.json` (atomic + backup) or `/data/semachat.sqlite` (crash-safe, Node 22+) |
| `SEMACHAT_ORIGIN`, `SEMACHAT_TRUST_PROXY=1` | CORS origin; trust `X-Forwarded-For` behind Caddy/nginx |
| `SMTP_HOST`, `SMTP_PORT` (465), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | The app mailbox **login1@wavehub.co.ke** that sends every login code (users and developers). `SMTP_SECURE=ssl\|starttls\|none` (default: ssl on 465, starttls otherwise). Alternative: `RESEND_API_KEY` |
| `MPESA_*` | Real wallet top-ups (Daraja STK push); without them top-ups are simulated |
| `SEMACHAT_STUN`, `SEMACHAT_TURN_URL/USER/CRED` | Call connectivity; TURN is needed for strict networks |
| `LIVEKIT_URL/API_KEY/API_SECRET` | Optional: server-side conference calls (the app issues the tokens) |

## Health checks
`GET /healthz` (alive) and `GET /readyz` (storage reachable). The Dockerfile already uses `/healthz`.

## What is real and what still needs your accounts
- Real now: signed sessions, consent records, audited developer access, rate limits, WebRTC call signalling, atomic/SQLite storage.
- Needs your credentials: email sending (Resend), M-Pesa (Safaricom Daraja), TURN/LiveKit. Everything falls back to a clearly flagged demo mode.
- Needs your infrastructure for scale: object storage/CDN for photos, videos and music (`settings.musicCdn`), and PostgreSQL or similar if you outgrow SQLite (implement `{kind, load, save, close}` in `backend/storage.js`).
- Health guidance, safety/money monitoring and moderation classifiers are demo heuristics; plug a real moderation service in with `core.compliance.addClassifier`.

## Sign-in
Users sign up and sign in with **email only**: SemaChat emails a 6-character code (capital letters and numbers, valid 5 minutes, one use, 5 tries, 30 s resend limit) from login1@wavehub.co.ke. The Developer Console uses the same email-code login. Sessions never expire; people stay signed in until they tap Sign out / change account. Phone is an optional profile field (used for M-Pesa). Sessions never expire: a person stays signed in, even when inactive, until they choose Sign out. Changing `SEMACHAT_SECRET` signs everyone out, so keep it stable.


## Setting up login1@wavehub.co.ke
1. Create the mailbox `login1@wavehub.co.ke` at your host (cPanel/Zoho/Google Workspace etc.) and note its SMTP server, port and password.
2. Put them in `.env` as `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER=login1@wavehub.co.ke`, `SMTP_PASS`.
3. In your DNS add SPF and DKIM (and DMARC) for `wavehub.co.ke` so codes land in the inbox, not spam.
4. Start the server: the startup banner shows `email: live (email codes from login1@wavehub.co.ke)`.


## Team access, install page, diagnostics
- `SEMACHAT_TEAM_ACCESS`, `SEMACHAT_TEAM_EMAILS`, `SEMACHAT_TEAM_CODE`: development-only sign-in for the research team (off by default). See DEV-ACCESS.md.
- `/install`: install instructions page for phones, tablets and desktops. `/readyz` reports mailbox health. `node backend/tools/check-email.js [address]` tests the mailbox.
- Behind a proxy on the same machine or private network the real visitor address is read from `X-Forwarded-For` automatically (`SEMACHAT_TRUST_PROXY=1` forces it, `0` disables it).
