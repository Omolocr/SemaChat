# SemaChat — chat, community & life planner

```
semachat/
  semachat-preview.html   <- open in any browser: full app, no install (mock backend in-page)
  backend/core.js       <- all API logic + seed data (runs in Node AND in the preview)
  backend/server.js     <- zero-dependency Node server: REST + realtime (SSE) + JSON-file storage
  frontend/index.html   <- one source, built into TWO separate apps: the Client app (phone view) and the Developer Console
  build.js              <- rebuilds semachat-preview.html after you edit core.js / index.html
```

## Run the real backend
    cd backend && node server.js      # http://localhost:3000

Client app: 0700 111 222, code 123ABC (or sign up). Developer Console: its own page (`semachat-console-preview.html`, or `/console` on the server), admin@semachat.app (demo code 123ABC; the developer console signs in by emailed code, no password).

## Rebuild the preview
    node build.js

## What exists now
- Sign up / sign in with name, phone, backup email (+ "Lost phone?" recovery by email)
- Chats: text, voice notes, photos, videos (2 min cap), files, contact cards, location, music, voice/video/conference calls, groups
- Contacts: friend requests, people search, AnA (reels, own Tube, analytics, paid Business posts)
- Explore: business and entertainment
- Me: wallet, financial services, shopping, travel partners (flights, trains, buses, taxis, hotels, restaurants), business plans
- Life Planner: tasks, goals, habits
- Developer dashboard: overview, users, revenue & fees, moderation, app controls (maintenance, feature switches, fees, broadcasts), partners, audit log

## Still mocked (next steps)
Email delivery (set SMTP_HOST/SMTP_USER/SMTP_PASS for login1@wavehub.co.ke), WebRTC calls, media storage, payments (M-Pesa etc.), push notifications, a real database (swap the JSON file for Postgres).

## Dual-Mode: Normal / Business (one identity, two modes)
Implemented from the DUAL-1..9 spec, mapped onto this zero-dependency stack
(in-memory state + JSON file instead of Prisma/Redis/BullMQ/ClickHouse).

- **Mode widget** at the top of the app: Normal | Business, with per-mode badges and a Register / Continue / Resubmit CTA.
- **Gating**: Business is hidden behind registration; every `/api/biz/*` call returns `BIZ_ACCOUNT_REQUIRED` with a CTA. Public welcome, guest preview (rate limited), category waitlist and concierge endpoints.
- **Mode-scoped chats** (customer sees Normal, owner sees Business), cross-mode AI assistant, shared team inbox, customer phone hidden until first order, auto-archive.
- **Mode-scoped notifications**: silent cross-mode delivery, urgent bypass, 15-minute batching, DND per mode.
- **Peek**: inspect or reply inline without switching; auto-switch preference (`always` / `critical_only` / `never`).
- **Shared wallet**: one balance, mode-tagged ledger, cross-mode transfers, revenue dashboard, VAT invoices, payouts, CSV export.
- **Developer dashboard**: Business verification (approve / reject / suspend), admin mode override (audited), Mode analytics, weekly report.
- **Demo helpers**: "Simulate customers" buttons in Business mode create orders, reviews, calls and messages.

Run the tests:

    node backend/test/dual-mode.test.js     # 24 backend tests incl. load test
    python3 tests/ui-test.py && python3 tests/ui-test-dual.py   # browser tests (Playwright)

Header `X-SemaChat-Mode` (and `X-SemaChat-Device`) is honoured by the real server; the preview uses the stored mode.

## Business build-out (add-on)

Adds the full Business Mode commerce layer on top of Dual-Mode:

- **Business page / mini-app**: public page with follow, message-business chat, catalog (products, services, videos), reviews with owner replies.
- **Orders**: customers pay from their wallet (escrow-style); declined orders are refunded automatically; "My orders" (Me tab) with reviews and disputes (14-day window).
- **Ad marketplace**: owners create campaigns (budget paid upfront), admin approves/rejects, delivery appears as Sponsored cards in Explore; unspent budget refunded on stop; "Simulate a day" for demos.
- **Business analytics**: views, funnel, revenue, top sellers, ratings, repeat customers, ad cost per order; "Load sample history" button.
- **Admin**: Ad review and Disputes sections in the developer console.

Files: `backend/business.js`, `frontend/business-ui.js`. Tests: `node --test backend/test/*.test.js` (34), `tests/ui-test.py`, `tests/ui-test-dual.py`, `tests/ui-test-business.py`, `tests/ui-test-business-owner.py` (Playwright, after `node build.js`).

## Adjustments (identity, bank, Moments, safety)

- **Sign-up requirements** per account type (Personal / Corporate / Institution); under-18s need a guardian, who gets a linked second account.
- **Badges:** yellow (no ID), green (ID submitted), gold (ID + paid, no ads). **Location locator** with on/off switch.
- **Wallet activation** opens a bank account (SemaChat Trust Bank, demo); behaviour-based Trust Score; loans from the bank and vetted lenders; records kept by SemaChat and the lender.
- **Moments** ring above Chats (20-second clips, up to 10 min, 24 h life, reactions + comments, business link-outs) and **Super Moments** (3-5 min) in Contacts → AnA; upload from album or camera.
- **Profile** has Normal / Business widgets. **Chats show no ticks, last-seen or online status.**
- **Developer dashboard:** People (gender, age group, residence, last active, last action), Safety & minors, Money alerts, Bank & loans.
- Safety detection and money rules are transparent demo heuristics, not production classifiers.

Tests: `backend/test/compliance.test.js`, `tests/ui-test-adjust.py`.

## Batch 3: Exercise & Health, DIRA Music, Donations, On the move!, DIRA TECH apps
New backend modules (`health.js`, `music.js`, `community.js`) and UI add-ons (`frontend/health-ui.js`, `music-ui.js`, `community-ui.js`, injected at `<!--EXT-->`).

- **Exercise & Health** (AnA quick row + pinned in Chats): step recorder that recognises stroll / walk / brisk / jog / run / sprint from cadence, activity type and calories (MET × kg × hours); heart-rate meter; breath-hold lung report; BMI / obesity advice or "clean bill of health"; water, sleep, blood-pressure logs, guided breathing and a daily health score. Wellness guidance only, never a diagnosis. API: `/api/wellness/*`.
- **DIRA Music**: 300,000-track cloud catalogue in 24 genres (artist, band, title everywhere), SD-card/local files with ID3 tags, 40+ equalizer presets, 10-band EQ, noise reduction, clarity, super bass, moods, effects and a volume expander up to 300% with a limiter and hearing warning. Demo audio is synthesised on-device; set `settings.musicCdn` (Developer Console → DIRA Music) to stream real files from `{cdn}/{genre}/{n}.mp3`. API: `/api/music/*`.
- **Me footnote + DIRA TECH apps**: footnote always shown; "Also from DIRA TECH" appears only after the developer activates an app (Dashboard → DIRA TECH apps). Tap opens the app by deep link, else the download page.
- **Moments line-up**: one straight scrolling line, loads more on scroll (`/api/moments?offset&limit`), contacts first then business moments.
- **Donations**: appeals need the whole 8-item verification list; they go live only after check 1 (documents) AND check 2 (visit or video call) pass in the Developer Console. Images and videos accepted. Cards appear at intervals in Chats, Explore, AnA and Business home. No platform fee.
- **On the move!**: quick 3-hour adverts for registered outlets (normal or business account), photos + pin, priced KES 100 per 50 sq m in Nairobi/Kisumu/Nakuru/Mombasa/Eldoret and KES 50 elsewhere (editable in the dashboard), shown only inside the paid area.
- Production notes: media is stored as data URLs in the demo; use object storage for real deployments. Feature switches: `health`, `music`, `donations`, `onthemove`.

## Infrastructure (calls, providers, compliance, deployment)
- Real WebRTC calls (1:1 and group mesh) signalled over the app's own SSE stream, TURN/STUN from env, optional LiveKit tokens.
- Provider adapters: email verification codes (Resend) and M-Pesa Daraja STK push, each with a flagged demo fallback; signed session tokens.
- Compliance: consent recorded at sign-up, pluggable classifier hook, audited developer access to sensitive records.
- Deployment: JSON or SQLite storage, `/healthz` and `/readyz`, production refuses to start in demo configuration, Dockerfile, `docker-compose.yml` + Caddy HTTPS, `.env.example`. See DEPLOY.md.
- Tests: `node --test backend/test/*.test.js` and the `ui-test*.py` Playwright suites (run after `node build.js`).

- **Auth (latest):** email-only sign-up and sign-in for users AND the developer console (no phone, no password). The app emails a 6-character code (capital letters + numbers) from login1@wavehub.co.ke, valid 5 minutes, one use, 5 tries. Once signed in the app stays signed in, even when closed or unused, until the person taps Sign out / change account. Phone is an optional profile field.

- **Content guard (developer):** words, slang, phrases, place names and restricted zones kept in Developer Console → Content guard. Matches are stopped before delivery: in chat the sender still sees the message marked "Not delivered" and nobody else receives it; posts, comments, captions and adverts are refused. Disguised spellings are normalised; every change is audit-logged; the hit list is flagged as personal data in the Access audit. It is a word list, not an AI. Add a real moderation service with `core.compliance.addClassifier`.


## Two separate apps
- **Client app** (`/`, `semachat-preview.html`): phone home screen, SemaChat icon, opening video, then the app. It has no way to reach the developer console and the console screens are not part of its page.
- **Developer Console** (`/console`, `semachat-console-preview.html`): its own page and sign-in (token kept under a different key from the client's). No toggle between the two.
- In production set `SEMACHAT_CONSOLE_HOST=console.yourdomain.com`: the console page and every `/api/admin/*` route then answer only on that host (404 elsewhere), so you can put it behind a VPN or IP allow-list.
- In the two preview files the data is shared through the browser's local storage when both are opened from the same folder; reload the other page to see changes.


## Research team access and installing
See **DEV-ACCESS.md**: the free team entry pass (private link, no sign-in), team sign-in for both consoles (development only), installing the app on phones, tablets and desktops (`/install`), and a checklist for sign-in problems (`/readyz`, `node backend/tools/check-email.js`).
