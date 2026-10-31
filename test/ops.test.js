const test = require('node:test'), assert = require('node:assert'), http = require('node:http'), fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), { spawn } = require('node:child_process');
const core = require('../core'); require('../business')(core); require('../compliance')(core); require('../realtime')(core);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'semachat-test-'));

/* ---------- realtime calls (WebRTC signalling) ---------- */
test('calls: ring, join, relay offer/answer/ICE only between members, log on end', () => {
  const db = core.seed(), ev = []; core.hooks.emit = (u, e) => ev.push({ u, ...e });
  const g = (m, u, b, t) => core.handle(db, m, u, b || {}, t || 'tok_u_me', {});
  const ch = db.chats.find(c => c.members.length === 2 && c.members.includes('u_me') && c.members.includes('u_wanjiru'));
  const r = g('POST', '/api/calls', { chatId: ch.id, mode: 'video' }); assert.equal(r.status, 200); const id = r.data.id;
  assert.ok(ev.some(e => e.u === 'u_wanjiru' && e.type === 'call_incoming' && e.call.from.id === 'u_me' && e.call.mode === 'video'));
  assert.equal(g('POST', '/api/calls', { chatId: ch.id }).status, 409, 'already in a call');
  assert.equal(g('POST', '/api/calls/' + id + '/join', {}, 'tok_u_otieno').status, 403, 'strangers cannot join');
  assert.equal(g('POST', '/api/calls/' + id + '/join', {}, 'tok_u_wanjiru').status, 200);
  assert.equal(g('POST', '/api/calls/' + id + '/signal', { to: 'u_me', kind: 'offer', data: { sdp: 'x' } }, 'tok_u_wanjiru').status, 200);
  assert.ok(ev.some(e => e.u === 'u_me' && e.type === 'call_signal' && e.kind === 'offer' && e.from === 'u_wanjiru'));
  assert.equal(g('POST', '/api/calls/' + id + '/signal', { to: 'u_otieno', kind: 'offer' }, 'tok_u_wanjiru').status, 400, 'cannot signal outsiders');
  assert.equal(g('POST', '/api/calls/' + id + '/signal', { to: 'u_me', kind: 'bogus' }, 'tok_u_wanjiru').status, 400);
  assert.equal(g('POST', '/api/calls/' + id + '/signal', { to: 'u_me', kind: 'ice', data: { c: 'x'.repeat(30000) } }, 'tok_u_wanjiru').status, 413);
  g('POST', '/api/calls/' + id + '/leave'); assert.ok(ev.some(e => e.type === 'call_signal' && e.kind === 'ended'));
  const last = db.messages.filter(m => m.chatId === ch.id).slice(-1)[0]; assert.equal(last.type, 'call'); assert.equal(g('GET', '/api/calls/config').data.mesh, true);
});
test('calls: decline and missed calls are logged; switched-off calls are refused', () => {
  const db = core.seed(), g = (m, u, b, t) => core.handle(db, m, u, b || {}, t || 'tok_u_me', {});
  const ch = db.chats.find(c => c.members.length === 2 && c.members.includes('u_me') && c.members.includes('u_otieno'));
  const id = g('POST', '/api/calls', { chatId: ch.id, mode: 'voice' }).data.id; g('POST', '/api/calls/' + id + '/decline', {}, 'tok_u_otieno');
  assert.equal(g('POST', '/api/calls/' + id + '/join', {}, 'tok_u_otieno').status, 404, 'declined call is over');
  assert.ok(db.messages.filter(m => m.chatId === ch.id).slice(-1)[0].meta.missed);
  g('POST', '/api/admin/settings', { feature: { key: 'videoCalls', on: false } }, 'tok_admin');
  assert.equal(g('POST', '/api/calls', { chatId: ch.id, mode: 'video' }).status, 403);
});
test('LiveKit token is a valid HS256 JWT', () => {
  process.env.LIVEKIT_API_KEY = 'k'; process.env.LIVEKIT_API_SECRET = 's3cret';
  const [h, b, s] = core.realtime.livekitToken('u_me', 'Amani', 'room1').split('.');
  assert.equal(JSON.parse(Buffer.from(b, 'base64url')).video.room, 'room1');
  assert.equal(s, crypto.createHmac('sha256', 's3cret').update(h + '.' + b).digest('base64url'));
});

/* ---------- consent, audited access, pluggable classifier ---------- */
test('sign-up needs consent and records it; developer access is audited; classifier plug-in works', () => {
  const db = core.seed(), g = (m, u, b, t) => core.handle(db, m, u, b || {}, t, {});
  const base = { name: 'Ada Wairimu', phone: '0711000111', email: 'ada@mail.com', code: '123ABC', role: 'user', kyc: { legalName: 'Ada Wairimu', gender: 'female', age: 27, idType: 'national_id', idNumber: '31234567', city: 'Nairobi', area: 'Kilimani' } };
  assert.equal(g('POST', '/api/auth/signup', base).data.code, 'CONSENT_REQUIRED');
  const ok = g('POST', '/api/auth/signup', { ...base, consent: { terms: true, privacy: true } }); assert.equal(ok.status, 200);
  const u = db.users.find(x => x.phone === '+254711000111' || x.name === 'Ada Wairimu'); assert.equal(u.consent.version, '2026-10'); assert.ok(u.consent.ts);
  g('GET', '/api/admin/people', null, 'tok_admin'); g('GET', '/api/admin/consent/' + u.id, null, 'tok_admin');
  const log = g('GET', '/api/admin/access-log', null, 'tok_admin').data; assert.ok(log.entries.some(e => e.what === '/api/admin/people' && e.sensitive)); assert.ok(log.consent.recorded >= 1);
  assert.equal(g('GET', '/api/admin/access-log', null, 'tok_u_me').status, 401);
  core.compliance.addClassifier(t => /\bjackpot\b/i.test(t) ? ['risky_activity'] : []);
  core.compliance.addClassifier(() => { throw new Error('broken classifier'); });   // must not break chat
  const kid = db.users.find(x => x.minor); assert.ok(kid, 'seed has a minor');
  const ch = db.chats.find(c => c.members.includes(kid.id) && c.members.length === 2), other = ch.members.find(m => m !== kid.id);
  const before = db.comp.alerts.length; assert.equal(g('POST', '/api/chats/' + ch.id + '/messages', { text: 'win the jackpot tonight' }, 'tok_' + other).status, 200);
  assert.ok(db.comp.alerts.length > before, 'plug-in category raised a guardian alert');
});

/* ---------- providers: Africa's Talking + Daraja against local mock servers ---------- */
test('email verification codes and M-Pesa STK push (mock providers)', async () => {
  const seen = { mail: [], stk: [] };
  const mock = http.createServer((req, res) => { let d = ''; req.on('data', c => d += c); req.on('end', () => {
    const out = (o, s = 200) => { res.writeHead(s, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url.startsWith('/emails')) { seen.mail.push({ h: req.headers, b: JSON.parse(d) }); return out({ id: 'em_1' }); }
    if (req.url.startsWith('/oauth/v1/generate')) return out({ access_token: 'T0K', expires_in: '3599' });
    if (req.url.startsWith('/mpesa/stkpush')) { seen.stk.push({ h: req.headers, b: JSON.parse(d) }); return out({ ResponseCode: '0', CheckoutRequestID: 'ws_CO_TEST1' }); }
    out({}, 404); }); }).listen(0);
  await new Promise(r => mock.on('listening', r)); const base = 'http://127.0.0.1:' + mock.address().port;
  const env = { SEMACHAT_SECRET: 'x'.repeat(40), RESEND_API_KEY: 'rk_test', EMAIL_FROM: 'SemaChat <no-reply@semachat.example>', EMAIL_API_BASE: base, MPESA_BASE: base, MPESA_CONSUMER_KEY: 'ck', MPESA_CONSUMER_SECRET: 'cs', MPESA_SHORTCODE: '174379', MPESA_PASSKEY: 'pk', MPESA_CALLBACK_URL: 'https://app.example/api/pay/mpesa/callback' };
  const db = core.seed(); core.hooks.persist = () => { }; const warns = []; require('../providers')(core, env, { warn: m => warns.push(m) });
  const g = (m, u, b, t) => core.handle(db, m, u, b || {}, t === undefined ? 'tok_u_me' : t, {});
  try {
  // email sign-in: code arrives by email, works once, wrong/demo codes fail, resend throttled
  const o = g('POST', '/api/auth/otp', { email: 'Amani@Mail.com', purpose: 'signin' }, ''); assert.ok(!/123ABC/.test(o.data.hint));
  await sleep(150); assert.equal(seen.mail.length, 1); assert.equal(seen.mail[0].h.authorization, 'Bearer rk_test'); assert.deepEqual(seen.mail[0].b.to, ['amani@mail.com']);
  const code = /code is ([A-Z0-9]{6})\b/.exec(seen.mail[0].b.text)[1];
  g('POST', '/api/auth/otp', { email: 'amani@mail.com' }, ''); await sleep(50); assert.equal(seen.mail.length, 1, 'resend throttled');
  assert.equal(g('POST', '/api/auth/signin', { email: 'amani@mail.com', code: '123ABC' }, '').status, 400, 'demo code no longer works');
  assert.equal(g('POST', '/api/auth/signin', { email: 'amani@mail.com', code }, '').status, 200);
  assert.equal(g('POST', '/api/auth/signin', { email: 'amani@mail.com', code }, '').status, 400, 'a code works once');
  // email sign-up: the address must be verified with its own code, and cannot be reused
  assert.equal(g('POST', '/api/auth/otp', { email: 'amani@mail.com', purpose: 'signup' }, '').status, 409);
  assert.equal(g('POST', '/api/auth/otp', { email: 'nobody@mail.com', purpose: 'signin' }, '').status, 404);
  assert.equal(g('POST', '/api/auth/otp', { email: 'not-an-email' }, '').status, 400);
  // M-Pesa
  const bal = g('GET', '/api/me').data.balance, r = g('POST', '/api/wallet/topup', { amount: 500, method: 'M-Pesa' }); assert.equal(r.data.pending, true);
  await sleep(300); assert.equal(g('GET', '/api/wallet/topup/' + r.data.id).data.status, 'sent'); assert.equal(g('GET', '/api/me').data.balance, bal, 'no money before the customer pays');
  const stk = seen.stk[0].b; assert.equal(stk.Amount, 500); assert.equal(stk.PhoneNumber, '254700111222'); assert.equal(seen.stk[0].h.authorization, 'Bearer T0K');
  assert.equal(stk.Password, Buffer.from('174379pk' + stk.Timestamp).toString('base64'));
  const cbPath = new URL(stk.CallBackURL).pathname + new URL(stk.CallBackURL).search, ok = { Body: { stkCallback: { CheckoutRequestID: 'ws_CO_TEST1', ResultCode: 0, CallbackMetadata: { Item: [{ Name: 'Amount', Value: 500 }, { Name: 'MpesaReceiptNumber', Value: 'QWE123' }] } } } };
  assert.equal(g('POST', '/api/pay/mpesa/callback?k=forged', ok, '').status, 403, 'forged callback rejected');
  assert.equal(g('POST', cbPath, { Body: { stkCallback: { ...ok.Body.stkCallback, CallbackMetadata: { Item: [{ Name: 'Amount', Value: 5 }] } } } }, '').data.ResultCode, 0);
  assert.equal(g('GET', '/api/wallet/topup/' + r.data.id).data.status, 'failed', 'wrong amount is not credited'); assert.equal(g('GET', '/api/me').data.balance, bal);
  // a second payment completes and replays are idempotent
  const r2 = g('POST', '/api/wallet/topup', { amount: 700, method: 'M-Pesa' }); await sleep(300); const s2 = seen.stk[1].b, p2 = new URL(s2.CallBackURL); const cb2 = { Body: { stkCallback: { CheckoutRequestID: 'ws_CO_TEST1', ResultCode: 0, CallbackMetadata: { Item: [{ Name: 'Amount', Value: 700 }, { Name: 'MpesaReceiptNumber', Value: 'ZXC999' }] } } } };
  db.pay.pending[r2.data.id].checkoutId = 'ws_CO_TEST2'; cb2.Body.stkCallback.CheckoutRequestID = 'ws_CO_TEST2';
  assert.equal(g('POST', p2.pathname + p2.search, cb2, '').status, 200); g('POST', p2.pathname + p2.search, cb2, ''); assert.equal(g('GET', '/api/me').data.balance, bal + 700, 'credited exactly once');
  assert.equal(g('GET', '/api/admin/providers', null, 'tok_admin').data.mpesa.slice(0, 4), 'live');
  } finally { mock.close(); }
});

/* ---------- storage adapters ---------- */
test('JSON storage is atomic and recovers from a corrupt file via the backup', () => {
  const { open } = require('../storage'), f = path.join(tmp(), 'db.json'), s = open(f);
  assert.equal(s.load(), null); s.save({ v: 2, n: 1 }); s.save({ v: 2, n: 2 }); assert.equal(s.load().n, 2);
  fs.writeFileSync(f, '{"v":2,"n":'); assert.equal(s.load().n, 1, 'fell back to the .bak copy'); assert.ok(!fs.existsSync(f + '.tmp'));
});
test('SQLite storage round-trips the app state', t => {
  let ok = true; try { require('node:sqlite'); } catch (e) { ok = false; } if (!ok) return t.skip('node:sqlite needs Node 22+');
  const { open } = require('../storage'), f = path.join(tmp(), 'semachat.sqlite'), s = open(f); assert.equal(s.kind, 'sqlite'); assert.equal(s.load(), null);
  const db = core.seed(); s.save(db); s.close(); const s2 = open(f), back = s2.load(); assert.equal(back.users.length, db.users.length); s2.close();
});
test('session tokens are signed and tampering is rejected', () => {
  const S = require('../session')('s'.repeat(32)), t = S.sign('tok_u_me'); assert.match(t, /^tok_u_me\.[\w-]{32}$/); assert.equal(S.verify(t), 'tok_u_me');
  assert.equal(S.verify('tok_u_me'), ''); assert.equal(S.verify(t.replace('u_me', 'u_wanjiru')), ''); assert.equal(S.verify(t.slice(0, -1) + 'x'), ''); assert.equal(require('../session')('').verify('tok_u_me'), 'tok_u_me');
});

/* ---------- the real server process ---------- */
const boot = (env, ms = 1500) => new Promise(res => { const p = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PATH: process.env.PATH, ...env } }); let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d); p.on('exit', code => res({ p, out, code })); setTimeout(() => res({ p, out, code: null }), ms); });
const getj = async (port, p, o) => { const r = await fetch('http://127.0.0.1:' + port + p, o); return { s: r.status, j: await r.json().catch(() => null), h: r.headers }; };
test('server: health checks, signed sessions, rate limit, security headers', async () => {
  const port = 4300 + Math.floor(Math.random() * 500), env = { PORT: port, SEMACHAT_DB: path.join(tmp(), 'u.sqlite'), SEMACHAT_SECRET: 'z'.repeat(40), SEMACHAT_ADMIN_EMAILS: 'boss@semachat.test' };
  try { require('node:sqlite'); } catch (e) { env.SEMACHAT_DB = path.join(tmp(), 'u.json'); }
  const { p, out } = await boot(env, 1800); try {
    assert.match(out, /sessions: signed/); const h = await getj(port, '/healthz'); assert.equal(h.s, 200); assert.equal(h.j.ok, true); assert.equal(h.h.get('x-content-type-options'), 'nosniff');
    assert.equal((await getj(port, '/readyz')).j.ready, true);
    const J = (b, t) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) });
    const si = await getj(port, '/api/auth/signin', J({ email: 'amani@mail.com', code: '123ABC' })); assert.equal(si.s, 200); assert.match(si.j.token, /^tok_u_me\./);
    assert.equal((await getj(port, '/api/me', { headers: { Authorization: 'Bearer tok_u_me' } })).s, 401, 'unsigned token refused');
    assert.equal((await getj(port, '/api/me', { headers: { Authorization: 'Bearer ' + si.j.token } })).s, 200);
    assert.equal((await getj(port, '/api/admin/signin', J({ email: 'admin@semachat.app', code: '123ABC' }))).s, 401, 'the demo developer address is replaced by SEMACHAT_ADMIN_EMAILS');
    assert.equal((await getj(port, '/api/admin/signin', J({ email: 'boss@semachat.test', password: 'x' }))).s, 401, 'no password login any more');
    assert.equal((await getj(port, '/api/admin/signin', J({ email: 'boss@semachat.test', code: '123abc' }))).s, 200, 'developer signs in by email code (demo code, any case)');
    const codes = []; for (let i = 0; i < 25; i++) codes.push((await getj(port, '/api/auth/signin', J({ email: 'amani@mail.com', code: 'bad' }))).s); assert.ok(codes.includes(429), 'auth endpoints are rate limited');
  } finally { p.kill('SIGTERM'); await sleep(300); }
});
test('server: production without its secret stays UP in setup mode (health passes, nothing else is served)', async () => {
  const port = 4900 + Math.floor(Math.random() * 90);
  const { p, out } = await boot({ PORT: port, NODE_ENV: 'production', SEMACHAT_DB: path.join(tmp(), 'p.json'), SEMACHAT_SECRET: '', SEMACHAT_ALLOW_DEMO: '' }, 1800); try {
    assert.match(out, /SETUP REQUIRED/); assert.match(out, /SEMACHAT_SECRET/);
    const h = await getj(port, '/healthz'); assert.equal(h.s, 200); const r = await getj(port, '/readyz'); assert.equal(r.s, 200); assert.equal(r.j.setupRequired, true);
    assert.equal((await getj(port, '/api/auth/signin', { method: 'POST', body: '{}' })).s, 503, 'the API is closed');
    const pg = await fetch('http://127.0.0.1:' + port + '/'); assert.equal(pg.status, 200); assert.match(await pg.text(), /setup required/i);
  } finally { p.kill('SIGTERM'); await sleep(300); }
});
test('server: production with a secret starts, but never accepts the demo code or the demo developer address; unwritable storage does not crash it', async () => {
  const port = 5950 + Math.floor(Math.random() * 40), J = b => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  const blocker = path.join(tmp(), 'not-a-folder'); fs.writeFileSync(blocker, 'x');   // a FILE where a folder is needed: the same failure as a read-only or root-owned /data
  const { p, out } = await boot({ PORT: port, NODE_ENV: 'production', SEMACHAT_DB: path.join(blocker, 'sub', 'semachat.json'), SEMACHAT_SECRET: 'k'.repeat(40), SEMACHAT_ALLOW_DEMO: '' }, 2200); try {
    assert.match(out, /RUNNING, BUT NOT READY FOR CLIENTS/); assert.match(out, /TEMPORARY file/);
    assert.equal((await getj(port, '/healthz')).s, 200); const rz = await getj(port, '/readyz'); assert.equal(rz.s, 200); assert.match(rz.j.storage, /temporary/);
    assert.equal((await getj(port, '/api/auth/signin', J({ email: 'amani@mail.com', code: '123ABC' }))).s, 400, 'demo code refused in production');
    assert.equal((await getj(port, '/api/admin/signin', J({ email: 'admin@semachat.app', code: '123ABC' }))).s, 401, 'demo developer address refused in production');
    const o = await getj(port, '/api/auth/otp', J({ email: 'amani@mail.com', purpose: 'signin' })); assert.match(o.j.hint, /not set up/i);
  } finally { p.kill('SIGTERM'); await sleep(300); }
});

test('email-only auth in demo mode: sign-up verifies the email, sign-in by email, tokens never expire until sign-off', () => {
  core.hooks.otpSend = null; core.hooks.otpCheck = null;       // earlier tests install the live email provider on the shared core
  const g = (m, u, b, t) => core.handle(db, m, u, b || {}, t === undefined ? '' : t, {}), db = core.seed();
  const base = { name: 'Zuri Achieng', email: 'Zuri@Mail.com', code: '123ABC', role: 'user', consent: { terms: true, privacy: true }, kyc: { legalName: 'Zuri Achieng', gender: 'female', age: 29, city: 'Kisumu' } };
  assert.equal(g('POST', '/api/auth/signup', { ...base, code: '000000' }).status, 400, 'wrong email code');
  assert.equal(g('POST', '/api/auth/signup', { ...base, email: 'bad' }).status, 400);
  const r = g('POST', '/api/auth/signup', base); assert.equal(r.status, 200);                      // no phone needed
  const me = g('GET', '/api/me', null, r.data.token).data; assert.equal(me.email, 'zuri@mail.com');
  assert.equal(g('POST', '/api/auth/signup', { ...base, kyc: { ...base.kyc, legalName: 'Other' } }).status, 409, 'one account per email');
  assert.equal(g('POST', '/api/auth/signin', { phone: '0700111222', code: '123ABC' }).status, 404, 'phone sign-in is gone');
  const si = g('POST', '/api/auth/signin', { email: 'ZURI@mail.com', code: '123ABC' }); assert.equal(si.status, 200);
  db.seen[r.data.token.slice(4)] = Date.now() - 400 * 864e5;                                     // a year of silence
  assert.equal(g('GET', '/api/me', null, si.data.token).status, 200, 'still signed in after a long absence');
  assert.equal(g('POST', '/api/auth/signout', {}, si.data.token).status, 200);
});

/* ---------- email login codes: sender, format, 5-minute expiry, SMTP, developer console ---------- */
test('email codes: 6 uppercase letters/digits, valid 5 minutes, sent from login1@wavehub.co.ke over SMTP, same for the developer console', async () => {
  const net = require('net'), mails = [];
  const smtp = net.createServer(sock => {
    let mode = 'cmd', buf = '', cur = { rcpt: [], data: '' }; const w = l => sock.write(l + '\r\n');
    w('220 mail.wavehub.co.ke ESMTP');
    sock.on('data', d => { buf += d; let i;
      while (mode === 'data' ? buf.includes('\r\n.\r\n') : (i = buf.indexOf('\r\n')) >= 0) {
        if (mode === 'data') { const k = buf.indexOf('\r\n.\r\n'); cur.data = buf.slice(0, k); buf = buf.slice(k + 5); mails.push(cur); cur = { rcpt: [], data: '' }; mode = 'cmd'; w('250 queued'); continue; }
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (mode === 'user') { cur.user = Buffer.from(line, 'base64').toString(); mode = 'pass'; w('334 UGFzc3dvcmQ6'); }
        else if (mode === 'pass') { cur.pass = Buffer.from(line, 'base64').toString(); mode = 'cmd'; w('235 ok'); }
        else if (/^EHLO/i.test(line)) w('250 mail.wavehub.co.ke');
        else if (/^AUTH LOGIN/i.test(line)) { mode = 'user'; w('334 VXNlcm5hbWU6'); }
        else if (/^MAIL FROM:/i.test(line)) { cur.from = line.slice(10); w('250 ok'); }
        else if (/^RCPT TO:/i.test(line)) { cur.rcpt.push(line.slice(8)); w('250 ok'); }
        else if (/^DATA/i.test(line)) { mode = 'data'; w('354 go'); }
        else if (/^QUIT/i.test(line)) { w('221 bye'); sock.end(); }
        else w('250 ok'); } });
  }).listen(0); await new Promise(r => smtp.on('listening', r));
  const env = { SEMACHAT_SECRET: 'x'.repeat(40), SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.address().port), SMTP_SECURE: 'none', SMTP_USER: 'login1@wavehub.co.ke', SMTP_PASS: 'mailbox-pass' };
  const db = core.seed(); core.hooks.persist = () => { }; require('../providers')(core, env, { warn: () => { } });
  const g = (m, u, b, t) => core.handle(db, m, u, b || {}, t === undefined ? 'tok_u_me' : t, {});
  const realNow = Date.now; try {
    g('POST', '/api/auth/otp', { email: 'amani@mail.com', purpose: 'signin' }, ''); await sleep(300);
    assert.equal(mails.length, 1, 'the code is emailed automatically');
    const m = mails[0]; assert.match(m.from, /<login1@wavehub\.co\.ke>/); assert.match(m.rcpt[0], /<amani@mail\.com>/); assert.equal(m.user, 'login1@wavehub.co.ke'); assert.equal(m.pass, 'mailbox-pass');
    assert.match(m.data, /From: SemaChat <login1@wavehub\.co\.ke>/);
    const text = Buffer.from(m.data.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString();
    const code = /code is ([A-Z0-9]{6})\b/.exec(text)[1]; assert.match(code, /^[A-Z0-9]{6}$/); assert.match(text, /5 minutes/);
    // wrong code fails; the right code works in lower case too (typed on a phone) and only once
    assert.equal(g('POST', '/api/auth/signin', { email: 'amani@mail.com', code: 'ZZZZZZ' }, '').status, 400);
    assert.equal(g('POST', '/api/auth/signin', { email: 'amani@mail.com', code: code.toLowerCase() }, '').status, 200);
    assert.equal(g('POST', '/api/auth/signin', { email: 'amani@mail.com', code }, '').status, 400);
    // expiry: valid at 4m59s, dead at 5m01s
    const t0 = realNow.call(Date); Date.now = () => t0 + 31000; g('POST', '/api/auth/otp', { email: 'amani@mail.com' }, ''); await sleep(300); assert.equal(mails.length, 2);
    const c2 = /code is ([A-Z0-9]{6})\b/.exec(Buffer.from(mails[1].data.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString())[1];
    Date.now = () => t0 + 31000 + 5 * 60000 + 1000; assert.equal(g('POST', '/api/auth/signin', { email: 'amani@mail.com', code: c2 }, '').status, 400, 'expired after 5 minutes');
    Date.now = () => t0 + 62000; g('POST', '/api/auth/otp', { email: 'amani@mail.com' }, ''); await sleep(300); assert.equal(mails.length, 3);
    const c3 = /code is ([A-Z0-9]{6})\b/.exec(Buffer.from(mails[2].data.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString())[1];
    Date.now = () => t0 + 62000 + 4 * 60000 + 59000; assert.equal(g('POST', '/api/auth/signin', { email: 'amani@mail.com', code: c3 }, '').status, 200, 'still valid just inside 5 minutes');
    Date.now = realNow;
    // developer console: only listed developer emails get a code, nobody else learns whether an address is listed
    const before = mails.length;
    const a1 = g('POST', '/api/admin/otp', { email: 'stranger@mail.com' }, ''); assert.equal(a1.status, 200); await sleep(200); assert.equal(mails.length, before, 'no email for non-developers');
    const a2 = g('POST', '/api/admin/otp', { email: 'Admin@Semachat.app' }, ''); assert.equal(a2.status, 200); await sleep(300); assert.equal(mails.length, before + 1);
    assert.match(mails[before].rcpt[0], /<admin@semachat\.app>/);
    const ac = /code is ([A-Z0-9]{6})\b/.exec(Buffer.from(mails[before].data.split('Content-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString())[1];
    assert.equal(g('POST', '/api/admin/signin', { email: 'admin@semachat.app', password: 'semachat-admin' }, '').status, 401);
    assert.equal(g('POST', '/api/admin/signin', { email: 'stranger@mail.com', code: ac }, '').status, 401);
    assert.equal(g('POST', '/api/admin/signin', { email: 'admin@semachat.app', code: ac }, '').data.token, 'tok_admin');
  } finally { Date.now = realNow; smtp.close(); core.hooks.otpSend = null; core.hooks.otpCheck = null; }
});
test('default sender is login1@wavehub.co.ke', () => {
  const st = require('../providers')(core, { SEMACHAT_SECRET: 'x'.repeat(40), SMTP_HOST: 'localhost' }, { warn: () => { } }).status();
  assert.match(st.email, /login1@wavehub\.co\.ke/); core.hooks.otpSend = null; core.hooks.otpCheck = null;
});

/* ---------- development team access, install (PWA) files, proxy addresses ---------- */
test('server: team access signs the research team into BOTH consoles with one code; off by default; weak code refused', async () => {
  const port = 5100 + Math.floor(Math.random() * 300), dbf = path.join(tmp(), 't.json');
  const env = { PORT: port, SEMACHAT_DB: dbf, SEMACHAT_SECRET: 'q'.repeat(40), SEMACHAT_TEAM_ACCESS: '1', SEMACHAT_TEAM_EMAILS: 'Ann.Dev@wavehub.co.ke, bob@wavehub.co.ke', SEMACHAT_TEAM_CODE: 'team-Access 2026x' };
  const J = (b, t) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) });
  { const { p, out } = await boot(env, 1800); try {
    assert.match(out, /TEAM ACCESS IS ON for 2 email/);
    assert.equal((await getj(port, '/readyz')).j.teamAccess, true);
    const o = await getj(port, '/api/auth/otp', J({ email: 'ann.dev@wavehub.co.ke', purpose: 'signin' })); assert.equal(o.s, 200); assert.equal(o.j.team, true); assert.match(o.j.hint, /team access code/i);
    // first visit creates a test account; the code can be typed in any case with spaces
    const a = await getj(port, '/api/auth/signin', J({ email: 'Ann.Dev@wavehub.co.ke', code: 'TEAM-access2026X'.replace('-', '') })); assert.equal(a.s, 200); assert.match(a.j.token, /^tok_u_/);
    const me = await getj(port, '/api/me', { headers: { Authorization: 'Bearer ' + a.j.token } }); assert.equal(me.s, 200); assert.equal(me.j.email, 'ann.dev@wavehub.co.ke');
    assert.equal((await getj(port, '/api/auth/signin', J({ email: 'ann.dev@wavehub.co.ke', code: 'TEAMACCESS2026X' }))).s, 200, 'second sign-in reuses the account');
    assert.equal((await getj(port, '/api/auth/signin', J({ email: 'ann.dev@wavehub.co.ke', code: 'WRONGCODE123' }))).s, 400);
    assert.equal((await getj(port, '/api/auth/signin', J({ email: 'stranger@mail.com', code: 'TEAMACCESS2026X' }))).s, 404, 'team code does nothing for unlisted emails');
    // developer console
    const c = await getj(port, '/api/admin/signin', J({ email: 'bob@wavehub.co.ke', code: 'teamaccess2026x' })); assert.equal(c.s, 200); assert.match(c.j.token, /^tok_admin/);
    assert.equal((await getj(port, '/api/admin/signin', J({ email: 'stranger@mail.com', code: 'TEAMACCESS2026X' }))).s, 401);
    const st = await getj(port, '/api/admin/stats', { headers: { Authorization: 'Bearer ' + c.j.token } }); assert.equal(st.s, 200);
    const au = await getj(port, '/api/admin/audit', { headers: { Authorization: 'Bearer ' + c.j.token } }); assert.ok(au.j.some(x => /Team access sign-in \(developer console\): bob@/.test(x.msg)) && au.j.some(x => /Team test account created: ann\.dev@/.test(x.msg)), 'team sign-ins are audited');
    // installable app files
    const mf = await fetch('http://127.0.0.1:' + port + '/manifest.webmanifest'); assert.match(mf.headers.get('content-type'), /manifest\+json/); const mj = await mf.json(); assert.equal(mj.display, 'standalone'); assert.ok(mj.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));
    const cm = await (await fetch('http://127.0.0.1:' + port + '/console.webmanifest')).json(); assert.equal(cm.start_url, '/console?source=pwa'); assert.equal(cm.scope, '/console');
    const sw = await fetch('http://127.0.0.1:' + port + '/sw.js'); assert.match(sw.headers.get('content-type'), /javascript/); assert.equal(sw.headers.get('service-worker-allowed'), '/'); assert.match(await sw.text(), /addEventListener\('fetch'/);
    const ins = await (await fetch('http://127.0.0.1:' + port + '/install')).text(); assert.match(ins, /Install SemaChat/); assert.match(ins, /Add to Home Screen/);
    const pg = await (await fetch('http://127.0.0.1:' + port + '/')).text(); assert.match(pg, /rel="manifest" href="\/manifest\.webmanifest"/); assert.match(pg, /serviceWorker\.register\('\/sw\.js'\)/);
    const cp = await (await fetch('http://127.0.0.1:' + port + '/console')).text(); assert.match(cp, /rel="manifest" href="\/console\.webmanifest"/);
    // behind a proxy on the same machine, people are told apart by X-Forwarded-For (no shared lock-out)
    const bad = ip => getj(port, '/api/auth/signin', { ...J({ email: 'ann.dev@wavehub.co.ke', code: 'nope' }), headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip } });
    const codes = []; for (let i = 0; i < 25; i++) codes.push((await bad('203.0.113.7')).s); assert.ok(codes.includes(429), 'one noisy visitor is limited');
    assert.notEqual((await bad('203.0.113.99')).s, 429, 'a different visitor is not locked out');
  } finally { p.kill('SIGTERM'); await sleep(300); } }
  // off by default, even with emails and a code listed
  { const port2 = port + 301, { p } = await boot({ ...env, PORT: port2, SEMACHAT_TEAM_ACCESS: '' }, 1600); try {
    assert.equal((await getj(port2, '/readyz')).j.teamAccess, false);
    assert.equal((await getj(port2, '/api/admin/signin', J({ email: 'bob@wavehub.co.ke', code: 'TEAMACCESS2026X' }))).s, 401);
  } finally { p.kill('SIGTERM'); await sleep(300); } }
  // a weak code is refused, access stays off
  { const port3 = port + 302, { p, out } = await boot({ ...env, PORT: port3, SEMACHAT_TEAM_CODE: '1234' }, 1600); try {
    assert.match(out, /SEMACHAT_TEAM_CODE must be 10-32/); assert.equal((await getj(port3, '/readyz')).j.teamAccess, false);
  } finally { p.kill('SIGTERM'); await sleep(300); } }
});

test('server: team entry pass opens client app and developer console with no sign-in; off by default; weak pass refused', async () => {
  const port = 5800 + Math.floor(Math.random() * 100), J = (b, t) => ({ method: 'POST', headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: JSON.stringify(b) });
  const env = { PORT: port, SEMACHAT_DB: path.join(tmp(), 'tp.json'), SEMACHAT_SECRET: 'w'.repeat(40), SEMACHAT_TEAM_PASS: 'a1b2-c3d4-e5f6-g7h8-j9k0' };
  { const { p, out } = await boot(env, 1800); try {
    assert.match(out, /TEAM ENTRY PASS IS ON/); assert.equal((await getj(port, '/readyz')).j.teamPass, true);
    assert.equal((await getj(port, '/api/team/enter', J({ pass: 'nope' }))).s, 401);
    const ok = await getj(port, '/api/team/enter', J({ pass: 'A1B2C3D4E5F6G7H8J9K0', who: 'Amina K.' })); assert.equal(ok.s, 200);
    assert.match(ok.j.token, /^tok_u_/); assert.match(ok.j.adminToken, /^tok_admin\./); assert.equal(ok.j.who, 'aminak');
    assert.equal((await getj(port, '/api/me', { headers: { Authorization: 'Bearer ' + ok.j.token } })).j.email, 'team-aminak@semachat.team');
    assert.equal((await getj(port, '/api/admin/stats', { headers: { Authorization: 'Bearer ' + ok.j.adminToken } })).s, 200, 'console opens with the same pass');
    const again = await getj(port, '/api/team/enter', J({ pass: 'a1b2-c3d4-e5f6-g7h8-j9k0', who: 'aminak' })); assert.equal(again.j.token.split('.')[0], ok.j.token.split('.')[0], 'same person, same account');
    const au = await getj(port, '/api/admin/audit', { headers: { Authorization: 'Bearer ' + ok.j.adminToken } }); assert.ok(au.j.some(x => /Team pass entry/.test(x.msg)));
    const pg = await fetch('http://127.0.0.1:' + port + '/team'); assert.equal(pg.status, 200); assert.equal(pg.headers.get('cache-control'), 'no-store'); assert.match(await pg.text(), /team entry/i);
    for (let i = 0; i < 10; i++) await getj(port, '/api/team/enter', J({ pass: 'wrong' + i }));
    assert.notEqual((await getj(port, '/api/team/enter', J({ pass: 'A1B2C3D4E5F6G7H8J9K0' }))).s, 200, 'ten wrong passes lock entry for a while');
  } finally { p.kill('SIGTERM'); await sleep(300); } }
  { const { p } = await boot({ ...env, PORT: port + 101, SEMACHAT_TEAM_PASS: '' }, 1600); try {
    assert.equal((await getj(port + 101, '/api/team/enter', J({ pass: 'A1B2C3D4E5F6G7H8J9K0' }))).s, 404, 'off by default');
  } finally { p.kill('SIGTERM'); await sleep(300); } }
  { const { p, out } = await boot({ ...env, PORT: port + 102, SEMACHAT_TEAM_PASS: 'short' }, 1600); try {
    assert.match(out, /SEMACHAT_TEAM_PASS must be 16-64/); assert.equal((await getj(port + 102, '/api/team/enter', J({ pass: 'short' }))).s, 404);
  } finally { p.kill('SIGTERM'); await sleep(300); } }
});
