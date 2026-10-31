/* SemaChat — real-world providers (server only).
 *  - Email sign-in / sign-up codes (users AND the developer console), sent from login1@wavehub.co.ke by SMTP or Resend
 *  - M-Pesa wallet top-ups via Safaricom Daraja (STK push + callback)
 * Everything is optional and driven by environment variables. Without keys the app stays in clearly-labelled DEMO mode
 * (code 123ABC, instant top-ups). Nothing here needs an npm package.
 *
 *   Email (SMTP, the mailbox login1@wavehub.co.ke):  SMTP_HOST  SMTP_USER  SMTP_PASS  [SMTP_PORT=465]  [SMTP_SECURE=ssl|starttls|none]
 *   Email (or Resend API):  RESEND_API_KEY  [EMAIL_API_BASE]
 *   Both:   [EMAIL_FROM="SemaChat <login1@wavehub.co.ke>"]
 *   Codes are 6 characters (A-Z, 0-9, uppercase) and expire after 5 minutes.
 *   M-Pesa: MPESA_CONSUMER_KEY  MPESA_CONSUMER_SECRET  MPESA_SHORTCODE  MPESA_PASSKEY  MPESA_CALLBACK_URL
 *           [MPESA_ENV=sandbox|production]  [MPESA_BASE]
 *   Both:   SEMACHAT_SECRET (signs sessions, OTP hashes and the M-Pesa callback key)
 */
'use strict';
const https = require('https'), http = require('http'), crypto = require('crypto'), net = require('net'), tls = require('tls');
const DEFAULT_FROM = 'SemaChat <login1@wavehub.co.ke>';
const CODE_MINUTES = 5;

module.exports = function install(core, env, log) {
  env = env || process.env; log = log || console;
  const secret = env.SEMACHAT_SECRET || '';
  const hmac = s => crypto.createHmac('sha256', secret || 'semachat-demo-secret').update(s).digest('hex');
  const hooks = core.hooks;
  const cfg = {
    email: !!(env.SMTP_HOST || env.RESEND_API_KEY),
    mpesa: !!(env.MPESA_CONSUMER_KEY && env.MPESA_CONSUMER_SECRET && env.MPESA_SHORTCODE && env.MPESA_PASSKEY && env.MPESA_CALLBACK_URL)
  };
  const status = () => ({ email: cfg.email ? 'live (email codes from ' + fromAddr() + ')' : 'demo (code 123ABC, no email sent)', mpesa: cfg.mpesa ? 'live (' + (env.MPESA_ENV === 'production' ? 'production' : 'sandbox') + ')' : 'demo (instant top-up)', sessions: secret ? 'signed' : 'unsigned (set SEMACHAT_SECRET)' });

  /* ---- tiny HTTPS/HTTP client ---- */
  function request(url, { method = 'GET', headers = {}, body = null, timeout = 15000 } = {}) {
    return new Promise((resolve, reject) => {
      const u = new URL(url), lib = u.protocol === 'http:' ? http : https;
      const req = lib.request({ hostname: u.hostname, port: u.port || (u.protocol === 'http:' ? 80 : 443), path: u.pathname + u.search, method, headers: Object.assign({ 'User-Agent': 'semachat-app' }, headers), timeout }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (e) { /* not JSON */ } resolve({ status: res.statusCode, body: j, text: d }); });
      });
      req.on('timeout', () => req.destroy(new Error('Provider timed out'))); req.on('error', reject); if (body) req.write(body); req.end();
    });
  }

  /* ---------------------------------------------------------------- email verification codes (sign-up and sign-in) */
  const codes = new Map();     // email -> { h, exp, tries, sentAt }
  const FROM = () => env.EMAIL_FROM || DEFAULT_FROM;
  function fromAddr() { const m = FROM().match(/<([^>]+)>/); return (m ? m[1] : FROM()).trim(); }

  /* ---- SMTP: a small client (no npm package) for the app's own mailbox ---- */
  const b64 = x => Buffer.from(x, 'utf8').toString('base64');
  const clean = x => String(x).replace(/[\r\n]+/g, ' ');
  function smtpSend(to, subject, text, html, probe) {
    const host = env.SMTP_HOST, port = Number(env.SMTP_PORT || 465);
    const mode = env.SMTP_SECURE || (port === 465 ? 'ssl' : port === 25 || port === 2525 ? 'none' : 'starttls');
    const boundary = 'sema_' + crypto.randomBytes(8).toString('hex');
    const msg = ['From: ' + clean(FROM()), 'To: ' + clean(to), 'Subject: =?UTF-8?B?' + b64(subject) + '?=', 'Date: ' + new Date().toUTCString(), 'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@' + (fromAddr().split('@')[1] || 'semachat') + '>',
      'MIME-Version: 1.0', 'Content-Type: multipart/alternative; boundary="' + boundary + '"', '',
      '--' + boundary, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64(text).replace(/(.{76})/g, '$1\r\n'),
      '--' + boundary, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', b64(html || text).replace(/(.{76})/g, '$1\r\n'), '--' + boundary + '--', ''].join('\r\n');
    return new Promise((resolve, reject) => {
      let sock, buf = '', waiting = null, done = false;
      const fail = e => { if (done) return; done = true; try { sock && sock.destroy(); } catch (x) { /* ignore */ } reject(e instanceof Error ? e : new Error(String(e))); };
      const attach = () => { sock.setEncoding('utf8'); sock.on('data', d => { buf += d; pump(); }); sock.on('error', fail); sock.on('timeout', () => fail(new Error('SMTP timed out'))); sock.setTimeout(20000); };
      // a reply is complete when a line "NNN text" (no dash after the code) arrives
      const pump = () => { if (!waiting) return; const lines = buf.split('\r\n'); if (lines.length < 2) return; const last = lines[lines.length - 2]; if (/^\d{3} /.test(last) || /^\d{3}$/.test(last)) { const text = buf; buf = ''; const w = waiting; waiting = null; w({ code: Number(last.slice(0, 3)), text }); } };
      const reply = () => new Promise(r => { waiting = r; pump(); });
      const cmd = async (line, ok) => { sock.write(line + '\r\n'); const r = await reply(); if (!ok.includes(Math.floor(r.code / 100))) throw new Error('SMTP ' + r.code + ' after ' + line.split(' ')[0]); return r; };
      const run = async () => {
        let r = await reply(); if (r.code !== 220) throw new Error('SMTP greeting ' + r.code);
        const name = (fromAddr().split('@')[1] || 'localhost');
        r = await cmd('EHLO ' + name, [2]);
        if (mode === 'starttls') {
          await cmd('STARTTLS', [2]);
          sock.removeAllListeners('data'); buf = ''; waiting = null;
          sock = tls.connect({ socket: sock, servername: host }); attach(); await new Promise((res, rej) => { sock.once('secureConnect', res); sock.once('error', rej); });
          r = await cmd('EHLO ' + name, [2]);
        }
        if (env.SMTP_USER) {
          await cmd('AUTH LOGIN', [3]); await cmd(b64(env.SMTP_USER), [3]); await cmd(b64(env.SMTP_PASS || ''), [2]);
        }
        if (probe) { try { sock.write('QUIT\r\n'); sock.end(); } catch (x) { /* ignore */ } done = true; return resolve({ ok: true, probe: true }); }
        await cmd('MAIL FROM:<' + fromAddr() + '>', [2]); await cmd('RCPT TO:<' + clean(to).replace(/[<>]/g, '') + '>', [2]); await cmd('DATA', [3]);
        sock.write(msg.replace(/^\./gm, '..') + '\r\n.\r\n'); r = await reply(); if (r.code >= 400) throw new Error('SMTP rejected the message (' + r.code + ')');
        try { sock.write('QUIT\r\n'); sock.end(); } catch (x) { /* ignore */ }
        done = true; resolve({ ok: true });
      };
      const start = () => { attach(); run().catch(fail); };
      if (mode === 'ssl') sock = tls.connect({ host, port, servername: host }, start); else sock = net.connect({ host, port }, start);
      sock.on('error', fail);
    });
  }

  // Resend (https://resend.com) or any API-compatible service via EMAIL_API_BASE
  async function resendSend(to, subject, text, html) {
    const base = env.EMAIL_API_BASE || 'https://api.resend.com';
    const r = await request(base.replace(/\/$/, '') + '/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: FROM(), to: [to], subject, text, html: html || undefined }) });
    if (r.status >= 300) throw new Error('Email provider answered ' + r.status);
    return r.body;
  }
  const health = { mode: env.SMTP_HOST ? 'smtp' : env.RESEND_API_KEY ? 'resend' : 'demo', ok: null, lastError: '', lastOkAt: 0, lastCheckAt: 0 };
  const noteOk = () => { health.ok = true; health.lastError = ''; health.lastOkAt = Date.now(); };
  const noteErr = e => { health.ok = false; health.lastError = String(e && e.message || e).slice(0, 200); };
  const sendEmail = (to, subject, text, html) => (env.SMTP_HOST ? smtpSend(to, subject, text, html) : resendSend(to, subject, text, html)).then(r => { noteOk(); return r; }, e => { noteErr(e); throw e; });
  // log in to the mailbox without sending anything: tells you at startup whether login codes can leave the server
  const checkEmail = async () => { health.lastCheckAt = Date.now(); if (!env.SMTP_HOST) { health.ok = cfg.email ? null : false; return health; } try { await smtpSend('check@invalid.example', 'check', 'check', '', true); noteOk(); } catch (e) { noteErr(e); } return health; };

  const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const newCode = () => { let c = ''; for (let i = 0; i < 6; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)]; return c; };
  if (cfg.email) {
    hooks.otpSend = email => {
      const now = Date.now(), prev = codes.get(email);
      if (prev && now < prev.sentAt + 30000) return { throttled: true, hint: 'A code was just sent. Wait 30 seconds before asking again.' };
      const code = newCode();
      codes.set(email, { h: hmac(email + ':' + code), exp: now + CODE_MINUTES * 60000, tries: 0, sentAt: now });
      sendEmail(email, 'SemaChat code: ' + code + ' (valid ' + CODE_MINUTES + ' minutes)',
        'Your SemaChat sign-in code is ' + code + '\n\nIt expires in ' + CODE_MINUTES + ' minutes and works once. Never share it with anyone. If you did not ask for it, ignore this email.\n\nSemaChat',
        '<div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:16px"><h2 style="color:#22a000;margin:0 0 12px">SemaChat</h2><p>Your sign-in code is</p><p style="font-size:34px;letter-spacing:8px;font-weight:800;margin:8px 0">' + code + '</p><p style="color:#666">It expires in ' + CODE_MINUTES + ' minutes and works once. Never share it with anyone. If you did not ask for it, ignore this email.</p></div>')
        .catch(e => { codes.delete(email); log.warn('[email] could not send: ' + e.message); });
      return { hint: 'We emailed a 6-character code to ' + email.replace(/^(.).*(@.*)$/, '$1•••$2') + '. It expires in ' + CODE_MINUTES + ' minutes. Check your inbox and spam folder.' };
    };
    hooks.otpCheck = (email, code) => {
      const c = codes.get(email); if (!c || Date.now() > c.exp) return false;
      if (++c.tries > 5) { codes.delete(email); return false; }
      const ok = /^[A-Z0-9]{6}$/.test(code) && crypto.timingSafeEqual(Buffer.from(hmac(email + ':' + code)), Buffer.from(c.h));
      if (ok) codes.delete(email); return ok;
    };
  }
  hooks.email = cfg.email ? sendEmail : null;

  /* ---------------------------------------------------------------- M-Pesa (Daraja STK push) */
  const mbase = () => env.MPESA_BASE || (env.MPESA_ENV === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke');
  const stamp = () => new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  let tok = null;
  async function mpesaToken() {
    if (tok && tok.exp > Date.now() + 30000) return tok.v;
    const r = await request(mbase() + '/oauth/v1/generate?grant_type=client_credentials', { headers: { Authorization: 'Basic ' + Buffer.from(env.MPESA_CONSUMER_KEY + ':' + env.MPESA_CONSUMER_SECRET).toString('base64') } });
    if (!r.body || !r.body.access_token) throw new Error('M-Pesa sign-in failed (' + r.status + ')');
    tok = { v: r.body.access_token, exp: Date.now() + (+r.body.expires_in || 3000) * 1000 - 60000 }; return tok.v;
  }
  const msisdn = p => { const d = String(p).replace(/\D/g, ''); return d.startsWith('254') ? d : d.startsWith('0') ? '254' + d.slice(1) : '254' + d; };
  async function stkPush(pay) {
    const t = stamp(), pw = Buffer.from(env.MPESA_SHORTCODE + env.MPESA_PASSKEY + t).toString('base64');
    const cb = env.MPESA_CALLBACK_URL + (env.MPESA_CALLBACK_URL.includes('?') ? '&' : '?') + 'k=' + hmac('mpesa:' + pay.id).slice(0, 24);
    const r = await request(mbase() + '/mpesa/stkpush/v1/processrequest', { method: 'POST', headers: { Authorization: 'Bearer ' + await mpesaToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ BusinessShortCode: env.MPESA_SHORTCODE, Password: pw, Timestamp: t, TransactionType: 'CustomerPayBillOnline', Amount: pay.amount, PartyA: msisdn(pay.phone), PartyB: env.MPESA_SHORTCODE, PhoneNumber: msisdn(pay.phone), CallBackURL: cb, AccountReference: 'SEMACHAT', TransactionDesc: 'SemaChat wallet top up' }) });
    if (!r.body || r.body.ResponseCode !== '0') throw new Error((r.body && (r.body.errorMessage || r.body.ResponseDescription)) || 'M-Pesa refused the request (' + r.status + ')');
    return r.body.CheckoutRequestID;
  }
  const payStore = db => (db.pay || (db.pay = { pending: {} }));
  core.use(function (X) {
    const { route, fail, wallet, addTx, notify, audit } = X;
    if (cfg.mpesa) {
      hooks.payments = {
        topup(c, amount) {
          const ps = payStore(c.db), phone = String(c.body.phone || c.user.phone);
          if (!/^\+?[0-9]{9,15}$/.test(phone.replace(/[\s-]/g, ''))) fail(400, 'Enter a valid M-Pesa number.');
          const pay = { id: 'pay_' + crypto.randomBytes(6).toString('hex'), userId: c.user.id, amount, phone, mode: c.mode, status: 'initiated', createdAt: Date.now() };
          ps.pending[pay.id] = pay;
          stkPush(pay).then(id => { pay.checkoutId = id; pay.status = 'sent'; hooks.persist(); }).catch(e => { pay.status = 'failed'; pay.error = e.message; log.warn('[mpesa] ' + e.message); hooks.persist(); });
          return { pending: true, id: pay.id, message: 'Check your phone and enter your M-Pesa PIN to finish.' };
        }
      };
    }
    route('GET', /^\/api\/wallet\/topup\/(pay_[a-f0-9]+)$/, 'user', 'wallet', c => {
      const p = payStore(c.db).pending[c.p[0]]; if (!p || p.userId !== c.user.id) fail(404, 'Payment not found.');
      return { id: p.id, status: p.status, amount: p.amount, error: p.error || null, receipt: p.receipt || null, balance: wallet(c.db, c.user.id).balance };
    });
    // Safaricom calls this when the customer approves or cancels. The key in the URL stops anyone else faking it.
    route('POST', /^\/api\/pay\/mpesa\/callback$/, null, null, c => {
      const cb = (c.body.Body || {}).stkCallback || {}, ps = payStore(c.db);
      const p = Object.values(ps.pending).find(x => x.checkoutId && x.checkoutId === cb.CheckoutRequestID);
      if (!p || String(c.query.k || '') !== hmac('mpesa:' + p.id).slice(0, 24)) fail(403, 'Unknown payment.');
      if (p.status === 'paid') return { ResultCode: 0, ResultDesc: 'Already processed' };
      const items = ((cb.CallbackMetadata || {}).Item || []).reduce((o, i) => (o[i.Name] = i.Value, o), {});
      if (cb.ResultCode === 0 && Math.round(+items.Amount) === p.amount) {
        p.status = 'paid'; p.receipt = items.MpesaReceiptNumber || ''; wallet(c.db, p.userId).balance += p.amount;
        addTx(c.db, p.userId, { type: 'in', kind: 'topup', mode: p.mode || 'normal', title: 'Top up • M-Pesa ' + p.receipt, amount: p.amount });
        notify(c.db, p.userId, { type: 'wallet', mode: p.mode || 'normal', title: 'Top-up received', body: 'KES ' + p.amount.toLocaleString('en-KE') + ' was added to your wallet.' });
      } else { p.status = 'failed'; p.error = cb.ResultDesc || 'Payment cancelled'; }
      hooks.persist(); return { ResultCode: 0, ResultDesc: 'Accepted' };
    });
    route('GET', /^\/api\/admin\/providers$/, 'admin', null, c => Object.assign(status(), { classifiers: core.compliance ? core.compliance.classifiers() : 0, pendingPayments: Object.values(payStore(c.db).pending).filter(p => ['initiated', 'sent'].includes(p.status)).length, turn: !!env.SEMACHAT_TURN_URL, livekit: !!env.LIVEKIT_URL, storage: env.SEMACHAT_DB && /\.(sqlite|db)$/i.test(env.SEMACHAT_DB) ? 'SQLite' : 'JSON file' }));
  });
  return { cfg, status, sendEmail, checkEmail, health, stkPush, codes };
};
