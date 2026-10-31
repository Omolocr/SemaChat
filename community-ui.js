/* SemaChat — Community UI add-on (loaded via <!--EXT-->).
 * AnA quick row, Donations (double verification, checklist, uploads, interleaved cards),
 * On the move! (3-hour local adverts priced by area), the DIRA TECH footnote + developer-activated apps on Me,
 * and the developer-dashboard sections: Donations, On the move!, DIRA TECH apps, DIRA Music. */
(function () {
  'use strict';
  const dn = S.dn = { live: [], mine: [], list: null, tab: 'live', sel: null, hide: {}, give: { amount: '', anon: false }, f: { title: '', nationalId: '', fullName: '', address: '', description: '', amount: '', deadline: '', idSelfie: null, media: [], truth: false }, adm: null, plan: { method: 'visit', when: '' } };
  const ot = S.ot = { tab: 'near', loc: { lat: 0.0167, lng: 37.0722, label: 'Nanyuki (demo location)' }, near: null, mine: [], pricing: null, quote: null, f: { text: '', sqm: 10000, photos: [], label: '', lat: 0.0167, lng: 37.0722 } };
  S.dira = null;
  const tryA = async (m, p, b) => { try { return await api(m, p, b); } catch (e) { return null; } };
  const css = document.createElement('style');
  css.textContent = `.qrow{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:0 16px 12px}.qrow button{background:#fff;border-radius:14px;padding:10px 2px;font-weight:700;font-size:11.5px;display:flex;flex-direction:column;align-items:center;gap:3px;box-shadow:0 1px 0 var(--line)}.qrow span{font-size:24px}
  .dcard{margin:0 16px 12px;border-radius:18px;background:linear-gradient(135deg,#fffaf0,#fff5f5);border:1px solid #fbd38d;padding:12px;position:relative}.dcard .x{position:absolute;top:6px;right:10px;color:var(--muted);font-size:16px}.dcard .pg{height:8px;background:#fff;border-radius:99px;overflow:hidden;margin:6px 0}.dcard .pg i{display:block;height:100%;background:linear-gradient(90deg,#ed8936,#c2410c)}
  .dthumb{width:64px;height:64px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:30px;color:#fff;flex:0 0 64px;background-size:cover;background-position:center}
  .vstep{display:flex;gap:8px;align-items:flex-start;margin:6px 0;font-size:13px}.vstep i{width:22px;height:22px;border-radius:50%;background:var(--soft);display:flex;align-items:center;justify-content:center;font-style:normal;font-size:12px;flex:0 0 22px}.vstep.ok i{background:var(--green);color:#fff}.vstep.wait i{background:#fefcbf}.vstep.bad i{background:var(--red);color:#fff}
  .ckl{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line);font-size:13px}.ckl i{font-style:normal;width:22px;height:22px;border-radius:50%;background:var(--soft);display:flex;align-items:center;justify-content:center;flex:0 0 22px;font-size:12px}.ckl.ok i{background:var(--green);color:#fff}
  .upl{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.upl .u{width:64px;height:64px;border-radius:12px;background:var(--soft) center/cover;position:relative;display:flex;align-items:center;justify-content:center;font-size:22px}.upl .u b{position:absolute;top:-4px;right:-4px;background:var(--red);color:#fff;border-radius:50%;width:18px;height:18px;font-size:11px;text-align:center;line-height:18px}
  .otc{margin:0 16px 10px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 1px 0 var(--line)}.otc .ph2{height:110px;display:flex;align-items:center;justify-content:center;font-size:54px;background-size:cover;background-position:center;color:#fff}.otc .bd{padding:10px 12px}.otc .tx{font-size:16px;font-weight:800;margin:3px 0}
  .otstrip{display:flex;gap:10px;overflow-x:auto;padding:0 16px 12px;scrollbar-width:none}.otstrip button{flex:0 0 190px;text-align:left;border-radius:16px;overflow:hidden;background:#fff;box-shadow:0 1px 0 var(--line)}.otstrip .ph2{height:62px;display:flex;align-items:center;justify-content:center;font-size:30px;color:#fff;background-size:cover}.otstrip .bd{padding:6px 10px;font-size:12px}
  .dira{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:0 16px 8px}.dira button{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;font-weight:700;text-align:center}.dira span{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#1f1b2e,#553c9a);display:flex;align-items:center;justify-content:center;font-size:26px}
  .dfoot{text-align:center;font-size:12px;color:var(--muted);padding:14px 16px 26px;font-weight:700;letter-spacing:.3px}`;
  document.head.appendChild(css);
  const kes = n => 'KES ' + Math.round(n).toLocaleString('en-KE');
  const leftD = ts => { const d = Math.ceil((ts - Date.now()) / 864e5); return d > 0 ? d + ' day' + (d === 1 ? '' : 's') + ' left' : 'ending today'; };
  const mediaBg = m => m && (m.data || m.thumb) ? `background-image:url(${m.data || m.thumb})` : `background:linear-gradient(135deg,${((m && m.g) || ['#c2410c', '#f59e0b']).join(',')})`;
  const shrink = (file, max, q) => new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { const sc = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', q || 0.72)); }; im.onerror = () => rej(new Error('That image could not be read.')); im.src = u; });
  const videoThumb = file => new Promise(res => { const v = document.createElement('video'), u = URL.createObjectURL(file); v.preload = 'metadata'; v.muted = true; v.src = u; const done = (th, d) => { URL.revokeObjectURL(u); res({ thumb: th, durationSec: d }); }; v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 1) / 2); }; v.onseeked = () => { try { const c = document.createElement('canvas'); c.width = 360; c.height = Math.round(360 * (v.videoHeight || 202) / (v.videoWidth || 360)); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); done(c.toDataURL('image/jpeg', 0.6), Math.round(v.duration || 0)); } catch (e) { done(null, 0); } }; v.onerror = () => done(null, 0); setTimeout(() => done(null, 0), 6000); });

  /* ------------------------------------------------------------ AnA quick row */
  window.quickRow = function () {
    const q = [['health', '💪', 'Exercise & Health', 'health'], ['music', '🎵', 'DIRA Music', 'music'], ['donations', '🤲', 'Donations', 'donations'], ['onthemove', '📍', 'On the move!', 'otm']].filter(x => feat(x[0]));
    return q.length ? `<div class="qrow">${q.map(x => `<button data-act="go" data-p="${x[3]}"><span>${x[1]}</span>${x[2]}</button>`).join('')}</div>` : '';
  };
  const _ana = window.anaView;
  window.anaView = function () {
    let h = _ana(); const i = h.indexOf('<div class="chips">'), q = quickRow();
    if (i >= 0 && q) h = h.slice(0, i) + q + h.slice(i);
    return insertDon(h, '<div class="post"', 1, 'ana');
  };

  /* ------------------------------------------------------------ interleaved donation cards */
  function pickDon(surface) {
    const L = dn.live.filter(c => !dn.hide[c.id]); if (!L.length || !feat('donations')) return null;
    const k = Math.floor(Date.now() / 60000) + surface.length * 7; return L[k % L.length];
  }
  const donCard = (c, surface) => `<div class="dcard"><button class="x" data-act="dnhide" data-id="${c.id}" title="Hide">✕</button><div class="mut sm" style="font-weight:800;letter-spacing:.4px">🤲 A SECOND CHANCE · VERIFIED</div><div class="row" style="margin-top:6px"><div class="dthumb" style="${mediaBg(c.media[0])}">${c.media[0] && !c.media[0].data && !c.media[0].thumb ? esc(c.media[0].emoji || '🤲') : ''}</div><div class="grow"><b>${esc(c.title)}</b><div class="mut sm">${esc(c.fullName.split(' (')[0])} · ${esc(c.address)}</div></div></div><div class="pg"><i style="width:${c.pct}%"></i></div><div class="row sm"><b class="grow">${kes(c.raised)} <span class="mut">of ${kes(c.amount)}</span></b><span class="mut">${leftD(c.deadline)}</span></div><div class="row" style="margin-top:8px"><button class="btn sm grow" data-act="dnopen" data-id="${c.id}">Read story &amp; give</button></div></div>`;
  function insertDon(h, marker, nth, surface) {
    const c = pickDon(surface); if (!c) return h; const card = donCard(c, surface); let at = -1, from = 0;
    for (let i = 0; i < nth + 1; i++) { at = h.indexOf(marker, from); if (at < 0) break; from = at + 1; }
    return at < 0 ? h + card : h.slice(0, at) + card + h.slice(at);
  }
  const _chats = window.chatsView;
  window.chatsView = function () { const h = _chats(); return isBiz() ? h : insertDon(h, '<div class="li" data-act="openchat"', 3, 'chats'); };
  const _explore = window.exploreView;
  window.exploreView = function () { let h = _explore(); h = insertDon(h, '<div class="exc"', 2, 'explore-' + S.ex); const s = otStrip(); const i = h.indexOf('<div class="chips">'); return s && i >= 0 && S.ex === 'business' ? h.slice(0, i) + s + h.slice(i) : h; };
  const _bhome = window.bhomeView;
  window.bhomeView = function () { const h = _bhome(); return h + insertDon('', '', 0, 'business'); };

  /* ------------------------------------------------------------ loading */
  const _load = window.load;
  window.load = async function () {
    await _load(); const v = cur(), k = v ? v.n : S.tab;
    if (feat('donations') && ['chats', 'explore', 'contacts', 'bhome', 'donations', 'dondetail'].includes(k)) dn.live = (await tryA('GET', '/api/donations')) || [];
    if (k === 'donations') { dn.mine = (await tryA('GET', '/api/donations?mine=1')) || []; if (!dn.list) dn.list = await tryA('GET', '/api/donations/checklist'); }
    if (k === 'dondetail') dn.sel = await tryA('GET', '/api/donations/' + v.id);
    if (k === 'me') S.dira = await tryA('GET', '/api/dira');
    if (feat('onthemove') && (k === 'otm' || (k === 'explore' && S.ex === 'business' && !isBiz()))) { const r = await tryA('GET', '/api/otm?lat=' + ot.loc.lat + '&lng=' + ot.loc.lng); ot.near = r ? r.items : []; }
    if (k === 'otm') { ot.mine = (await tryA('GET', '/api/otm/mine')) || []; if (!ot.pricing) ot.pricing = await tryA('GET', '/api/otm/pricing'); if (!ot.quote && ot.tab === 'make') await quote(); }
  };
  const _pv = window.pageView; window.pageView = v => v.n === 'donations' ? donPage() : v.n === 'dondetail' ? donDetail() : v.n === 'otm' ? otmPage() : _pv(v);

  /* ------------------------------------------------------------ Me: DIRA TECH apps + footnote */
  const _me = window.meView;
  window.meView = function () {
    const h = _me(), apps = (S.dira && S.dira.apps) || [];
    const sec = apps.length ? `<div class="sec">Also from DIRA TECH</div><div class="dira">${apps.map(a => `<button data-act="dirapp" data-id="${a.id}"><span>${esc(a.emoji)}</span>${esc(a.name)}</button>`).join('')}</div>` : '';
    return h + sec + `<div class="dfoot">${esc((S.dira && S.dira.footer) || 'DIRA TECH | Spiker Group Company')}</div>`;
  };

  /* ------------------------------------------------------------ Donations pages */
  function donPage() {
    if (!feat('donations')) return ph('Donations') + offBanner('donations', 'Donations');
    const tabs = [['live', '🤲 Give'], ['mine', 'My campaigns'], ['new', '＋ Ask for help']];
    return ph('Donations') + `<div class="hpill" style="display:flex;gap:6px;padding:0 16px 10px">${tabs.map(t => `<button class="chip ${dn.tab === t[0] ? 'on' : ''}" data-act="dntab" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>` +
      (dn.tab === 'live' ? `<div class="mut sm" style="padding:0 16px 10px">A second chance for people in need. Every campaign passes <b>two checks</b>: documents reviewed, then a visit or video call by the SemaChat team. Donations go straight to the person’s SemaChat wallet. SemaChat takes no fee.</div>` + (dn.live.map(c => donCard(c, 'page')).join('') || '<div class="empty"><b>🤲</b>No verified campaigns right now.</div>') : dn.tab === 'mine' ? mineTab() : newTab());
  }
  const STEPS = { passed: ['ok', '✓'], waiting: ['wait', '…'], scheduled: ['wait', '📅'], failed: ['bad', '✕'] };
  function steps(c) {
    const d = STEPS[c.steps.docs] || STEPS.waiting, f = STEPS[c.steps.field] || STEPS.waiting;
    return `<div class="vstep ok"><i>✓</i><div><b>Documents submitted</b></div></div><div class="vstep ${d[0]}"><i>${d[1]}</i><div><b>Check 1: documents reviewed</b><div class="mut sm">${c.steps.docs === 'passed' ? 'Approved by the SemaChat team' : c.steps.docs === 'failed' ? 'Not approved' : 'Waiting for review'}</div></div></div><div class="vstep ${f[0]}"><i>${f[1]}</i><div><b>Check 2: physical visit or video call</b><div class="mut sm">${c.fieldPlan ? 'Scheduled: ' + (c.fieldPlan.method === 'video' ? 'video call' : 'visit') + ' on ' + new Date(c.fieldPlan.when).toDateString() : c.steps.field === 'passed' ? 'Verified by the SemaChat team' : c.steps.field === 'failed' ? 'Not successful' : 'The SemaChat team will visit you or call on video'}</div></div></div><div class="vstep ${c.status === 'live' || c.status === 'funded' ? 'ok' : 'wait'}"><i>${c.status === 'live' || c.status === 'funded' ? '✓' : '…'}</i><div><b>Campaign live</b></div></div>`;
  }
  const LBL = { pending_docs: 'In review', awaiting_field: 'Awaiting visit / video call', live: 'Live', rejected: 'Not approved', funded: 'Fully funded', ended: 'Ended', closed: 'Closed' };
  function mineTab() { return dn.mine.length ? dn.mine.map(c => `<div class="card" style="margin:0 16px 12px"><div class="row"><b class="grow">${esc(c.title)}</b><span class="tagb ${c.status === 'live' ? 'b' : 'o'}">${LBL[c.status] || c.status}</span></div><div class="mut sm">${kes(c.raised)} of ${kes(c.amount)} · ${leftD(c.deadline)}</div>${steps(c)}${['live', 'pending_docs', 'awaiting_field'].includes(c.status) ? `<button class="btn alt sm" data-act="dnclose" data-id="${c.id}">Close campaign</button>` : ''}</div>`).join('') : '<div class="empty"><b>📝</b>You have no campaigns.<br><span class="sm">Tap “Ask for help” to start one.</span></div>'; }
  function ckState() {
    const f = dn.f, n = Date.now(), dl = f.deadline ? new Date(f.deadline + 'T23:59:00').getTime() : 0;
    return { nationalId: /^\d{7,9}$/.test(String(f.nationalId).replace(/\s/g, '')), fullName: f.fullName.trim().split(/\s+/).filter(Boolean).length >= 2, idSelfie: !!f.idSelfie, address: f.address.trim().length >= 5, media: f.media.length > 0, description: f.description.trim().length >= 20, amount: +f.amount >= 500 && +f.amount <= 5e6, deadline: dl > n + 12 * 36e5 && dl <= n + 180 * 864e5 };
  }
  function newTab() {
    const f = dn.f, st = ckState(), items = (dn.list && dn.list.items) || [], done = Object.values(st).every(Boolean) && f.title.trim().length >= 5, cnt = Object.values(st).filter(Boolean).length;
    const up = (id, label) => `<label class="btn alt sm" style="cursor:pointer;display:inline-block">${label}<input type="file" id="${id}" accept="${id === 'dnMedia' ? 'image/*,video/*' : 'image/*'}" ${id === 'dnMedia' ? 'multiple' : 'capture="user"'} style="display:none"></label>`;
    return `<div class="card" style="margin:0 16px 12px"><b>Verification list</b><div class="mut sm" style="margin-bottom:6px">Complete every item below before you can submit (<span id="dnCnt">${cnt}</span>/8 done). Your ID number and selfie are seen only by the verification team.</div>${items.map(i => `<div class="ckl ${st[i.key] ? 'ok' : ''}" data-k="${i.key}"><i>${st[i.key] ? '✓' : '○'}</i><div><b>${esc(i.label)}</b><div class="mut sm">${esc(i.hint)}</div></div></div>`).join('')}</div>
    <div class="hgrp" style="padding:0 16px 12px"><label class="lb">Campaign title</label><input data-bind="dn.f.title" data-onchg="dnrefresh" maxlength="70" placeholder="e.g. Help rebuild my kiosk" value="${esc(f.title)}">
      <label class="lb">1. National ID number</label><input data-bind="dn.f.nationalId" data-onchg="dnrefresh" inputmode="numeric" placeholder="e.g. 12345678" value="${esc(f.nationalId)}">
      <label class="lb">2. Full name (as on the ID)</label><input data-bind="dn.f.fullName" data-onchg="dnrefresh" placeholder="First and last name" value="${esc(f.fullName)}">
      <label class="lb">3. Selfie holding your ID across your face</label><div class="upl">${f.idSelfie ? `<div class="u" style="background-image:url(${f.idSelfie})"><b data-act="dnrmself">×</b></div>` : ''}</div>${up('dnSelfie', f.idSelfie ? 'Retake selfie' : '📸 Take / choose selfie')}
      <label class="lb">4. Location address</label><input data-bind="dn.f.address" data-onchg="dnrefresh" placeholder="Town, area, landmark" value="${esc(f.address)}">
      <label class="lb">5. Video or photos of the situation (up to 6)</label><div class="upl">${f.media.map((m, i) => `<div class="u" style="${m.thumb ? `background-image:url(${m.thumb})` : ''}">${m.type === 'video' ? '▶' : ''}${m.type === 'video' && !m.thumb ? '🎬' : ''}<b data-act="dnrmmedia" data-i="${i}">×</b></div>`).join('')}</div>${up('dnMedia', '＋ Add photos / video')}
      <label class="lb">6. Summarised description <span class="mut">(${f.description.trim().length}/600)</span></label><textarea data-bind="dn.f.description" data-onchg="dnrefresh" rows="4" maxlength="600" placeholder="What happened, and what will the money be used for?">${esc(f.description)}</textarea>
      <div class="hrow2"><div><label class="lb">7. Amount needed (KES)</label><input data-bind="dn.f.amount" data-onchg="dnrefresh" type="number" placeholder="e.g. 45000" value="${esc(f.amount)}"></div><div><label class="lb">8. Deadline</label><input data-bind="dn.f.deadline" data-onchg="dnrefresh" type="date" value="${esc(f.deadline)}"></div></div>
      <label class="row" style="margin:10px 0;gap:8px;align-items:flex-start"><input type="checkbox" data-act="dntruth" ${f.truth ? 'checked' : ''} style="margin-top:3px"><span class="sm">I confirm everything above is true. I understand the SemaChat team will review my documents, then visit me or call me on video, and that false claims will lead to a ban and may be reported.</span></label>
      <button class="btn full" id="dnGo" data-act="dnsubmit" ${done && f.truth ? '' : 'disabled style="opacity:.45"'}>Submit for verification</button>${done && f.truth ? '' : '<div class="mut sm" style="margin-top:6px;text-align:center">Complete the list and confirm to enable submitting.</div>'}</div>`;
  }
  // update the checklist in place: a full re-render would steal focus from the field being filled
  function dnPatch() {
    const st = ckState(), f = dn.f, done = Object.values(st).every(Boolean) && f.title.trim().length >= 5 && f.truth;
    document.querySelectorAll('.ckl[data-k]').forEach(e => { const ok = !!st[e.dataset.k]; e.classList.toggle('ok', ok); const i = e.querySelector('i'); if (i) i.textContent = ok ? '✓' : '○'; });
    const n = document.getElementById('dnCnt'); if (n) n.textContent = Object.values(st).filter(Boolean).length;
    const b = document.getElementById('dnGo'); if (b) { b.disabled = !done; b.style.opacity = done ? '' : '.45'; }
  }
  function donDetail() {
    const c = dn.sel; if (!c) return ph('Campaign') + '<div class="empty">Loading…</div>'; const g = dn.give, open = c.status === 'live';
    return ph('Campaign') + `<div style="margin:0 16px 12px;border-radius:18px;height:190px;display:flex;align-items:center;justify-content:center;font-size:80px;color:#fff;background-size:cover;background-position:center;${mediaBg(c.media[0])}">${c.media[0] && !c.media[0].data && !c.media[0].thumb ? esc(c.media[0].emoji || '🤲') : ''}</div>
    <div style="padding:0 16px"><span class="tagb b">✓ Verified: documents + ${'visit / video call'}</span><h2 style="margin:6px 0">${esc(c.title)}</h2><div class="mut sm">${esc(c.fullName)} · ${esc(c.address)}</div><p style="margin:10px 0">${esc(c.description)}</p>
    ${c.media.length > 1 ? `<div class="upl">${c.media.map(m => `<div class="u" style="${mediaBg(m)}">${m.type === 'video' ? '▶' : ''}</div>`).join('')}</div>` : ''}
    <div class="pg" style="height:10px;background:var(--soft);border-radius:99px;overflow:hidden;margin:8px 0"><i style="display:block;height:100%;width:${c.pct}%;background:linear-gradient(90deg,#ed8936,#c2410c)"></i></div><div class="row"><b class="grow">${kes(c.raised)} <span class="mut">of ${kes(c.amount)}</span></b><span class="mut sm">${c.donorCount} donor${c.donorCount === 1 ? '' : 's'} · ${leftD(c.deadline)}</span></div></div>
    ${open && c.owner.id !== S.me.id ? `<div class="card" style="margin:12px 16px"><b>Give</b><div class="chips" style="margin-top:6px">${[100, 500, 1000, 2000].map(x => `<button class="chip ${+g.amount === x ? 'on' : ''}" data-act="dnamt" data-v="${x}">${kes(x)}</button>`).join('')}</div><div class="row" style="margin-top:8px"><input data-bind="dn.give.amount" type="number" placeholder="Other amount (KES)" value="${esc(g.amount)}"></div><label class="row sm" style="gap:8px;margin:8px 0"><input type="checkbox" data-act="dnanon" ${g.anon ? 'checked' : ''}> Give anonymously</label><button class="btn full" data-act="dngive" data-id="${c.id}">Donate from my wallet</button><div class="mut sm" style="margin-top:6px">Wallet: ${kes(S.me.balance || 0)}. 100% reaches the beneficiary.</div></div>` : `<div class="mut sm" style="padding:12px 16px">${c.owner.id === S.me.id ? 'This is your campaign.' : 'This campaign is ' + (LBL[c.status] || c.status).toLowerCase() + '.'}</div>`}
    ${c.recent.length ? `<div class="sec">Recent donors</div>${c.recent.map(r => `<div class="li"><div class="fi" style="background:#fed7d7">❤️</div><div class="grow"><b class="sm">${esc(r.name)}</b></div><b>${kes(r.amount)}</b></div>`).join('')}` : ''}
    <div class="mut sm" style="padding:10px 16px 20px">Report a concern: if something looks wrong, tell SemaChat support. Verified by the SemaChat team.</div>`;
  }
  // file inputs (delegated: the page re-renders, so we listen on the document)
  document.addEventListener('change', async e => {
    const el = e.target; if (!el || !['dnSelfie', 'dnMedia', 'otPhoto'].includes(el.id)) return; const files = Array.from(el.files || []); el.value = ''; if (!files.length) return;
    try {
      if (el.id === 'dnSelfie') { dn.f.idSelfie = await shrink(files[0], 900, 0.7); }
      else if (el.id === 'dnMedia') { for (const f of files) { if (dn.f.media.length >= 6) break; if (/^video\//.test(f.type)) { if (f.size > 200 * 1048576) { toast('Video is over 200 MB. Please choose a shorter clip.'); continue; } const v = await videoThumb(f); dn.f.media.push({ type: 'video', thumb: v.thumb, durationSec: v.durationSec, name: f.name, sizeKb: Math.round(f.size / 1024) }); } else dn.f.media.push({ type: 'image', data: await shrink(f, 1000, 0.7), thumb: undefined, name: f.name, sizeKb: Math.round(f.size / 1024) }); } }
      else { for (const f of files) { if (ot.f.photos.length >= 4) break; ot.f.photos.push({ data: await shrink(f, 900, 0.7) }); } }
    } catch (err) { toast(err.message); } render();
  });
  /* ------------------------------------------------------------ On the move! */
  const otCard = (a, mine) => `<div class="otc"><div class="ph2" style="${mediaBg(a.photos[0])}">${a.photos[0] && !a.photos[0].data ? esc(a.photos[0].emoji || '📍') : ''}</div><div class="bd"><span class="tagb o">📍 On the move!</span> <span class="mut sm">${a.minsLeft >= 60 ? Math.floor(a.minsLeft / 60) + 'h ' + a.minsLeft % 60 + 'm' : a.minsLeft + ' min'} left</span><div class="tx">${esc(a.text)}</div><div class="mut sm">${esc(a.outlet)} · ${esc(a.pin.label)}${a.distanceM != null ? ' · ' + a.distanceM + ' m away' : ''}</div>${mine ? `<div class="row sm" style="margin-top:6px"><span class="grow mut">👁 ${a.views} · 👆 ${a.taps} · ${a.sqm.toLocaleString('en-KE')} sq m · ${kes(a.cost)}</span>${a.status === 'live' ? `<button class="btn alt sm" data-act="otstop" data-id="${a.id}">Stop</button>` : `<span class="tagb">${a.status}</span>`}</div>` : `<div class="row" style="margin-top:8px"><button class="btn sm grow" data-act="otgo" data-id="${a.id}">📍 Show on map</button></div>`}</div></div>`;
  function otStrip() { if (!feat('onthemove') || !ot.near || !ot.near.length) return ''; return `<div class="sec">📍 On the move! near you</div><div class="otstrip">${ot.near.map(a => `<button data-act="otgo" data-id="${a.id}"><div class="ph2" style="${mediaBg(a.photos[0])}">${a.photos[0] && !a.photos[0].data ? esc(a.photos[0].emoji || '📍') : ''}</div><div class="bd"><b>${esc(a.text.slice(0, 48))}</b><div class="mut">${esc(a.outlet)} · ${a.distanceM} m</div></div></button>`).join('')}</div>`; }
  async function quote() { try { ot.quote = await api('POST', '/api/otm/quote', { lat: ot.f.lat, lng: ot.f.lng, sqm: +ot.f.sqm }); ot.qerr = ''; } catch (e) { ot.quote = null; ot.qerr = e.message; } }
  const TOWNS = (window.SemaChatCore && SemaChatCore.otmTowns) || [['Nanyuki', 0.0167, 37.0722], ['Nairobi', -1.2921, 36.8219], ['Kisumu', -0.0917, 34.768], ['Nakuru', -0.3031, 36.08], ['Mombasa', -4.0435, 39.6682], ['Eldoret', 0.5143, 35.2698], ['Thika', -1.0332, 37.0693], ['Nyeri', -0.4201, 36.9476]].map(t => ({ name: t[0], lat: t[1], lng: t[2] }));
  function otmPage() {
    if (!feat('onthemove')) return ph('On the move!') + offBanner('onthemove', 'On the move!');
    const tabs = [['near', '📍 Near me'], ['make', '📣 Advertise'], ['mine', 'My adverts']];
    return ph('On the move!') + `<div style="display:flex;gap:6px;padding:0 16px 10px">${tabs.map(t => `<button class="chip ${ot.tab === t[0] ? 'on' : ''}" data-act="ottab" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>` + (ot.tab === 'near' ? otNear() : ot.tab === 'make' ? otMake() : (ot.mine.map(a => otCard(a, true)).join('') || '<div class="empty"><b>📣</b>No adverts yet.</div>'));
  }
  function otNear() {
    return `<div class="row" style="padding:0 16px 10px;gap:6px"><span class="grow sm">📍 <b>${esc(ot.loc.label)}</b></span><button class="btn alt sm" data-act="otlocate">Use my location</button></div><div style="padding:0 16px 10px"><select data-bind="ot.town" data-onchg="ottown"><option value="">Try another town…</option>${TOWNS.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('')}</select></div>
    <div class="mut sm" style="padding:0 16px 8px">Quick adverts from shops and outlets around you. Each lasts 3 hours and shows only inside its area.</div>${(ot.near || []).map(a => otCard(a)).join('') || '<div class="empty"><b>📍</b>No adverts at your spot right now.<br><span class="sm">Try another town above, or advertise your own outlet.</span></div>'}`;
  }
  function otMake() {
    const f = ot.f, p = ot.pricing, q = ot.quote, reg = S.me.hasBizAccount && S.me.bizStatus === 'active' || (S.ws && S.ws.bizState && S.ws.bizState.status === 'active') || isBiz();
    if (!reg) return `<div class="card" style="margin:0 16px"><b>Registered outlets only</b><p class="mut" style="margin:6px 0 10px">Register your shop, kiosk or business to post quick adverts. You can post from your normal or business account once registered.</p><button class="btn full" data-act="go" data-p="bizreg">Register my outlet</button></div>`;
    const ex = ['Grab a tasty lunch at only KES. 250!', 'Grab fresh juice at mama pima kiosk.', 'Get brake pads for your car today at KES. 2000'];
    return `<div class="hgrp" style="padding:0 16px"><label class="lb">Your advert (max 140 characters)</label><textarea data-bind="ot.f.text" rows="3" maxlength="140" placeholder="${esc(ex[0])}">${esc(f.text)}</textarea><div class="chips" style="padding:0 0 6px">${ex.map((x, i) => `<button class="chip" data-act="otex" data-i="${i}">${esc(x.slice(0, 28))}…</button>`).join('')}</div>
      <label class="lb">Photos (up to 4)</label><div class="upl">${f.photos.map((m, i) => `<div class="u" style="background-image:url(${m.data})"><b data-act="otrmph" data-i="${i}">×</b></div>`).join('')}</div><label class="btn alt sm" style="cursor:pointer;display:inline-block">📷 Add photo<input type="file" id="otPhoto" accept="image/*" multiple style="display:none"></label>
      <label class="lb" style="margin-top:10px">Pin location</label><div class="card" style="padding:10px"><div class="sm"><b>${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}</b></div><input data-bind="ot.f.label" placeholder="Name of the spot, e.g. Mama Pima Kiosk, Market Rd" value="${esc(f.label)}" style="margin:6px 0"><div class="row" style="gap:6px;flex-wrap:wrap"><button class="btn alt sm" data-act="otpin" data-v="here">📍 Use my location</button>${['◀', '▲', '▼', '▶'].map((x, i) => `<button class="btn alt sm" data-act="otnudge" data-v="${i}">${x} 25 m</button>`).join('')}</div><select data-bind="ot.town2" data-onchg="otpintown" style="margin-top:6px"><option value="">Pin in another town…</option>${TOWNS.map(t => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('')}</select></div>
      <label class="lb" style="margin-top:10px">Area to cover (square metres)</label><div class="chips" style="padding:0 0 6px">${((p && p.presets) || [500, 2000, 10000, 50000, 250000]).map(x => `<button class="chip ${+f.sqm === x ? 'on' : ''}" data-act="otsqm" data-v="${x}">${x.toLocaleString('en-KE')}</button>`).join('')}</div><input data-bind="ot.f.sqm" data-onchg="otrequote" type="number" min="50" value="${esc(f.sqm)}">
      <div class="card" style="margin:10px 0;background:#fffaf0">${q ? `<div class="row"><b class="grow">Price</b><b style="font-size:22px">${kes(q.cost)}</b></div><div class="sm mut">${esc(q.town)} rate: ${esc(q.rule)} · ${q.units} × ${kes(q.rate)}</div><div class="sm mut">Reaches about ${q.radiusM} m around the pin · lasts ${q.hours} hours</div>` : `<div class="sm" style="color:var(--red)">${esc(ot.qerr || 'Set a pin and area to see the price.')}</div>`}<div class="mut sm" style="margin-top:6px">Rates: ${p ? kes(p.premiumRate) + ' per ' + p.unitSqm + ' sq m in ' + p.premiumTowns.join(', ') + '; ' + kes(p.otherRate) + ' per ' + p.unitSqm + ' sq m in other towns.' : ''}</div></div>
      <button class="btn full" data-act="otpost" ${q ? '' : 'disabled style="opacity:.5"'}>Pay ${q ? kes(q.cost) : ''} &amp; go live for 3 hours</button><div class="mut sm" style="margin-top:6px;text-align:center">Charged from your wallet (${kes(S.me.balance || 0)}). Adverts are not refunded once live.</div></div>`;
  }
  /* ------------------------------------------------------------ actions */
  const locName = async (lat, lng) => 'Your location';
  Object.assign(acts, {
    dirapp(d) {
      const a = S.dira && S.dira.apps.find(x => x.id === d.id); if (!a) return;
      toast('Opening ' + a.name + '…'); let left = false; const onHide = () => { if (document.hidden) left = true; }; document.addEventListener('visibilitychange', onHide);
      try { const fr = document.createElement('iframe'); fr.style.display = 'none'; fr.src = a.scheme; document.body.appendChild(fr); setTimeout(() => fr.remove(), 2000); } catch (e) { /* ignore */ }
      setTimeout(() => { document.removeEventListener('visibilitychange', onHide); if (!left) { toast(a.name + ' is not installed. Taking you to download it…'); if (a.storeUrl) window.open(a.storeUrl, '_blank', 'noopener'); } }, 1600);
    },
    dntab(d) { dn.tab = d.v; render(); }, dnrefresh() { dnPatch(); },
    dnhide(d) { dn.hide[d.id] = true; render(); },
    dnopen(d) { go('dondetail', { id: d.id }); },
    dnrmself() { dn.f.idSelfie = null; render(); }, dnrmmedia(d) { dn.f.media.splice(+d.i, 1); render(); },
    dntruth() { dn.f.truth = !dn.f.truth; dnPatch(); },
    dnsubmit() { return guard(async () => { const f = dn.f, dl = new Date(f.deadline + 'T23:59:00').getTime(); await api('POST', '/api/donations', { title: f.title, nationalId: f.nationalId, fullName: f.fullName, idSelfie: f.idSelfie, address: f.address, media: f.media, description: f.description, amount: +f.amount, deadline: dl, confirmTruth: f.truth }); Object.assign(dn.f, { title: '', nationalId: '', fullName: '', address: '', description: '', amount: '', deadline: '', idSelfie: null, media: [], truth: false }); dn.tab = 'mine'; toast('Submitted. Step 1 of 2: the SemaChat team will review your documents.'); await load(); render(); }); },
    dnclose(d) { return guard(async () => { await api('POST', '/api/donations/' + d.id + '/close'); await load(); render(); }); },
    dnamt(d) { dn.give.amount = d.v; render(); }, dnanon() { dn.give.anon = !dn.give.anon; },
    dngive(d) { return guard(async () => { const r = await api('POST', '/api/donations/' + d.id + '/give', { amount: +dn.give.amount, anonymous: dn.give.anon }); toast('Thank you! ' + kes(+dn.give.amount) + ' sent.'); dn.give.amount = ''; dn.sel = r.campaign; S.me = await api('GET', '/api/me'); render(); }); },
    ottab(d) { ot.tab = d.v; return guard(async () => { await load(); render(); }); },
    otlocate() { if (!navigator.geolocation) return toast('Location is not available here.'); navigator.geolocation.getCurrentPosition(p => { ot.loc = { lat: p.coords.latitude, lng: p.coords.longitude, label: 'Your current location' }; Object.assign(ot.f, { lat: p.coords.latitude, lng: p.coords.longitude }); guard(async () => { await load(); render(); }); }, () => toast('Could not get your location. Pick a town instead.'), { timeout: 8000 }); },
    ottown(d, el) { const t = TOWNS.find(x => x.name === el.value); if (!t) return; ot.loc = { lat: t.lat, lng: t.lng, label: t.name }; return guard(async () => { await load(); render(); }); },
    otgo(d) { return guard(async () => { const r = await api('POST', '/api/otm/' + d.id + '/tap'); window.open('https://www.google.com/maps?q=' + r.pin.lat + ',' + r.pin.lng, '_blank', 'noopener'); toast('Pin: ' + r.pin.label); }); },
    otex(d) { ot.f.text = ['Grab a tasty lunch at only KES. 250!', 'Grab fresh juice at mama pima kiosk.', 'Get brake pads for your car today at KES. 2000'][+d.i]; render(); },
    otrmph(d) { ot.f.photos.splice(+d.i, 1); render(); },
    otpin() { if (!navigator.geolocation) return toast('Location is not available here.'); navigator.geolocation.getCurrentPosition(p => { Object.assign(ot.f, { lat: p.coords.latitude, lng: p.coords.longitude }); guard(async () => { await quote(); render(); }); }, () => toast('Could not get your location. Use the arrows or pick a town.'), { timeout: 8000 }); },
    otnudge(d) { const m = 25 / 111320, i = +d.v; ot.f.lat += i === 1 ? m : i === 2 ? -m : 0; ot.f.lng += i === 0 ? -m : i === 3 ? m : 0; return guard(async () => { await quote(); render(); }); },
    otpintown(d, el) { const t = TOWNS.find(x => x.name === el.value); if (!t) return; Object.assign(ot.f, { lat: t.lat, lng: t.lng, label: ot.f.label || t.name }); return guard(async () => { await quote(); render(); }); },
    otsqm(d) { ot.f.sqm = +d.v; return guard(async () => { await quote(); render(); }); },
    otrequote() { return guard(async () => { await quote(); render(); }); },
    otpost() { return guard(async () => { const f = ot.f, r = await api('POST', '/api/otm', { text: f.text, photos: f.photos, lat: f.lat, lng: f.lng, label: f.label, sqm: +f.sqm }); toast('Live for 3 hours · ' + kes(r.quote.cost) + ' charged'); Object.assign(ot.f, { text: '', photos: [] }); S.me = await api('GET', '/api/me'); ot.tab = 'mine'; await load(); render(); }); },
    otstop(d) { return guard(async () => { if (!confirm('Stop this advert? Live adverts are not refunded.')) return; await api('DELETE', '/api/otm/' + d.id); await load(); render(); }); }
  });

  /* ------------------------------------------------------------ developer console */
  window.adminLoadExt = async function (s, A) {
    const t = true;
    if (s === 'donations') A.don = await api('GET', '/api/admin/donations', null, t);
    if (s === 'otm') A.otm = await api('GET', '/api/admin/otm', null, t);
    if (s === 'dira') A.dira = await api('GET', '/api/admin/dira', null, t);
    if (s === 'music') A.mus = await api('GET', '/api/admin/music', null, t);
  };
  const tmx = ts => ts ? new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  window.aDonations = function () {
    const d = S.a.don; if (!d) return '<h2>Donations</h2>'; const x = dn.adm;
    const row = c => `<tr><td><b>${esc(c.title)}</b><div class="mut sm">${esc(c.fullName)} · ${esc(c.address)}</div></td><td>${kes(c.amount)}<div class="mut sm">raised ${kes(c.raised)}</div></td><td><span class="tagb ${c.status === 'live' ? 'b' : 'o'}">${LBL[c.status] || c.status}</span></td><td class="sm">Docs: ${c.steps.docs}<br>Field: ${c.steps.field}</td><td><button class="btn sm alt" data-act="a_dnview" data-id="${c.id}">Review</button></td></tr>`;
    const sel = x && d.campaigns.find(c => c.id === x);
    return `<h2>Donations</h2><p class="lead">Double verification: (1) the documents pleading the case, then (2) a physical visit or video call by the SemaChat team. A campaign goes live only after both pass.</p>
    <div class="grid"><div class="gk"><span>Awaiting document review</span><b>${d.stats.pending}</b></div><div class="gk"><span>Awaiting visit / video</span><b>${d.stats.awaiting}</b></div><div class="gk"><span>Live campaigns</span><b>${d.stats.live}</b></div><div class="gk"><span>Raised to date</span><b>${kes(d.stats.raised)}</b></div></div>
    <div class="pn"><table class="tbl"><tr><th>Campaign</th><th>Goal</th><th>Status</th><th>Checks</th><th></th></tr>${d.campaigns.map(row).join('')}</table></div>
    ${sel ? `<div class="pn"><div class="row"><h3 class="grow">${esc(sel.title)}</h3><button class="btn sm alt" data-act="a_dnclose">Close</button></div><div class="two"><div><b>Verification documents</b><div class="sm" style="margin-top:6px">National ID: <b>${esc(sel.docs.nationalId)}</b><br>Full name: ${esc(sel.fullName)}<br>Address: ${esc(sel.address)}<br>Amount: ${kes(sel.amount)} · Deadline ${new Date(sel.deadline).toDateString()}<br>Beneficiary account: ${esc(sel.owner ? sel.owner.name : '')}</div><div class="sm" style="margin:8px 0"><b>Description</b><br>${esc(sel.description)}</div><b class="sm">Selfie with ID</b><div style="margin:6px 0">${sel.docs.idSelfie ? `<img src="${sel.docs.idSelfie}" style="max-width:200px;border-radius:12px">` : '<span class="mut sm">Demo campaign (no selfie stored)</span>'}</div><b class="sm">Situation media</b><div class="upl">${sel.media.map(m => `<div class="u" style="${mediaBg(m)}">${m.type === 'video' ? '▶' : ''}${m.emoji && !m.data && !m.thumb ? esc(m.emoji) : ''}</div>`).join('')}</div></div>
      <div><b>Step 1: documents</b><div class="sm">${sel.verify.docs ? (sel.verify.docs.ok ? '✅ Approved' : '❌ Rejected') + ' · ' + esc(sel.verify.docs.note || '') : 'Not reviewed yet'}</div>${sel.status === 'pending_docs' ? `<input data-bind="dn.note" placeholder="Note (optional)" style="margin:6px 0"><div class="row"><button class="btn sm" data-act="a_dndocs" data-id="${sel.id}" data-v="1">Approve documents</button><button class="btn sm alt" data-act="a_dndocs" data-id="${sel.id}" data-v="0">Reject</button></div>` : ''}
      <b style="display:block;margin-top:12px">Step 2: physical visit or video call</b><div class="sm">${sel.verify.field ? (sel.verify.field.ok === true ? '✅ Verified' : sel.verify.field.ok === false ? '❌ Failed' : '📅 ' + (sel.verify.field.method === 'video' ? 'Video call' : 'Visit') + ' scheduled for ' + tmx(sel.verify.field.when)) : 'Not scheduled'}</div>
      ${sel.status === 'awaiting_field' ? `<div class="row" style="margin:6px 0;gap:6px"><select data-bind="dn.plan.method"><option value="visit" ${dn.plan.method === 'visit' ? 'selected' : ''}>Physical visit</option><option value="video" ${dn.plan.method === 'video' ? 'selected' : ''}>Video call</option></select><input type="datetime-local" data-bind="dn.plan.when"><button class="btn sm" data-act="a_dnsched" data-id="${sel.id}">Schedule</button></div>${sel.verify.field ? `<div class="row"><button class="btn sm" data-act="a_dnfield" data-id="${sel.id}" data-v="1">Verified: go live</button><button class="btn sm alt" data-act="a_dnfield" data-id="${sel.id}" data-v="0">Not verified</button></div>` : ''}` : ''}
      ${sel.status === 'live' ? `<button class="btn sm alt" style="margin-top:10px" data-act="a_dntake" data-id="${sel.id}">Take down</button>` : ''}</div></div></div>` : ''}`;
  };
  window.aOtm = function () {
    const o = S.a.otm; if (!o) return '<h2>On the move!</h2>'; const c = o.config;
    return `<h2>On the move!</h2><p class="lead">Quick local adverts that last ${c.hours} hours and are priced by the area covered.</p><div class="grid"><div class="gk"><span>Live now</span><b>${o.stats.live}</b></div><div class="gk"><span>Adverts sold</span><b>${o.stats.total}</b></div><div class="gk"><span>Revenue</span><b>${kes(o.stats.revenue)}</b></div></div>
    <div class="pn"><h3>Pricing</h3><div class="row" style="flex-wrap:wrap;gap:8px"><label class="sm">Per ${c.unitSqm} sq m in ${c.premiumTowns.join(', ')}<input type="number" data-bind="f.otmP" value="${S.f.otmP != null ? S.f.otmP : c.premiumRate}" style="width:110px"></label><label class="sm">Other towns<input type="number" data-bind="f.otmO" value="${S.f.otmO != null ? S.f.otmO : c.otherRate}" style="width:110px"></label><label class="sm">Hours live<input type="number" data-bind="f.otmH" value="${S.f.otmH != null ? S.f.otmH : c.hours}" style="width:80px"></label><button class="btn sm" data-act="a_otmsave">Save pricing</button></div></div>
    <div class="pn"><table class="tbl"><tr><th>Outlet</th><th>Advert</th><th>Area</th><th>Paid</th><th>Status</th><th></th></tr>${o.ads.map(a => `<tr><td><b>${esc(a.outlet)}</b><div class="mut sm">${esc(a.town)}</div></td><td>${esc(a.text)}</td><td>${a.sqm.toLocaleString('en-KE')} sq m</td><td>${kes(a.cost)}</td><td>${a.status}${a.status === 'live' ? ' · ' + a.minsLeft + ' min left' : ''}</td><td>${a.status === 'live' ? `<button class="btn sm alt" data-act="a_otmtake" data-id="${a.id}">Remove</button>` : ''}</td></tr>`).join('')}</table></div>`;
  };
  window.aDira = function () {
    const d = S.a.dira; if (!d) return '<h2>DIRA TECH apps</h2>'; const on = d.apps.filter(a => a.enabled).length;
    return `<h2>DIRA TECH apps</h2><p class="lead">Placeholders only you can see. Clients see “Also from DIRA TECH” on their Me screen only after you activate at least one app. The footnote “${esc(d.footer)}” always shows.</p>
    <div class="row" style="margin-bottom:10px"><button class="btn sm" data-act="a_diraall" data-v="1">Activate all</button><button class="btn sm alt" data-act="a_diraall" data-v="0">Hide all</button><span class="mut sm">${on} of ${d.apps.length} visible to clients</span></div>
    <div class="pn"><table class="tbl"><tr><th>App</th><th>Open link (installed)</th><th>Download link (not installed)</th><th>Visible to clients</th><th></th></tr>${d.apps.map(a => `<tr><td><b>${esc(a.emoji)} ${esc(a.name)}</b><div class="mut sm">${esc(a.blurb)}</div></td><td><input data-bind="f.dira_${a.id}_s" value="${esc(S.f['dira_' + a.id + '_s'] != null ? S.f['dira_' + a.id + '_s'] : a.scheme)}" style="min-width:150px"></td><td><input data-bind="f.dira_${a.id}_u" value="${esc(S.f['dira_' + a.id + '_u'] != null ? S.f['dira_' + a.id + '_u'] : a.storeUrl)}" style="min-width:220px"></td><td><label class="sw"><input type="checkbox" data-act="a_dirasw" data-id="${a.id}" ${a.enabled ? 'checked' : ''}><span></span></label></td><td><button class="btn sm alt" data-act="a_dirasave" data-id="${a.id}">Save links</button></td></tr>`).join('')}</table></div>`;
  };
  window.aMusicAdm = function () {
    const m = S.a.mus; if (!m) return '<h2>DIRA Music</h2>';
    return `<h2>DIRA Music</h2><p class="lead">${m.total.toLocaleString('en-KE')} songs in ${m.genres} genres · ${m.listeners} listeners so far. The demo plays synthesised audio; set your CDN / object-storage base URL to stream real files from <code>/{genre}/{n}.mp3</code>.</p><div class="pn"><label class="sm">Music CDN base URL</label><div class="row"><input data-bind="f.cdn" placeholder="https://cdn.example.com/music" value="${esc(S.f.cdn != null ? S.f.cdn : m.cdn)}"><button class="btn sm" data-act="a_musicsave">Save</button></div></div>`;
  };
  const refresh = async (msg) => { if (msg) toast(msg); await adminBoot(); };
  Object.assign(adm, {
    async dnview(d) { dn.adm = d.id; render(); }, async dnclose() { dn.adm = null; render(); },
    async dndocs(d) { await api('POST', '/api/admin/donations/' + d.id + '/docs', { approve: d.v === '1', note: dn.note || '' }, true); dn.note = ''; await refresh('Documents ' + (d.v === '1' ? 'approved' : 'rejected')); },
    async dnsched(d) { await api('POST', '/api/admin/donations/' + d.id + '/schedule', { method: dn.plan.method, when: dn.plan.when ? new Date(dn.plan.when).getTime() : undefined }, true); await refresh('Scheduled'); },
    async dnfield(d) { await api('POST', '/api/admin/donations/' + d.id + '/field', { ok: d.v === '1' }, true); await refresh(d.v === '1' ? 'Verified: campaign is live' : 'Marked not verified'); },
    async dntake(d) { await api('POST', '/api/admin/donations/' + d.id + '/takedown', {}, true); await refresh('Taken down'); },
    async otmsave() { await api('PUT', '/api/admin/otm', { premiumRate: S.f.otmP, otherRate: S.f.otmO, hours: S.f.otmH }, true); await refresh('Pricing saved'); },
    async otmtake(d) { await api('POST', '/api/admin/otm/' + d.id + '/takedown', {}, true); await refresh('Removed'); },
    async dirasw(d, el) { await api('PUT', '/api/admin/dira/' + d.id, { enabled: el.checked }, true); await refresh(el.checked ? 'Visible to clients' : 'Hidden from clients'); },
    async diraall(d) { await api('POST', '/api/admin/dira', { enabled: d.v === '1' }, true); await refresh(d.v === '1' ? 'All apps activated' : 'All apps hidden'); },
    async dirasave(d) { const a = S.a.dira.apps.find(x => x.id === d.id); await api('PUT', '/api/admin/dira/' + d.id, { scheme: S.f['dira_' + d.id + '_s'] != null ? S.f['dira_' + d.id + '_s'] : a.scheme, storeUrl: S.f['dira_' + d.id + '_u'] != null ? S.f['dira_' + d.id + '_u'] : a.storeUrl }, true); await refresh('Links saved'); },
    async musicsave() { await api('PUT', '/api/admin/music', { cdn: S.f.cdn }, true); await refresh('Saved'); }
  });
})();
