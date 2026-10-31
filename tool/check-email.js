#!/usr/bin/env node
/* Checks the login-code mailbox. Usage:
 *   node backend/tools/check-email.js                 -> logs in to the mailbox only (sends nothing)
 *   node backend/tools/check-email.js you@example.com -> also sends a test email with a sample code
 * With Docker:  docker compose exec semachat node backend/tools/check-email.js you@example.com
 * Reads the same environment variables as the server (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM, RESEND_API_KEY). */
'use strict';
const core = require('../core');
const prov = require('../providers')(core, process.env, console);
(async () => {
  const to = process.argv[2];
  console.log('Mode: ' + prov.health.mode + (process.env.SMTP_HOST ? '  host=' + process.env.SMTP_HOST + ' port=' + (process.env.SMTP_PORT || 465) + ' user=' + (process.env.SMTP_USER || '(none)') : ''));
  if (prov.health.mode === 'demo') { console.log('❌ No mailbox is configured (SMTP_HOST or RESEND_API_KEY missing). Login codes are not sent.'); process.exit(2); }
  const h = await prov.checkEmail();
  if (h.ok === false) { console.log('❌ Cannot log in to the mailbox: ' + h.lastError); console.log('   Common causes: wrong password, wrong port (465 = SSL, 587 = STARTTLS), host blocks the server IP, or the host needs an "app password".'); process.exit(1); }
  console.log('✅ Mailbox login works.');
  if (to) {
    try { await prov.sendEmail(to, 'SemaChat test email', 'This is a test from SemaChat. Sample code: TEST42', '<p>This is a test from SemaChat. Sample code: <b>TEST42</b></p>'); console.log('✅ Test email sent to ' + to + '. Check the inbox AND the spam folder.'); }
    catch (e) { console.log('❌ Sending failed: ' + e.message); process.exit(1); }
  }
  process.exit(0);
})();
