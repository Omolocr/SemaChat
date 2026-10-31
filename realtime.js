/* SemaChat — real-time calls (add-on module).
 * WebRTC signalling over the existing SSE stream: the server only relays small offer / answer / ICE messages between
 * members of a chat; audio and video flow peer-to-peer (mesh, fine for 1:1 and small groups). For big conferences set
 * LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET and clients get a signed LiveKit token instead (SFU).
 * Works in Node (require('./realtime')(core)) and in the browser preview (after core.js), where it is not used.
 */
(function (root, install) {
  if (typeof module === 'object' && module.exports) module.exports = install;
  else install(root.SemaChatCore);
})(typeof self !== 'undefined' ? self : this, function install(core) {
  core.use(function (X) {
    'use strict';
    const { route, uid, fail, byId, pub, pushMessage, notify, logEvent } = X;
    const env = (typeof process !== 'undefined' && process.env) || {};
    const calls = new Map();                         // id -> live call (in memory: calls never outlive a restart)
    const RING_MS = 60000, MAX_SIGNAL = 24000;
    const emit = (userId, evt) => core.hooks.emit(userId, evt);
    const iceServers = () => {
      const s = [{ urls: (env.SEMACHAT_STUN || 'stun:stun.l.google.com:19302').split(',') }];
      if (env.SEMACHAT_TURN_URL) s.push({ urls: env.SEMACHAT_TURN_URL.split(','), username: env.SEMACHAT_TURN_USER || '', credential: env.SEMACHAT_TURN_CRED || '' });
      return s;
    };
    const livekit = () => !!(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
    const b64u = b => Buffer.from(b).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    // LiveKit access token: a plain HS256 JWT, so no SDK is needed on the server
    function livekitToken(identity, name, room) {
      const crypto = require('crypto'), now = Math.floor(Date.now() / 1000);
      const head = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), body = b64u(JSON.stringify({ iss: env.LIVEKIT_API_KEY, sub: identity, name, nbf: now - 5, exp: now + 3600, video: { room, roomJoin: true, canPublish: true, canSubscribe: true } }));
      return head + '.' + body + '.' + b64u(crypto.createHmac('sha256', env.LIVEKIT_API_SECRET).update(head + '.' + body).digest());
    }
    const sweep = () => { const now = Date.now(); calls.forEach((c, id) => { if (c.state === 'ringing' && now - c.startedAt > RING_MS) finish(c.db, c, 'missed'); if (now - c.startedAt > 6 * 3600e3) calls.delete(id); }); };
    function finish(db, call, why) {
      if (call.ended) return; call.ended = true; calls.delete(call.id);
      const ch = db.chats.find(x => x.id === call.chatId), dur = call.connectedAt ? Math.round((Date.now() - call.connectedAt) / 1000) : 0;
      call.members.forEach(m => emit(m, { type: 'call_signal', id: call.id, from: call.caller, kind: why === 'missed' ? 'missed' : 'ended', data: {} }));
      if (ch) { try { pushMessage(db, ch, call.caller, 'call', '', { mode: call.mode, dur, count: ch.members.length, missed: !call.connectedAt }); } catch (e) { /* call log is best-effort */ } }
      if (why === 'missed') call.members.filter(m => m !== call.caller).forEach(m => notify(db, m, { type: 'call', mode: 'normal', title: 'Missed ' + call.mode + ' call', body: (byId(db, call.caller) || {}).name + ' called you.', ctx: { chatId: call.chatId } }));
    }
    const need = (c, id) => { sweep(); const call = calls.get(id); if (!call) fail(404, 'This call has ended.'); if (!call.members.includes(c.user.id)) fail(403, 'You are not part of this call.'); return call; };

    route('GET', /^\/api\/calls\/config$/, 'user', 'calls', c => ({ iceServers: iceServers(), livekit: livekit(), mesh: true }));
    route('POST', /^\/api\/calls$/, 'user', 'calls', c => {
      sweep(); const ch = c.db.chats.find(x => x.id === c.body.chatId && x.members.includes(c.user.id)); if (!ch) fail(404, 'Chat not found.');
      const mode = c.body.mode === 'video' ? 'video' : 'voice', f = c.db.settings.features;
      if (mode === 'video' && !f.videoCalls) fail(403, 'Video calls are currently switched off by SemaChat.');
      if (ch.members.length > 2 && !f.conference) fail(403, 'Group & conference calls are currently switched off by SemaChat.');
      if (ch.members.length > 8 && !livekit()) fail(400, 'Calls with more than 8 people need a conference server (LiveKit). Ask the developer to enable it.');
      const busy = Array.from(calls.values()).find(k => !k.ended && k.participants.includes(c.user.id)); if (busy) fail(409, 'You are already in a call.');
      const call = { id: uid('cl_'), db: c.db, chatId: ch.id, caller: c.user.id, mode, members: ch.members.slice(), participants: [c.user.id], state: 'ringing', startedAt: Date.now(), connectedAt: 0 };
      calls.set(call.id, call);
      call.members.filter(m => m !== c.user.id).forEach(m => emit(m, { type: 'call_incoming', call: { id: call.id, chatId: ch.id, mode, title: ch.type === 'group' ? ch.name : c.user.name, group: ch.members.length > 2, from: pub(c.user) } }));
      logEvent(c.db, 'call_started', c.user.id, { id: call.id, mode, members: call.members.length });
      return { id: call.id, mode, iceServers: iceServers(), livekit: livekit(), members: call.members.map(m => pub(byId(c.db, m))) };
    });
    route('POST', /^\/api\/calls\/(cl_[a-z0-9]+)\/join$/, 'user', 'calls', c => {
      const call = need(c, c.p[0]); if (call.participants.includes(c.user.id)) fail(409, 'You already joined this call.');
      const existing = call.participants.slice(); call.participants.push(c.user.id);
      if (!call.connectedAt && call.participants.length > 1) { call.connectedAt = Date.now(); call.state = 'live'; }
      existing.forEach(p => emit(p, { type: 'call_signal', id: call.id, from: c.user.id, kind: 'joined', data: { user: pub(c.user) } }));
      const out = { id: call.id, mode: call.mode, iceServers: iceServers(), participants: existing.map(p => pub(byId(c.db, p))), livekit: livekit() };
      if (livekit()) out.token = livekitToken(c.user.id, c.user.name, call.id);
      return out;
    });
    route('POST', /^\/api\/calls\/(cl_[a-z0-9]+)\/signal$/, 'user', 'calls', c => {
      const call = need(c, c.p[0]), to = String(c.body.to || ''), kind = String(c.body.kind || '');
      if (!['offer', 'answer', 'ice'].includes(kind)) fail(400, 'Unknown signal.'); if (!call.participants.includes(to) || to === c.user.id) fail(400, 'That person is not in the call.');
      if (JSON.stringify(c.body.data || {}).length > MAX_SIGNAL) fail(413, 'Signal too large.');
      emit(to, { type: 'call_signal', id: call.id, from: c.user.id, kind, data: c.body.data || {} }); return { ok: true };
    });
    route('POST', /^\/api\/calls\/(cl_[a-z0-9]+)\/decline$/, 'user', 'calls', c => {
      const call = need(c, c.p[0]); emit(call.caller, { type: 'call_signal', id: call.id, from: c.user.id, kind: 'declined', data: {} });
      call.declined = (call.declined || []).concat(c.user.id);
      if (call.members.length === 2 || call.declined.length >= call.members.length - 1) finish(c.db, call, 'declined'); return { ok: true };
    });
    route('POST', /^\/api\/calls\/(cl_[a-z0-9]+)\/leave$/, 'user', 'calls', c => {
      const call = need(c, c.p[0]); call.participants = call.participants.filter(p => p !== c.user.id);
      call.participants.forEach(p => emit(p, { type: 'call_signal', id: call.id, from: c.user.id, kind: 'left', data: {} }));
      if (call.participants.length === 0) finish(c.db, call, call.connectedAt ? 'ended' : 'missed'); else if (call.connectedAt && call.participants.length < 2) finish(c.db, call, 'ended');
      return { ok: true };
    });
    route('GET', /^\/api\/calls\/active$/, 'user', 'calls', c => { sweep(); const k = Array.from(calls.values()).find(x => x.members.includes(c.user.id) && x.state === 'ringing' && x.caller !== c.user.id); return k ? { id: k.id, chatId: k.chatId, mode: k.mode, from: pub(byId(c.db, k.caller)) } : null; });
    core.realtime = { calls, livekitToken };
  });
});
