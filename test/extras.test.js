const test = require('node:test'), assert = require('node:assert');
const core = require('../core'); require('../business')(core); require('../compliance')(core); require('../health')(core); require('../music')(core); require('../community')(core);
const mk = () => { const db = core.seed(); const call = (m, u, b, t) => core.handle(db, m, u, b || {}, t || 'tok_u_me', {}); return { db, call }; };
const A = 'tok_admin', W = core.wellness;
const img = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

test('walking styles are recognised from cadence and calories follow MET × kg × hours', () => {
  const k = s => W.classifyCadence(s).key;
  assert.deepEqual([60, 90, 110, 135, 160, 190].map(k), ['stroll', 'walk', 'brisk', 'jog', 'run', 'sprint']);
  const a = W.analyseSession([{ steps: 1000, seconds: 600 }], 70, 170);   // 100 spm → brisk? (100 is brisk lower bound)
  assert.equal(a.dominant, 'brisk'); assert.equal(a.calories, Math.round(4.8 * 70 * (600 / 3600)));
  const { call } = mk(); const r = call('POST', '/api/wellness/session', { segments: [{ steps: 400, seconds: 240 }, { steps: 300, seconds: 120 }, { steps: 350, seconds: 120 }] });
  assert.equal(r.status, 200); assert.deepEqual(r.data.session.styles.map(s => s.key).sort(), ['brisk', 'run', 'sprint']); assert.ok(r.data.session.calories > 0);
  assert.equal(call('POST', '/api/wellness/session', { steps: 0, seconds: 30 }).status, 400);
});
test('heart rate, breath-hold, BMI and clean bill of health', () => {
  const { call } = mk();
  assert.match(call('POST', '/api/wellness/hr', { bpm: 72 }).data.headline, /Healthy resting/); assert.equal(call('POST', '/api/wellness/hr', { bpm: 400 }).status, 400);
  const short = call('POST', '/api/wellness/breath', { seconds: 8 }).data, good = call('POST', '/api/wellness/breath', { seconds: 40 }).data;
  assert.equal(short.key, 'very_short'); assert.equal(good.key, 'good'); assert.match(good.disclaimer, /not a medical diagnosis/);
  const ob = call('POST', '/api/wellness/assess', { weightKg: 110, heightCm: 168, age: 45 }).data; assert.match(ob.category, /Obesity/); assert.ok(ob.risks.length >= 3); assert.equal(ob.cleanBillOfHealth, false);
  const ok = call('POST', '/api/wellness/assess', { weightKg: 68, heightCm: 175, age: 30 }).data; assert.equal(ok.cleanBillOfHealth, true);
  assert.equal(call('POST', '/api/wellness/bp', { sys: 150, dia: 95 }).data.level, 'high');
});
test('music: 300,000 songs, 24 genres, artist + band + title, favourites, search', () => {
  const { call } = mk();
  const g = call('GET', '/api/music/genres').data; assert.equal(g.total, 300000); assert.equal(g.genres.length, 24);
  const t = call('GET', '/api/music/tracks?genre=gospel&limit=5').data; assert.equal(t.items.length, 5); t.items.forEach(x => { assert.ok(x.title && x.artist && x.band); assert.equal(x.genre, 'gospel'); });
  assert.deepEqual(call('GET', '/api/music/track/t_77').data.title, core.music.track(77).title);
  assert.ok(call('GET', '/api/music/tracks?q=mama&limit=10').data.items.length > 0);
  assert.equal(call('POST', '/api/music/fav', { id: 't_5' }).data.fav, true); assert.equal(call('GET', '/api/music/library').data.favourites.length, 1);
  assert.equal(call('PUT', '/api/music/eq', { preset: 'bass', bands: [9, 20, -30], boost: 900 }).data.boost, 300);
});
test('DIRA TECH apps are hidden from clients until the developer activates them', () => {
  const { call } = mk();
  assert.equal(call('GET', '/api/dira').data.apps.length, 0); assert.equal(call('GET', '/api/dira').data.footer, 'DIRA TECH | Spiker Group Company');
  assert.equal(call('GET', '/api/admin/dira', null, A).data.apps.length, 7); assert.equal(call('GET', '/api/admin/dira').status, 401);
  call('PUT', '/api/admin/dira/pingsat', { enabled: true }, A); assert.deepEqual(call('GET', '/api/dira').data.apps.map(a => a.name), ['PINGsat']);
});
test('donations need the full list and BOTH checks before going live', () => {
  const { call } = mk(), dl = Date.now() + 30 * 864e5;
  const form = { title: 'Restart my shop', nationalId: '12345678', fullName: 'Amani Njoroge', idSelfie: img, address: 'Nanyuki, Market Road', media: [{ type: 'image', data: img }], description: 'Flood waters ruined my shop stock and I need to restock.', amount: 30000, deadline: dl, confirmTruth: true };
  const bad = call('POST', '/api/donations', { ...form, idSelfie: null, amount: 10 }); assert.equal(bad.status, 400); assert.deepEqual(bad.data.missing.sort(), ['amount', 'idSelfie']);
  const W1 = 'tok_u_wanjiru', r = call('POST', '/api/donations', form, W1); assert.equal(r.status, 200); assert.equal(r.data.status, 'pending_docs'); const id = r.data.id;
  assert.ok(!call('GET', '/api/donations').data.some(c => c.id === id));                       // not public yet
  assert.equal(call('POST', '/api/admin/donations/' + id + '/field', { ok: true }, A).status, 409); // cannot skip step 1
  assert.equal(call('POST', '/api/admin/donations/' + id + '/docs', { approve: true }, A).data.status, 'awaiting_field');
  assert.equal(call('POST', '/api/admin/donations/' + id + '/field', { ok: true }, A).status, 409); // step 2 must be scheduled
  call('POST', '/api/admin/donations/' + id + '/schedule', { method: 'video' }, A);
  assert.equal(call('POST', '/api/donations/' + id + '/give', { amount: 100 }).status, 409);
  assert.equal(call('POST', '/api/admin/donations/' + id + '/field', { ok: true }, A).data.status, 'live');
  assert.ok(call('GET', '/api/donations').data.some(c => c.id === id));
  assert.equal(call('POST', '/api/donations/' + id + '/give', { amount: 100 }, W1).status, 400);   // not your own
  const before = call('GET', '/api/me').data.balance, g = call('POST', '/api/donations/' + id + '/give', { amount: 500 });
  assert.equal(g.status, 200); assert.equal(g.data.campaign.raised, 500); assert.equal(call('GET', '/api/me').data.balance, before - 500);
});
test('On the move!: priced per 50 sq m by town, registered outlets only, lasts 3 hours, area-limited', () => {
  const { db, call } = mk(), C = core.community;
  assert.equal(C.quote(50, C.nearestTown(-1.2864, 36.8172)).cost, 100);               // Nairobi 50 sq m
  assert.equal(C.quote(120, C.nearestTown(-0.0917, 34.768)).cost, 300);               // Kisumu, 3 units
  assert.equal(C.quote(50, C.nearestTown(0.0167, 37.0722)).cost, 50);                 // other town
  ['Nakuru', 'Mombasa', 'Eldoret'].forEach(n => assert.ok(C.TOWNS.find(t => t[0] === n && t[3])));
  const body = { text: 'Fresh bread today at KES 50', lat: 0.0167, lng: 37.0722, sqm: 500, photos: [{ emoji: '🍞' }], label: 'Bakery' };
  assert.equal(call('POST', '/api/otm', body).status, 403);                           // u_me has no registered outlet
  const bal = call('GET', '/api/me', null, 'tok_c_savanna').data.balance, r = call('POST', '/api/otm', body, 'tok_c_savanna');
  assert.equal(r.status, 200); assert.equal(r.data.quote.cost, 500); assert.equal(r.data.ad.minsLeft, 180); assert.equal(call('GET', '/api/me', null, 'tok_c_savanna').data.balance, bal - 500);
  assert.ok(call('GET', '/api/otm?lat=0.0167&lng=37.0722').data.items.some(a => a.text === body.text));
  assert.ok(!call('GET', '/api/otm?lat=-1.2864&lng=36.8172').data.items.some(a => a.text === body.text));   // outside its area
  db.otm.ads.forEach(a => a.expiresAt = Date.now() - 1); assert.equal(call('GET', '/api/otm?lat=0.0167&lng=37.0722').data.items.length, 0); // expired after 3 h
  assert.equal(call('POST', '/api/otm/quote', { lat: 0.0167, lng: 37.07, sqm: 10 }).status, 400);
});
test('moments line-up pages and includes contacts and business moments', () => {
  const { call } = mk(), a = call('GET', '/api/moments?limit=5').data; assert.equal(a.rings.length, 5); assert.ok(a.hasMore && a.total > 5);
  const all = [].concat(a.rings, call('GET', '/api/moments?offset=5&limit=60').data.rings); assert.equal(all.length, a.total);
  assert.ok(all.some(g => g.business) && all.some(g => !g.business && !g.mine));
});
test('new feature switches exist and turn the routes off', () => {
  const { call } = mk(); ['health', 'music', 'donations', 'onthemove'].forEach(k => assert.equal(call('GET', '/api/me').data.features[k], true));
  call('POST', '/api/admin/settings', { feature: { key: 'music', on: false } }, A); assert.equal(call('GET', '/api/music/genres').status, 403);
});
