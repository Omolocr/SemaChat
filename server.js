/* SemaChat backend — zero-dependency Node server.
 * REST API + Server-Sent Events (chat, calls signalling) + pluggable storage + optional email / M-Pesa providers.
 * Run:  node backend/server.js      (see DEPLOY.md for every environment variable)
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const core = require('./core');
require('./business')(core);
require('./compliance')(core);   // identity, safety, bank/loans, Moments, consent, audited developer access
require('./health')(core);       // Exercise & Health
require('./music')(core);        // DIRA Music
require('./community')(core);    // DIRA TECH apps, donations, On the move!
require('./guard')(core);        // developer content guard (words, places, restricted zones)
require('./realtime')(core);     // WebRTC call signalling (+ LiveKit token)
const storage = require('./storage');
const providers = require('./providers')(core, process.env, console);
const session = require('./session')(process.env.SEMACHAT_SECRET || '');

const env = process.env, PROD = env.NODE_ENV === 'production';
const PORT = env.PORT || 3000;
const DB_FILE = env.SEMACHAT_DB || path.join(__dirname, 'data.json');
const FRONT = path.join(__dirname, '..', 'frontend', 'index.html');
const assets = require('./assets');
const EXT = ['health-ui.js', 'music-ui.js', 'community-ui.js', 'calls-ui.js', 'ops-ui.js', 'guard-ui.js'];
const read = f => fs.readFileSync(path.join(__dirname, '..', 'frontend', f), 'utf8');
// developer console sign-in is by emailed code; these are the addresses allowed in (comma separated)
const adminList = String(env.SEMACHAT_ADMIN_EMAILS || env.SEMACHAT_ADMIN_EMAIL || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
if (adminList.length) core.ADMIN.emails = adminList;
// development team access (OFF unless SEMACHAT_TEAM_ACCESS=1): listed team emails sign in to BOTH the client app and the developer console
// with one shared team code, no email needed. For staging / research only: switch it off before real clients arrive.
const teamEmails = String(env.SEMACHAT_TEAM_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
const teamCode = String(env.SEMACHAT_TEAM_CODE || '').replace(/[\s-]+/g, '').toUpperCase();
const teamPass = String(env.SEMACHAT_TEAM_PASS || '').replace(/[\s-]+/g, '').toUpperCase();
let teamNote = '';
if (env.SEMACHAT_TEAM_PASS) { if (/^[A-Z0-9]{16,64}$/.test(teamPass)) core.TEAM.pass = teamPass; else teamNote = 'SEMACHAT_TEAM_PASS must be 16-64 letters/numbers (hyphens ignored): team entry pass stays OFF.'; }
if (env.SEMACHAT_TEAM_ACCESS === '1') {
  if (!teamEmails.length) teamNote = 'SEMACHAT_TEAM_ACCESS=1 but SEMACHAT_TEAM_EMAILS is empty: team access stays OFF.';
  else if (!/^[A-Z0-9]{10,32}$/.test(teamCode)) teamNote = 'SEMACHAT_TEAM_CODE must be 10-32 letters/numbers (no spaces or symbols): team access stays OFF.';
  else { core.TEAM.enabled = true; core.TEAM.emails = teamEmails; core.TEAM.code = teamCode; }
}

/* ---- startup checks: say loudly what is still in demo mode, and refuse to run a public server that is wide open ---- */
const problems = [], notes = [];
if (!env.SEMACHAT_SECRET) problems.push('SEMACHAT_SECRET is not set: session tokens are guessable. Set a long random string.');
if (env.SEMACHAT_SECRET && env.SEMACHAT_SECRET.length < 24) problems.push('SEMACHAT_SECRET is shorter than 24 characters.');
if (!adminList.length) problems.push('Developer console still allows the demo address admin@semachat.app. Set SEMACHAT_ADMIN_EMAILS to your own email address(es).');
if (!providers.cfg.email) problems.push('No email provider: sign-up and sign-in use the public demo code 123ABC. Set SMTP_HOST, SMTP_USER and SMTP_PASS for the login1@wavehub.co.ke mailbox (or RESEND_API_KEY).');
if (!providers.cfg.mpesa) notes.push('M-Pesa is not configured: wallet top-ups are simulated (instant, no real money).');
if (!env.SEMACHAT_TURN_URL) notes.push('No TURN server: calls work on most networks but can fail behind strict NATs. Set SEMACHAT_TURN_URL for reliable calls.');
if (problems.length) {
  const head = PROD ? 'REFUSING TO START (NODE_ENV=production):' : 'DEMO MODE. Fine for testing, NOT safe for real users:';
  console.warn('\n⚠️  ' + head + '\n' + problems.map(p => '   - ' + p).join('\n'));
  if (PROD && env.SEMACHAT_ALLOW_DEMO !== '1') { console.error('\nFix the items above, or set SEMACHAT_ALLOW_DEMO=1 to override (not recommended).'); process.exit(1); }
}
notes.forEach(n => console.warn('ℹ️  ' + n));

/* ---- storage ---- */
const store = storage.open(DB_FILE);
let db = null; try { db = store.load(); } catch (e) { console.error('Could not read the database: ' + e.message); process.exit(1); }
if (!db || db.v !== 2) db = core.seed();
let saveTimer = null, dirty = false;
const flush = () => { clearTimeout(saveTimer); saveTimer = null; if (!dirty) return; try { store.save(db); dirty = false; } catch (e) { console.error('SAVE FAILED: ' + e.message); } };
const save = () => { dirty = true; if (!saveTimer) saveTimer = setTimeout(flush, 150); };
dirty = true; flush();

/* ---- realtime (SSE): userId -> Set(res) ---- */
const streams = new Map();
core.hooks.emit = (userId, evt) => { (streams.get(userId) || []).forEach(res => { try { res.write('data: ' + JSON.stringify(evt) + '\n\n'); } catch (e) { /* closed */ } }); };
core.hooks.persist = save;
setInterval(() => streams.forEach(set => set.forEach(res => { try { res.write(': hb\n\n'); } catch (e) { /* closed */ } })), 25000).unref();

/* ---- tiny rate limiter (per IP, in memory) ---- */
const hits = new Map();
const limited = (ip, bucket, max) => {
  const k = bucket + '|' + ip, now = Date.now(), h = hits.get(k);
  if (!h || now > h.reset) { hits.set(k, { n: 1, reset: now + 60000 }); return false; }
  return ++h.n > max;
};
setInterval(() => { const now = Date.now(); hits.forEach((h, k) => { if (now > h.reset) hits.delete(k); }); }, 60000).unref();

const HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Permissions-Policy': 'microphone=(self), camera=(self), geolocation=(self), accelerometer=(self), gyroscope=(self)' };
const ORIGIN = env.SEMACHAT_ORIGIN || '*';
const send = (res, status, data, ctype) => { res.writeHead(status, Object.assign({ 'Content-Type': ctype || 'application/json', 'Access-Control-Allow-Origin': ORIGIN }, HEADERS)); res.end(JSON.stringify(data)); };
// Behind Caddy/nginx/Docker every request arrives from the proxy's own address. Trust X-Forwarded-For when the proxy is on this machine or a private network
// (or when SEMACHAT_TRUST_PROXY=1), otherwise all users would share ONE rate-limit bucket and get locked out together.
const isPrivate = a => /^(::1|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.))/i.test(String(a || ''));
const ipOf = req => { const direct = req.socket.remoteAddress || 'local', fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return ((env.SEMACHAT_TRUST_PROXY === '1' || (env.SEMACHAT_TRUST_PROXY !== '0' && isPrivate(direct))) && fwd) || direct; };
const MAX_BODY = 14 * 1048576;     // photos and video thumbnails travel as data URLs

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, Object.assign({ 'Access-Control-Allow-Origin': ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SemaChat-Mode, X-SemaChat-Device', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }, HEADERS));
    return res.end();
  }
  const url = new URL(req.url, 'http://x'), ip = ipOf(req);

  // brand assets: icon, opening video, web app manifest
  if (url.pathname === '/manifest.webmanifest') return send(res, 200, assets.MANIFEST, 'application/manifest+json');
  if (url.pathname === '/console.webmanifest') return send(res, 200, assets.CONSOLE_MANIFEST, 'application/manifest+json');
  if (url.pathname === '/sw.js') { res.writeHead(200, Object.assign({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' }, HEADERS)); return res.end(read('sw.js')); }
  if (url.pathname === '/team' || url.pathname === '/team/') { res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }, HEADERS)); return res.end(read('team.html')); }
  if (url.pathname === '/install' || url.pathname === '/install/') { res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, HEADERS)); return res.end(read('install.html')); }
  if (url.pathname.startsWith('/assets/')) {
    const f = path.basename(url.pathname), ext = path.extname(f), fp = path.join(assets.DIR, f);
    if (!assets.TYPES[ext] || !fs.existsSync(fp)) return send(res, 404, { error: 'not found' });
    res.writeHead(200, Object.assign({ 'Content-Type': assets.TYPES[ext], 'Cache-Control': 'public, max-age=86400' }, HEADERS)); return fs.createReadStream(fp).pipe(res);
  }

  // health checks for load balancers / Docker / uptime monitors
  if (url.pathname === '/healthz') return send(res, 200, { ok: true, app: 'SemaChat', uptimeSec: Math.round(process.uptime()) });
  if (url.pathname === '/readyz') {
    let ready = !!db && Array.isArray(db.users); let detail = store.kind;
    try { if (store.kind === 'json') fs.accessSync(path.dirname(DB_FILE), fs.constants.W_OK); } catch (e) { ready = false; detail = 'storage not writable'; }
    return send(res, ready ? 200 : 503, { ready, storage: detail, users: ready ? db.users.length : 0, email: { mode: providers.health.mode, ok: providers.health.ok, lastError: providers.health.lastError }, teamAccess: core.TEAM.enabled, teamPass: !!core.TEAM.pass });
  }

  if (url.pathname === '/api/stream') {
    const tok = session.verify(url.searchParams.get('token') || '');
    const user = tok && db.users.find(u => 'tok_' + u.id === tok);
    if (!user) return send(res, 401, { error: 'Please sign in.' });
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }, HEADERS));
    res.write('retry: 3000\n\n');
    if (!streams.has(user.id)) streams.set(user.id, new Set());
    streams.get(user.id).add(res);
    req.on('close', () => streams.get(user.id).delete(res));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    const ch = String(env.SEMACHAT_CONSOLE_HOST || '').toLowerCase();
    if (ch && url.pathname.startsWith('/api/admin') && String(req.headers.host || '').split(':')[0].toLowerCase() !== ch) return send(res, 404, { error: 'not found' });
    const isAuth = /^\/api\/(auth|team|admin\/(signin|otp))/.test(url.pathname);
    if (limited(ip, isAuth ? 'auth' : 'api', isAuth ? 20 : 900)) return send(res, 429, { error: 'Too many requests. Please wait a minute and try again.' });
    const chunks = []; let size = 0, dead = false;
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { dead = true; send(res, 413, { error: 'That upload is too large.' }); req.destroy(); } else chunks.push(c); });
    req.on('end', () => {
      if (dead) return;
      const raw = Buffer.concat(chunks).toString('utf8'); let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch (e) { return send(res, 400, { error: 'Invalid JSON' }); }
      const token = session.verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
      const hdrs = Object.assign({}, req.headers, { 'x-client-ip': ip });
      const out = core.handle(db, req.method, url.pathname + url.search, body, token, hdrs);
      if (out.data && typeof out.data.token === 'string' && out.data.token.startsWith('tok_')) out.data.token = session.sign(out.data.token);
      if (out.data && typeof out.data.adminToken === 'string' && out.data.adminToken.startsWith('tok_')) out.data.adminToken = session.sign(out.data.adminToken);
      if (req.method !== 'GET') save();
      send(res, out.status, out.data);
    });
    return;
  }

  // two separate front ends: the client app at "/" and the developer console at "/console".
  // Set SEMACHAT_CONSOLE_HOST (e.g. console.example.com) to serve the console, and the /api/admin routes, ONLY on that host.
  const host = String(req.headers.host || '').split(':')[0].toLowerCase();
  const consoleHost = String(env.SEMACHAT_CONSOLE_HOST || '').toLowerCase();
  const isConsolePath = url.pathname === '/console' || url.pathname === '/console/';
  const onConsoleHost = !!consoleHost && host === consoleHost;
  if (isConsolePath || onConsoleHost) {
    if (consoleHost && !onConsoleHost) return send(res, 404, { error: 'not found' });
  }
  const app = (isConsolePath || onConsoleHost) ? 'console' : 'client';
  fs.readFile(FRONT, 'utf8', (err, html) => {
    if (err) return send(res, 500, { error: 'frontend/index.html missing' });
    const tag = f => '<script>' + read(f) + '</script>';
    const page = assets.fill(html, 'link', app).replace('<!--CORE-->', '<script>window.SEMACHAT_API_BASE="";</script>').replace('<!--BIZ-->', () => tag('business-ui.js')).replace('<!--ADJ-->', () => tag('adjust-ui.js')).replace('<!--EXT-->', () => EXT.map(tag).join('\n'));
    res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, HEADERS)); res.end(page);
  });
});

const stop = sig => { console.log('\n' + sig + ': saving and shutting down…'); flush(); streams.forEach(s => s.forEach(r => { try { r.end(); } catch (e) { /* ignore */ } })); server.close(() => { store.close(); process.exit(0); }); setTimeout(() => { store.close(); process.exit(0); }, 3000).unref(); };
process.on('SIGTERM', () => stop('SIGTERM')); process.on('SIGINT', () => stop('SIGINT'));

server.listen(PORT, () => {
  const st = providers.status();
  console.log('SemaChat running on http://localhost:' + server.address().port + '  [storage: ' + store.kind + ' · email: ' + st.email + ' · m-pesa: ' + st.mpesa + ' · sessions: ' + st.sessions + ']\n  Client app:  /\n  Console:     /console   (developer console, separate page and sign-in; set SEMACHAT_CONSOLE_HOST to serve it on its own address only)\n  Health:      /healthz  /readyz');
  console.log('  Install:     /install   (add the app to phones, tablets and desktops)');
  if (teamNote) console.warn('  ⚠️  ' + teamNote);
  if (core.TEAM.pass) console.warn('  ⚠️  TEAM ENTRY PASS IS ON: anyone with the private /team link gets full access to the client app AND the developer console. Development only: remove SEMACHAT_TEAM_PASS before real clients arrive.');
  if (core.TEAM.enabled) console.warn('  ⚠️  TEAM ACCESS IS ON for ' + core.TEAM.emails.length + ' email(s): they can sign in to the client app AND the developer console with the team code. Development use only: remove SEMACHAT_TEAM_ACCESS before real clients arrive.');
  providers.checkEmail().then(h => {
    if (h.mode === 'demo') console.warn('  ⚠️  EMAIL: no mailbox configured. Login codes are NOT sent; the demo code works for everyone. Set SMTP_HOST/SMTP_USER/SMTP_PASS (see DEPLOY.md).');
    else if (h.ok === false) console.error('  ❌ EMAIL: cannot log in to the mailbox, so login codes will NOT arrive. Reason: ' + h.lastError + '\n     Fix SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS, or use team access meanwhile. Test with: node backend/tools/check-email.js you@example.com');
    else if (h.ok) console.log('  ✅ EMAIL: logged in to the mailbox (' + (process.env.SMTP_USER || h.mode) + '). Login codes can be sent.');
  }).catch(() => { });
});
