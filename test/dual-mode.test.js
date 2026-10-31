// Dual-mode (Normal / Business) tests — run: node --test backend/test
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core');

function world() {
  const db = core.seed(), events = [];
  core.hooks.emit = (uid, ev) => events.push({ uid, ev }); core.hooks.persist = () => {};
  const call = (m, u, b, t, h) => core.handle(db, m, u, b, t, h);
  const emailOf = phone => { phone = phone.replace(/[\s-]/g, ''); const p = phone.startsWith('0') ? '+254' + phone.slice(1) : phone; return core.seed().users.find(u => u.phone === p).email; };
  const login = phone => call('POST', '/api/auth/signin', { email: emailOf(phone), code: '123ABC' }).data.token;
  const T = { me: login('0700111222'), sav: login('020 555 0000'), fat: login('0733444555'), juma: login('0788999000'), neema: login('0777888999'), zaw: login('0755666777') };
  const admin = call('POST', '/api/admin/signin', { email: 'admin@semachat.app', code: '123abc' }).data.token;
  return { db, events, call, T, admin };
}
const H = (mode, dev) => ({ 'x-semachat-mode': mode, 'x-semachat-device': dev || 'phone' });

test('DUAL-1: switch is forced to normal for non-business users', () => {
  const w = world();
  assert.deepEqual(w.call('GET', '/api/mode/current', null, w.T.me).data, { activeMode: 'normal', hasBizAccount: false, bizAccountStatus: 'none' });
  const r = w.call('POST', '/api/mode/switch', { mode: 'business', deviceId: 'd1' }, w.T.me).data;
  assert.equal(r.activeMode, 'normal'); assert.equal(r.forced, true);
  assert.equal(w.call('POST', '/api/mode/switch', { mode: 'normal' }, w.T.me).data.activeMode, 'normal');
  const bad = w.call('POST', '/api/mode/switch', { mode: 'nope' }, w.T.me); assert.equal(bad.status, 400); assert.equal(bad.data.code, 'INVALID_MODE');
});
test('DUAL-1: business user switch persists per device, stored globally, emits mode:changed', () => {
  const w = world();
  const r = w.call('POST', '/api/mode/switch', { mode: 'business', deviceId: 'phone' }, w.T.sav).data;
  assert.equal(r.activeMode, 'business');
  assert.equal(w.db.modeState.c_savanna.phone, 'business'); assert.equal(w.db.users.find(u => u.id === 'c_savanna').activeMode, 'business');
  assert.ok(w.events.some(e => e.uid === 'c_savanna' && e.ev.type === 'mode:changed' && e.ev.mode === 'business' && e.ev.deviceId === 'phone'));
  // per-device: another device with its own pin stays normal; header wins over stored state
  w.call('POST', '/api/mode/switch', { mode: 'normal', deviceId: 'laptop' }, w.T.sav);
  assert.equal(w.call('GET', '/api/mode/current', null, w.T.sav, { 'x-semachat-device': 'laptop' }).data.activeMode, 'normal');
  assert.equal(w.call('GET', '/api/mode/current', null, w.T.sav, H('business', 'laptop')).data.activeMode, 'business');
  assert.equal(w.call('GET', '/api/mode/current', null, w.T.me, H('business')).data.activeMode, 'normal'); // header ignored without account
});
test('DUAL-2: widget state for all five business statuses', () => {
  const w = world(), ws = t => w.call('GET', '/api/mode/widget-state', null, t).data;
  assert.deepEqual([ws(w.T.me).bizState.ctaLabel, ws(w.T.me).bizState.ctaAction], ['Register', 'register']);
  assert.deepEqual([ws(w.T.juma).bizState.status, ws(w.T.juma).bizState.ctaLabel], ['pending', 'Continue']);
  const s = ws(w.T.sav); assert.equal(s.bizState.status, 'active'); assert.equal(s.segments[1].enabled, true); assert.equal(s.bizState.ctaLabel, null);
  assert.deepEqual([ws(w.T.neema).bizState.status, ws(w.T.neema).bizState.ctaLabel], ['rejected', 'Resubmit']);
  w.call('POST', '/api/admin/biz/c_savanna', { action: 'suspend' }, w.admin);
  assert.deepEqual([ws(w.T.sav).bizState.status, ws(w.T.sav).bizState.ctaLabel], ['suspended', 'Contact support']);
  assert.equal(w.call('POST', '/api/mode/switch', { mode: 'business' }, w.T.sav).data.code, 'BIZ_ACCOUNT_SUSPENDED');
});
test('DUAL-2: badge counts are computed per mode from unread chats and notifications', () => {
  const w = world(), s = w.call('GET', '/api/mode/widget-state', null, w.T.sav).data;
  assert.ok(s.segments[0].badgeCount >= 0);
  w.call('POST', '/api/dev/simulate', { kind: 'chat' }, w.T.sav);
  const s2 = w.call('GET', '/api/mode/widget-state', null, w.T.sav).data;
  assert.ok(s2.segments[1].badgeCount > s.segments[1].badgeCount, 'business badge grows with a new customer message');
});
test('DUAL-2: deactivate archives, reactivate restores, admin override is audited', () => {
  const w = world();
  assert.equal(w.call('POST', '/api/biz/deactivate', {}, w.T.sav).data.code, 'CONFIRM_REQUIRED');
  w.call('POST', '/api/mode/switch', { mode: 'business' }, w.T.sav);
  const r = w.call('POST', '/api/biz/deactivate', { confirm: true }, w.T.sav).data; assert.equal(r.activeMode, 'normal');
  assert.equal(w.call('GET', '/api/mode/widget-state', null, w.T.sav).data.bizState.ctaAction, 'reactivate');
  assert.equal(w.call('GET', '/api/biz/dashboard', null, w.T.sav).status, 403);
  assert.equal(w.call('POST', '/api/biz/reactivate', {}, w.T.sav).status, 200);
  assert.equal(w.call('GET', '/api/biz/dashboard', null, w.T.sav).status, 200);
  const o = w.call('POST', '/api/admin/users/c_savanna/mode', { mode: 'business', reason: 'support ticket 42' }, w.admin); assert.equal(o.data.activeMode, 'business');
  assert.ok(w.db.audit[0].msg.includes('support ticket 42'));
  assert.equal(w.call('POST', '/api/admin/users/c_savanna/mode', { mode: 'normal' }, w.admin).status, 400);
});
test('DUAL-3: customer sees business chat in Normal, owner in Business; groups stay business-only', () => {
  const w = world(), ids = (t, mode) => w.call('GET', '/api/chats?mode=' + mode, null, t).data.map(c => c.id);
  assert.ok(ids(w.T.me, 'normal').includes('ch_5')); assert.ok(!ids(w.T.me, 'business').includes('ch_5'));
  assert.ok(ids(w.T.sav, 'business').includes('ch_5')); assert.ok(!ids(w.T.sav, 'normal').includes('ch_5'));
  assert.ok(ids(w.T.sav, 'business').includes('ch_6')); assert.ok(!ids(w.T.sav, 'normal').includes('ch_6'));
  const msgsMe = w.call('GET', '/api/chats/ch_5/messages', null, w.T.me).data, msgsSav = w.call('GET', '/api/chats/ch_5/messages', null, w.T.sav).data;
  assert.deepEqual(msgsMe.map(m => m.id), msgsSav.map(m => m.id));
  assert.ok(ids(w.T.me, 'all').includes('ch_5') && w.call('GET', '/api/chats?mode=all', null, w.T.me).data.every(c => c.modeContext));
});
test('DUAL-3: cross-mode AI assistant appears in both modes; auto mode follows header', () => {
  const w = world();
  const n = w.call('GET', '/api/chats?mode=normal', null, w.T.sav).data, b = w.call('GET', '/api/chats?mode=business', null, w.T.sav).data;
  assert.ok(n.find(c => c.ai).isCrossMode && b.find(c => c.ai));
  assert.ok(!w.call('GET', '/api/chats', null, w.T.sav, H('normal')).data.some(c => c.id === 'ch_6'));
  assert.ok(w.call('GET', '/api/chats', null, w.T.sav, H('business')).data.some(c => c.id === 'ch_6'));
});
test('DUAL-3: shared business inbox for team members with per-member unread state', () => {
  const w = world();
  assert.ok(w.call('GET', '/api/chats', null, w.T.fat, H('business')).data.some(c => c.id === 'ch_5'), 'team member sees the owner\'s customer chat');
  w.call('POST', '/api/dev/simulate', { kind: 'chat' }, w.T.sav);
  const un = t => w.call('GET', '/api/chats', null, t, H('business')).data.reduce((n, c) => n + c.unread, 0);
  const before = un(w.T.fat); w.call('GET', '/api/chats/ch_5/messages', null, w.T.fat);
  assert.ok(un(w.T.fat) <= before);
  assert.equal(w.call('POST', '/api/biz/team', { userId: 'u_zawadi' }, w.T.fat).status, 403);
  assert.equal(w.call('POST', '/api/biz/team', { userId: 'u_zawadi' }, w.T.sav).status, 400, 'must be a contact first');
  w.db.friends.c_savanna.push('u_zawadi'); w.db.friends.u_zawadi.push('c_savanna');
  assert.equal(w.call('POST', '/api/biz/team', { userId: 'u_zawadi' }, w.T.sav).status, 200);
});
test('DUAL-3: customer phone hidden from business until first order or shared', () => {
  const w = world();
  const other = () => w.call('GET', '/api/chats?mode=business', null, w.T.sav).data.find(c => c.id === 'ch_5').other;
  assert.equal(other().phone, null); assert.equal(other().phoneHidden, true);
  w.call('POST', '/api/chats/ch_5/messages', { type: 'text', text: 'call me on 0700 111 222' }, w.T.me);
  assert.equal(other().phone, '+254700111222');
  const w2 = world(); w2.call('POST', '/api/dev/simulate', { kind: 'order' }, w2.T.sav);
  assert.ok(w2.db.chats.filter(c => c.bizOwner === 'c_savanna').some(c => c.phoneRevealed));
});
test('DUAL-3: auto-archive hides stale business chats (>90d) and keeps them searchable via archived=1', () => {
  const w = world();
  assert.ok(!w.call('GET', '/api/chats?mode=business', null, w.T.sav).data.some(c => c.id === 'ch_7'));
  assert.ok(w.call('GET', '/api/chats?mode=business&archived=1', null, w.T.sav).data.some(c => c.id === 'ch_7'));
});
test('DUAL-4: business notification in Normal mode is silent; urgent bypasses; batching groups', () => {
  const w = world();
  w.call('POST', '/api/mode/switch', { mode: 'normal' }, w.T.sav);
  w.call('POST', '/api/dev/simulate', { kind: 'order' }, w.T.sav);
  let list = w.call('GET', '/api/notifications?mode=business', null, w.T.sav).data.items;
  const order = list.find(n => n.type === 'order'); assert.equal(order.delivery.silent, true); assert.equal(order.delivery.banner, false);
  w.call('POST', '/api/dev/simulate', { kind: 'call' }, w.T.sav);
  const call = w.call('GET', '/api/notifications?mode=business', null, w.T.sav).data.items.find(n => n.type === 'call');
  assert.equal(call.delivery.silent, false); assert.equal(call.delivery.sound, true);
  w.call('POST', '/api/dev/simulate', { kind: 'order' }, w.T.sav); w.call('POST', '/api/dev/simulate', { kind: 'order' }, w.T.sav); w.call('POST', '/api/dev/simulate', { kind: 'review', rating: 5 }, w.T.sav);
  list = w.call('GET', '/api/notifications?mode=business', null, w.T.sav).data.items;
  const batch = list.find(n => n.isBatch); assert.ok(batch, 'a batch summary exists'); assert.match(batch.body, /3 new orders \(KES [\d,]+\)/); assert.match(batch.body, /1 new review/);
  assert.ok(list.some(n => n.type === 'call' && !n.isBatch), 'urgent never batched');
});
test('DUAL-4: critical rules (big order, negative review) are urgent; notifications filter by mode', () => {
  const w = world();
  w.call('POST', '/api/dev/simulate', { kind: 'order', big: true }, w.T.sav); w.call('POST', '/api/dev/simulate', { kind: 'review', rating: 1 }, w.T.sav);
  const items = w.call('GET', '/api/notifications?mode=business', null, w.T.sav).data.items;
  assert.ok(items.find(n => n.type === 'order').urgent); assert.ok(items.find(n => n.type === 'review').urgent);
  assert.ok(w.call('GET', '/api/notifications?mode=normal', null, w.T.sav).data.items.every(n => n.mode === 'normal'));
  assert.ok(w.call('GET', '/api/notifications?mode=all', null, w.T.sav).data.items.length >= items.length);
});
test('DUAL-4: DND per mode holds non-critical alerts but lets critical through', () => {
  const w = world(); const now = new Date(), h = x => String(x).padStart(2, '0');
  const start = h((now.getHours() + 23) % 24) + ':00', end = h((now.getHours() + 1) % 24) + ':00';
  w.call('PATCH', '/api/me/preferences', { dnd: { business: { enabled: true, start, end, critical: true } } }, w.T.sav);
  w.call('POST', '/api/dev/simulate', { kind: 'order' }, w.T.sav); w.call('POST', '/api/dev/simulate', { kind: 'call' }, w.T.sav);
  const items = w.call('GET', '/api/notifications?mode=business', null, w.T.sav).data.items;
  assert.equal(items.find(n => n.type === 'order').delivery.held, true); assert.equal(items.find(n => n.type === 'call').delivery.held, false);
});
test('DUAL-7: peek returns details without switching; inline reply does not switch; switch is explicit', () => {
  const w = world(); w.call('POST', '/api/mode/switch', { mode: 'normal' }, w.T.sav);
  w.call('POST', '/api/dev/simulate', { kind: 'order' }, w.T.sav);
  const n = w.call('GET', '/api/notifications?mode=business', null, w.T.sav).data.items.find(x => x.type === 'order');
  const p = w.call('GET', '/api/notifications/' + n.id + '/peek', null, w.T.sav, H('normal')).data;
  assert.ok(p.context.order.items.length && p.actions.some(a => a.id === 'switch_mode') && p.actions.some(a => a.id === 'reply_inline'));
  assert.equal(w.call('GET', '/api/mode/current', null, w.T.sav, H('normal')).data.activeMode, 'normal');
  const r = w.call('POST', '/api/notifications/' + n.id + '/reply', { body: 'Thanks, preparing it now!' }, w.T.sav, H('normal')); assert.equal(r.data.sent, true); assert.equal(r.data.activeMode, 'normal');
  assert.equal(w.db.users.find(u => u.id === 'c_savanna').activeMode, 'normal');
  const sw = w.call('POST', '/api/notifications/' + n.id + '/switch', {}, w.T.sav); assert.equal(sw.data.activeMode, 'business'); assert.ok(sw.data.ctx.orderId);
  assert.equal(w.call('POST', '/api/notifications/nope/reply', { body: 'x' }, w.T.sav).status, 404);
});
test('DUAL-7: batch peek lists each underlying notification with its order', () => {
  const w = world(); for (let i = 0; i < 3; i++) w.call('POST', '/api/dev/simulate', { kind: 'order' }, w.T.sav);
  const b = w.call('GET', '/api/notifications?mode=business', null, w.T.sav).data.items.find(n => n.isBatch);
  const p = w.call('GET', '/api/notifications/batch/' + b.id + '/peek', null, w.T.sav).data;
  assert.equal(p.items.filter(i => i.order).length, 3); assert.match(p.summary, /3 new orders/);
  const o = p.items[0].order; assert.equal(w.call('POST', '/api/biz/orders/' + o.id + '/accept', {}, w.T.sav).data.status, 'completed');
  assert.equal(w.call('POST', '/api/biz/orders/' + o.id + '/accept', {}, w.T.sav).status, 409);
});
test('DUAL-7: auto-switch preference is stored and validated', () => {
  const w = world();
  assert.equal(w.call('GET', '/api/me/preferences', null, w.T.sav).data.autoSwitch, 'critical_only');
  assert.equal(w.call('PATCH', '/api/me/preferences', { autoSwitch: true }, w.T.sav).data.autoSwitch, true);
  assert.equal(w.call('PATCH', '/api/me/preferences', { autoSwitch: 'bogus' }, w.T.sav).data.autoSwitch, true);
});
test('DUAL-5: one balance, mode-filtered ledger, tagging by originating mode', () => {
  const w = world(); const bal = m => w.call('GET', '/api/wallet', null, w.T.sav, H(m)).data;
  assert.equal(bal('normal').balance, bal('business').balance);
  assert.ok(bal('business').tx.every(t => t.mode === 'business')); assert.ok(bal('normal').tx.every(t => t.mode === 'normal'));
  w.call('POST', '/api/wallet/topup', { amount: 1000 }, w.T.sav, H('business')); w.call('POST', '/api/wallet/topup', { amount: 500 }, w.T.sav, H('normal'));
  assert.equal(bal('business').tx[0].title.startsWith('Top up'), true); assert.equal(bal('normal').tx[0].mode, 'normal');
  assert.equal(w.call('GET', '/api/wallet?mode=all', null, w.T.sav).data.mode, 'all');
  w.call('POST', '/api/wallet/topup', { amount: 5000 }, w.T.me); w.call('POST', '/api/services/book', { partnerId: 'pt_bus', itemId: 'it7' }, w.T.me, H('normal'));
  assert.equal(w.call('GET', '/api/wallet', null, w.T.me, H('normal')).data.tx[0].mode, 'normal');
});
test('DUAL-5: cross-mode transfer writes two linked rows and leaves balance unchanged', () => {
  const w = world(), before = w.call('GET', '/api/wallet', null, w.T.sav).data.balance;
  const r = w.call('POST', '/api/wallet/cross-transfer', { from: 'business', amount: 5000 }, w.T.sav).data; assert.equal(r.balance, before);
  const all = w.call('GET', '/api/wallet?mode=all', null, w.T.sav).data.tx.filter(t => t.referenceId === r.referenceId);
  assert.equal(all.length, 2); assert.deepEqual(all.map(t => t.mode).sort(), ['business', 'normal']); assert.deepEqual(all.map(t => t.type).sort(), ['in', 'out']);
  assert.equal(w.call('POST', '/api/wallet/cross-transfer', { from: 'business', amount: 5000 }, w.T.me).status, 403);
});
test('DUAL-5: revenue dashboard, completed order credits business ledger, invoice with VAT, CSV, payout', () => {
  const w = world(); const rev0 = w.call('GET', '/api/wallet/biz/revenue', null, w.T.sav).data;
  assert.ok(rev0.revenue > 0 && rev0.orders > 0 && rev0.taxCollected > 0 && rev0.series.length === 30);
  w.call('POST', '/api/dev/simulate', { kind: 'order' }, w.T.sav);
  const ord = w.call('GET', '/api/biz/orders', null, w.T.sav).data[0];
  assert.equal(w.call('GET', '/api/biz/orders/' + ord.id + '/invoice', null, w.T.sav).status, 409, 'no invoice before completion');
  w.call('POST', '/api/biz/orders/' + ord.id + '/accept', {}, w.T.sav);
  const inv = w.call('GET', '/api/biz/orders/' + ord.id + '/invoice', null, w.T.sav).data; assert.match(inv.html, /VAT \(16%/); assert.match(inv.html, /P051234567X/);
  const rev1 = w.call('GET', '/api/wallet/biz/revenue', null, w.T.sav).data; assert.equal(rev1.orders, rev0.orders + 1);
  assert.match(w.call('GET', '/api/wallet/biz/export', null, w.T.sav).data.csv, /^date,title,direction/);
  const p = w.call('POST', '/api/wallet/biz/payout', {}, w.T.sav).data; assert.ok(p.amount > 0 && p.fee >= 0 && p.net === p.amount - p.fee);
  assert.equal(w.call('POST', '/api/wallet/biz/payout', {}, w.T.sav).status, 400, 'nothing left to sweep');
  assert.equal(w.call('PATCH', '/api/biz/settings', { bankLinked: false }, w.T.sav).data.bankLinked, false);
  assert.equal(w.call('POST', '/api/wallet/biz/payout', { amount: 100 }, w.T.sav).status, 400);
});
test('DUAL-6: gate blocks non-business users with a call-to-action; public entry points work', () => {
  const w = world();
  for (const [m, u] of [['GET', '/api/biz/dashboard'], ['GET', '/api/biz/orders'], ['GET', '/api/wallet/biz/revenue'], ['POST', '/api/dev/simulate']]) {
    const r = w.call(m, u, {}, w.T.me); assert.equal(r.status, 403, u); assert.equal(r.data.code, 'BIZ_ACCOUNT_REQUIRED'); assert.equal(r.data.ctaAction, 'register'); assert.equal(r.data.ctaLabel, 'Start Registration');
  }
  assert.equal(w.call('GET', '/api/biz/dashboard', null, null).status, 401);
  const wel = w.call('GET', '/api/biz/welcome').data; assert.ok(wel.requirements.length && wel.ctaButtons.length === 3);
  const pv = w.call('GET', '/api/biz/preview').data; assert.equal(pv.sample, true); assert.match(pv.banner, /sample data/i);
  const sat = w.call('GET', '/api/biz/categories/pharmacy/waitlist-status?area=Westlands').data; assert.equal(sat.isSaturated, true); assert.ok(sat.alternativeActions.length >= 3);
  assert.equal(w.call('GET', '/api/biz/categories/pharmacy/waitlist-status?lat=-1.2676&lng=36.8108').data.isSaturated, true);
  assert.equal(w.call('GET', '/api/biz/categories/cafe/waitlist-status?area=nanyuki').data.isSaturated, false);
  assert.equal(w.call('GET', '/api/biz/concierge-available').data.available, true);
});
test('DUAL-6: preview endpoint is rate limited to 10 requests/min per client', () => {
  const w = world(), h = { 'x-client-ip': 'ip-test-' + Math.random() }; let last;
  for (let i = 0; i < 11; i++) last = w.call('GET', '/api/biz/preview', null, null, h);
  assert.equal(last.status, 429);
});
test('DUAL-6: registration → admin approval → business mode unlocked; discovery entry points', () => {
  const w = world();
  const d = w.call('GET', '/api/mode/discovery', null, w.T.me).data.entries; assert.deepEqual(d.map(e => e.type), ['informal_upgrade', 'maps_claim', 'generic']);
  assert.equal(w.call('POST', '/api/biz/register', { name: 'X', category: 'cafe', kind: 'formal', taxPin: 'bad' }, w.T.me).status, 400);
  assert.equal(w.call('POST', '/api/biz/register', { name: 'Amani Brews', category: 'cafe', kind: 'formal', taxPin: 'A001234567B' }, w.T.me).data.status, 'pending');
  assert.equal(w.call('POST', '/api/mode/switch', { mode: 'business' }, w.T.me).data.activeMode, 'normal');
  w.call('POST', '/api/admin/biz/u_me', { action: 'approve' }, w.admin);
  assert.equal(w.call('POST', '/api/mode/switch', { mode: 'business' }, w.T.me).data.activeMode, 'business');
  assert.equal(w.call('GET', '/api/biz/dashboard', null, w.T.me).status, 200);
  assert.ok(w.call('GET', '/api/notifications?mode=normal', null, w.T.me).data.items.some(n => n.type === 'verification' && n.urgent));
  assert.equal(w.call('POST', '/api/mode/discovery/click', { entryPoint: 'generic' }, w.T.zaw).status, 200);
  const w2 = world(); w2.call('POST', '/api/admin/settings', { autoApproveBiz: true }, w2.admin);
  assert.equal(w2.call('POST', '/api/biz/register', { name: 'Zawadi Chess Club', category: 'education', kind: 'informal' }, w2.T.zaw).data.status, 'active');
});
test('DUAL-9: events are logged and surface in mode analytics and the weekly report', () => {
  const w = world();
  w.call('POST', '/api/mode/switch', { mode: 'business' }, w.T.sav); w.call('POST', '/api/mode/switch', { mode: 'normal' }, w.T.sav);
  w.call('GET', '/api/biz/dashboard', null, w.T.me); w.call('POST', '/api/dev/simulate', { kind: 'order' }, w.T.sav);
  const a = w.call('GET', '/api/admin/mode-analytics', null, w.admin).data.metrics;
  assert.ok(a.engagement.switches >= 16 && a.gate.blocks >= 10 && a.notifications.delivered >= 40 && a.discovery.byEntryPoint.length >= 2 && a.adoption.bizPct > 0);
  const r = w.call('GET', '/api/admin/weekly-report', null, w.admin).data; assert.ok(r.highlights.length === 5);
  assert.equal(w.call('GET', '/api/admin/mode-analytics', null, w.T.me).status, 401);
});
test('DUAL-8: load — 1,000 concurrent mode switches and 5,000 mode-scoped chat queries stay fast and consistent', () => {
  const w = world(); const t0 = Date.now();
  for (let i = 0; i < 1000; i++) w.call('POST', '/api/mode/switch', { mode: i % 2 ? 'normal' : 'business', deviceId: 'd' + (i % 50) }, w.T.sav);
  const t1 = Date.now(); let n = 0;
  for (let i = 0; i < 5000; i++) n += w.call('GET', '/api/chats?mode=' + (i % 2 ? 'business' : 'normal'), null, w.T.sav).data.length;
  const t2 = Date.now(); assert.ok(n > 0);
  console.log('    1000 switches: ' + (t1 - t0) + ' ms, 5000 chat queries: ' + (t2 - t1) + ' ms');
  assert.ok(t1 - t0 < 5000 && t2 - t1 < 15000);
  assert.equal(Object.keys(w.db.modeState.c_savanna).length, 50);
});
