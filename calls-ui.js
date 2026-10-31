/* SemaChat — real WebRTC calls (loaded via <!--EXT-->).
 * With the backend running, voice / video / group calls are real: the server relays offer/answer/ICE over the SSE
 * stream and audio + video travel peer-to-peer. In the standalone preview (no backend) the original simulated call
 * screen is kept, because there is nobody on the other end to connect to. */
(function () {
  'use strict';
  const live = () => typeof REMOTE !== 'undefined' && REMOTE && window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
  let R = null, ring = null;          // R = active call, ring = incoming call prompt
  window.__rtc = () => R;
  const css = document.createElement('style');
  css.textContent = `#rtc,#rtcin{position:fixed;inset:0;z-index:350;max-width:520px;margin:0 auto;background:#14101f;color:#fff;display:flex;flex-direction:column}
  #rtc .tp{padding:16px;text-align:center}#rtc .tp h2{font-size:18px}#rtc .tm{opacity:.8;font-variant-numeric:tabular-nums}
  #rtc .grid{flex:1;display:grid;gap:8px;padding:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-content:center}
  #rtc .tile{position:relative;background:#2a2340;border-radius:16px;overflow:hidden;min-height:150px;display:flex;align-items:center;justify-content:center}
  #rtc .tile video{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;background:#000}#rtc .tile.noV video{display:none}
  #rtc .tile .nm{position:absolute;left:8px;bottom:6px;font-size:12px;background:#0008;border-radius:99px;padding:2px 8px;z-index:2}
  #rtc .tile.me{outline:2px solid #ffffff33}#rtc .cc{display:flex;gap:14px;justify-content:center;padding:16px 16px 28px}
  #rtc .cc button,#rtcin .cc button{width:58px;height:58px;border-radius:50%;background:#ffffff22;color:#fff;font-size:24px}#rtc .cc .on{background:#fff;color:#14101f}#rtc .cc .end,#rtcin .no{background:#e53e3e}#rtcin .yes{background:#38a169}
  #rtcin{justify-content:center;align-items:center;text-align:center;gap:10px}#rtcin .cc{display:flex;gap:40px;margin-top:30px}`;
  document.head.appendChild(css);
  const post = (p, b) => api('POST', p, b || {});
  const ago = () => { const s = Math.floor((Date.now() - R.t0) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function ui() {
    if (!R) return; let el = document.getElementById('rtc'); if (!el) { el = document.createElement('div'); el.id = 'rtc'; document.body.appendChild(el); }
    const tiles = [`<div class="tile me ${R.mode === 'video' && R.cam ? '' : 'noV'}" id="t_me"><video autoplay playsinline muted></video><span style="font-size:40px">🙂</span><span class="nm">You${R.muted ? ' · 🔇' : ''}</span></div>`]
      .concat(Object.keys(R.peers).map(id => `<div class="tile ${R.mode === 'video' ? '' : 'noV'}" id="t_${id}"><video autoplay playsinline></video><span style="font-size:40px">🙂</span><span class="nm">${esc(R.peers[id].name)} · ${R.peers[id].state}</span></div>`));
    el.innerHTML = `<div class="tp"><h2>${esc(R.title)}</h2><div class="tm" id="rtcT">${R.waiting ? 'Ringing…' : ago()}</div></div><div class="grid">${tiles.join('')}</div>
      <div class="cc"><button class="${R.muted ? 'on' : ''}" data-rt="mute">${R.muted ? '🔇' : '🎙️'}</button>${R.mode === 'video' ? `<button class="${R.cam ? '' : 'on'}" data-rt="cam">${R.cam ? '📹' : '🚫'}</button>` : ''}<button class="end" data-rt="end">📵</button></div>`;
    const me = el.querySelector('#t_me video'); if (me && R.local) me.srcObject = R.local;
    Object.keys(R.peers).forEach(id => { const v = el.querySelector('#t_' + id + ' video'); if (v && R.peers[id].stream) v.srcObject = R.peers[id].stream; });
  }
  async function media(mode) {
    try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' }); }
    catch (e) { if (mode === 'video') { try { toast('Camera unavailable: continuing with voice only.'); return await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e2) { /* fall through */ } } throw new Error('Allow microphone access to make calls.'); }
  }
  function peer(id, name, initiator) {
    if (R.peers[id]) return R.peers[id];
    const pc = new RTCPeerConnection({ iceServers: R.ice }), P = R.peers[id] = { pc, name: name || 'Friend', state: 'connecting…', stream: null, queue: [] };
    R.local.getTracks().forEach(t => pc.addTrack(t, R.local));
    pc.onicecandidate = e => { if (e.candidate && R) post('/api/calls/' + R.id + '/signal', { to: id, kind: 'ice', data: e.candidate.toJSON() }).catch(() => { }); };
    pc.ontrack = e => { P.stream = e.streams[0]; ui(); };
    pc.onconnectionstatechange = () => { P.state = pc.connectionState === 'connected' ? 'connected' : pc.connectionState === 'failed' ? 'connection failed' : 'connecting…'; if (pc.connectionState === 'connected') R.waiting = false; ui(); };
    if (initiator) pc.createOffer().then(o => pc.setLocalDescription(o)).then(() => post('/api/calls/' + R.id + '/signal', { to: id, kind: 'offer', data: pc.localDescription.toJSON() })).catch(e => toast(e.message));
    ui(); return P;
  }
  const drop = id => { const P = R && R.peers[id]; if (P) { try { P.pc.close(); } catch (e) { /* closed */ } delete R.peers[id]; ui(); } };
  function cleanup(msg) {
    if (!R) return; clearInterval(R.timer); Object.keys(R.peers).forEach(id => { try { R.peers[id].pc.close(); } catch (e) { /* closed */ } }); R.local && R.local.getTracks().forEach(t => t.stop());
    const el = document.getElementById('rtc'); if (el) el.remove(); const chatId = R.chatId; R = null; if (msg) toast(msg);
    const t = cur(); if (t && t.n === 'chat' && S.d.chat && S.d.chat.ch.id === chatId) api('GET', '/api/chats/' + chatId + '/messages').then(m => { S.d.chat.msgs = m; render(); }).catch(() => { }); else softRefresh && softRefresh();
  }
  function begin(o) {
    R = Object.assign({ peers: {}, muted: false, cam: o.mode === 'video', t0: Date.now(), waiting: false }, o);
    R.timer = setInterval(() => { const e = document.getElementById('rtcT'); if (e && !R.waiting) e.textContent = ago(); }, 1000); ui();
  }
  async function realStart(mode) {
    const ch = S.d.chat.ch;
    try {
      const local = await media(mode), r = await post('/api/calls', { chatId: ch.id, mode });
      begin({ id: r.id, chatId: ch.id, mode, ice: r.iceServers, local, title: ch.type === 'group' ? ch.name : 'Calling ' + ch.name, waiting: true, users: {} }); r.members.forEach(m => { R.users[m.id] = m; });
    } catch (e) { toast(e.message); }
  }
  const _start = window.startCall;
  window.startCall = function (mode) {
    const ch = S.d.chat && S.d.chat.ch; if (!ch || !live()) return _start(mode);
    if (!feat('calls')) return toast('Calls are switched off by SemaChat right now.');
    if (mode === 'video' && !feat('videoCalls')) return toast('Video calls are switched off by SemaChat right now.');
    if (ch.members.length > 2 && !feat('conference')) return toast('Group calls are switched off by SemaChat right now.');
    if (R) return toast('You are already in a call.'); realStart(mode);
  };
  async function accept() {
    const c = ring; stopRing(); if (!c || R) return;
    try {
      const local = await media(c.mode), r = await post('/api/calls/' + c.id + '/join');
      begin({ id: c.id, chatId: c.chatId, mode: c.mode, ice: r.iceServers, local, title: c.title, users: {} });
      r.participants.forEach(p => { R.users[p.id] = p; peer(p.id, p.name, true); });
    } catch (e) { toast(e.message); post('/api/calls/' + c.id + '/decline').catch(() => { }); }
  }
  function stopRing() { clearTimeout(stopRing.t); const el = document.getElementById('rtcin'); if (el) el.remove(); const c = ring; ring = null; return c; }
  function incoming(c) {
    if (R || ring) { post('/api/calls/' + c.id + '/decline').catch(() => { }); return; }
    ring = c; const el = document.createElement('div'); el.id = 'rtcin';
    el.innerHTML = `<div style="font-size:64px">📞</div><h2>${esc(c.from.name)}</h2><div style="opacity:.8">${c.group ? 'Group ' : ''}${c.mode === 'video' ? 'video' : 'voice'} call · ${esc(c.title)}</div><div class="cc"><button class="no" data-rt="decline">📵</button><button class="yes" data-rt="accept">📞</button></div>`;
    document.body.appendChild(el); try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) { /* no vibration */ }
    stopRing.t = setTimeout(stopRing, 58000);
  }
  async function signal(ev) {
    if (ring && ring.id === ev.id && ['ended', 'missed', 'declined'].includes(ev.kind)) { stopRing(); return toast('Missed call'); }
    if (!R || R.id !== ev.id) return;
    const from = ev.from, d = ev.data || {};
    if (ev.kind === 'joined') { R.users[from] = d.user; R.waiting = false; const P = peer(from, d.user && d.user.name, false); P.name = (d.user && d.user.name) || P.name; ui(); }
    else if (ev.kind === 'offer') {
      const P = peer(from, (R.users[from] || {}).name, false);
      await P.pc.setRemoteDescription(d); P.queue.splice(0).forEach(c => P.pc.addIceCandidate(c).catch(() => { }));
      const a = await P.pc.createAnswer(); await P.pc.setLocalDescription(a); post('/api/calls/' + R.id + '/signal', { to: from, kind: 'answer', data: P.pc.localDescription.toJSON() }).catch(() => { });
    } else if (ev.kind === 'answer') { const P = R.peers[from]; if (P) { await P.pc.setRemoteDescription(d); P.queue.splice(0).forEach(c => P.pc.addIceCandidate(c).catch(() => { })); } }
    else if (ev.kind === 'ice') { const P = R.peers[from]; if (P) { if (P.pc.remoteDescription) P.pc.addIceCandidate(d).catch(() => { }); else P.queue.push(d); } }
    else if (ev.kind === 'left') drop(from);
    else if (ev.kind === 'declined') { toast(((R.users[from] || {}).name || 'They') + ' declined.'); }
    else if (ev.kind === 'ended') cleanup('Call ended'); else if (ev.kind === 'missed') cleanup('No answer');
  }
  const _ev = window.onEvent;
  window.onEvent = function (ev) { if (ev.type === 'call_incoming') return incoming(ev.call); if (ev.type === 'call_signal') return signal(ev).catch(e => console.warn('[call]', e.message)); return _ev(ev); };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-rt]'); if (!b) return; const a = b.dataset.rt;
    if (a === 'accept') accept(); else if (a === 'decline') { const c = stopRing(); if (c) post('/api/calls/' + c.id + '/decline').catch(() => { }); }
    else if (a === 'mute' && R) { R.muted = !R.muted; R.local.getAudioTracks().forEach(t => t.enabled = !R.muted); ui(); }
    else if (a === 'cam' && R) { R.cam = !R.cam; R.local.getVideoTracks().forEach(t => t.enabled = R.cam); ui(); }
    else if (a === 'end' && R) { const id = R.id; post('/api/calls/' + id + '/leave').catch(() => { }); cleanup(); }
  });
})();
