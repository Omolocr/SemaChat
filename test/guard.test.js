const test = require('node:test'), assert = require('node:assert');
const core = require('../core'); require('../business')(core); require('../compliance')(core); require('../community')(core); require('../guard')(core);
const mk = () => { core.hooks.emit = () => { }; const db = core.seed(), call = (m, u, b, t) => core.handle(db, m, u, b || {}, t || 'tok_u_me', {}); return { db, call }; };
const A = 'tok_admin', chatWith = (call, who) => call('GET', '/api/chats').data.find(c => c.members && c.members.some(m => m.id === who) && c.type === 'direct');

test('developer manages the list; terms are normalised so simple tricks do not slip through', () => {
  const { call } = mk();
  assert.equal(call('GET', '/api/admin/guard').status, 401, 'developer sign-in required');
  const r = call('POST', '/api/admin/guard/rules', { term: 'Wipe Them Out', type: 'phrase', category: 'incitement' }, A); assert.equal(r.status, 200);
  assert.equal(call('POST', '/api/admin/guard/rules', { term: 'wipe them out' }, A).status, 409, 'duplicates refused');
  assert.equal(call('POST', '/api/admin/guard/rules', { term: 'a' }, A).status, 400);
  const t = s => call('POST', '/api/admin/guard/test', { text: s }, A).data.blocked;
  assert.ok(t('we should WIPE them out!!')); assert.ok(t('w1pe  th3m 0ut')); assert.ok(t('kill them all')); assert.ok(!t('wipe the table clean'));
  assert.ok(t('k i l l  t h e m  a l l'), 'spaced-out letters are joined');
  call('POST', '/api/admin/guard/bulk', { text: 'foo bar\nbaz', category: 'hate', type: 'slang' }, A);
  assert.equal(call('GET', '/api/admin/guard', null, A).data.rules.length, 3 + 1 + 2);
  call('PUT', '/api/admin/guard/rules/' + r.data.id, { enabled: false }, A); assert.ok(!t('wipe them out'));
});
test('a blocked chat message is never delivered, but the sender sees it marked Not delivered', () => {
  const { call, db } = mk(), ch = chatWith(call, 'u_wanjiru'); assert.ok(ch);
  const before = call('GET', '/api/chats/' + ch.id + '/messages', null, 'tok_u_wanjiru').data.length;
  const ok = call('POST', '/api/chats/' + ch.id + '/messages', { type: 'text', text: 'hello Wanjiru' }); assert.equal(ok.status, 200); assert.ok(!ok.data.blocked);
  const bad = call('POST', '/api/chats/' + ch.id + '/messages', { type: 'text', text: 'we will kill them all' });
  assert.equal(bad.status, 200, 'the sender is not shown an error'); assert.equal(bad.data.blocked, true); assert.match(bad.data.blockReason, /not delivered/i);
  const mine = call('GET', '/api/chats/' + ch.id + '/messages').data; assert.ok(mine.some(m => m.id === bad.data.id && m.blocked), 'sender sees it');
  const theirs = call('GET', '/api/chats/' + ch.id + '/messages', null, 'tok_u_wanjiru').data; assert.equal(theirs.length, before + 1); assert.ok(!theirs.some(m => m.id === bad.data.id), 'recipient never gets it');
  assert.ok(!db.messages.some(m => m.id === bad.data.id), 'not stored among delivered messages');
  assert.ok(!db.notifications.some(n => n.userId === 'u_wanjiru' && /kill them/i.test(n.body || '')), 'no notification either');
  const hit = call('GET', '/api/admin/guard', null, A).data; assert.equal(hit.stats.blocked24h, 1); assert.equal(hit.hits[0].user.id, 'u_me');
});
test('posts, comments and captions are refused; the guard can be switched off', () => {
  const { call } = mk();
  assert.equal(call('POST', '/api/posts', { kind: 'reel', caption: 'burn their houses tonight' }).status, 422);
  assert.equal(call('POST', '/api/posts', { kind: 'reel', caption: 'a lovely sunrise' }).status, 200);
  call('PUT', '/api/admin/guard/settings', { enabled: false }, A); assert.equal(call('POST', '/api/posts', { kind: 'reel', caption: 'burn their houses tonight' }).status, 200);
});
test('restricted zones block location messages and location sharing; places can be listed as words too', () => {
  const { call } = mk(); call('POST', '/api/admin/guard/zones', { name: 'Demo restricted compound', lat: 0.0167, lng: 37.0722, radiusM: 300 }, A);
  const ch = chatWith(call, 'u_wanjiru');
  const inside = call('POST', '/api/chats/' + ch.id + '/messages', { type: 'location', text: 'Here', meta: { lat: 0.0170, lng: 37.0725 } }); assert.equal(inside.data.blocked, true);
  assert.ok(!call('POST', '/api/chats/' + ch.id + '/messages', { type: 'location', text: 'Here', meta: { lat: -1.28, lng: 36.82 } }).data.blocked);
  assert.equal(call('POST', '/api/location', { on: true, lat: 0.0168, lng: 37.0721, label: 'Town' }).status, 422);
  call('POST', '/api/admin/guard/rules', { term: 'Secret Camp Road', type: 'location', category: 'security' }, A);
  assert.equal(call('POST', '/api/chats/' + ch.id + '/messages', { type: 'text', text: 'meet at secret camp road' }).data.blocked, true);
});
test('guard changes are audit-logged and the hit list counts as personal data in the access audit', () => {
  const { call } = mk(); call('POST', '/api/admin/guard/rules', { term: 'example term', category: 'other' }, A);
  assert.ok(call('GET', '/api/admin/audit', null, A).data.some(a => /Content guard: added/.test(a.msg)));
  call('GET', '/api/admin/guard', null, A); const log = call('GET', '/api/admin/access-log', null, A).data; assert.ok(log.entries.some(e => /guard/.test(e.what) && e.sensitive));
});
