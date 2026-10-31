/* SemaChat — adjustments UI add-on (loaded after business-ui.js via <!--ADJ-->).
 * Sign-up requirements (Personal / Corporate / Institution + guardian for minors), profile Normal/Business widgets,
 * badge colours + ID submission, location locator, wallet bank account + loans, guardian alerts,
 * Moments ring + full-screen viewer + composer, Super Moments, and the developer console views
 * (People, Safety & minors, Money alerts, Bank & loans).
 * Chats deliberately show no delivered / read ticks and no last-seen or "online" status. */
(function () {
  'use strict';
  const ad = S.ad = { su: null, bank: null, idn: null, loc: null, guard: null, loans: null, rings: null, sup: null,
    mk: { kind: 'moment', segs: [], caption: '', sponsored: false, link: true }, bk: { city: '', area: '', work: '', consent: false },
    id: { idType: 'national_id', idNumber: '' }, ln: { lender: null, amount: '', term: 30 }, pdet: null };
  S.apf = { g: '', a: '', t: '', q: '' };
  const tryA = async (m, p, b) => { try { return await api(m, p, b); } catch (e) { return null; } };
  const reload = async () => { await load(); render(); };
  const mmss2 = s => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');
  const tm = ts => ts ? new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const grad2 = g => `linear-gradient(135deg,${(g || ['#553c9a', '#2b6cb0']).join(',')})`;
  const mediaStyle = m => m && m.img ? `background-image:url(${m.img});background-size:cover` : `background:${grad2(m && m.g)}`;
  const css = document.createElement('style');
  css.textContent = `
  .mring{display:flex;flex-wrap:nowrap;align-items:flex-start;gap:10px;overflow-x:auto;overflow-y:hidden;padding:4px 16px 12px;scrollbar-width:none;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}.mring::-webkit-scrollbar{display:none}.mring>button{flex:0 0 70px;width:70px;height:86px;text-align:center;font-size:11.5px;scroll-snap-align:start;overflow:hidden}.mring .rg{position:relative}.mring .ad{position:absolute;bottom:-2px;right:-2px;background:#b7791f;color:#fff;border-radius:99px;font-size:9px;padding:1px 5px;line-height:1.3}.mring .ad.bz{background:#2b6cb0}.mring .mmore{flex:0 0 24px;align-self:center;color:var(--muted);text-align:center}
  .mring .rg{width:62px;height:62px;border-radius:50%;padding:3px;margin:0 auto 4px;background:conic-gradient(var(--brand),#f6ad55,var(--brand2),var(--brand))}
  .mring .rg.seen{background:#c9c4b8}.mring .rg.biz{background:conic-gradient(#2b6cb0,#38b2ac,#2b6cb0)}
  .mring .rg>div{width:100%;height:100%;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;overflow:hidden;background-size:cover}
  .mring .add .rg{background:var(--soft)}.mring .add .rg>div{background:var(--soft);color:var(--brand);font-size:28px;font-weight:700}
  .mring .nm{display:block;width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mring .sp{color:#b7791f;font-size:10px}
  .scard{min-width:150px;max-width:150px;height:210px;border-radius:18px;color:#fff;position:relative;overflow:hidden;flex-shrink:0;text-align:left;padding:10px;display:flex;flex-direction:column;justify-content:flex-end}
  .scard .em{position:absolute;top:34%;left:0;right:0;text-align:center;font-size:54px}.scard b{font-size:13px;text-shadow:0 1px 3px #0008}.scard small{opacity:.9;text-shadow:0 1px 3px #0008}
  #mviewer{position:fixed;inset:0;z-index:300;color:#fff;display:flex;flex-direction:column;background:#111;max-width:520px;margin:0 auto}
  #mviewer .stage{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:140px}
  #mviewer .stage img{width:100%;height:100%;object-fit:cover}
  #mviewer .tp,#mviewer .bt{position:relative;z-index:2;padding:12px 14px}
  #mviewer .tp{background:linear-gradient(#0009,transparent)}#mviewer .bt{margin-top:auto;background:linear-gradient(transparent,#000b)}
  #mviewer .pgs{display:flex;gap:4px;margin-bottom:10px}#mviewer .pgs i{flex:1;height:3px;border-radius:2px;background:#fff4;overflow:hidden}#mviewer .pgs i b{display:block;height:100%;width:0;background:#fff}
  #mviewer .who{display:flex;align-items:center;gap:10px}#mviewer .tap{position:absolute;top:80px;bottom:190px;width:40%;z-index:1}
  #mviewer .rx{display:flex;gap:6px;justify-content:center;margin:8px 0}#mviewer .rx button{font-size:26px;background:#fff2;border-radius:50%;width:44px;height:44px}#mviewer .rx button.on{background:#fff5;outline:2px solid #fff}
  #mviewer input{background:#fff2;color:#fff;border:0;border-radius:99px;padding:10px 14px;flex:1}#mviewer input::placeholder{color:#fffb}
  #mviewer .cm{max-height:92px;overflow:auto;font-size:13px;margin-bottom:6px}#mviewer .lnk{background:#fff;color:#111;border-radius:99px;padding:9px 16px;font-weight:800;display:inline-block;margin-bottom:8px}
  #mviewer button{color:#fff}#mviewer .lnk{color:#111}
  .fly{position:fixed;font-size:44px;z-index:400;pointer-events:none;animation:flyup 1s forwards}@keyframes flyup{to{transform:translateY(-160px);opacity:0}}
  .legend{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.legend span{font-size:11.5px;padding:3px 8px;border-radius:99px}
  .modew{display:flex;background:var(--soft);border-radius:16px;padding:4px;margin:0 16px 6px}.modew button{flex:1;padding:10px 6px;border-radius:12px;font-weight:800;font-size:14px}
  .modew button.on{background:#fff;box-shadow:0 1px 4px #0002}.modew button.on.b{background:#1EC40B;color:#fff}
  .sw{width:46px;height:26px;border-radius:99px;background:#cbd5e0;position:relative;flex-shrink:0}.sw.on{background:var(--brand)}.sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s}.sw.on i{left:23px}
  .scorebar{height:10px;border-radius:99px;background:linear-gradient(90deg,#e53e3e,#ecc94b,#38a169);position:relative}.scorebar i{position:absolute;top:-4px;width:4px;height:18px;background:#111;border-radius:2px}
  .sev-high{color:#c53030;font-weight:700}.sev-medium{color:#b7791f;font-weight:700}.sev-low{color:#718096}`;
  document.head.appendChild(css);

  /* ============================================================ data loading */
  const _load = window.load;
  window.load = async function () {
    await _load();
    const v = cur(), k = v ? v.n : S.tab;
    if (k === 'chats' && !isBiz()) ad.rings = await tryA('GET', '/api/moments?limit=12');
    else if (k === 'contacts' && S.cs === 'ana') ad.sup = await tryA('GET', '/api/moments/super');
    else if (k === 'wallet') ad.bank = await tryA('GET', '/api/bank');
    else if (k === 'me') { ad.idn = await tryA('GET', '/api/me/identity'); ad.loc = await tryA('GET', '/api/location'); ad.guard = await tryA('GET', '/api/guardian'); }
    else if (k === 'adloans') ad.loans = await tryA('GET', '/api/loans/offers');
    else if (k === 'adguard') ad.guard = await tryA('GET', '/api/guardian');
    else if (k === 'adloc') ad.loc = await tryA('GET', '/api/location');
  };

  /* ============================================================ sign-up with full requirements */
  const blankSu = () => ({ name: '', legalName: '', idType: 'national_id', idNumber: '', gender: '', age: '', city: '', area: '', workAddress: '',
    orgName: '', regNumber: '', kraPin: '', sector: '', instType: '', accreditation: '',
    g: { name: '', relation: 'Parent', phone: '', email: '', idType: 'national_id', idNumber: '', gender: '', age: '', city: '', approvalCode: '' } });
  ad.su = blankSu();
  const getP = p => p.split('.').reduce((a, k) => a[k], ad.su);
  const setP = (p, v) => { const k = p.split('.'), last = k.pop(); k.reduce((a, x) => a[x], ad.su)[last] = v; };
  const REQ = {
    user: ['Your real name exactly as on your National ID or Passport', 'National ID or Passport number (optional at sign-up; without it your badge stays Yellow)', 'Gender (Male or Female) and age. You must be 18 or older', 'City / town / village and area where you live', 'Work address (optional now, mandatory when you activate the wallet)', 'Phone number and a backup email for recovery', 'Under 18? A parent or guardian must approve and provide their own details'],
    corporate: ['Registered business name', 'Registration / incorporation number', 'KRA PIN', 'Sector of business', 'Head office city and physical address', 'Phone number and a backup email', 'A monthly plan is required to post (fee charged by SemaChat)'],
    institution: ['Registered institution name and type (school, college, hospital, NGO, church, government…)', 'Registration number and KRA PIN', 'Accreditation / licence (where applicable)', 'Head office city and physical address', 'Phone number and a backup email', 'A monthly plan is required to post (fee charged by SemaChat)']
  };
  const fld = (l, p, o) => { o = o || {}; return `<label class="lb">${l}</label><input ${o.type ? 'type="' + o.type + '"' : ''} data-bind="ad.su.${p}" ${o.onchg ? 'data-onchg="' + o.onchg + '"' : ''} value="${esc(getP(p))}" placeholder="${esc(o.ph || '')}" ${S.auth.step === 2 ? 'disabled' : ''}>`; };
  const chipsel = (p, opts) => `<div class="row" style="flex-wrap:wrap">${opts.map(o => `<button class="chip ${getP(p) === o[0] ? 'on' : ''}" data-act="adsu" data-p="${p}" data-v="${o[0]}">${o[1]}</button>`).join('')}</div>`;
  function signupForm() {
    const a = S.auth, s = ad.su, r = a.role, minor = r === 'user' && s.age !== '' && +s.age < 18;
    const ids = [['national_id', 'National ID'], ['passport', 'Passport']];
    let body = '';
    if (r === 'user') {
      body += fld('Name shown to friends', 'name', { ph: 'e.g. Amani' }) + fld('Real name on National ID / Passport', 'legalName', { ph: 'As printed on your ID' }) +
        `<label class="lb">ID type</label>${chipsel('idType', ids)}` + fld('National ID / Passport number (optional now)', 'idNumber', { ph: 'Leave blank to stay unverified (Yellow)' }) +
        `<label class="lb">Gender</label>${chipsel('gender', [['male', 'Male'], ['female', 'Female']])}` + fld('Age', 'age', { type: 'number', onchg: 'adrender', ph: '18 or older' }) +
        fld('City / town / village of residence', 'city') + fld('Residential area / estate', 'area') + fld('Work address (optional; required for the wallet)', 'workAddress');
      body += `<div class="legend"><span style="background:#fef3c7">🟡 Yellow: no ID submitted</span><span style="background:#dcfce7">🟢 Green: ID submitted</span><span style="background:#fde68a">★ Gold: ID + paid version, no ads</span></div>`;
      if (minor) body += `<div class="card col" style="margin-top:12px;background:#fff7ed"><b>👨‍👩‍👧 Parent / guardian approval</b><p class="mut sm">Under 18 accounts need a guardian. They provide the same details as an adult and get a linked second account that is alerted about safety risks (adult content, strangers, risky places or activities). Alerts are also sent to SemaChat. Accounts can be removed after more than 3 violations.</p>` +
        fld('Guardian full name', 'g.name') + fld('Relationship', 'g.relation') + fld('Guardian email (the approval code is sent here)', 'g.email', { type: 'email' }) + fld('Guardian phone (optional)', 'g.phone', { type: 'tel' }) +
        `<label class="lb">Guardian ID type</label>${chipsel('g.idType', ids)}` + fld('Guardian ID / passport number', 'g.idNumber') + `<label class="lb">Guardian gender</label>${chipsel('g.gender', [['male', 'Male'], ['female', 'Female']])}` + fld('Guardian age', 'g.age', { type: 'number' }) + fld('Guardian city / town', 'g.city') + fld('Approval code emailed to the guardian', 'g.approvalCode', { ph: 'Demo: 123ABC' }) + '</div>';
    } else {
      body += fld(r === 'corporate' ? 'Registered business name' : 'Registered institution name', 'orgName') + fld('Registration / incorporation number', 'regNumber') + fld('KRA PIN', 'kraPin');
      body += r === 'corporate' ? fld('Sector of business', 'sector', { ph: 'e.g. Food & beverage' }) : `<label class="lb">Type of institution</label><select data-bind="ad.su.instType" ${a.step === 2 ? 'disabled' : ''}><option value="">Choose…</option>${['School', 'College / University', 'Hospital / Clinic', 'NGO', 'Faith organisation', 'Government body', 'Other'].map(x => `<option ${s.instType === x ? 'selected' : ''}>${x}</option>`).join('')}</select>` + fld('Accreditation / licence', 'accreditation');
      body += fld('Head office city / town', 'city') + fld('Physical address', 'area');
    }
    return body;
  }
  const _authView = window.authView;
  window.authView = function () {
    const a = S.auth; if (a.mode !== 'up') return _authView();
    const roles = [['user', 'Personal'], ['corporate', 'Corporate'], ['institution', 'Institution']];
    return `<div class="scr auth"><div class="logo">🌍</div><h1>SemaChat</h1><p class="tag">I am because we are.</p>
      <div class="sub3" style="margin:0"><button data-act="authmode" data-m="in">Sign in</button><button class="on" data-act="authmode" data-m="up">Sign up</button></div>
      <div class="fm"><label class="lb">Account type</label><div class="row" style="flex-wrap:wrap">${roles.map(x => `<button class="chip ${a.role === x[0] ? 'on' : ''}" data-act="adrole" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
      <details class="card" style="margin:8px 0"><summary><b>What you need for a ${roles.find(x => x[0] === a.role)[1]} account</b></summary><ul style="margin:8px 0 0 18px;line-height:1.6;font-size:13px">${REQ[a.role].map(x => `<li>${x}</li>`).join('')}</ul></details>
      ${signupForm()}
      <label class="lb">Email address (you will sign in with it)</label><input type="email" data-bind="auth.email" value="${esc(a.email)}" ${a.step === 2 ? 'disabled' : ''} placeholder="you@example.com">
      <label class="lb">Phone number (optional)</label><input type="tel" data-bind="auth.phone" value="${esc(a.phone)}" ${a.step === 2 ? 'disabled' : ''} placeholder="0700 000 000">
      ${a.step === 2 ? `<label class="lb">Email verification code</label><input data-bind="auth.code" value="${esc(a.code)}" placeholder="ABC123" maxlength="32" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" style="text-transform:uppercase;letter-spacing:6px;font-weight:800;font-size:20px;text-align:center"><div class="hint">${esc(a.hint)}</div>` : ''}
      ${a.step === 2 ? `<label class="row sm" style="gap:8px;margin:10px 0;align-items:flex-start"><input type="checkbox" id="adConsent" data-act="adconsent" ${a.consent ? 'checked' : ''} style="margin-top:3px"><span>I agree to the <b>Terms of Use</b> and the <b>Privacy Policy</b>, including child-safety checks, money-transaction monitoring and content rules that stop messages containing words or places SemaChat does not allow. I understand my agreement is recorded.</span></label>` : ''}
      ${a.err ? `<div class="err">${esc(a.err)}</div>` : ''}
      ${a.step === 1 ? `<button class="btn full" data-act="otp">Email me a verification code</button><button class="btn alt full" data-act="addemo">Fill demo details</button>` : `<button class="btn full" data-act="authgo">Verify email &amp; create my account</button><button class="btn alt full" data-act="authmode" data-m="up">Change details</button>`}</div>
      <p class="mut sm" style="margin:16px 16px 0">We email a 6-character code (capital letters and numbers) from login1@wavehub.co.ke to verify your address. It works for 5 minutes. You then stay signed in until you tap Sign out / change account.</p><p class="mut sm" style="margin:16px">SemaChat is for people 13 and older. Under 18s need a guardian's approval. By signing up you agree that the safety checks and money-transaction monitoring described in our terms apply.</p></div>`;
  };

  /* ============================================================ profile widgets (Normal / Business), badges, locator, guardian */
  const TIER = { yellow: ['🟡', 'Not verified', 'No National ID / Passport submitted'], green: ['🟢', 'Verified', 'National ID / Passport submitted'], gold: ['★', 'Gold verified', 'ID submitted + paid version: no ads'] };
  window.profileWidgets = function () {
    const m = S.me, mode = m.activeMode || 'normal', i = ad.idn, t = m.tier || 'yellow', tw = TIER[t], l = ad.loc, gd = ad.guard;
    let h = `<div class="modew"><button class="${mode === 'normal' ? 'on' : ''}" data-act="msw" data-v="normal">👤 Normal</button><button class="${mode === 'business' ? 'on b' : ''}" data-act="msw" data-v="business">🏪 Business</button></div>
      <p class="mut sm" style="padding:0 18px 8px">${mode === 'normal' ? '<b>Normal</b>: your personal space. Chats with friends and family, Moments, Around &amp; About and your wallet. ' + (m.hasBizAccount ? 'Tap <b>Business</b> to switch to your business inbox, catalog, orders and ads.' : 'Tap <b>Business</b> to see what it offers and register your business.') : '<b>Business</b>: customer chats, catalog, orders, ads and analytics under your business name. Same wallet and identity. Tap <b>Normal</b> to go back to your personal side.'}</p>`;
    if (m.role === 'user') {
      h += `<div class="card" style="margin:0 16px 10px"><div class="row"><span style="font-size:22px">${tw[0]}</span><div class="grow"><b>${tw[1]}</b><div class="mut sm">${tw[2]}</div></div>${t === 'yellow' ? '<button class="btn sm" data-act="adidsheet">Submit ID</button>' : t === 'green' ? '<button class="btn sm alt" data-act="go" data-p="plans">Go Gold</button>' : ''}</div>
        <div class="legend"><span style="background:#fef3c7">🟡 Yellow: not verified</span><span style="background:#dcfce7">🟢 Green: ID submitted</span><span style="background:#fde68a">★ Gold: ID + paid, no ads</span></div></div>`;
    }
    if (l) h += `<div class="card row" style="margin:0 16px 10px"><span style="font-size:24px">📍</span><div class="grow" data-act="go" data-p="adloc"><b>Location locator</b><div class="mut sm">${l.me && l.me.on ? 'On · sharing ' + esc(l.me.label) + ' with friends' : 'Off · nobody can see where you are'}</div></div><div class="sw ${l.me && l.me.on ? 'on' : ''}" data-act="adlocsw"><i></i></div></div>`;
    if (i && i.minor && i.guardian) h += `<div class="card" style="margin:0 16px 10px;background:#fff7ed"><b>🛡️ Protected account</b><div class="mut sm">${esc(i.guardian.name)} (${esc(i.guardian.relation)}) is your guardian. They are alerted about safety risks and guideline breaches. Violations: ${i.violations}/3.</div></div>`;
    if (gd && gd.isGuardian) h += `<div class="card row" style="margin:0 16px 10px" data-act="go" data-p="adguard"><span style="font-size:24px">👨‍👩‍👧</span><div class="grow"><b>Guardian dashboard</b><div class="mut sm">${gd.minors.length} linked account${gd.minors.length === 1 ? '' : 's'} · ${gd.alerts.filter(a => !a.ack).length} open alert(s)</div></div>›</div>`;
    return h;
  };

  /* ============================================================ wallet: bank account + loans */
  const _wallet = window.walletPage;
  window.walletPage = function () {
    const h = _wallet(), b = ad.bank; if (!b || h.indexOf('<div class="chips"') < 0) return h;
    const card = b.active ? `<div class="card" style="margin:12px 16px 0"><div class="row"><span style="font-size:24px">🏦</span><div class="grow"><b>${esc(b.account.bank)}</b><div class="mut sm">Account ${esc(b.account.accountNo)} · ${esc(b.account.branch)} branch</div></div><button class="btn sm" data-act="go" data-p="adloans">Loans</button></div><div class="mut sm" style="margin-top:6px">Records are kept by ${b.account.recordHolders.map(esc).join(' and ')}.</div></div>`
      : `<div class="card" style="margin:12px 16px 0;background:#f0fff4"><b>🏦 Activate your wallet</b><p class="mut sm" style="margin:4px 0 8px">Activating opens a bank account with <b>${esc(b.designatedBank)}</b>, and unlocks small loans.</p>${b.requirements.map(r => `<div class="sm">${r[1] ? '✅' : '⬜'} ${esc(r[0])}</div>`).join('')}<button class="btn full" style="margin-top:10px" data-act="adbanksheet">Activate wallet</button></div>`;
    return h.replace('<div class="chips"', () => card + '<div class="chips"');
  };
  function loansPage() {
    const d = ad.loans; if (!d) return ph('Loans') + '<div class="empty">Loading…</div>';
    if (!d.active) return ph('Loans') + `<div class="empty"><b>🏦</b>Activate your wallet first. It opens your bank account and unlocks loans.<br><button class="btn" style="margin-top:10px" data-act="go" data-p="wallet">Go to wallet</button></div>`;
    const sc = d.score;
    return ph('Loans') + `<div class="card" style="margin:0 16px 10px"><div class="row"><b class="grow">SemaChat Trust Score</b><b style="font-size:22px">${sc.score}</b></div><div class="scorebar" style="margin:10px 0 4px"><i style="left:calc(${sc.score}% - 2px)"></i></div><div class="mut sm">${sc.band} · based on your wallet behaviour and repayments</div>
      <div style="margin-top:8px">${sc.factors.map(f => `<div class="stat"><span>${esc(f.label)}</span><b style="color:${f.pts < 0 ? '#c53030' : '#2f855a'}">${f.pts > 0 ? '+' : ''}${f.pts}</b></div>`).join('')}</div></div>
      ${d.owing ? `<div class="hint" style="margin:0 16px 10px">You currently owe <b>${money(d.owing)}</b>.</div>` : ''}
      <div class="sec">Lenders on SemaChat</div>${d.offers.map(o => `<div class="card" style="margin:0 16px 10px"><div class="row"><b class="grow">${esc(o.name)}</b>${o.vetted ? '<span class="tagb">✓ Vetted</span>' : ''}</div><div class="mut sm">${esc(o.tagline)} · ${esc(o.licence)}</div>
        <div class="stat"><span>Interest</span><b>${o.monthlyRatePct}% / month</b></div><div class="stat"><span>You can borrow now</span><b>${o.eligible ? money(o.available) : 'Not yet · needs score ' + o.minScore}</b></div>
        <button class="btn full" style="margin-top:6px" data-act="adloanform" data-id="${o.id}" ${o.eligible ? '' : 'disabled'}>Apply</button></div>`).join('')}
      <div class="sec">My loans</div>${d.loans.map(l => `<div class="card" style="margin:0 16px 10px"><div class="row"><b class="grow">${esc(l.lender)}</b><span class="tagb ${l.status === 'repaid' ? '' : 'o'}">${l.status}</span></div><div class="stat"><span>Borrowed ${money(l.principal)} + interest ${money(l.interest)}</span><b>Owing ${money(l.balance)}</b></div><div class="mut sm">Due ${dt(l.dueAt)} · records kept by ${l.recordHolders.map(esc).join(' and ')}</div>
        ${l.status !== 'repaid' ? `<div class="row" style="margin-top:8px"><button class="btn sm grow" data-act="adrepay" data-id="${l.id}">Repay ${money(l.balance)}</button><button class="btn sm alt" data-act="adage" data-id="${l.id}" title="Demo">⏩ Fast-forward</button></div>` : ''}</div>`).join('') || '<div class="empty" style="padding:12px">No loans yet.</div>'}`;
  }

  /* ============================================================ location + guardian pages */
  const SPOTS = [['Nanyuki Town', 0.0167, 37.0739], ['Nairobi CBD', -1.2864, 36.8172], ['Nightclub strip (demo)', 0.0191, 37.0771]];
  function adlocPage() {
    const l = ad.loc; if (!l) return ph('Location locator') + '<div class="empty">Loading…</div>'; const on = l.me && l.me.on;
    return ph('Location locator') + `<div class="card row" style="margin:0 16px 10px"><div class="grow"><b>Share my location with friends</b><div class="mut sm">You can turn this off any time. When it is off nobody sees where you are.</div></div><div class="sw ${on ? 'on' : ''}" data-act="adlocsw"><i></i></div></div>
      ${on ? `<div class="sec">Pretend I am at (demo)</div><div class="chips" style="padding:0 16px">${SPOTS.map((s, i) => `<button class="chip ${l.me.label === s[0] ? 'on' : ''}" data-act="adlocspot" data-i="${i}">${s[0]}</button>`).join('')}</div>` : ''}
      <div class="sec">Friends sharing nearby</div>${l.friends.map(f => `<div class="li"><div class="av" style="background:${f.color}">${esc(ini(f.name))}</div><div class="grow"><b>${esc(f.name)}</b><div class="mut sm">📍 ${esc(f.label)}</div></div><span class="sm">${f.km == null ? '' : f.km + ' km'}</span></div>`).join('') || '<div class="empty" style="padding:14px">No friends are sharing their location.</div>'}`;
  }
  function adguardPage() {
    const g = ad.guard; if (!g) return ph('Guardian dashboard') + '<div class="empty">Loading…</div>';
    return ph('Guardian dashboard') + g.minors.map(k => `<div class="card" style="margin:0 16px 10px"><div class="row"><b class="grow">${esc(k.name)} · ${k.age}</b><span class="tagb ${k.violations ? 'o' : ''}">${k.violations}/3 violations</span></div><div class="mut sm">${k.locationOn ? '📍 ' + esc(k.location.label) : '📍 Location sharing is off'}${k.status !== 'active' ? ' · account ' + k.status : ''}</div></div>`).join('') +
      `<div class="sec">Safety alerts</div>` + (g.alerts.map(a => `<div class="card" style="margin:0 16px 10px;${a.ack ? 'opacity:.6' : ''}"><div class="row"><b class="grow">${esc(a.label)}</b><span class="sev-${a.severity}">${a.severity}</span></div><div>${esc(a.text)}</div>${a.excerpt ? `<div class="mut sm" style="margin-top:4px">“${esc(a.excerpt)}”</div>` : ''}<div class="row" style="margin-top:6px"><span class="mut sm grow">${tm(a.ts)} · also sent to SemaChat</span>${a.ack ? '' : `<button class="chip" data-act="adack" data-id="${a.id}">Got it</button>`}</div></div>`).join('') || '<div class="empty" style="padding:14px">No alerts. 🎉</div>');
  }

  /* ============================================================ moments ring + super moments */
  const ringBtn = (g, i) => `<button data-act="admopen" data-k="moment" data-i="${i}"><div class="rg ${g.seen ? 'seen' : ''} ${g.business ? 'biz' : ''}"><div style="${mediaStyle(g.cover)}">${g.cover && g.cover.emoji ? g.cover.emoji : ''}</div>${g.sponsored ? '<b class="ad">Ad</b>' : g.business ? '<b class="ad bz">Biz</b>' : ''}</div><span class="nm">${g.mine ? 'Your moment' : esc(g.name.split(' ')[0])}</span></button>`;
  function ringHtml() {
    const r = ad.rings; if (!r) return '';
    return `<div class="mring" id="mring"><button class="add" data-act="admk" data-k="moment"><div class="rg"><div>＋</div></div><span class="nm">Add</span></button>${r.rings.map(ringBtn).join('')}${r.hasMore ? '<i class="mmore" id="mmore">…</i>' : ''}</div>`;
  }
  // load the next page of moments when the line-up is scrolled to its end (contacts' moments first, then businesses)
  let ringBusy = false;
  document.addEventListener('scroll', async e => {
    const el = e.target; if (!el || el.id !== 'mring' || ringBusy || !ad.rings || !ad.rings.hasMore) return;
    if (el.scrollLeft + el.clientWidth < el.scrollWidth - 90) return;
    ringBusy = true;
    try {
      const r = await tryA('GET', '/api/moments?offset=' + ad.rings.rings.length + '&limit=20');
      if (r && r.rings.length) { const base = ad.rings.rings.length; ad.rings.rings = ad.rings.rings.concat(r.rings); ad.rings.hasMore = r.hasMore; const m = el.querySelector('#mmore'); if (m) m.remove(); el.insertAdjacentHTML('beforeend', r.rings.map((g, i) => ringBtn(g, base + i)).join('') + (r.hasMore ? '<i class="mmore" id="mmore">…</i>' : '')); }
      else ad.rings.hasMore = false;
    } finally { ringBusy = false; }
  }, true);
  const _chats = window.chatsView;
  window.chatsView = function () { const h = _chats(), at = h.indexOf('<div class="chips"'); return at < 0 || !ad.rings ? h : h.slice(0, at) + ringHtml() + h.slice(at); };
  function superRow() {
    const s = ad.sup; if (!s) return '';
    return `<div class="row" style="padding:8px 16px 4px"><b class="grow">⚡ Super Moments <span class="mut sm">3–5 min · contacts + businesses</span></b><button class="btn sm" data-act="admk" data-k="super">＋ Create</button></div><div class="bxrow">${s.groups.map((g, i) => `<button class="scard" data-act="admopen" data-k="super" data-i="${i}" style="${mediaStyle(g.cover)}"><span class="em">${g.cover && g.cover.emoji ? g.cover.emoji : ''}</span><b class="ell">${esc(g.caption)}</b><small>${esc(g.name)} · ${mmss2(g.totalSec)}${g.business ? ' · Business' : ''}</small></button>`).join('') || '<div class="mut sm">Nothing yet.</div>'}</div>`;
  }
  const _ana = window.anaView;
  window.anaView = function () {
    const h = _ana(), mark = 'data-act="newpost">＋</button></div>', i = h.indexOf(mark);
    return i < 0 || !ad.sup ? h : h.slice(0, i + mark.length) + superRow() + h.slice(i + mark.length);
  };

  /* ---- full-screen viewer (own DOM, independent of render()) ---- */
  const V = { list: [], gi: 0, ii: 0, t0: 0, timer: null, paused: false, el: null, showC: false, comments: [] };
  const itemMs = it => Math.min(it.durationSec, 5) * 1000; // the preview plays clips at demo speed
  function vStop() { clearInterval(V.timer); V.timer = null; }
  function vClose() { vStop(); if (V.el) { V.el.remove(); V.el = null; } V.paused = false; V.showC = false; reload().catch(() => { }); }
  function vFly(e) { const f = document.createElement('div'); f.className = 'fly'; f.textContent = e; f.style.left = (40 + Math.random() * 40) + '%'; f.style.bottom = '140px'; document.body.appendChild(f); setTimeout(() => f.remove(), 1000); }
  async function vLoadComments(it) { V.comments = (await tryA('GET', '/api/moments/' + it.id + '/comments')) || []; }
  function vDraw() {
    const g = V.list[V.gi]; if (!g) return vClose(); const it = g.items[V.ii];
    if (!V.el) { V.el = document.createElement('div'); V.el.id = 'mviewer'; document.body.appendChild(V.el); }
    V.el.innerHTML = `<div class="stage" style="${it.media && it.media.img ? '' : 'background:' + grad2(it.media && it.media.g)}">${it.media && it.media.img ? `<img src="${it.media.img}">` : esc((it.media && it.media.emoji) || '🎬')}</div>
      <div class="tap" style="left:0" data-v="prev"></div><div class="tap" style="right:0" data-v="next"></div>
      <div class="tp"><div class="pgs">${g.items.map((x, k) => `<i><b data-pb="${k}" style="width:${k < V.ii ? 100 : 0}%"></b></i>`).join('')}</div>
        <div class="who">${av(g.author, 38)}<div class="grow"><b>${g.mine ? 'Your moment' : esc(g.name)}</b>${g.sponsored ? ' <span class="tagb o">Sponsored</span>' : g.business ? ' <span class="tagb b">Business</span>' : ''}<div class="sm" style="opacity:.85">${ago(it.ts)} · clip ${V.ii + 1}/${g.items.length} · ${mmss2(it.durationSec)}</div></div>${g.mine ? '<button data-v="del" style="font-size:18px;margin-right:10px">🗑️</button>' : ''}<button data-v="close" style="font-size:26px">✕</button></div></div>
      <div class="bt">${it.caption ? `<div style="font-size:17px;margin-bottom:8px;text-shadow:0 1px 3px #000">${esc(it.caption)}</div>` : ''}${it.link ? `<button class="lnk" data-v="link">${esc(it.link.label || 'Visit our page')} ›</button>` : ''}
        ${g.mine ? `<div class="sm" style="opacity:.9">👁 ${it.views} views · ${it.comments} comments${it.clicks ? ' · ' + it.clicks + ' link taps' : ''}</div>` : `<div class="rx">${['❤️', '😂', '😮', '👏', '🔥', '🙏'].map(e => `<button data-v="rx" data-e="${e}" class="${it.mine === e ? 'on' : ''}">${e}</button>`).join('')}</div>`}
        ${V.showC ? `<div class="cm">${V.comments.map(c => `<div><b>${esc(c.user.name.split(' ')[0])}</b> ${esc(c.text)}</div>`).join('') || '<span style="opacity:.8">No comments yet.</span>'}</div>` : ''}
        <div class="row"><input id="mvc" placeholder="Send a comment…"><button data-v="send" style="font-size:22px">➤</button><button data-v="cm" style="font-size:18px">💬 ${it.comments}</button></div></div>`;
    if (!g.mine) tryA('POST', '/api/moments/' + it.id + '/view');
    V.t0 = Date.now(); vStop(); V.timer = setInterval(vTick, 100);
  }
  function vTick() {
    if (V.paused || !V.el) return; const g = V.list[V.gi], it = g.items[V.ii], p = Math.min(1, (Date.now() - V.t0) / itemMs(it)), b = V.el.querySelector('[data-pb="' + V.ii + '"]'); if (b) b.style.width = p * 100 + '%'; if (p >= 1) vNext();
  }
  function vNext() { const g = V.list[V.gi]; V.showC = false; V.paused = false; if (V.ii < g.items.length - 1) { V.ii++; vDraw(); } else if (V.gi < V.list.length - 1) { V.gi++; V.ii = 0; vDraw(); } else vClose(); }
  function vPrev() { V.showC = false; V.paused = false; if (V.ii > 0) { V.ii--; vDraw(); } else if (V.gi > 0) { V.gi--; V.ii = 0; vDraw(); } else { V.t0 = Date.now(); } }
  function vKeep() { const i0 = V.el.querySelector('#mvc'), val = i0 ? i0.value : '', t0 = V.t0; vDraw(); V.t0 = t0; const i = V.el.querySelector('#mvc'); if (i && val) i.value = val; }
  document.addEventListener('click', async e => {
    const t = e.target.closest('#mviewer [data-v]'); if (!t) return; e.stopPropagation(); const g = V.list[V.gi], it = g.items[V.ii], k = t.dataset.v;
    if (k === 'close') vClose(); else if (k === 'next') vNext(); else if (k === 'prev') vPrev();
    else if (k === 'rx') { const r = await tryA('POST', '/api/moments/' + it.id + '/react', { emoji: t.dataset.e }); if (r) { Object.assign(it, r); vFly(t.dataset.e); V.el.querySelectorAll('[data-v=rx]').forEach(b => b.classList.toggle('on', b.dataset.e === t.dataset.e)); } }
    else if (k === 'cm') { V.showC = !V.showC; V.paused = V.showC; if (V.showC) await vLoadComments(it); vKeep(); }
    else if (k === 'send') { const i = V.el.querySelector('#mvc'), txt = i.value.trim(); if (!txt) return; const r = await tryA('POST', '/api/moments/' + it.id + '/comments', { text: txt }); if (r) { it.comments++; V.showC = true; V.paused = true; await vLoadComments(it); vKeep(); const j = V.el.querySelector('#mvc'); if (j) j.value = ''; } }
    else if (k === 'link') { const r = await tryA('POST', '/api/moments/' + it.id + '/click'); const id = (r && r.ownerId) || (it.link && it.link.ownerId); vStop(); if (V.el) { V.el.remove(); V.el = null; } if (id) go('bizpage', { id }); }
    else if (k === 'del') { if (confirm('Delete this moment?')) { await tryA('DELETE', '/api/moments/group/' + g.groupId); vClose(); } }
  }, true);
  document.addEventListener('focusin', e => { if (e.target.id === 'mvc') V.paused = true; });
  document.addEventListener('focusout', e => { if (e.target.id === 'mvc' && !V.showC) { V.paused = false; V.t0 = Date.now(); } });

  /* ---- composer (album / camera / sample clips) ---- */
  const dur = () => ad.mk.segs.reduce((n, s) => n + s.durationSec, 0);
  const SAMPLES = [['🌅', ['#f6ad55', '#c05621']], ['🌊', ['#4299e1', '#2c5282']], ['🌲', ['#48bb78', '#22543d']], ['🎶', ['#9f7aea', '#44337a']], ['🍽️', ['#ed8936', '#9c4221']], ['🏔️', ['#a0aec0', '#2d3748']], ['🎉', ['#ed64a6', '#702459']], ['📚', ['#38b2ac', '#234e52']], ['🚲', ['#ecc94b', '#744210']], ['🌍', ['#4c51bf', '#1a365d']]];
  const shrink = f => new Promise(res => { const img = new Image(), u = URL.createObjectURL(f); img.onload = () => { const c = document.createElement('canvas'), sc = Math.min(1, 520 / Math.max(img.width, img.height)); c.width = img.width * sc; c.height = img.height * sc; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', .6)); }; img.onerror = () => res(null); img.src = u; });
  const frames = f => new Promise(res => {
    const v = document.createElement('video'), u = URL.createObjectURL(f); v.muted = true; v.preload = 'metadata'; v.src = u;
    v.onloadedmetadata = async () => {
      const total = isFinite(v.duration) ? v.duration : 20, n = Math.max(1, Math.min(30, Math.ceil(total / 20))), out = [];
      for (let i = 0; i < n; i++) {
        await new Promise(r2 => { v.onseeked = r2; v.currentTime = Math.min(Math.max(0, total - .1), i * 20 + .3); setTimeout(r2, 1500); });
        const c = document.createElement('canvas'), sc = Math.min(1, 520 / Math.max(v.videoWidth || 520, v.videoHeight || 520)); c.width = (v.videoWidth || 520) * sc; c.height = (v.videoHeight || 520) * sc;
        try { c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); out.push({ img: c.toDataURL('image/jpeg', .6), sec: Math.max(1, Math.min(20, Math.round(total - i * 20))) }); } catch (e) { }
      }
      URL.revokeObjectURL(u); res(out);
    };
    v.onerror = () => res([]); setTimeout(() => res([]), 12000);
  });
  const mkInput = (id, multi, capture) => { const i = document.createElement('input'); i.type = 'file'; i.id = id; i.hidden = true; i.accept = 'image/*,video/*'; if (multi) i.multiple = true; if (capture) i.setAttribute('capture', 'environment'); document.body.appendChild(i);
    i.addEventListener('change', async e => { const fs = Array.from(e.target.files); e.target.value = ''; for (const f of fs) { if (f.type.startsWith('video/')) (await frames(f)).forEach(x => ad.mk.segs.push({ media: { img: x.img }, durationSec: x.sec })); else { const d = await shrink(f); if (d) ad.mk.segs.push({ media: { img: d }, durationSec: 20 }); } } if (S.sheet && S.sheet.n === 'admk') render(); }); };
  mkInput('adAlb', true, false); mkInput('adCam', false, true);

  /* ============================================================ sheets */
  const SH = {
    admk() {
      const m = ad.mk, total = dur(), sup = m.kind === 'super', ok = m.segs.length && (sup ? total >= 180 && total <= 300 : total <= 600);
      return `<h3>${sup ? '⚡ New Super Moment' : '✨ New Moment'}</h3><p class="mut sm" style="margin-bottom:8px">${sup ? 'Super Moments run 3 to 5 minutes (up to 15 clips of 20 seconds).' : 'Up to 10 minutes, cut into 20-second clips. Visible for 24 hours.'} Pick from your album or take a shot with the camera.</p>
        <div class="row" style="flex-wrap:wrap;margin-bottom:8px"><button class="btn sm" data-act="adpick" data-k="adCam">📷 Camera</button><button class="btn sm alt" data-act="adpick" data-k="adAlb">🖼️ Album</button><button class="btn sm alt" data-act="adsample">✨ Sample clips</button>${m.segs.length ? '<button class="btn sm alt" data-act="adclear">Clear</button>' : ''}</div>
        <div class="bxrow" style="padding:0 0 8px">${m.segs.map((s, i) => `<div style="min-width:54px;height:72px;border-radius:10px;${mediaStyle(s.media)};display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;position:relative" data-act="adrmseg" data-i="${i}">${s.media.emoji || ''}<small style="position:absolute;bottom:2px;right:4px;font-size:10px">${s.durationSec}s</small></div>`).join('') || '<div class="mut sm">No clips yet.</div>'}</div>
        <div class="stat"><span>${m.segs.length} clip${m.segs.length === 1 ? '' : 's'} (tap a clip to remove it)</span><b style="color:${ok ? '#2f855a' : '#c53030'}">${mmss2(total)} ${sup ? '(needs 3:00 to 5:00)' : '(max 10:00)'}</b></div>
        <input data-bind="ad.mk.caption" placeholder="Caption" value="${esc(m.caption)}" style="margin:6px 0">
        ${isBiz() ? `<div class="row" style="margin:6px 0"><button class="chip ${m.link ? 'on' : ''}" data-act="admktoggle" data-f="link">🔗 Link to my page</button><button class="chip ${m.sponsored ? 'on' : ''}" data-act="admktoggle" data-f="sponsored">📣 Promote (${sup ? 'KES 300' : 'KES 150'})</button></div>` : ''}
        <button class="btn full" data-act="admkpost" ${ok ? '' : 'disabled'}>Post ${sup ? 'Super Moment' : 'Moment'}</button>`;
    },
    adid() { return `<h3>Submit your ID</h3><p class="mut sm" style="margin-bottom:8px">Your badge turns <b>green</b> once a National ID or Passport number is on file.</p><div class="row" style="margin-bottom:8px">${[['national_id', 'National ID'], ['passport', 'Passport']].map(o => `<button class="chip ${ad.id.idType === o[0] ? 'on' : ''}" data-act="adidtype" data-v="${o[0]}">${o[1]}</button>`).join('')}</div><input data-bind="ad.id.idNumber" value="${esc(ad.id.idNumber)}" placeholder="ID / passport number"><button class="btn full" style="margin-top:10px" data-act="adidsave">Submit</button>`; },
    adbank() {
      const b = ad.bk; return `<h3>Activate wallet</h3><p class="mut sm" style="margin-bottom:8px">This opens a bank account for you at <b>${esc(ad.bank ? ad.bank.designatedBank : 'SemaChat Trust Bank')}</b>. SemaChat and the bank both keep your records.</p><div class="col"><input data-bind="ad.bk.city" value="${esc(b.city)}" placeholder="City / town of residence"><input data-bind="ad.bk.area" value="${esc(b.area)}" placeholder="Residential area / estate"><input data-bind="ad.bk.work" value="${esc(b.work)}" placeholder="Work address">
        <button class="chip ${b.consent ? 'on' : ''}" data-act="adbankconsent" style="align-self:flex-start">${b.consent ? '☑' : '☐'} I accept the bank account terms</button><button class="btn full" data-act="adbanksave">Open my account</button></div>`;
    },
    adloan() {
      const d = ad.loans, o = d && d.offers.find(x => x.id === ad.ln.lender); if (!o) return '';
      const amt = +ad.ln.amount || 0, intr = Math.round(amt * o.monthlyRatePct / 100 * ad.ln.term / 30);
      return `<h3>Borrow from ${esc(o.name)}</h3><div class="col"><input type="number" data-bind="ad.ln.amount" data-onchg="adrender" value="${esc(ad.ln.amount)}" placeholder="Amount (max ${money(o.available)})"><div class="row">${o.terms.map(t => `<button class="chip ${ad.ln.term === t ? 'on' : ''}" data-act="adterm" data-v="${t}">${t} days</button>`).join('')}</div>
        <div class="hint">Interest ${o.monthlyRatePct}% a month: <b>${money(intr)}</b>. Repay <b>${money(amt + intr)}</b> by the due date. Late repayments add a fee and lower your score.</div><button class="btn full" data-act="adloansave">Take loan</button></div>`;
    }
  };
  const _sv = window.sheetView;
  window.sheetView = function () { const n = S.sheet && S.sheet.n; return SH[n] ? `<div class="shade" data-act="closesheet"></div><div class="sheet"><div class="grip"></div>${SH[n]()}</div>` : _sv(); };
  const _pv = window.pageView;
  const PAGES = { adloans: loansPage, adloc: adlocPage, adguard: adguardPage };
  window.pageView = v => PAGES[v.n] ? PAGES[v.n](v) : _pv(v);

  /* ============================================================ actions */
  const doneT = async m => { if (m) toast(m); await reload(); };
  Object.assign(acts, {
    adrender() { render(); },
    async adpq() { await adminBoot(); },
    adrole(d) { S.auth.role = d.v; render(); },
    adsu(d) { setP(d.p, d.v); render(); },
    addemo() {
      const a = S.auth, s = ad.su; a.phone = ''; a.email = 'new.user@mail.com';
      if (a.role === 'user') Object.assign(s, { name: 'Neo', legalName: 'Neo Mwangi', idNumber: '31234567', gender: 'male', age: '26', city: 'Nyeri', area: "Ruring'ori", workAddress: 'Nyeri Town' });
      else if (a.role === 'corporate') Object.assign(s, { orgName: 'Neo Traders Ltd', regNumber: 'PVT-AB123', kraPin: 'P051234567Z', sector: 'Retail', city: 'Nyeri', area: 'Kimathi Way, Nyeri' });
      else Object.assign(s, { orgName: 'Nyeri Polytechnic', regNumber: 'REG-5521', kraPin: 'P059876543Q', instType: 'College / University', accreditation: 'TVETA 2021', city: 'Nyeri', area: 'Kamakwa Road' });
      render();
    },
    async otp() {
      const a = S.auth, s = ad.su; a.err = '';
      try {
        if (!a.email.trim()) throw new Error('Enter your email address.');
        if (a.mode === 'up') { if (a.role === 'user' && !s.legalName.trim()) throw new Error('Enter your real name as on your National ID / Passport.'); if (a.role !== 'user' && !s.orgName.trim()) throw new Error('Enter the registered name.'); if (!s.name.trim()) s.name = (s.legalName || s.orgName).split(' ')[0]; }
        const r = await api('POST', '/api/auth/otp', { email: a.email, purpose: a.mode === 'up' ? 'signup' : 'signin' }); a.hint = r.hint;
        if (a.mode === 'up' && a.role === 'user' && +s.age < 18 && s.g.email) await api('POST', '/api/auth/otp', { email: s.g.email, purpose: 'guardian' });
        a.step = 2; a.code = '';
      } catch (e) { a.err = e.message; } render();
    },
    adconsent() { S.auth.consent = !S.auth.consent; },
    async authgo() {
      const a = S.auth, s = ad.su; a.err = '';
      try {
        let r;
        if (a.mode === 'up') {
          const kyc = a.role === 'user' ? { legalName: s.legalName, idType: s.idType, idNumber: s.idNumber, gender: s.gender, age: s.age, city: s.city, area: s.area, workAddress: s.workAddress }
            : { orgName: s.orgName, regNumber: s.regNumber, kraPin: s.kraPin, sector: s.sector, instType: s.instType, accreditation: s.accreditation, city: s.city, area: s.area };
          const body = { name: a.role === 'user' ? (s.name || s.legalName) : s.orgName, phone: a.phone, email: a.email, code: a.code, role: a.role, kyc };
          if (a.role === 'user' && +s.age < 18) body.guardian = { name: s.g.name, relation: s.g.relation, phone: s.g.phone, email: s.g.email, idType: s.g.idType, idNumber: s.g.idNumber, gender: s.g.gender, age: s.g.age, city: s.g.city, approvalCode: s.g.approvalCode };
          if (!a.consent) throw new Error('Please accept the Terms of Use and the Privacy Policy to create an account.');
          body.consent = { terms: true, privacy: true };
          r = await api('POST', '/api/auth/signup', body);
        } else r = await api('POST', '/api/auth/signin', { email: a.email, code: a.code });
        S.token = r.token; store.set('semachat_tok', r.token); ad.su = blankSu(); await startSession();
      } catch (e) { a.err = e.message; a.step = 2; render(); }
    },
    adidsheet() { ad.id = { idType: 'national_id', idNumber: '' }; S.sheet = { n: 'adid' }; render(); },
    adidtype(d) { ad.id.idType = d.v; render(); },
    adidsave() { return guard(async () => { await api('POST', '/api/me/identity', ad.id); S.sheet = null; await doneT('Thanks. Your badge is now green.'); }); },
    adlocsw() { return guard(async () => { const on = !(ad.loc && ad.loc.me && ad.loc.me.on), sp = SPOTS[0], me = (ad.loc && ad.loc.me) || {}; await api('POST', '/api/location', on ? { on, lat: me.lat || sp[1], lng: me.lng || sp[2], label: me.label || sp[0] } : { on }); await doneT(on ? '📍 Location sharing is on' : 'Location sharing is off'); }); },
    adlocspot(d) { const s = SPOTS[+d.i]; return guard(async () => { await api('POST', '/api/location', { on: true, lat: s[1], lng: s[2], label: s[0] }); await doneT(); }); },
    adbanksheet() { const p = (ad.bank && ad.bank.prefill) || {}; ad.bk = { city: p.city || '', area: p.area || '', work: p.workAddress || p.work || '', consent: false }; S.sheet = { n: 'adbank' }; render(); },
    adbankconsent() { ad.bk.consent = !ad.bk.consent; render(); },
    adbanksave() { return guard(async () => { const b = ad.bk; await api('POST', '/api/wallet/activate', { city: b.city, area: b.area, workAddress: b.work, consent: b.consent }); S.sheet = null; await doneT('🏦 Bank account opened'); }); },
    adloanform(d) { ad.ln = { lender: d.id, amount: '', term: 30 }; S.sheet = { n: 'adloan' }; render(); },
    adterm(d) { ad.ln.term = +d.v; render(); },
    adloansave() { return guard(async () => { await api('POST', '/api/loans/apply', { lenderId: ad.ln.lender, amount: ad.ln.amount, termDays: ad.ln.term }); S.sheet = null; await doneT('Loan paid into your wallet'); }); },
    adrepay(d) { return guard(async () => { await api('POST', '/api/loans/' + d.id + '/repay', {}); await doneT('Repaid. Thank you!'); }); },
    adage(d) { return guard(async () => { await api('POST', '/api/loans/' + d.id + '/age', {}); await doneT('Fast-forwarded past the due date (demo)'); }); },
    adack(d) { return guard(async () => { await api('POST', '/api/guardian/alerts/' + d.id + '/ack'); await doneT(); }); },
    admk(d) { ad.mk = { kind: d.k, segs: [], caption: '', sponsored: false, link: true }; S.sheet = { n: 'admk' }; render(); },
    adpick(d) { document.getElementById(d.k).click(); },
    adsample() { const n = ad.mk.kind === 'super' ? 10 : 3; for (let i = 0; i < n; i++) { const s = SAMPLES[(ad.mk.segs.length + i) % SAMPLES.length]; ad.mk.segs.push({ media: { emoji: s[0], g: s[1] }, durationSec: 20 }); } render(); },
    adclear() { ad.mk.segs = []; render(); },
    adrmseg(d) { ad.mk.segs.splice(+d.i, 1); render(); },
    admktoggle(d) { ad.mk[d.f] = !ad.mk[d.f]; render(); },
    admkpost() { return guard(async () => { const m = ad.mk; const r = await api('POST', '/api/moments', { kind: m.kind, segments: m.segs.map(s => ({ media: s.media, durationSec: s.durationSec })), caption: m.caption, sponsored: m.sponsored, linkLabel: m.link ? undefined : '' }); S.sheet = null; await doneT('Posted · visible for 24 hours (' + mmss2(r.totalSec) + ')'); }); },
    admopen(d) { const list = d.k === 'super' ? (ad.sup && ad.sup.groups) : (ad.rings && ad.rings.rings); if (!list || !list[+d.i]) return; V.list = list.slice(); V.gi = +d.i; V.ii = 0; V.paused = false; V.showC = false; vDraw(); }
  });

  /* ============================================================ developer console */
  const badge = (t, c) => `<span class="tagb ${c || 'b'}">${t}</span>`;
  const TIERB = { yellow: '🟡 Yellow', green: '🟢 Green', gold: '★ Gold' };
  window.aPeople = function () {
    const A = S.a, l = A.people || [], f = S.apf, d = ad.pdet;
    const chip = (k, v, t) => `<button class="chip ${f[k] === v ? 'on' : ''}" data-act="a_pf" data-k="${k}" data-v="${v}">${t}</button>`;
    return `<h2>People</h2><p class="lead">Who our users are: gender, age group, place of residence, tier, when they were last active and what they did. Used for community-guideline enforcement.</p>
    <div class="pn"><div class="row" style="flex-wrap:wrap;gap:6px"><input style="max-width:220px" data-bind="apf.q" data-onchg="adpq" placeholder="Search name, phone or town" value="${esc(f.q)}">${chip('g', '', 'All genders')}${chip('g', 'male', 'Male')}${chip('g', 'female', 'Female')}<span class="grow"></span>${chip('a', '', 'All ages')}${chip('a', 'adult', 'Adults')}${chip('a', 'minor', 'Minors')}${chip('t', '', 'Any tier')}${chip('t', 'yellow', 'Yellow')}${chip('t', 'green', 'Green')}${chip('t', 'gold', 'Gold')}</div>
    <table class="tbl"><tr><th>User</th><th>Gender</th><th>Age</th><th>Residence</th><th>Tier</th><th>Last active</th><th>Last action</th><th>Strikes</th><th></th></tr>${l.map(p => `<tr><td><b>${esc(p.name)}</b><div class="mut sm">${esc(p.phone)} · ${p.role}</div></td><td>${p.gender || '—'}</td><td>${p.age || '—'} ${p.ageGroup === 'minor' ? '<span class="tagb o">Minor</span>' : p.role === 'user' ? '<span class="tagb b">Adult</span>' : ''}${p.guardian ? `<div class="mut sm">Guardian: ${esc(p.guardian.name)}</div>` : ''}</td><td>${esc(p.city || '—')}<div class="mut sm">${esc(p.area || '')}</div></td><td>${p.role === 'user' ? TIERB[p.tier] : '—'}</td><td>${tm(p.lastSeen)}</td><td>${esc(p.lastAction || '—')}</td><td>${p.violations ? `<b style="color:#c53030">${p.violations}</b>` : 0}${p.openAlerts ? ' ⚠️' + p.openAlerts : ''}</td><td><button class="btn sm alt" data-act="a_pdet" data-id="${p.id}">Details</button></td></tr>`).join('') || '<tr><td colspan="9" class="mut">No one matches.</td></tr>'}</table></div>
    ${d ? `<div class="pn" id="pdet"><div class="row"><h3 class="grow">${esc(d.name)} ${d.ageGroup === 'minor' ? badge('Minor', 'o') : ''}</h3><button class="btn sm alt" data-act="a_pclose">Close</button></div>
      <div class="two"><div><b>Identity</b><div class="sm">Legal name: ${esc((d.kyc && d.kyc.legalName) || d.name)}<br>${d.kyc && d.kyc.idNumber ? (d.kyc.idType === 'passport' ? 'Passport' : 'National ID') + ' ' + esc(d.kyc.idNumber) : 'No ID submitted'}<br>Gender ${d.gender || '—'} · Age ${d.age || '—'}<br>Lives in ${esc(d.city || '—')} ${esc(d.area || '')}<br>Work: ${esc((d.kyc && d.kyc.workAddress) || '—')}<br>Joined ${tm(d.joined)}${d.guardian ? '<br>Guardian: ' + esc(d.guardian.name) + ' (' + esc(d.guardian.relation) + ')' : ''}${d.minors && d.minors.length ? '<br>Guardian of: ' + d.minors.map(m => esc(m.name)).join(', ') : ''}</div>
        <b style="display:block;margin-top:8px">Bank</b><div class="sm">${d.account ? esc(d.account.bank) + ' · ' + esc(d.account.accountNo) : 'Wallet not activated'}</div>${d.location ? `<b style="display:block;margin-top:8px">Location (sharing is on)</b><div class="sm">${esc(d.location.label)}</div>` : ''}</div>
      <div><b>Recent activity</b>${d.log.map(x => `<div class="sm">${tm(x.ts)} · ${esc(x.detail)}</div>`).join('') || '<div class="mut sm">None</div>'}<b style="display:block;margin-top:8px">Contacted most</b>${d.contacted.map(x => `<div class="sm">${esc(x.name)} · ${x.count} message(s)</div>`).join('') || '<div class="mut sm">None</div>'}<b style="display:block;margin-top:8px">Shared</b>${d.shared.map(x => `<div class="sm">${tm(x.ts)} · ${esc(x.label)}</div>`).join('') || '<div class="mut sm">None</div>'}</div></div>
      ${d.violationList.length ? `<b>Guideline violations (${d.violationList.length})</b>${d.violationList.map(v => `<div class="sm">${tm(v.ts)} · ${esc(v.cat)} · “${esc(v.excerpt)}”</div>`).join('')}` : ''}</div>` : ''}`;
  };
  window.aSafety = function () {
    const s = S.a.safety; if (!s) return '';
    return `<h2>Safety & minors</h2><p class="lead">Automatic checks (a demo keyword heuristic) on minors' chats and locations alert the guardian and SemaChat. Only flagged excerpts are kept. More than 3 violations puts an account up for take-down.</p>
    <div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="a_cdemo">▶ Run demo scenario</button><span class="mut sm">Simulates a stranger messaging a minor, a minor near a risky place, and a run of large transfers.</span></div>
    <div class="pn"><h3>Alerts (${s.alerts.length})</h3><table class="tbl"><tr><th>When</th><th>Minor</th><th>Type</th><th>Detail</th><th>Severity</th><th>Guardian</th></tr>${s.alerts.map(a => `<tr><td>${tm(a.ts)}</td><td>${esc(a.minor)}</td><td>${esc(a.label)}</td><td>${esc(a.text)}${a.excerpt ? `<div class="mut sm">“${esc(a.excerpt)}”</div>` : ''}</td><td class="sev-${a.severity}">${a.severity}</td><td>${esc(a.guardian)}${a.ack ? ' ✓' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">No alerts.</td></tr>'}</table></div>
    <div class="pn"><h3>Community-guideline strikes</h3><table class="tbl"><tr><th>User</th><th>Strikes</th><th>Latest</th><th>Status</th><th></th></tr>${s.strikes.map(x => `<tr><td><b>${esc(x.name)}</b> ${x.minor ? badge('Minor', 'o') : ''}</td><td><b ${x.strikes > 3 ? 'style="color:#c53030"' : ''}>${x.strikes}</b></td><td>${x.last ? esc(x.last.cat) + ' · “' + esc(x.last.excerpt) + '”' : ''}</td><td>${x.status}</td><td>${x.status === 'suspended' ? `<button class="btn sm gr" data-act="a_sact" data-id="${x.id}" data-v="restore">Restore</button>` : `<button class="btn sm alt" data-act="a_sact" data-id="${x.id}" data-v="takedown">Pull down</button>`} <button class="btn sm alt" data-act="a_sact" data-id="${x.id}" data-v="clear">Clear</button></td></tr>`).join('') || '<tr><td colspan="5" class="mut">No strikes.</td></tr>'}</table></div>
    <div class="pn"><h3>Notices to the developer</h3>${s.notices.map(n => `<div class="sm">${tm(n.ts)} · ${esc(n.msg)}</div>`).join('') || '<div class="mut sm">None</div>'}</div>
    <div class="pn"><h3>Minor accounts (${s.minors.length})</h3><table class="tbl"><tr><th>Minor</th><th>Age</th><th>Guardian</th><th>Strikes</th><th>Open alerts</th></tr>${s.minors.map(m => `<tr><td>${esc(m.name)}</td><td>${m.age}</td><td>${m.guardian ? esc(m.guardian.name) : '—'}</td><td>${m.violations}</td><td>${m.openAlerts}</td></tr>`).join('')}</table></div>`;
  };
  window.aAml = function () {
    const a = S.a.aml; if (!a) return '';
    return `<h2>Money alerts</h2><p class="lead">All money movements are screened against demo rules modelled on Kenyan anti-money-laundering requirements (POCAMLA). Hits are raised for review, escalation or suspension.</p>
    <div class="pn"><div class="row"><span class="grow"><b>Large-transaction threshold</b></span><input type="number" style="max-width:140px" data-bind="f.aml" value="${esc(S.f.aml == null ? a.thresholds.largeTx : S.f.aml)}"><button class="btn sm" data-act="a_amlth">Save</button></div></div>
    <div class="pn"><table class="tbl"><tr><th>When</th><th>User</th><th>Alert</th><th>Amount</th><th>Status</th><th></th></tr>${a.alerts.map(x => `<tr><td>${tm(x.ts)}</td><td>${esc(x.user)}</td><td><b>${esc(x.title)}</b><div class="mut sm">${esc(x.detail)}</div></td><td>${money(x.amount)}</td><td>${badge(x.status, x.status === 'open' ? 'o' : 'b')}</td><td>${x.status === 'open' ? `<button class="btn sm alt" data-act="a_aact" data-id="${x.id}" data-v="review">Mark reviewed</button> <button class="btn sm gr" data-act="a_aact" data-id="${x.id}" data-v="escalate">Escalate</button> <button class="btn sm alt" data-act="a_aact" data-id="${x.id}" data-v="suspend">Suspend</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="mut">No money alerts. Run the demo scenario under Safety &amp; minors.</td></tr>'}</table></div>`;
  };
  window.aLending = function () {
    const d = S.a.lending; if (!d) return ''; const t = d.totals;
    return `<h2>Bank & loans</h2><p class="lead">Wallet bank accounts and loans. SemaChat and the lender both keep the records.</p><div class="gridk">${gk('Bank accounts', t.accounts)}${gk('Disbursed', money(t.disbursed))}${gk('Outstanding', money(t.outstanding))}${gk('Overdue loans', t.overdue)}</div>
    <div class="pn"><h3>Lenders</h3><table class="tbl"><tr><th>Lender</th><th>Type</th><th>Rate / month</th><th>Max</th><th>Min score</th><th>Licence</th></tr>${d.lenders.map(l => `<tr><td><b>${esc(l.name)}</b></td><td>${l.kind}</td><td>${l.monthlyRatePct}%</td><td>${money(l.max)}</td><td>${l.minScore}</td><td>${esc(l.licence)}</td></tr>`).join('')}</table></div>
    <div class="pn"><h3>Loans</h3><table class="tbl"><tr><th>Borrower</th><th>Lender</th><th>Principal</th><th>Owing</th><th>Score</th><th>Due</th><th>Status</th></tr>${d.loans.map(l => `<tr><td>${esc(l.user)}</td><td>${esc(l.lender)}</td><td>${money(l.principal)}</td><td>${money(l.balance)}</td><td>${l.score}</td><td>${dt(l.dueAt)}</td><td>${badge(l.status, l.status === 'repaid' ? '' : 'o')}</td></tr>`).join('') || '<tr><td colspan="7" class="mut">No loans yet.</td></tr>'}</table></div>
    <div class="pn"><h3>Bank accounts</h3><table class="tbl"><tr><th>User</th><th>Bank</th><th>Account</th><th>Branch</th><th>Balance</th></tr>${d.accounts.map(a => `<tr><td>${esc(a.user)}</td><td>${esc(a.bank)}</td><td>${esc(a.accountNo)}</td><td>${esc(a.branch)}</td><td>${money(a.balance)}</td></tr>`).join('')}</table></div>`;
  };
  Object.assign(adm, {
    async pf(d) { S.apf[d.k] = d.v; await adminBoot(); },
    async pdet(d) { ad.pdet = await api('GET', '/api/admin/people/' + d.id, null, true); render(); },
    async pclose() { ad.pdet = null; render(); },
    async sact(d) { await api('POST', '/api/admin/safety/user/' + d.id, { action: d.v }, true); toast('Done'); await adminBoot(); },
    async cdemo() { const r = await api('POST', '/api/admin/compliance/demo', {}, true); toast('Demo run: ' + r.alerts + ' safety alerts, ' + r.aml + ' money alerts'); await adminBoot(); },
    async aact(d) { await api('POST', '/api/admin/aml/' + d.id, { action: d.v }, true); toast('Alert ' + d.v); await adminBoot(); },
    async amlth() { await api('POST', '/api/admin/aml/thresholds', { largeTx: S.f.aml }, true); toast('Threshold saved'); await adminBoot(); }
  });
})();
