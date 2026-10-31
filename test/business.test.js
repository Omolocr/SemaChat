const test = require('node:test'), assert = require('node:assert');
const core = require('../core'); require('../business')(core);
const mk = () => { const db = core.seed(); const call = (m, u, b, t) => core.handle(db, m, u, b, t, {}); return { db, call }; };
const emailOf = phone => { phone = phone.replace(/[\s-]/g, ''); const p = phone.startsWith('0') ? '+254' + phone.slice(1) : phone; return core.seed().users.find(u => u.phone === p).email; };
const login = (call, phone) => call('POST', '/api/auth/signin', { email: emailOf(phone), code: '123ABC' }).data.token;
const ADMIN = 'tok_admin';
// u_me (0700111222) is a normal user; c_savanna is the demo business; make a business owner via admin approval
function bizMe(call) {
  const T = login(call, '0700111222');
  call('POST', '/api/biz/register', { name: 'Amani Roasters', category: 'cafe', kind: 'informal', area: 'Nanyuki' }, T);
  call('POST', '/api/admin/biz/u_me', { action: 'approve' }, ADMIN);
  call('POST', '/api/wallet/topup', { amount: 50000 }, T);
  return T;
}
test('directory and page: customers can browse businesses, pages count views, follow works', () => {
  const { call } = mk(); const T = login(call, '0700111222');
  const dir = call('GET', '/api/biz/pages', null, T); assert.equal(dir.status, 200); assert.ok(dir.data.length >= 2);
  assert.ok(dir.data.some(p => p.name === 'Savanna Coffee Co.' && p.rating >= 4));
  const pg = call('GET', '/api/biz/pages/c_savanna', null, T).data;
  assert.equal(pg.canOrder, true); assert.ok(pg.items.length >= 4); assert.ok(pg.reviews.length >= 3);
  assert.equal(call('POST', '/api/biz/pages/c_savanna/follow', {}, T).data.following, true);
  assert.equal(call('GET', '/api/biz/pages/c_savanna', null, T).data.page.following, true);
  assert.equal(call('GET', '/api/biz/pages/nobody', null, T).status, 404);
});
test('ordering: pay from wallet, stock drops, owner is notified; decline refunds, accept pays out', () => {
  const { db, call } = mk(); const T = login(call, '0700111222'); const before = call('GET', '/api/wallet', null, T).data.balance;
  const items = call('GET', '/api/biz/pages/c_savanna', null, T).data.items, mug = items.find(i => i.name === 'Ceramic mug'), stock = mug.stock;
  const o = call('POST', '/api/biz/pages/c_savanna/order', { items: [{ id: mug.id, qty: 2 }], note: 'Gift wrap please' }, T); assert.equal(o.status, 200); assert.equal(o.data.total, 900);
  assert.equal(call('GET', '/api/wallet', null, T).data.balance, before - 900);
  assert.equal(call('GET', '/api/biz/pages/c_savanna', null, T).data.items.find(i => i.id === mug.id).stock, stock - 2);
  assert.ok(db.notifications.some(n => n.userId === 'c_savanna' && n.type === 'order'));
  // asking for more than the stock is refused and charges nothing
  const mugRec = db.catalog.find(i => i.id === mug.id), keep = mugRec.stock; mugRec.stock = 1;
  const over = call('POST', '/api/biz/pages/c_savanna/order', { items: [{ id: mug.id, qty: 2 }] }, T); assert.equal(over.status, 409); mugRec.stock = keep;
  assert.equal(call('GET', '/api/wallet', null, T).data.balance, before - 900);
  // decline refunds (a team member of the business acts for it)
  const ord = db.bizOrders.find(x => x.id === o.data.id);
  const F = 'tok_u_fatuma';
  const rej = call('POST', '/api/biz/orders/' + ord.id + '/reject', {}, F); assert.equal(rej.status, 200);
  assert.equal(call('GET', '/api/me/orders', null, T).data.find(x => x.id === ord.id).refunded, true);
  assert.ok(call('GET', '/api/wallet?mode=all', null, T).data.tx.some(t => t.kind === 'refund'));
  const o2 = call('POST', '/api/biz/pages/c_savanna/order', { items: [{ id: mug.id, qty: 1 }] }, T).data;
  assert.equal(call('POST', '/api/biz/orders/' + o2.id + '/accept', {}, F).data.status, 'completed');
  assert.equal(call('GET', '/api/wallet', null, T).data.balance, before - 450); // only the accepted order is paid; the declined one was refunded
});
test('ordering guards: own business, empty basket, insufficient balance, videos not purchasable', () => {
  const { call } = mk(); const T = bizMe(call);
  assert.equal(call('POST', '/api/biz/pages/u_me/order', { items: [] }, T).status, 400);
  const cat = call('POST', '/api/biz/catalog', { kind: 'product', name: 'House blend', price: 800, stock: 5 }, T); assert.equal(cat.status, 200);
  assert.equal(call('POST', '/api/biz/pages/u_me/order', { items: [{ id: cat.data.id, qty: 1 }] }, T).data.error, 'You cannot order from your own business.');
  const Z = login(call, '0711222333'); // Wanjiru: no balance
  const poor = call('POST', '/api/biz/pages/u_me/order', { items: [{ id: cat.data.id, qty: 1 }] }, Z); assert.equal(poor.status, 402);
  const sav = call('GET', '/api/biz/pages/c_savanna', null, T).data.items, vid = sav.find(i => i.kind === 'video');
  assert.equal(call('POST', '/api/biz/pages/c_savanna/order', { items: [{ id: vid.id, qty: 1 }] }, T).status, 400);
});
test('catalog management is gated and validated', () => {
  const { call } = mk(); const N = login(call, '0711222333');
  const g = call('GET', '/api/biz/catalog', null, N); assert.equal(g.status, 403); assert.equal(g.data.code, 'BIZ_ACCOUNT_REQUIRED');
  const T = bizMe(call);
  assert.equal(call('POST', '/api/biz/catalog', { kind: 'gadget', name: 'x' }, T).status, 400);
  assert.equal(call('POST', '/api/biz/catalog', { kind: 'product', name: 'Free thing', price: 0 }, T).status, 400);
  const it = call('POST', '/api/biz/catalog', { kind: 'service', name: 'Coffee tasting', price: 1500, duration: 45 }, T).data; assert.equal(it.duration, 45);
  assert.equal(call('PATCH', '/api/biz/catalog/' + it.id, { price: 1800, active: false }, T).data.price, 1800);
  assert.ok(!call('GET', '/api/biz/pages/u_me', null, N).data.items.some(i => i.id === it.id), 'inactive items hidden from customers');
  assert.equal(call('DELETE', '/api/biz/catalog/' + it.id, null, T).status, 200);
  assert.equal(call('PATCH', '/api/biz/page', { about: 'Fresh roasts', hours: '8-5', cover: ['#112233', '#445566'] }, T).data.about, 'Fresh roasts');
});
test('reviews and replies; negative review is urgent; one review per order', () => {
  const { db, call } = mk(); const T = login(call, '0700111222');
  const m = call('GET', '/api/biz/pages/c_savanna', null, T).data.items.find(i => i.kind === 'product');
  const o = call('POST', '/api/biz/pages/c_savanna/order', { items: [{ id: m.id, qty: 1 }] }, T).data;
  assert.equal(call('POST', '/api/me/orders/' + o.id + '/review', { rating: 1 }, T).status, 409, 'must be completed first');
  call('POST', '/api/biz/orders/' + o.id + '/accept', {}, 'tok_u_fatuma');
  const r = call('POST', '/api/me/orders/' + o.id + '/review', { rating: 1, text: 'Late' }, T); assert.equal(r.status, 200);
  assert.ok(db.notifications.some(n => n.type === 'review' && n.urgent && n.userId === 'c_savanna'));
  assert.equal(call('POST', '/api/me/orders/' + o.id + '/review', { rating: 5 }, T).status, 409);
  const list = call('GET', '/api/biz/reviews', null, 'tok_u_fatuma').data; const mine = list.reviews.find(x => x.text === 'Late');
  assert.equal(call('POST', '/api/biz/reviews/' + mine.id + '/reply', { text: 'Sorry, we will do better' }, 'tok_u_fatuma').status, 200);
  assert.ok(list.breakdown.find(b => b.stars === 1).n >= 1);
});
test('disputes: customer opens, admin refunds; owner recovers net; dismiss path; window and duplicates enforced', () => {
  const { db, call } = mk(); const T = login(call, '0700111222'), F = 'tok_u_fatuma';
  const m = call('GET', '/api/biz/pages/c_savanna', null, T).data.items.find(i => i.kind === 'product');
  const mk1 = () => { const o = call('POST', '/api/biz/pages/c_savanna/order', { items: [{ id: m.id, qty: 1 }] }, T).data; call('POST', '/api/biz/orders/' + o.id + '/accept', {}, F); return o; };
  const o = mk1(); assert.equal(call('POST', '/api/me/orders/' + o.id + '/dispute', { reason: 'x' }, T).status, 400);
  const d = call('POST', '/api/me/orders/' + o.id + '/dispute', { reason: 'Beans were stale' }, T).data; assert.equal(d.status, 'open');
  assert.equal(call('POST', '/api/me/orders/' + o.id + '/dispute', { reason: 'Beans were stale again' }, T).status, 409);
  const bal = call('GET', '/api/wallet', null, T).data.balance, ownerBal = db.wallets.c_savanna.balance;
  assert.equal(call('GET', '/api/admin/disputes', null, ADMIN).data[0].status, 'open');
  assert.equal(call('POST', '/api/admin/disputes/' + d.id, { action: 'refund' }, ADMIN).data.status, 'refunded');
  assert.equal(call('GET', '/api/wallet', null, T).data.balance, bal + o.total);
  assert.ok(db.wallets.c_savanna.balance < ownerBal);
  assert.equal(call('POST', '/api/admin/disputes/' + d.id, { action: 'dismiss' }, ADMIN).status, 409);
  const o3 = mk1(); const d3 = call('POST', '/api/me/orders/' + o3.id + '/dispute', { reason: 'Changed my mind' }, T).data;
  assert.equal(call('POST', '/api/admin/disputes/' + d3.id, { action: 'dismiss', note: 'Not eligible' }, ADMIN).data.status, 'dismissed');
  const old = mk1(); db.bizOrders.find(x => x.id === old.id).ts -= 20 * 86400000;
  assert.equal(call('POST', '/api/me/orders/' + old.id + '/dispute', { reason: 'Too late to ask' }, T).status, 409);
});
test('ads: create charges wallet, needs admin approval, delivers, pauses, refunds unspent; rejection refunds', () => {
  const { db, call } = mk(); const T = bizMe(call); const bal0 = call('GET', '/api/wallet?mode=all', null, T).data.balance;
  assert.equal(call('POST', '/api/biz/ads', { name: 'a', headline: 'Fresh roast', dailyBudget: 500, days: 3 }, T).status, 400);
  assert.equal(call('POST', '/api/biz/ads', { name: 'Launch', headline: 'Fresh roasts in Nanyuki', dailyBudget: 50, days: 3 }, T).status, 400);
  const ad = call('POST', '/api/biz/ads', { name: 'Launch', headline: 'Fresh roasts in Nanyuki', dailyBudget: 500, days: 3, objective: 'orders' }, T).data;
  assert.equal(ad.status, 'pending_review'); assert.equal(call('GET', '/api/wallet?mode=all', null, T).data.balance, bal0 - 1500);
  assert.equal(call('GET', '/api/ads/feed', null, login(call, '0711222333')).data.some(a => a.id === ad.id), false, 'not shown before approval');
  assert.equal(call('POST', '/api/biz/ads/' + ad.id + '/simulate-day', {}, T).status, 409);
  assert.equal(call('POST', '/api/admin/ads/' + ad.id, { action: 'approve' }, ADMIN).data.status, 'active');
  assert.equal(call('GET', '/api/ads/feed', null, login(call, '0711222333')).data.some(a => a.id === ad.id), true);
  const day = call('POST', '/api/biz/ads/' + ad.id + '/simulate-day', {}, T).data; assert.ok(day.spent >= 495 && day.spent <= 500); assert.ok(day.impressions > 4000); assert.ok(day.clicks > 50);
  const rev = db.revenue.filter(r => r.type === 'ads').reduce((n, r) => n + r.amount, 0); assert.ok(rev >= 495, 'platform books ad revenue as it is spent');
  assert.equal(call('POST', '/api/biz/ads/' + ad.id + '/pause', {}, T).data.status, 'paused');
  assert.equal(call('GET', '/api/ads/feed', null, login(call, '0711222333')).data.some(a => a.id === ad.id), false, 'paused ads are not served');
  call('POST', '/api/biz/ads/' + ad.id + '/resume', {}, T);
  const stop = call('POST', '/api/biz/ads/' + ad.id + '/stop', {}, T).data; assert.equal(stop.status, 'stopped'); assert.ok(stop.refunded >= 990 && stop.refunded <= 1010);
  const ad2 = call('POST', '/api/biz/ads', { name: 'Bad', headline: 'Guaranteed miracle cure', dailyBudget: 200, days: 2 }, T).data, b1 = call('GET', '/api/wallet?mode=all', null, T).data.balance;
  const rj = call('POST', '/api/admin/ads/' + ad2.id, { action: 'reject', reason: 'Misleading claim' }, ADMIN).data; assert.equal(rj.status, 'rejected');
  assert.equal(call('GET', '/api/wallet?mode=all', null, T).data.balance, b1 + 400);
  assert.equal(call('POST', '/api/biz/ads', { name: 'Poor', headline: 'Way too big', dailyBudget: 1e6, days: 30 }, T).status, 402);
});
test('ads: campaign cap and click tracking', () => {
  const { call } = mk(); const T = bizMe(call); const N = login(call, '0711222333');
  for (let i = 0; i < 5; i++) assert.equal(call('POST', '/api/biz/ads', { name: 'C' + i, headline: 'Headline ' + i, dailyBudget: 100, days: 1 }, T).status, 200);
  assert.equal(call('POST', '/api/biz/ads', { name: 'C6', headline: 'Headline six', dailyBudget: 100, days: 1 }, T).status, 409);
  const ads = call('GET', '/api/biz/ads', null, T).data.ads; call('POST', '/api/admin/ads/' + ads[0].id, { action: 'approve' }, ADMIN);
  const feed = call('GET', '/api/ads/feed', null, N).data; assert.equal(call('POST', '/api/ads/' + feed[0].id + '/click', {}, N).data.ownerId, 'u_me');
});
test('analytics: empty for new business, filled after demo history; funnel and top items', () => {
  const { call } = mk(); const T = bizMe(call); const N = login(call, '0711222333');
  const a0 = call('GET', '/api/biz/analytics', null, T).data; assert.equal(a0.totals.views, 0); assert.equal(a0.totals.orders, 0);
  call('POST', '/api/biz/catalog', { kind: 'product', name: 'House blend', price: 800, stock: 50 }, T);
  call('GET', '/api/biz/pages/u_me', null, N);
  assert.equal(call('GET', '/api/biz/analytics', null, T).data.totals.views, 1, 'customer page view counted; owner views are not');
  call('GET', '/api/biz/pages/u_me', null, T); assert.equal(call('GET', '/api/biz/analytics', null, T).data.totals.views, 1);
  assert.equal(call('POST', '/api/biz/demo-history', {}, T).data.orders, 10);
  const a = call('GET', '/api/biz/analytics?days=14', null, T).data;
  assert.equal(a.series.views.length, 14); assert.ok(a.totals.views > 50); assert.equal(a.totals.completed, 10); assert.ok(a.totals.revenue > 0);
  assert.ok(a.topItems.length >= 1 && a.topItems[0].revenue >= a.topItems[a.topItems.length - 1].revenue); assert.ok(a.conversionPct > 0); assert.ok(a.rating.count >= 5);
  assert.ok(call('GET', '/api/wallet/biz/revenue?days=14', null, T).data.revenue > 0);
});
test('admin: ad and dispute queues require developer sign-in', () => {
  const { call } = mk(); const T = login(call, '0700111222');
  assert.equal(call('GET', '/api/admin/ads', null, T).status, 401); assert.equal(call('GET', '/api/admin/disputes', null, T).status, 401);
  assert.equal(call('GET', '/api/admin/ads', null, ADMIN).status, 200);
});
