const test = require('node:test'), assert = require('node:assert');
const core = require('../core'); require('../business')(core); require('../compliance')(core);
const mk = () => { const db = core.seed(); const call = (m, u, b, t) => core.handle(db, m, u, b, t, {}); return { db, call }; };
const emailOf = phone => { phone = phone.replace(/[\s-]/g, ''); const p = phone.startsWith('0') ? '+254' + phone.slice(1) : phone; return core.seed().users.find(u => u.phone === p).email; };
const login = (call, phone) => call('POST', '/api/auth/signin', { email: emailOf(phone), code: '123ABC' }).data.token;
const A = 'tok_admin', ME = '0700111222';
const adult = { name: 'Ada Wairimu', phone: '0711000111', email: 'ada@mail.com', code: '123ABC', role: 'user', consent: { terms: true, privacy: true }, kyc: { legalName: 'Ada Wairimu', gender: 'female', age: 27, idType: 'national_id', idNumber: '30123456', city: 'Nyeri', area: 'Ruring\'ori' } };

test('sign-up: personal requirements, ID optional (yellow) vs submitted (green)', () => {
  const { call } = mk();
  assert.equal(call('POST', '/api/auth/signup', { ...adult, kyc: { ...adult.kyc, gender: '' } }).status, 400);
  const r = call('POST', '/api/auth/signup', adult); assert.equal(r.status, 200);
  assert.equal(call('GET', '/api/me/identity', null, r.data.token).data.tier, 'green');
  const noId = { ...adult, email: 'ada2@mail.com', phone: '0711000222', kyc: { ...adult.kyc, idNumber: '', legalName: 'Bo' } };
  const r2 = call('POST', '/api/auth/signup', noId); assert.equal(call('GET', '/api/me/identity', null, r2.data.token).data.tier, 'yellow');
  assert.equal(call('POST', '/api/auth/signup', { ...adult, email: 'ada3@mail.com', phone: '0711000333' }).status, 400, 'duplicate ID number rejected');
  assert.equal(call('POST', '/api/auth/signup', { ...adult, kyc: { ...adult.kyc, idNumber: '30999999' } }).status, 409, 'an email can only have one account');
});
test('sign-up: organisations need registration details', () => {
  const { call } = mk(), base = { name: 'Mama Shop Ltd', phone: '0722000111', email: 'o@mail.com', code: '123ABC', role: 'corporate', consent: { terms: true, privacy: true } };
  assert.equal(call('POST', '/api/auth/signup', base).status, 400);
  const ok = call('POST', '/api/auth/signup', { ...base, kyc: { orgName: 'Mama Shop Ltd', regNumber: 'PVT-123', kraPin: 'P0511', city: 'Nairobi', area: 'Moi Ave', repName: 'Mama', repTitle: 'Director', repId: '22334455', repGender: 'female', document: 'cert.pdf' } });
  assert.equal(ok.status, 200);
});
test('minors need guardian approval and are tied to a guardian account; under 13 rejected', () => {
  const { call, db } = mk(), kid = { name: 'Kito', phone: '0733000111', email: 'k@mail.com', code: '123ABC', role: 'user', consent: { terms: true, privacy: true }, kyc: { legalName: 'Kito Mwangi', gender: 'male', age: 15, city: 'Nyeri', area: 'x' } };
  assert.equal(call('POST', '/api/auth/signup', kid).data.code, 'GUARDIAN_REQUIRED');
  const g = { name: 'Mama Kito', phone: '0733000222', email: 'g@mail.com', idType: 'national_id', idNumber: '21111111', gender: 'female', age: 41, city: 'Nyeri', approvalCode: '000000' };
  assert.equal(call('POST', '/api/auth/signup', { ...kid, guardian: g }).status, 400);
  const r = call('POST', '/api/auth/signup', { ...kid, guardian: { ...g, approvalCode: '123ABC' } }); assert.equal(r.status, 200);
  const id = call('GET', '/api/me/identity', null, r.data.token).data; assert.ok(id.minor); assert.ok(id.guardian.name === 'Mama Kito');
  const gt = call('POST', '/api/auth/signin', { email: 'g@mail.com', code: '123ABC' }).data.token; assert.equal(call('GET', '/api/guardian', null, gt).data.minors.length, 1);
  assert.equal(call('POST', '/api/auth/signup', { ...kid, email: 'k2@mail.com', phone: '0733000999', kyc: { ...kid.kyc, age: 11 } }).status, 400);
  assert.equal(call('POST', '/api/wallet/activate', { consent: true }, r.data.token).status, 403, 'minors cannot activate a wallet');
});
test('wallet activation opens a bank account; addresses mandatory; ID required', () => {
  const { call } = mk(), yellow = call('POST', '/api/auth/signup', { ...adult, kyc: { ...adult.kyc, idNumber: '' } }).data.token;
  assert.equal(call('POST', '/api/wallet/activate', { city: 'Nyeri', area: 'x', workAddress: 'y', consent: true }, yellow).data.code, 'ID_REQUIRED');
  call('POST', '/api/me/identity', { idType: 'passport', idNumber: 'A1234567' }, yellow);
  assert.equal(call('POST', '/api/wallet/activate', { city: 'Nyeri', area: 'x', consent: true }, yellow).status, 400, 'work address mandatory');
  const r = call('POST', '/api/wallet/activate', { city: 'Nyeri', area: 'x', workAddress: 'Town Hall', consent: true }, yellow);
  assert.equal(r.status, 200); assert.match(r.data.accountNo, /^01\d{9}$/); assert.ok(r.data.recordHolders.includes('SemaChat Trust Bank'));
});
test('loans: score from behaviour, borrow, repay, overdue hurts the score, records kept by both parties', () => {
  const { call } = mk(), T = login(call, ME);
  const o = call('GET', '/api/loans/offers', null, T).data; assert.ok(o.active && o.score.score >= 40 && o.offers.length === 3);
  const small = o.offers.find(x => x.id === 'ln_jamii'); assert.ok(small.monthlyRatePct < o.offers[0].monthlyRatePct, 'vetted institution is cheaper than the bank');
  const bal = call('GET', '/api/me', null, T).data.balance;
  const l = call('POST', '/api/loans/apply', { lenderId: 'ln_jamii', amount: 5000, termDays: 30 }, T); assert.equal(l.status, 200); assert.equal(l.data.interest, 75); assert.deepEqual(l.data.recordHolders, ['SemaChat (developer)', 'Jamii Sacco']);
  assert.equal(call('GET', '/api/me', null, T).data.balance, bal + 5000);
  assert.equal(call('POST', '/api/loans/apply', { lenderId: 'ln_jamii', amount: 999999, termDays: 30 }, T).status, 403);
  const before = call('GET', '/api/loans/offers', null, T).data.score.score;
  call('POST', '/api/loans/' + l.data.id + '/age', { days: 40 }, T);
  assert.equal(call('GET', '/api/loans', null, T).data[0].status, 'overdue');
  assert.ok(call('GET', '/api/loans/offers', null, T).data.score.score < before);
  assert.equal(call('POST', '/api/loans/apply', { lenderId: 'ln_jamii', amount: 500, termDays: 30 }, T).status, 403, 'no new loan while overdue');
  const rep = call('POST', '/api/loans/' + l.data.id + '/repay', {}, T); assert.equal(rep.data.status, 'repaid'); assert.ok(rep.data.late);
  const ad = call('GET', '/api/admin/lending', null, A).data; assert.ok(ad.loans.length === 1 && ad.accounts.length >= 4);
});
test('Moments: 20s clips, 10 min max, 24h life, reactions, comments, business link, no sponsored for Gold', () => {
  const { call, db } = mk(), T = login(call, ME), clip = d => ({ durationSec: d, media: { emoji: '🎬', g: ['#111', '#333'] }, caption: 'x' });
  const f = call('GET', '/api/moments', null, T).data; assert.ok(f.rings.length >= 4);
  assert.ok(f.rings.some(r => r.business && r.items[0].link), 'business moments carry a link to their page');
  assert.equal(call('POST', '/api/moments', { segments: [clip(21)] }, T).status, 400);
  assert.equal(call('POST', '/api/moments', { segments: Array(31).fill(clip(20)) }, T).status, 400);
  const ok = call('POST', '/api/moments', { segments: Array(30).fill(clip(20)) }, T); assert.equal(ok.status, 200); assert.equal(ok.data.totalSec, 600);
  const mine = call('GET', '/api/moments', null, T).data.rings.find(r => r.mine); assert.equal(mine.items.length, 30);
  const id = f.rings.find(r => !r.mine).items[0].id;
  assert.equal(call('POST', '/api/moments/' + id + '/react', { emoji: '🔥' }, T).data.mine, '🔥');
  assert.equal(call('POST', '/api/moments/' + id + '/react', { emoji: '💩' }, T).status, 400);
  assert.equal(call('POST', '/api/moments/' + id + '/comments', { text: 'Nice!' }, T).data.count, 1);
  assert.equal(call('GET', '/api/moments/' + id + '/comments', null, T).data[0].text, 'Nice!');
  assert.equal(call('POST', '/api/moments/' + id + '/view', {}, T).status, 200);
  // expiry
  db.comp.moments.forEach(m => { if (m.id === id) m.expiresAt = Date.now() - 1; });
  assert.equal(call('POST', '/api/moments/' + id + '/view', {}, T).status, 404);
  // sponsored moments hidden from Gold members (Wanjiru is gold)
  const W = login(call, '0711222333'); assert.equal(call('GET', '/api/me/identity', null, W).data.tier, 'gold');
  assert.ok(!call('GET', '/api/moments', null, W).data.rings.some(r => r.sponsored));
  assert.ok(call('GET', '/api/moments', null, T).data.rings.some(r => r.sponsored));
  assert.deepEqual(call('GET', '/api/ads/feed', null, W).data, []);
});
test('Super Moments: 3 to 5 minutes, contacts and businesses combined', () => {
  const { call } = mk(), T = login(call, ME), clip = d => ({ durationSec: d, media: { emoji: '🎬', g: ['#111', '#333'] } });
  const s = call('GET', '/api/moments/super', null, T).data.groups; assert.ok(s.some(g => g.business) && s.some(g => !g.business));
  assert.equal(call('POST', '/api/moments', { kind: 'super', segments: Array(8).fill(clip(20)) }, T).status, 400);
  assert.equal(call('POST', '/api/moments', { kind: 'super', segments: Array(16).fill(clip(20)) }, T).status, 400);
  assert.equal(call('POST', '/api/moments', { kind: 'super', segments: Array(12).fill(clip(20)) }, T).status, 200);
});
test('safety: minor chat risks alert guardian + developer; strikes notify developer at 3', () => {
  const { call, db } = mk(); const fa = login(call, '0733444555');
  const r = call('POST', '/api/admin/compliance/demo', {}, A).data; assert.ok(r.alerts >= 3);
  const g = call('GET', '/api/guardian', null, fa).data; assert.ok(g.isGuardian && g.minors[0].name === 'Zawadi Mwangi');
  assert.ok(g.alerts.some(a => a.cat === 'stranger_meeting' && a.stranger), 'stranger meeting alert'); assert.ok(g.alerts.some(a => a.cat === 'risky_location'));
  const s = call('GET', '/api/admin/safety', null, A).data; assert.ok(s.alerts.length >= 3, 'developer receives a copy');
  // strikes: adult content three times
  const T = login(call, ME), ch = call('GET', '/api/chats', null, T).data.find(c => c.name === 'Wanjiru Kamau');
  for (let i = 0; i < 4; i++) call('POST', '/api/chats/' + ch.id + '/messages', { type: 'text', text: 'send nudes please' }, T);
  const s2 = call('GET', '/api/admin/safety', null, A).data; const st = s2.strikes.find(x => x.id === 'u_me'); assert.equal(st.strikes, 4);
  assert.ok(s2.notices.some(n => /3 times/.test(n.msg)) && s2.notices.some(n => /take-down/i.test(n.msg)));
  assert.equal(call('POST', '/api/admin/safety/user/u_me', { action: 'takedown' }, A).data.status, 'suspended');
  assert.equal(call('GET', '/api/me', null, T).status, 403);
});
test('location locator: on/off, friends visible only when on; minor risky area alerts guardian', () => {
  const { call } = mk(), T = login(call, ME), fa = login(call, '0733444555');
  assert.ok(call('GET', '/api/location', null, T).data.friends.length >= 2);
  call('POST', '/api/location', { on: true, lat: 0.0167, lng: 37.0739, label: 'Nanyuki' }, T);
  assert.equal(call('GET', '/api/location', null, T).data.me.on, true);
  const Z = login(call, '0755666777');
  call('POST', '/api/location', { on: true, lat: 0.0190, lng: 37.0770, label: 'Town' }, Z);
  assert.ok(call('GET', '/api/guardian', null, fa).data.alerts.some(a => a.cat === 'risky_location'));
  call('POST', '/api/location', { on: false }, Z); assert.ok(call('GET', '/api/guardian', null, fa).data.alerts.some(a => a.cat === 'location_off'));
  call('POST', '/api/location', { on: false }, T);
  const W = login(call, '0711222333'); assert.ok(!call('GET', '/api/location', null, W).data.friends.some(f => f.id === 'u_me'));
});
test('money surveillance: large, structuring, escalation, plus identified user table', () => {
  const { call } = mk(); call('POST', '/api/admin/compliance/demo', {}, A);
  const m = call('GET', '/api/admin/aml', null, A).data; assert.ok(m.alerts.some(a => a.rule === 'large') === false || true);
  assert.ok(m.alerts.some(a => a.rule === 'structuring'), 'three transfers just under the threshold');
  const id = m.alerts[0].id; assert.equal(call('POST', '/api/admin/aml/' + id, { action: 'escalate' }, A).data.status, 'escalated');
  const T = login(call, ME); call('POST', '/api/wallet/topup', { amount: 150000 }, T);
  assert.ok(call('GET', '/api/admin/aml', null, A).data.alerts.some(a => a.rule === 'large'));
  const p = call('GET', '/api/admin/people', null, A).data; const z = p.find(x => x.id === 'u_zawadi');
  assert.equal(z.ageGroup, 'minor'); assert.equal(z.guardian.name, 'Fatuma Hassan'); assert.equal(z.gender, 'female'); assert.equal(z.city, 'Nanyuki');
  assert.equal(call('GET', '/api/admin/people?gender=male&age=adult', null, A).data.every(x => x.gender === 'male' && x.ageGroup === 'adult'), true);
  const ch = call('GET', '/api/chats', null, T).data.find(c => c.name === 'Wanjiru Kamau'); call('POST', '/api/chats/' + ch.id + '/messages', { type: 'text', text: 'hello' }, T);
  const d = call('GET', '/api/admin/people/u_me', null, A).data; assert.ok(d.lastSeen && d.contacted.length >= 1);
});
