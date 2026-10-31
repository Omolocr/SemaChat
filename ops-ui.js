/* SemaChat — developer console: Access audit (who looked at personal data, consent records) and Providers & health. */
(function () {
  'use strict';
  const _load = window.adminLoadExt;
  window.adminLoadExt = async function (s, A) {
    if (_load) await _load(s, A);
    if (s === 'access') A.access = await api('GET', '/api/admin/access-log', null, true);
    if (s === 'providers') A.prov = await api('GET', '/api/admin/providers', null, true).catch(() => null);
  };
  const tm = ts => new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  window.aAccess = function () {
    const a = S.a.access; if (!a) return '<h2>Access audit</h2>';
    return `<h2>Access audit</h2><p class="lead">Every developer-dashboard action is recorded here. Anything that opens personal data (people, ID documents, loans, safety alerts, donation documents) is flagged. Repeated identical requests within 30 seconds are collapsed.</p>
    <div class="grid"><div class="gk"><span>Recorded actions</span><b>${a.total}</b></div><div class="gk"><span>Sensitive-data views</span><b>${a.sensitive}</b></div><div class="gk"><span>Consents on record</span><b>${a.consent.recorded}/${a.consent.ofUsers}</b></div><div class="gk"><span>Message classifiers</span><b>${a.classifiers.builtIn + a.classifiers.external}</b></div></div>
    <p class="mut sm">${esc(a.consent.note)} Terms version ${esc(a.consent.version)}. Detection runs ${a.classifiers.builtIn} built-in rules plus ${a.classifiers.external} plug-in classifier${a.classifiers.external === 1 ? '' : 's'}.</p>
    <div class="pn"><table class="tbl"><tr><th>When</th><th>Action</th><th>Data</th><th></th></tr>${a.entries.map(e => `<tr><td class="sm">${tm(e.ts)}</td><td><code>${esc(e.method)} ${esc(e.what)}</code></td><td>${e.sensitive ? '<span class="tagb o">personal data</span>' : '<span class="mut sm">settings</span>'}</td><td class="sm mut">${e.n > 1 ? '×' + e.n : ''}</td></tr>`).join('')}</table></div>`;
  };
  window.aProviders = function () {
    const p = S.a.prov; if (!p) return '<h2>Providers & health</h2><p class="lead">Provider status is available when the app runs on the backend server.</p>';
    const row = (n, v, hint) => `<tr><td><b>${n}</b></td><td>${/^live|signed|JSON|SQLite/.test(v) ? '<span class="tagb b">' + esc(v) + '</span>' : '<span class="tagb o">' + esc(v) + '</span>'}</td><td class="sm mut">${hint}</td></tr>`;
    return `<h2>Providers & health</h2><p class="lead">What is real and what is still demo. Health checks for monitors: <code>/healthz</code> and <code>/readyz</code>.</p>
    <div class="pn"><table class="tbl"><tr><th>Service</th><th>Status</th><th>How to switch on</th></tr>${row('Email verification codes', p.email, 'RESEND_API_KEY, EMAIL_FROM (Resend)')}${row('M-Pesa top-ups', p.mpesa, 'MPESA_CONSUMER_KEY / SECRET / SHORTCODE / PASSKEY / CALLBACK_URL')}${row('Session security', p.sessions, 'SEMACHAT_SECRET (24+ random characters)')}${row('Call relay (TURN)', p.turn ? 'live' : 'not set', 'SEMACHAT_TURN_URL, SEMACHAT_TURN_USER, SEMACHAT_TURN_CRED')}${row('Group calls (LiveKit)', p.livekit ? 'live' : 'not set', 'LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET')}${row('Storage', p.storage, 'SEMACHAT_DB=/data/semachat.sqlite for SQLite')}</table></div>
    <p class="sm mut">Payments waiting for the customer to approve: ${p.pendingPayments}. Plug-in message classifiers: ${p.classifiers}.</p>`;
  };
})();
