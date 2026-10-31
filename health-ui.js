/* SemaChat — Exercise & Health UI add-on (loaded via <!--EXT-->).
 * Steps sensor + recorder with walking-style recognition and calories, heart-rate meter (camera / tap / manual),
 * breath-hold lung report, body (BMI / obesity) assessment, water, sleep, blood pressure, guided breathing, health score.
 * Reachable from AnA and pinned in the Chats list as a contact-like entry. All results are wellness guidance, not diagnosis. */
(function () {
  'use strict';
  const hl = S.hl = { sum: null, tab: 'steps', rec: null, res: null, hr: null, br: null, body: null, more: null, demo: 'walk', breathing: null,
    f: { w: '', h: '', a: '', sex: 'm', waist: '', steps: '', mins: '', sys: '', dia: '', hrm: '', sleep: '', state: 'rest', kind: 'inhale' } };
  const tryA = async (m, p, b) => { try { return await api(m, p, b); } catch (e) { return null; } };
  const STY = [['stroll', 'Strolling', 70, 2.3, 0.37, '🚶', 'Light activity'], ['walk', 'Walking', 100, 3.3, 0.413, '🚶‍♂️', 'Light–moderate activity'], ['brisk', 'Brisk walking', 120, 4.8, 0.45, '🚶‍♀️', 'Moderate activity'],
    ['jog', 'Jogging', 150, 7.0, 0.6, '🏃', 'Vigorous activity'], ['run', 'Running', 175, 9.8, 0.75, '🏃‍♂️', 'Vigorous activity'], ['sprint', 'Sprinting', 1e9, 12.5, 0.95, '⚡', 'High-intensity activity']];
  const IDLE = ['idle', 'Standing / shuffling', 0, 1.5, 0.2, '🧍', 'Resting'];
  const styleOf = spm => spm < 35 ? IDLE : STY.find(s => spm < s[2]);
  const css = document.createElement('style');
  css.textContent = `.hpill{display:flex;gap:6px;overflow-x:auto;padding:0 16px 10px;scrollbar-width:none}.hpill button{flex:0 0 auto;padding:8px 13px;border-radius:99px;background:var(--soft);font-weight:700;font-size:13px;color:#5c4a33}.hpill button.on{background:var(--brand);color:#fff}
  .hring{width:132px;height:132px;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;position:relative}.hring>div{width:104px;height:104px;border-radius:50%;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center}.hring b{font-size:26px;line-height:1}
  .hgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 16px}.hgrid>div{background:#fff;border-radius:14px;padding:10px 6px;text-align:center;box-shadow:0 1px 0 var(--line)}.hgrid b{display:block;font-size:17px}.hgrid span{font-size:11px;color:var(--muted)}
  .hbig{font-size:54px;font-weight:800;text-align:center;line-height:1}.hbtn{width:128px;height:128px;border-radius:50%;background:var(--brand);color:#fff;font-weight:800;font-size:18px;margin:6px auto;display:block}.hbtn.stop{background:var(--red)}
  .hrep{border-radius:16px;padding:14px;margin:0 16px 12px;background:#fff;box-shadow:0 1px 0 var(--line)}.hrep.ok{border-left:6px solid var(--green)}.hrep.watch{border-left:6px solid #d69e2e}.hrep.high,.hrep.urgent{border-left:6px solid var(--red)}
  .hrep ul{margin:6px 0 0 18px}.hrep li{margin:3px 0;font-size:13.5px}.hdis{font-size:11.5px;color:var(--muted);margin-top:8px}
  .hbar{height:10px;border-radius:99px;background:var(--soft);overflow:hidden}.hbar i{display:block;height:100%;background:var(--green);border-radius:99px}
  .hweek{display:flex;gap:6px;align-items:flex-end;height:80px;padding:0 16px}.hweek div{flex:1;text-align:center;font-size:10px;color:var(--muted)}.hweek i{display:block;background:var(--brand2);border-radius:6px 6px 0 0;margin-bottom:3px;min-height:3px}
  .bmi{position:relative;height:14px;border-radius:99px;margin:14px 0 4px;background:linear-gradient(90deg,#4299e1 0 18.5%,#48bb78 18.5% 40%,#ecc94b 40% 60%,#ed8936 60% 80%,#e53e3e 80%)}.bmi i{position:absolute;top:-5px;width:6px;height:24px;background:#1f1b2e;border-radius:3px;transform:translateX(-3px)}
  .hheart{font-size:80px;text-align:center;display:block}.beat{animation:beat .8s infinite}@keyframes beat{50%{transform:scale(1.18)}}
  .breath{width:150px;height:150px;border-radius:50%;margin:10px auto;background:radial-gradient(circle,#bee3f8,#4299e1);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;transition:transform 4s ease-in-out}
  .hgrp{padding:0 16px 10px}.hgrp input,.hgrp select{margin-bottom:8px}.hrow2{display:grid;grid-template-columns:1fr 1fr;gap:8px}`;
  document.head.appendChild(css);
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  const kcalOf = (met, kg, sec) => met * kg * sec / 3600;
  const kgNow = () => (hl.sum && hl.sum.profile && hl.sum.profile.weightKg) || 70;
  const cmNow = () => (hl.sum && hl.sum.profile && hl.sum.profile.heightCm) || 170;

  /* ------------------------------------------------------------ entry points: AnA, Chats, loader */
  const _chats = window.chatsView;
  window.chatsView = function () {
    const h = _chats(); if (!feat('health') || isBiz()) return h;
    const k = h.indexOf('<div class="chips"'); if (k < 0) return h; const e = h.indexOf('</div>', k) + 6;
    const row = `<div class="li" data-act="go" data-p="health"><div class="av" style="width:50px;height:50px;background:linear-gradient(135deg,#38a169,#2f855a);font-size:24px">💪</div><div class="grow"><div class="row"><b class="grow ell">Exercise &amp; Health</b><span class="tagb b" style="text-transform:none">Wellness</span></div><div class="mut ell sm">${hl.sum ? hl.sum.today.steps.toLocaleString('en-KE') + ' steps today · tap to open' : 'Steps, heart rate, lungs & more'}</div></div></div>`;
    return h.slice(0, e) + row + h.slice(e);
  };
  const _load = window.load;
  window.load = async function () {
    await _load();
    const v = cur(), k = v ? v.n : S.tab;
    if (!feat('health')) return;
    if (k === 'health') { hl.sum = await tryA('GET', '/api/wellness'); if (hl.sum && hl.sum.profile && !hl.f.w) Object.assign(hl.f, { w: hl.sum.profile.weightKg, h: hl.sum.profile.heightCm, a: hl.sum.profile.age, sex: hl.sum.profile.sex, waist: hl.sum.profile.waistCm || '' }); }
    else if (k === 'chats' && !isBiz()) hl.sum = await tryA('GET', '/api/wellness');
  };
  const _pv = window.pageView; window.pageView = v => v.n === 'health' ? healthPage() : _pv(v);

  /* ------------------------------------------------------------ page */
  function healthPage() {
    if (!feat('health')) return ph('Exercise & Health') + offBanner('health', 'Exercise & Health');
    const s = hl.sum; if (!s) return ph('Exercise & Health') + '<div class="empty">Loading…</div>';
    const tabs = [['steps', '👟 Steps'], ['heart', '❤️ Heart'], ['lungs', '🫁 Lungs'], ['body', '⚖️ Body'], ['more', '✨ More']];
    return ph('Exercise &amp; Health') + `<div class="hpill">${tabs.map(t => `<button class="${hl.tab === t[0] ? 'on' : ''}" data-act="hltab" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>` + ({ steps: stepsTab, heart: heartTab, lungs: lungsTab, body: bodyTab, more: moreTab })[hl.tab](s) +
      `<div class="hdis" style="padding:6px 20px 20px">${esc(s.disclaimer)}</div>`;
  }
  const rep = (r, inner) => `<div class="hrep ${r.level || 'ok'}">${inner}</div>`;

  /* ---- steps ---- */
  function stepsTab(s) {
    const t = s.today, pct = Math.min(100, Math.round(t.steps / s.goalSteps * 100)), R = hl.rec;
    const maxS = Math.max.apply(null, s.week.map(w => w.steps).concat([1]));
    const ring = `<div class="hring" style="background:conic-gradient(var(--green) ${pct * 3.6}deg,var(--soft) 0)"><div><b>${t.steps.toLocaleString('en-KE')}</b><span class="sm mut">of ${s.goalSteps.toLocaleString('en-KE')}</span></div></div>`;
    const live = R ? `<div class="card" style="margin:12px 16px" id="hlLive">${liveHtml()}</div>` : '';
    const legend = `<div class="sec">How styles are recognised</div><div class="card" style="margin:0 16px 12px;font-size:12.5px">${STY.map((x, i) => `<div class="row" style="margin:3px 0"><span style="width:26px">${x[5]}</span><b class="grow">${x[1]}</b><span class="mut">${i === 0 ? '< 70' : x[2] > 1e8 ? '≥ 175' : (STY[i - 1][2] + '–' + x[2])} steps/min · ${x[3]} METs</span></div>`).join('')}<div class="mut sm" style="margin-top:6px">Calories = METs × your weight × time. Update your weight in the Body tab for accuracy (now ${kgNow()} kg).</div></div>`;
    return `<div style="padding:0 16px 10px">${ring}</div>
    <div class="hgrid"><div><b>${t.calories}</b><span>kcal today</span></div><div><b>${(t.distanceM / 1000).toFixed(2)}</b><span>km</span></div><div><b>${Math.round(t.seconds / 60)}</b><span>active min</span></div></div>
    ${s.streak ? `<div class="mut sm" style="text-align:center;margin:8px">🔥 ${s.streak}-day streak of 2,000+ steps</div>` : ''}
    ${R ? live : `<div class="card" style="margin:12px 16px"><b>Step recorder</b><div class="mut sm" style="margin:2px 0 8px">Uses your phone’s motion sensor. Keep the phone in a pocket or hand.</div>
      <button class="btn full" data-act="hlstart" data-m="sensor">▶ Start recording with sensor</button>
      <div class="row" style="margin-top:8px"><select data-bind="hl.demo" style="flex:1">${STY.map(x => `<option value="${x[0]}" ${hl.demo === x[0] ? 'selected' : ''}>${x[5]} ${x[1]}</option>`).join('')}</select><button class="btn alt" data-act="hlstart" data-m="demo">Demo ${'🎬'}</button></div>
      <div class="mut sm" style="margin-top:6px">No sensor on this device (or on a computer)? Use the demo to see styles being recognised, or add steps by hand below.</div></div>`}
    ${hl.res ? resultCard(hl.res) : ''}
    <div class="sec">Add steps by hand</div><div class="hgrp"><div class="hrow2"><input data-bind="hl.f.steps" type="number" placeholder="Steps" value="${esc(hl.f.steps)}"><input data-bind="hl.f.mins" type="number" placeholder="Minutes" value="${esc(hl.f.mins)}"></div><button class="btn alt full" data-act="hlmanual">Record</button></div>
    <div class="sec">Last 7 days</div><div class="hweek">${s.week.map(w => `<div><i style="height:${Math.round(w.steps / maxS * 60)}px"></i>${new Date(w.day).toLocaleDateString([], { weekday: 'narrow' })}<br>${w.steps ? (w.steps / 1000).toFixed(1) + 'k' : '–'}</div>`).join('')}</div>
    ${legend}<div class="sec">Recent sessions</div>${s.sessions.length ? s.sessions.slice(0, 8).map(x => `<div class="li"><div class="fi" style="background:var(--soft)">${(x.styles[0] && x.styles[0].emoji) || '👟'}</div><div class="grow"><b class="sm">${x.steps.toLocaleString('en-KE')} steps · ${esc(x.dominantLabel)}</b><div class="mut sm">${Math.round(x.seconds / 60)} min · ${x.calories} kcal · ${(x.distanceM / 1000).toFixed(2)} km · ${ago(x.ts)}</div></div></div>`).join('') : '<div class="empty" style="padding:14px">No sessions yet.</div>'}`;
  }
  function resultCard(r) {
    return `<div class="hrep ok"><b>Session saved: ${r.steps.toLocaleString('en-KE')} steps</b><div class="mut sm">${mmss(r.seconds)} · <b>${r.calories} kcal</b> · ${(r.distanceM / 1000).toFixed(2)} km · mostly <b>${esc(r.dominantLabel)}</b> (${esc(r.activityType)})</div>
      <table style="width:100%;margin-top:8px;font-size:12.5px;border-collapse:collapse"><tr class="mut"><td>Style</td><td>Steps</td><td>Time</td><td>kcal</td><td>Cadence</td></tr>${r.styles.map(x => `<tr><td>${x.emoji} ${esc(x.label)}</td><td>${x.steps}</td><td>${mmss(x.seconds)}</td><td>${x.calories}</td><td>${x.cadence}/min</td></tr>`).join('')}</table></div>`;
  }
  const liveHtml = () => { const R = hl.rec; if (!R) return ''; const el = (Date.now() - R.t0) / 1000, spm = R.spm || 0, st = styleOf(spm), cal = R.cal; return `<div class="mut sm" style="text-align:center">${R.mode === 'demo' ? '🎬 Demo walk' : '📡 Sensor'} · recording</div><div class="hbig">${R.steps}</div><div style="text-align:center" class="mut">steps</div><div class="hgrid" style="padding:10px 0 0"><div><b>${st[5]} ${st[1]}</b><span>${Math.round(spm)} steps/min</span></div><div><b>${cal.toFixed(1)}</b><span>kcal</span></div><div><b>${mmss(el)}</b><span>${(R.dist / 1000).toFixed(2)} km</span></div></div><div class="mut sm" style="text-align:center;margin-top:6px">${st[6]}</div><button class="hbtn stop" data-act="hlstop" style="width:100%;height:46px;border-radius:12px;font-size:15px">■ Stop &amp; save</button>`; };
  function recTick() {
    const R = hl.rec; if (!R) return; const now = Date.now();
    if (R.mode === 'demo') { const x = STY.find(s => s[0] === hl.demo) || STY[1], base = x[2] > 1e8 ? 185 : x[0] === 'stroll' ? 55 : (x[2] - (x[0] === 'walk' ? 15 : x[0] === 'brisk' ? 10 : 12)); R.carry = (R.carry || 0) + (base + (Math.random() * 6 - 3)) / 60; const n = Math.floor(R.carry); R.carry -= n; R.steps += n; R.win.push([now, n]); }
    R.win = R.win.filter(w => now - w[0] <= 10000);
    const secs = Math.min(10, (now - R.t0) / 1000), inWin = R.win.reduce((a, w) => a + w[1], 0); R.spm = secs >= 3 ? inWin / secs * 60 : inWin / Math.max(1, secs) * 60;
    const st = styleOf(R.spm); R.cal += kcalOf(st[3], kgNow(), 1); R.dist += st[4] * cmNow() / 100 * (R.win.length ? R.win[R.win.length - 1][1] : 0);
    if (now - R.segT >= 10000) { const n = R.steps - R.segS, sec = (now - R.segT) / 1000; if (n > 0) R.segs.push({ steps: n, seconds: Math.round(sec) }); R.segT = now; R.segS = R.steps; }
    const el = document.getElementById('hlLive'); if (el) el.innerHTML = liveHtml();
  }
  // motion-sensor step detection: smoothed acceleration magnitude, adaptive threshold, 250 ms refractory period
  function startSensor(R) {
    let avg = 9.8, last = 0, prev = 0, up = false;
    R.onMotion = e => { const a = e.accelerationIncludingGravity; if (!a) return; const m = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2); avg = avg * 0.9 + m * 0.1; const d = m - avg, t = Date.now(); if (d > 1.3 && !up && t - last > 250) { R.steps++; R.win.push([t, 1]); last = t; up = true; } if (d < 0.3) up = false; prev = m; };
    window.addEventListener('devicemotion', R.onMotion);
  }
  async function stopRec() {
    const R = hl.rec; if (!R) return; clearInterval(R.timer); if (R.onMotion) window.removeEventListener('devicemotion', R.onMotion);
    const now = Date.now(), n = R.steps - R.segS, sec = Math.max(1, Math.round((now - R.segT) / 1000)); if (n > 0) R.segs.push({ steps: n, seconds: sec });
    hl.rec = null; if (!R.steps) { toast('No steps were detected, so nothing was saved.'); return render(); }
    let segs = R.segs; while (segs.length > 400) { const m = []; for (let i = 0; i < segs.length; i += 2) m.push(i + 1 < segs.length ? { steps: segs[i].steps + segs[i + 1].steps, seconds: segs[i].seconds + segs[i + 1].seconds } : segs[i]); segs = m; }
    const r = await api('POST', '/api/wellness/session', { segments: segs, source: R.mode === 'demo' ? 'demo' : 'sensor', note: R.mode === 'demo' ? 'Demo walk' : 'Recorded walk' });
    hl.res = r.session; hl.sum = r.summary; if (r.goalReached) toast('🎯 Daily step goal reached!'); render();
  }

  /* ---- heart ---- */
  function heartTab(s) {
    const H = hl.hr, last = s.lastHr, f = hl.f;
    return `<div class="card" style="margin:0 16px 12px;text-align:center"><span class="hheart ${H && H.running ? 'beat' : ''}">❤️</span>
      <div class="hbig" id="hrNow">${H && H.bpm ? H.bpm : last ? last.bpm : '--'}</div><div class="mut">beats per minute</div>
      <div class="chips" style="justify-content:center;margin-top:8px"><button class="chip ${f.state === 'rest' ? 'on' : ''}" data-act="hlstate" data-v="rest">At rest</button><button class="chip ${f.state === 'active' ? 'on' : ''}" data-act="hlstate" data-v="active">After activity</button></div>
      <div id="hrMsg" class="mut sm" style="margin:8px 0;min-height:18px">${H && H.running ? H.msg || 'Measuring…' : 'Pick a method below. Sit still for a minute first if you are measuring resting rate.'}</div>
      <div class="hbar" style="margin:0 20px 10px"><i id="hrBar" style="width:${H && H.running ? H.pct || 0 : 0}%"></i></div>
      <button class="btn full" data-act="hlcam">📷 Measure with camera (cover lens with fingertip)</button>
      <div class="row" style="margin-top:8px"><button class="btn alt grow" data-act="hltap">👆 Tap-count (15 s)</button><button class="btn alt grow" data-act="hldemo">🎬 Demo</button></div>
      <div class="row" style="margin-top:8px"><input data-bind="hl.f.hrm" type="number" placeholder="Or type your bpm" value="${esc(f.hrm)}"><button class="btn sm" data-act="hlmanualhr">Save</button></div></div>
    ${hl.res2 ? hl.res2 : ''}<video id="hrVid" playsinline muted style="display:none"></video><canvas id="hrCv" width="32" height="32" style="display:none"></canvas>
    ${last ? `<div class="sec">Last reading</div><div class="li"><div class="fi" style="background:#fed7d7">❤️</div><div class="grow"><b>${last.bpm} bpm</b><div class="mut sm">${last.state === 'rest' ? 'At rest' : 'After activity'} · ${last.method} · ${ago(last.ts)} ago</div></div></div>` : ''}`;
  }
  const hrResult = r => { hl.res2 = rep(r.resting || { level: 'ok' }, `<b>${esc(r.headline)}</b><div class="sm" style="margin-top:4px">${r.resting ? esc(r.resting.note) : 'Max heart rate for your age is about ' + r.zone.maxHr + ' bpm. You are at ' + r.zone.pctMax + '% of it.'}</div><div class="sm mut" style="margin-top:4px">Zone: ${esc(r.zone.zone)} · ${r.zone.pctMax}% of max (${r.zone.maxHr})</div><div class="hdis">${esc(r.disclaimer)}</div>`); };
  async function saveHr(bpm, method) { const r = await api('POST', '/api/wellness/hr', { bpm, method, state: hl.f.state }); hrResult(r); hl.hr = { bpm, running: false }; hl.sum = await tryA('GET', '/api/wellness') || hl.sum; render(); }
  async function camHr() {
    const H = hl.hr = { running: true, msg: 'Starting camera…', pct: 0 }; render();
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: 64, height: 64 }, audio: false }); } catch (e) { hl.hr = null; render(); return toast('Camera not available here. Use tap-count, demo or type your reading.'); }
    try { const tr = stream.getVideoTracks()[0]; await tr.applyConstraints({ advanced: [{ torch: true }] }); } catch (e) { /* no torch: fine */ }
    const vid = document.getElementById('hrVid'), cv = document.getElementById('hrCv'); if (!vid) { stream.getTracks().forEach(t => t.stop()); return; }
    vid.srcObject = stream; await vid.play().catch(() => { }); const cx = cv.getContext('2d'), samples = [], t0 = Date.now();
    H.msg = 'Cover the camera lens with your fingertip and hold still…';
    const iv = setInterval(() => {
      const el = (Date.now() - t0) / 1000; try { cx.drawImage(vid, 0, 0, 32, 32); const d = cx.getImageData(0, 0, 32, 32).data; let r = 0; for (let i = 0; i < d.length; i += 4) r += d[i]; samples.push([el, r / 1024]); } catch (e) { /* ignore */ }
      H.pct = Math.min(100, el / 15 * 100); const b = document.getElementById('hrBar'); if (b) b.style.width = H.pct + '%'; const m = document.getElementById('hrMsg'); if (m) m.textContent = 'Measuring… ' + Math.max(0, 15 - Math.floor(el)) + 's';
      if (el >= 15) { clearInterval(iv); stream.getTracks().forEach(t => t.stop()); finish(); }
    }, 33);
    H.stop = () => { clearInterval(iv); stream.getTracks().forEach(t => t.stop()); };
    function finish() {
      const v = samples.map(s => s[1]), mean = v.reduce((a, b) => a + b, 0) / (v.length || 1); const w = 9, sm = v.map((_, i) => { let a = 0, n = 0; for (let k = -w; k <= w; k++) if (v[i + k] != null) { a += v[i + k]; n++; } return v[i] - a / n; });
      const sd = Math.sqrt(sm.reduce((a, b) => a + b * b, 0) / (sm.length || 1)), peaks = []; for (let i = 2; i < sm.length - 2; i++) if (sm[i] > sd * 0.4 && sm[i] >= sm[i - 1] && sm[i] > sm[i + 1] && sm[i] >= sm[i - 2] && sm[i] > sm[i + 2] && (!peaks.length || samples[i][0] - peaks[peaks.length - 1] > 0.33)) peaks.push(samples[i][0]);
      hl.hr = null;
      if (mean < 40 || peaks.length < 6) { render(); return toast('Could not get a clear pulse. Cover the lens fully with a fingertip, keep still and try again.'); }
      const bpm = Math.round((peaks.length - 1) / (peaks[peaks.length - 1] - peaks[0]) * 60); if (bpm < 35 || bpm > 220) { render(); return toast('The reading looked unreliable. Please try again.'); }
      saveHr(bpm, 'camera');
    }
    render();
  }

  /* ---- lungs ---- */
  function lungsTab(s) {
    const B = hl.br, f = hl.f, r = hl.res3;
    return `<div class="card" style="margin:0 16px 12px;text-align:center"><b>Breath-hold lung check</b><div class="mut sm" style="margin:2px 0 8px">Sit upright and relax. Take one normal deep breath, tap Start, and tap Stop the moment you need to breathe. Never do this in water, while driving, or if you feel dizzy.</div>
      <div class="chips" style="justify-content:center"><button class="chip ${f.kind === 'inhale' ? 'on' : ''}" data-act="hlkind" data-v="inhale">After a deep breath in</button><button class="chip ${f.kind === 'exhale' ? 'on' : ''}" data-act="hlkind" data-v="exhale">After breathing out</button></div>
      <div class="hbig" id="brT" style="margin-top:10px">${B ? '0.0' : '0'}<span style="font-size:20px"> s</span></div>
      <button class="hbtn ${B ? 'stop' : ''}" data-act="${B ? 'hlbrstop' : 'hlbrstart'}">${B ? 'Stop' : 'Start'}</button>
      <div class="row" style="margin-top:4px"><input data-bind="hl.f.bsec" type="number" placeholder="Or enter seconds you held" value="${esc(f.bsec || '')}"><button class="btn sm" data-act="hlbrmanual">Get report</button></div></div>
    ${r ? rep(r, `<b>${esc(r.label)}: ${r.seconds}s</b><div class="sm" style="margin-top:4px">Most likely: ${esc(r.likely)}.</div><ul>${r.advice.map(a => `<li>${esc(a)}</li>`).join('')}</ul><div class="hdis">${esc(r.disclaimer)}</div>`) : ''}
    <div class="sec">Typical results</div><div class="card" style="margin:0 16px 12px;font-size:12.5px">${[['Under 10 s', 'Very short: lung reserve may be reduced'], ['10–20 s', 'Below average'], ['20–30 s', 'Average'], ['30–45 s', 'Good'], ['45 s +', 'Excellent']].map(x => `<div class="row" style="margin:3px 0"><b style="width:76px">${x[0]}</b><span class="mut">${x[1]}</span></div>`).join('')}<div class="mut sm">Holds after breathing out are about half as long; the report adjusts for that and for age.</div></div>
    ${s.lastBreath ? `<div class="mut sm" style="padding:0 20px">Last check: ${s.lastBreath.seconds}s · ${ago(s.lastBreath.ts)} ago</div>` : ''}`;
  }

  /* ---- body ---- */
  function bodyTab(s) {
    const f = hl.f, r = hl.body;
    const inp = (k, l, t, ph) => `<div><label class="lb">${l}</label><input data-bind="hl.f.${k}" type="${t || 'number'}" placeholder="${ph || ''}" value="${esc(f[k])}"></div>`;
    return `<div class="hgrp"><div class="hrow2">${inp('w', 'Weight (kg)', 'number', 'e.g. 72')}${inp('h', 'Height (cm)', 'number', 'e.g. 175')}${inp('a', 'Age (years)', 'number', 'e.g. 31')}<div><label class="lb">Sex</label><select data-bind="hl.f.sex"><option value="m" ${f.sex === 'm' ? 'selected' : ''}>Male</option><option value="f" ${f.sex === 'f' ? 'selected' : ''}>Female</option></select></div></div>${inp('waist', 'Waist (cm), optional', 'number', 'around the navel')}<button class="btn full" style="margin-top:8px" data-act="hlassess">Analyse my body</button></div>
    ${r ? rep(r, `<b style="font-size:17px">${r.cleanBillOfHealth ? '✅ ' : ''}${esc(r.headline)}</b><div class="bmi"><i style="left:${Math.max(2, Math.min(98, (r.bmi - 14) / 28 * 100))}%"></i></div><div class="row mut sm"><span class="grow">14</span><span>18.5</span><span style="margin:0 20px">25</span><span>30</span><span style="margin-left:20px">40+</span></div>
      <div class="hgrid" style="padding:10px 0"><div><b>${r.bmi}</b><span>BMI</span></div><div><b>${r.healthyRangeKg[0]}–${r.healthyRangeKg[1]}</b><span>healthy kg</span></div><div><b>${r.dailyCalories}</b><span>kcal/day to maintain</span></div></div>
      ${r.risks.length ? `<b class="sm">Possible health dangers</b><ul>${r.risks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<div class="sm" style="color:var(--green)"><b>No weight-related risks found on these numbers.</b></div>'}<b class="sm">What to do</b><ul>${r.advice.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="hdis">${esc(r.disclaimer)}</div>`) : '<div class="empty" style="padding:10px"><span class="sm">Enter your weight, height and age to see your obesity status, possible health dangers, or a clean bill of health.</span></div>'}`;
  }

  /* ---- more ---- */
  function moreTab(s) {
    const t = s.today, f = hl.f, m = hl.more;
    const wp = Math.min(100, Math.round(t.waterMl / t.waterGoalMl * 100));
    return `<div class="card" style="margin:0 16px 12px"><div class="row"><b class="grow">Daily health score</b><b style="font-size:24px;color:${s.score >= 75 ? 'var(--green)' : s.score >= 50 ? '#b7791f' : 'var(--red)'}">${s.score}</b></div>${s.scoreParts.map(p => `<div class="row sm" style="margin:6px 0"><span style="width:60px">${p[0]}</span><div class="hbar grow"><i style="width:${p[1]}%"></i></div></div>`).join('')}<div class="mut sm">Built from today’s steps, water, last night’s sleep and your weight status.</div></div>
    <div class="card" style="margin:0 16px 12px"><div class="row"><b class="grow">💧 Water</b><span class="mut sm">${t.waterMl} / ${t.waterGoalMl} ml</span></div><div class="hbar" style="margin:8px 0"><i style="width:${wp}%;background:#4299e1"></i></div><div class="row">${[200, 250, 500, 750].map(x => `<button class="btn alt sm grow" data-act="hlwater" data-v="${x}">+${x}</button>`).join('')}</div></div>
    <div class="card" style="margin:0 16px 12px"><b>😴 Sleep</b><div class="mut sm">${t.sleepHours ? 'Last night: ' + t.sleepHours + ' h' : 'Log last night’s sleep'}</div><div class="row" style="margin-top:6px"><input data-bind="hl.f.sleep" type="number" step="0.5" placeholder="Hours slept" value="${esc(f.sleep)}"><button class="btn sm" data-act="hlsleep">Log</button></div>${m && m.kind === 'sleep' ? `<div class="sm" style="margin-top:6px"><b>${esc(m.label)}.</b> ${esc(m.advice)}</div>` : ''}</div>
    <div class="card" style="margin:0 16px 12px"><b>🩸 Blood pressure</b><div class="mut sm">${s.lastBp ? 'Last: ' + s.lastBp.sys + '/' + s.lastBp.dia + ' mmHg' : 'Use a cuff, then log the numbers'}</div><div class="row" style="margin-top:6px"><input data-bind="hl.f.sys" type="number" placeholder="Top (sys)" value="${esc(f.sys)}"><input data-bind="hl.f.dia" type="number" placeholder="Bottom (dia)" value="${esc(f.dia)}"><button class="btn sm" data-act="hlbp">Check</button></div>${m && m.kind === 'bp' ? `<div class="hrep ${m.level}" style="margin:8px 0 0"><b>${esc(m.label)}</b><div class="sm">${esc(m.advice)}</div></div>` : ''}</div>
    <div class="card" style="margin:0 16px 12px;text-align:center"><b>🧘 Guided breathing</b><div class="mut sm">Slow breathing calms stress and lowers heart rate.</div><div class="breath" id="brth" style="transform:scale(${hl.breathing && hl.breathing.big ? 1.3 : 0.8})">${hl.breathing ? hl.breathing.label : 'Ready'}</div>${hl.breathing ? '<button class="btn alt" data-act="hlbreathstop">Stop</button>' : '<button class="btn" data-act="hlbreathe">Start (box breathing 4-4-4-4)</button>'}</div>
    <div class="card" style="margin:0 16px 12px"><b>🎯 Daily step goal</b><div class="row" style="margin-top:6px"><input data-bind="hl.f.goal" type="number" placeholder="${s.goalSteps}" value="${esc(f.goal || '')}"><button class="btn sm" data-act="hlgoal">Set</button></div></div>
    <div class="card" style="margin:0 16px 12px"><b>💡 Healthy habits</b><ul style="margin:6px 0 0 18px;font-size:13.5px"><li>Walk 30 minutes most days; add 2 strength sessions a week.</li><li>Fill half your plate with vegetables; keep sugary drinks rare.</li><li>Stand up and stretch every hour of sitting.</li><li>Aim for 7–9 hours of sleep and a fixed bedtime.</li><li>Get blood pressure and sugar checked yearly after 30.</li></ul></div>`;
  }

  /* ------------------------------------------------------------ actions */
  const reloadSum = async () => { hl.sum = await tryA('GET', '/api/wellness') || hl.sum; render(); };
  Object.assign(acts, {
    hltab(d) { if (hl.hr && hl.hr.stop) { hl.hr.stop(); hl.hr = null; } hl.tab = d.v; render(); },
    hlstart(d) {
      if (hl.rec) return; const now = Date.now(), R = hl.rec = { mode: d.m, t0: now, steps: 0, cal: 0, dist: 0, spm: 0, win: [], segs: [], segT: now, segS: 0 };
      const go2 = () => { R.timer = setInterval(recTick, 1000); if (R.mode === 'sensor') startSensor(R); render(); };
      if (d.m === 'sensor') {
        if (!('DeviceMotionEvent' in window)) { hl.rec = null; return toast('This device has no motion sensor. Try the demo or add steps by hand.'); }
        if (typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().then(p => { if (p === 'granted') go2(); else { hl.rec = null; toast('Motion permission was declined.'); } }).catch(() => { hl.rec = null; });
        else go2();
      } else go2();
    },
    hlstop() { return guard(stopRec); },
    hlmanual() { return guard(async () => { const st = +hl.f.steps, mi = +hl.f.mins; if (!(st > 0) || !(mi > 0)) return toast('Enter steps and minutes.'); const r = await api('POST', '/api/wellness/session', { steps: st, seconds: mi * 60, source: 'manual', note: 'Added by hand' }); hl.res = r.session; hl.sum = r.summary; hl.f.steps = hl.f.mins = ''; if (r.goalReached) toast('🎯 Daily step goal reached!'); render(); }); },
    hlstate(d) { hl.f.state = d.v; render(); },
    hlcam() { return guard(camHr); },
    hltap() {
      const H = hl.hr = { running: true, msg: 'Tap the big button on every beat you feel…', pct: 0, taps: [] }; render();
      const m = document.getElementById('hrMsg'); const iv = setInterval(() => { const el = (Date.now() - H.t0) / 1000; H.pct = Math.min(100, el / 15 * 100); const b = document.getElementById('hrBar'); if (b) b.style.width = H.pct + '%'; if (el >= 15) { clearInterval(iv); const n = H.taps.length; hl.hr = null; if (n < 8) { render(); return toast('Too few taps to measure. Try again.'); } guard(() => saveHr(Math.round(n * 4), 'tap')); } }, 200); H.t0 = Date.now();
      document.getElementById('hrMsg').innerHTML = 'Tap here on every beat: <button class="btn sm" data-act="hlbeat">♥ beat</button>';
      H.stop = () => clearInterval(iv);
    },
    hlbeat() { if (hl.hr && hl.hr.taps) hl.hr.taps.push(Date.now()); },
    hldemo() { return guard(() => saveHr(hl.f.state === 'rest' ? 66 + Math.round(Math.random() * 10) : 118 + Math.round(Math.random() * 20), 'demo')); },
    hlmanualhr() { return guard(() => saveHr(+hl.f.hrm, 'manual')); },
    hlkind(d) { hl.f.kind = d.v; render(); },
    hlbrstart() { hl.br = { t0: Date.now() }; hl.br.timer = setInterval(() => { const e = document.getElementById('brT'); if (e) e.innerHTML = ((Date.now() - hl.br.t0) / 1000).toFixed(1) + '<span style="font-size:20px"> s</span>'; }, 100); render(); },
    hlbrstop() { return guard(async () => { const sec = (Date.now() - hl.br.t0) / 1000; clearInterval(hl.br.timer); hl.br = null; hl.res3 = await api('POST', '/api/wellness/breath', { seconds: Math.max(1, Math.round(sec * 10) / 10), kind: hl.f.kind }); await reloadSum(); }); },
    hlbrmanual() { return guard(async () => { hl.res3 = await api('POST', '/api/wellness/breath', { seconds: +hl.f.bsec, kind: hl.f.kind }); await reloadSum(); }); },
    hlassess() { return guard(async () => { const f = hl.f; hl.body = await api('POST', '/api/wellness/assess', { weightKg: +f.w, heightCm: +f.h, age: +f.a, sex: f.sex, waistCm: f.waist ? +f.waist : undefined }); await reloadSum(); }); },
    hlwater(d) { return guard(async () => { hl.sum = await api('POST', '/api/wellness/water', { ml: +d.v }); render(); }); },
    hlsleep() { return guard(async () => { const r = await api('POST', '/api/wellness/sleep', { hours: +hl.f.sleep }); hl.more = Object.assign({ kind: 'sleep' }, r); hl.sum = r.summary; render(); }); },
    hlbp() { return guard(async () => { const r = await api('POST', '/api/wellness/bp', { sys: +hl.f.sys, dia: +hl.f.dia }); hl.more = Object.assign({ kind: 'bp' }, r); await reloadSum(); }); },
    hlgoal() { return guard(async () => { const p = hl.sum.profile || { weightKg: 70, heightCm: 170, age: 30, sex: 'm' }; hl.sum = await api('POST', '/api/wellness/profile', Object.assign({}, p, { goalSteps: +hl.f.goal })); toast('Goal updated'); render(); }); },
    hlbreathe() {
      const ph2 = ['Breathe in', 'Hold', 'Breathe out', 'Hold'], B = hl.breathing = { i: 0, big: false, label: ph2[0], n: 0 }; B.big = true;
      B.timer = setInterval(() => { B.i = (B.i + 1) % 4; B.n++; B.label = ph2[B.i]; B.big = B.i === 0 || B.i === 1; const e = document.getElementById('brth'); if (e) { e.textContent = B.label; e.style.transform = 'scale(' + (B.big ? 1.3 : 0.8) + ')'; } if (B.n >= 16) acts.hlbreathstop(); }, 4000); render();
    },
    hlbreathstop() { if (hl.breathing) { clearInterval(hl.breathing.timer); hl.breathing = null; toast('Nice work. Notice how calm you feel.'); render(); } }
  });
})();
