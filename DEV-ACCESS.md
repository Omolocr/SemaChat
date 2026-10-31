# SemaChat: research team access, installing the app, and fixing "nobody can sign in"

For the development and research team only. Real clients sign in with the emailed code (see DEPLOY.md).

## 1. Give the research team free access (both consoles)

On the server, edit `.env` and add:

```
SEMACHAT_TEAM_ACCESS=1
SEMACHAT_TEAM_EMAILS=amina@wavehub.co.ke,joseph@wavehub.co.ke,research3@wavehub.co.ke
SEMACHAT_TEAM_CODE=PUT-A-LONG-CODE-HERE
```

- Make the code with `openssl rand -hex 6 | tr a-f A-F` (10 to 32 letters/numbers; hyphens and spaces are ignored).
- Share the code with the team **privately** (not in a public chat or repository).
- Restart: `docker compose up -d --force-recreate semachat` (or restart `node backend/server.js`).
- The startup log must show `TEAM ACCESS IS ON for N email(s)`. `https://YOUR-SITE/readyz` shows `"teamAccess": true`.

How a team member signs in (no email is sent):

| Where | Steps |
|---|---|
| **Client app** (`https://YOUR-SITE/`) | Sign in, type your team email, tap *Email me a verification code* (nothing is emailed, it tells you to use the team code), type the **team code**, *Verify & sign in*. First visit creates a test account for you automatically. |
| **Developer console** (`https://YOUR-SITE/console`) | Type your team email, *Email me a code*, type the **team code**, *Verify & sign in*. |

Good to know:
- Only the emails you list work. Any other email with the team code is refused.
- 10 wrong codes lock that email for 15 minutes.
- Team members stay signed in until they tap **Sign out / change account**.
- Team sign-ins and automatically created test accounts are written to the console's **Audit log**.
- Team members get **full developer console power**. List only trusted staff.
- Test accounts are flagged as team accounts. In the client app, *Me* has a demo switch for Personal / Corporate / Institution, and Business mode can be tried from the Business widget.
- **Before real clients arrive:** delete `SEMACHAT_TEAM_ACCESS` (or set it empty) and restart. Everyone then uses emailed codes only.

## 2. Install the app on phones, tablets and computers

Send the team this page: **`https://YOUR-SITE/install`**. It shows the steps for the device it is opened on.

- **Android phone/tablet (Chrome):** open the site, tap the green *Install SemaChat* bar (or the menu, then *Install app*).
- **iPhone/iPad (Safari):** open the site, tap *Share*, then *Add to Home Screen*.
- **Windows/Mac/Linux (Chrome or Edge):** open the site and click the install icon at the right end of the address bar.
- The **client app** (`/`) and the **developer console** (`/console`) install as two separate apps with their own icons.
- Opening the installed client app plays the globe animation, then the landing page.
- The site must be served over **HTTPS** (a real domain with a certificate; the provided Caddy setup does this) or browsers will not offer installation.

This is a web app that installs like a normal app (no store needed). If the team later needs `.apk` / Play Store / App Store packages, wrap the live URL with PWABuilder (pwabuilder.com) or Bubblewrap; that needs your own developer accounts and signing keys.

## 3. "Nobody can sign in": find the cause in 5 minutes

Do these in order:

1. **Is the server healthy?** Open `https://YOUR-SITE/readyz`. Look at `email`:
   - `"mode":"demo"` means **no mailbox is configured**: codes are never sent. Set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (the `login1@wavehub.co.ke` mailbox) in `.env`.
   - `"ok":false` with a `lastError` means the server **cannot log in to the mailbox** (wrong password or port, or your host blocks the connection).
   - `"ok":true` means the mailbox works; look at step 3.
2. **Test the mailbox directly** (sends nothing unless you give an address):
   ```
   docker compose exec semachat node backend/tools/check-email.js you@example.com
   ```
   It tells you if login works and sends a real test email. Check the **spam folder** too, and add SPF and DKIM for `wavehub.co.ke` at your DNS host so codes land in the inbox.
   Port 465 uses SSL; for port 587 set `SMTP_SECURE=starttls`. Many hosts need an "app password" for the mailbox.
3. **Are people locked out by the rate limit?** Behind Caddy/Docker all visitors can look like one address. The server now reads the real visitor address from the proxy automatically. If you use a proxy on another machine, set `SEMACHAT_TRUST_PROXY=1`.
4. **Wrong place to sign in?** New people must use **Sign up** first; *Sign in* only works for existing accounts.
5. **Meanwhile, work anyway:** switch on team access (section 1) so the research team can keep working while the mailbox is fixed.

Read the server log with `docker compose logs --tail=100 semachat`. The first lines say clearly whether email is working, and whether team access is on.
