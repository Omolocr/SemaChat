/* SemaChat — identity, safety, money and Moments add-on.
 * Installed with require('./compliance')(core). Everything lives under db.comp (lazy ensure()).
 *  - Identity: KYC tiers (yellow / green / gold), age + guardians, location locator
 *  - Wallet bank account (opened on wallet activation), behaviour-based credit score, loans from the partner bank and vetted lenders
 *  - Moments (20-second segments, 24h life, up to 10 min) and Super Moments (3-5 min), reactions and comments
 *  - Safety: AI-style (keyword heuristic, demo) scan of chats and locations for minors; guardian + developer alerts; violation strikes
 *  - Money surveillance rules (POCAMLA-style, demo thresholds) and the admin views that sit on top
 * All detection here is a transparent demo heuristic, not a production classifier. */
(function (root, install) {
  if (typeof module === 'object' && module.exports) module.exports = install;
  else install(root.SemaChatCore);
})(typeof self !== 'undefined' ? self : this, function install(core) {
'use strict';
  core.use(function (X) {
    const { route, uid, fail, byId, wallet, addTx, addRevenue, notify, pushMessage, audit, pub, friendsOf, D, H, tierOf, bizOwnerFor } = X;
    const OTP = core.OTP, MIN = 60000;
    const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
    const kes = n => 'KES ' + Math.round(n).toLocaleString('en-KE');
    const real = u => u && u.role !== 'system';

    /* ------------------------------------------------------------------ lazy state */
    function ensure(db) {
      if (db.comp) { db.comp.access = db.comp.access || []; return db.comp; }
      const t = Date.now(), c = db.comp = {
        v: 1, access: [], accounts: {}, loans: [], moments: [], seen: {}, alerts: [], violations: {}, aml: [], act: {}, loc: {}, notices: [], txScan: {}, records: [],
        thresholds: { largeTx: 100000, velocityPerHour: 10, unverifiedDay: 20000, passThroughMin: 50000 },
        riskyWords: ['club', 'nightclub', 'bar', 'casino', 'betting', 'lodging', 'brewery', 'liquor', 'pub'],
        zones: [{ id: 'z1', name: 'Nightclub strip (demo)', lat: 0.0190, lng: 37.0770, r: 400 }],
        lenders: [
          { id: 'ln_bank', kind: 'bank', name: 'SemaChat Trust Bank', tagline: 'Designated bank for SemaChat wallets', monthlyRatePct: 2.5, max: 50000, minScore: 40, terms: [30, 60, 90], vetted: true, licence: 'CBK-licensed (demo)' },
          { id: 'ln_jamii', kind: 'institution', name: 'Jamii Sacco', tagline: 'Small, low-interest member loans', monthlyRatePct: 1.5, max: 15000, minScore: 25, terms: [30, 60, 90], vetted: true, licence: 'SASRA-regulated (demo)' },
          { id: 'ln_mkulima', kind: 'institution', name: 'Mkulima Microfinance', tagline: 'Starter loans for small traders and farmers', monthlyRatePct: 1.2, max: 8000, minScore: 20, terms: [30, 60], vetted: true, licence: 'CBK-licensed microfinance (demo)' }
        ]
      };
      // legacy demo users get identity details so the developer console has something to show
      const SEED = { u_me: ['male', 29, 'Nanyuki', 'g'], u_wanjiru: ['female', 31, 'Nanyuki', 'gold'], u_otieno: ['male', 34, 'Kisumu', 'y'], u_fatuma: ['female', 40, 'Mombasa', 'g'], u_kiprono: ['male', 38, 'Iten', 'g'],
        u_zawadi: ['female', 16, 'Nanyuki', 'g'], u_baraka: ['male', 27, 'Nanyuki', 'g'], u_neema: ['female', 21, 'Nairobi', 'y'], u_juma: ['male', 33, 'Kisumu', 'y'], c_savanna: [null, null, 'Nanyuki', 'g'], i_laikipia: [null, null, 'Nanyuki', 'g'] };
      db.users.forEach(u => {
        const s = SEED[u.id]; if (!s || u.kyc) return;
        u.kyc = { role: u.role, legalName: u.name, gender: s[0], age: s[1], residence: { city: s[2], area: '' }, idSubmitted: s[3] !== 'y', idNumber: u.role === 'user' && s[3] !== 'y' ? String(10000000 + Math.abs(X.hash(u.id)) % 8999999) : undefined, idType: 'national_id', workAddress: '', minor: s[1] != null && s[1] < 18 };
        u.idSubmitted = s[3] !== 'y'; u.minor = !!u.kyc.minor; u.age = s[1];
        if (s[3] === 'gold') u.goldUntil = t + 20 * D;
      });
      const z = byId(db, 'u_zawadi'), f = byId(db, 'u_fatuma');
      if (z && f && !z.guardianId) { z.guardianId = 'u_fatuma'; z.guardianRelation = 'Mother'; f.guardianOf = (f.guardianOf || []).concat('u_zawadi'); }
      ['u_me', 'u_wanjiru', 'u_fatuma', 'u_kiprono'].forEach(id => { const u = byId(db, id); if (u) openAccount(db, u, { city: u.kyc.residence.city, area: 'Town centre' }, 'Office', t - 30 * D); });
      seedMoments(db, c);
      // friends who share their location in the demo
      c.loc.u_wanjiru = { on: true, lat: 0.0230, lng: 37.0712, label: 'Nanyuki Town', ts: t };
      c.loc.u_kiprono = { on: true, lat: 0.3534, lng: 35.9497, label: 'Iten', ts: t };
      c.loc.u_zawadi = { on: true, lat: 0.0150, lng: 37.0700, label: 'Nanyuki Girls High', ts: t };
      return c;
    }

    const tickAll = db => { const c = ensure(db); seedMoments(db, c); return c; };
    const act = (db, id) => { const c = ensure(db); return c.act[id] || (c.act[id] = { lastSeen: 0, lastAction: '', log: [], contacted: {}, shared: [] }); };
    const bizName = (db, id) => (db.bizAccounts[id] && db.bizAccounts[id].name) || (byId(db, id) || {}).name || 'Business';

    /* ------------------------------------------------------------------ Moments */
    const REACTIONS = ['❤️', '😂', '😮', '👏', '🔥', '🙏'];
    function seedMoments(db, c) {
      const now = Date.now(); if (c.moments.some(m => m.seed && m.expiresAt > now + 2 * H)) return;
      c.moments = c.moments.filter(m => !m.seed);
      const G = { run: ['#38a169', '#2c5282'], lake: ['#2b6cb0', '#805ad5'], iten: ['#dd6b20', '#c53030'], chess: ['#4a5568', '#2d3748'], coffee: ['#8b5a2b', '#3b2a1a'], dj: ['#d53f8c', '#553c9a'] };
      const mk = (author, group, idx, count, ageH, media, cap, extra) => c.moments.push(Object.assign({ id: uid('mo_'), groupId: group, userId: author, kind: 'moment', idx, count, durationSec: 20, media, caption: cap, ts: now - ageH * H, expiresAt: now - ageH * H + 24 * H, reactions: [], comments: [], views: [], clicks: 0, seed: true }, extra || {}));
      mk('u_wanjiru', 'g_s1', 0, 3, 2, { emoji: '🏃🏾‍♀️', g: G.run }, 'Sunrise 10K, Nanyuki hills 🌄'); mk('u_wanjiru', 'g_s1', 1, 3, 2, { emoji: '🥤', g: G.lake }, 'Recovery smoothie');
      mk('u_wanjiru', 'g_s1', 2, 3, 2, { emoji: '😴', g: G.chess }, 'Now a nap.');
      mk('u_otieno', 'g_s2', 0, 2, 5, { emoji: '📸', g: G.lake }, 'Golden hour on Lake Victoria'); mk('u_otieno', 'g_s2', 1, 2, 5, { emoji: '🛶', g: G.iten }, 'Fishermen heading out');
      mk('u_kiprono', 'g_s3', 0, 2, 9, { emoji: '🏔️', g: G.iten }, 'Iten altitude session'); mk('u_kiprono', 'g_s3', 1, 2, 9, { emoji: '⏱️', g: G.run }, 'New PB for the squad!');
      mk('u_zawadi', 'g_s4', 0, 1, 3, { emoji: '♟️', g: G.chess }, 'Checkmate in 4 😎');
      mk('c_savanna', 'g_s5', 0, 2, 1, { emoji: '☕', g: G.coffee }, 'Fresh roast just landed', { biz: true, link: { ownerId: 'c_savanna', label: 'Order from our page' } });
      mk('c_savanna', 'g_s5', 1, 2, 1, { emoji: '🥐', g: G.coffee }, 'Pair it with a warm croissant', { biz: true, link: { ownerId: 'c_savanna', label: 'See the menu' } });
      mk('u_baraka', 'g_s6', 0, 1, 4, { emoji: '🎧', g: G.dj }, 'Weekend DJ sets, book now', { biz: true, sponsored: true, link: { ownerId: 'u_baraka', label: 'Book Baraka Sounds' } });
      // more contacts' and businesses' moments so the line-up has plenty to scroll through
      const EXTRA = [['b_mamapima', 'Mama Pima Kitchen', '🍲', 'restaurant', 'Nanyuki', 'Home-style lunches daily'], ['b_acacia', 'Acacia Hotels', '🏨', 'hospitality', 'Naivasha', 'Lakeside stays and conferences'], ['b_njeri', 'Mama Njeri Crafts', '🧺', 'retail', 'Nyeri', 'Handwoven baskets and beadwork'], ['b_agrimart', 'AgriMart Nanyuki', '🌽', 'retail', 'Nanyuki', 'Seeds, feed and farm advice']];
      EXTRA.forEach((e, i) => {
        if (byId(db, e[0])) return; const t0 = Date.now();
        db.users.push({ id: e[0], name: e[1], phone: '+2540205' + String(10000 + i * 111), email: e[0] + '@biz.example', backupEmail: e[0] + '.bk@biz.example', role: 'corporate', status: 'active', verified: true, bio: e[5], color: ['#dd6b20', '#2b6cb0', '#805ad5', '#38a169'][i], joined: t0 - 60 * D, tube: null, activeMode: 'normal', hasBizAccount: true, bizStatus: 'active', bizActivatedAt: t0 - 50 * D, stats: { informalSales: 0, pinTaps: 0, referredBy: null }, prefs: null });
        db.friends[e[0]] = db.friends[e[0]] || [];
        db.bizAccounts[e[0]] = { name: e[1], category: e[3], kind: 'formal', taxPin: null, team: [], payoutSchedule: 'manual', bankLinked: false, inboxAccess: 'all', status: 'active', createdAt: t0 - 50 * D, page: { emoji: e[2], cover: ['#2d3748', '#553c9a'], about: e[5], hours: 'Open daily', area: e[4] } };
      });
      const G2 = { green: ['#38a169', '#276749'], sun: ['#ed8936', '#c05621'], sky: ['#4299e1', '#2c5282'], rose: ['#ed64a6', '#97266d'], dusk: ['#667eea', '#553c9a'] };
      mk('u_fatuma', 'g_s7', 0, 2, 7, { emoji: '🍞', g: G2.sun }, 'Mandazi and bread, hot from the oven'); mk('u_fatuma', 'g_s7', 1, 2, 7, { emoji: '🎂', g: G2.rose }, 'Birthday cake orders open');
      mk('u_wanjiru', 'g_s8', 0, 1, 11, { emoji: '🌿', g: G2.green }, 'New leaves on the monstera 🌿');
      mk('u_otieno', 'g_s9', 0, 1, 13, { emoji: '🌇', g: G2.dusk }, 'Dusk over the gulf');
      mk('u_kiprono', 'g_s10', 0, 1, 15, { emoji: '👟', g: G2.sky }, 'Gear check before tomorrow’s long run');
      mk('b_mamapima', 'g_b1', 0, 2, 2, { emoji: '🍲', g: G2.sun }, 'Today: githeri, chapati and beef stew', { biz: true, link: { ownerId: 'b_mamapima', label: 'Order lunch' } }); mk('b_mamapima', 'g_b1', 1, 2, 2, { emoji: '🥬', g: G2.green }, 'Fresh greens from the shamba', { biz: true, link: { ownerId: 'b_mamapima', label: 'See menu' } });
      mk('b_acacia', 'g_b2', 0, 1, 6, { emoji: '🏨', g: G2.sky }, 'Weekend lake-view rooms from KES 6,500', { biz: true, link: { ownerId: 'b_acacia', label: 'Book a stay' } });
      mk('b_njeri', 'g_b3', 0, 2, 8, { emoji: '🧺', g: G2.rose }, 'Handwoven sisal baskets, new designs', { biz: true, link: { ownerId: 'b_njeri', label: 'Visit the shop' } }); mk('b_njeri', 'g_b3', 1, 2, 8, { emoji: '📿', g: G2.dusk }, 'Beadwork made by our women’s group', { biz: true, link: { ownerId: 'b_njeri', label: 'Visit the shop' } });
      mk('b_agrimart', 'g_b4', 0, 1, 10, { emoji: '🌽', g: G2.green }, 'Certified maize seed in stock', { biz: true, link: { ownerId: 'b_agrimart', label: 'Visit AgriMart' } });
      // two Super Moments (3+ minutes) — one from a contact, one from a business
      const sup = (author, group, n, ageH, emoji, g, cap, extra) => { for (let i = 0; i < n; i++) c.moments.push(Object.assign({ id: uid('mo_'), groupId: group, userId: author, kind: 'super', idx: i, count: n, durationSec: 20, media: { emoji, g }, caption: cap + (i ? ' · part ' + (i + 1) : ''), ts: now - ageH * H, expiresAt: now - ageH * H + 24 * H, reactions: [], comments: [], views: [], clicks: 0, seed: true }, extra || {})); };
      sup('u_otieno', 'g_x1', 9, 6, '🌅', G.lake, 'A day on the lake: full story');
      sup('c_savanna', 'g_x2', 10, 3, '☕', G.coffee, 'From farm to cup: how our coffee is made', { biz: true, link: { ownerId: 'c_savanna', label: 'Visit Savanna Coffee' } });
    }
    function canSee(db, viewer, m) {
      if (m.expiresAt <= Date.now()) return false;
      if (m.userId === viewer.id) return true;
      if (friendsOf(db, viewer.id).includes(m.userId)) return true;
      if (m.biz && !m.sponsored) return true;   // business moments reach everyone after contacts
      if (m.sponsored && tierOf(viewer) !== 'gold') return true;
      return false;
    }
    const itemView = (db, m, vid) => ({ id: m.id, idx: m.idx, count: m.count, durationSec: m.durationSec, media: m.media, caption: m.caption, link: m.link || null, ts: m.ts, expiresAt: m.expiresAt,
      views: m.views.length, clicks: m.clicks, reactions: REACTIONS.map(e => ({ e, n: m.reactions.filter(r => r.e === e).length })).filter(x => x.n), mine: (m.reactions.find(r => r.userId === vid) || {}).e || null, comments: m.comments.length });
    function groups(db, viewer, kind, off, lim) {
      const c = tickAll(db), seen = c.seen[viewer.id] || {}, by = {};
      c.moments.filter(m => m.kind === kind && canSee(db, viewer, m)).forEach(m => (by[m.groupId] || (by[m.groupId] = [])).push(m));
      return Object.keys(by).map(g => {
        const ms = by[g].sort((a, b) => a.idx - b.idx), f = ms[0], a = byId(db, f.userId);
        return { groupId: g, kind, author: pub(a), business: !!f.biz, sponsored: !!f.sponsored, name: f.biz ? bizName(db, f.userId) : a.name, mine: f.userId === viewer.id, ts: f.ts, expiresAt: f.expiresAt, totalSec: ms.reduce((n, x) => n + x.durationSec, 0),
          seen: ms.every(x => seen[x.id]), items: ms.map(x => itemView(db, x, viewer.id)), cover: f.media, caption: f.caption, link: f.link || null };
      }).sort((a, b) => (b.mine - a.mine) || (a.seen - b.seen) || (b.business - a.business === 0 ? 0 : 0) || b.ts - a.ts);
    }
    route('GET', /^\/api\/moments$/, 'user', null, c => { const all = groups(c.db, c.user, 'moment'), off = Math.max(0, parseInt(c.query.offset, 10) || 0), lim = Math.min(60, Math.max(1, parseInt(c.query.limit, 10) || 60)); return { rings: all.slice(off, off + lim), total: all.length, offset: off, hasMore: off + lim < all.length, reactions: REACTIONS }; });
    route('GET', /^\/api\/moments\/super$/, 'user', null, c => ({ groups: groups(c.db, c.user, 'super'), reactions: REACTIONS }));
    route('POST', /^\/api\/moments$/, 'user', null, c => {
      const db = c.db, cm = ensure(db), b = c.body, kind = b.kind === 'super' ? 'super' : 'moment', segs = Array.isArray(b.segments) ? b.segments : [];
      if (!segs.length) fail(400, 'Add at least one clip or photo.');
      const max = kind === 'super' ? 15 : 30; if (segs.length > max) fail(400, kind === 'super' ? 'A Super Moment can be at most 5 minutes.' : 'A Moment can be at most 10 minutes (30 clips of 20 seconds).');
      let total = 0;
      segs.forEach(s => { const d = Math.round(+s.durationSec || 0); if (d < 1 || d > 20) fail(400, 'Each clip in a Moment is 20 seconds or less.'); total += d; if (JSON.stringify(s.media || {}).length > 450000) fail(413, 'That file is too large for the preview. Try a smaller photo or clip.'); });
      if (kind === 'moment' && total > 600) fail(400, 'A Moment can be at most 10 minutes.');
      if (kind === 'super' && (total < 180 || total > 300)) fail(400, 'A Super Moment runs 3 to 5 minutes. This one is ' + Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0') + '.');
      const asBiz = c.mode === 'business' && !!bizOwnerFor(db, c.user), owner = asBiz ? bizOwnerFor(db, c.user) : c.user.id;
      let sponsored = false;
      if (b.sponsored) {
        if (!asBiz) fail(403, 'Switch to Business mode to promote a Moment.');
        const fee = kind === 'super' ? 300 : 150; X.charge(db, c.user.id, fee, 'Promoted ' + (kind === 'super' ? 'Super ' : '') + 'Moment', 'business', 'ad'); addRevenue(db, 'moments_ads', fee, 'Promoted moment • ' + bizName(db, owner)); sponsored = true;
      }
      const link = asBiz && b.linkLabel !== '' ? { ownerId: owner, label: cut(b.linkLabel, 40) || 'Visit our page' } : null;
      const g = uid('g_'), now = Date.now();
      segs.forEach((s, i) => cm.moments.push({ id: uid('mo_'), groupId: g, userId: owner, kind, idx: i, count: segs.length, durationSec: Math.round(+s.durationSec), media: s.media || { emoji: '🎬', g: ['#553c9a', '#2b6cb0'] }, caption: cut(s.caption, 140),
        ts: now, expiresAt: now + 24 * H, reactions: [], comments: [], views: [], clicks: 0, biz: asBiz, sponsored, link, by: c.user.id }));
      const a = act(db, c.user.id); a.shared.unshift({ ts: now, type: kind, label: (kind === 'super' ? 'Super Moment' : 'Moment') + ' · ' + segs.length + ' clips · ' + total + 's' }); a.shared.length = Math.min(a.shared.length, 40);
      return { groupId: g, clips: segs.length, totalSec: total, expiresAt: now + 24 * H };
    });
    const mom = (db, id) => { const m = ensure(db).moments.find(x => x.id === id); if (!m || m.expiresAt <= Date.now()) fail(404, 'That Moment has expired.'); return m; };
    route('POST', /^\/api\/moments\/([^/]+)\/view$/, 'user', null, c => { const cm = ensure(c.db), m = mom(c.db, c.p[0]); if (!m.views.includes(c.user.id) && m.userId !== c.user.id) m.views.push(c.user.id); (cm.seen[c.user.id] || (cm.seen[c.user.id] = {}))[m.id] = 1; return { ok: true }; });
    route('POST', /^\/api\/moments\/([^/]+)\/click$/, 'user', null, c => { const m = mom(c.db, c.p[0]); m.clicks++; return m.link || {}; });
    route('POST', /^\/api\/moments\/([^/]+)\/react$/, 'user', null, c => {
      const m = mom(c.db, c.p[0]), e = c.body.emoji; if (!REACTIONS.includes(e)) fail(400, 'Pick one of the quick reactions.');
      m.reactions = m.reactions.filter(r => r.userId !== c.user.id); m.reactions.push({ userId: c.user.id, e });
      if (m.userId !== c.user.id) notify(c.db, m.by || m.userId, { type: 'moment', mode: m.biz ? 'business' : 'normal', title: c.user.name + ' reacted ' + e, body: 'to your ' + (m.kind === 'super' ? 'Super Moment' : 'Moment'), ctx: { momentId: m.id } });
      return itemView(c.db, m, c.user.id);
    });
    route('GET', /^\/api\/moments\/([^/]+)\/comments$/, 'user', null, c => mom(c.db, c.p[0]).comments.map(x => ({ id: x.id, text: x.text, ts: x.ts, user: pub(byId(c.db, x.userId)) })));
    route('POST', /^\/api\/moments\/([^/]+)\/comments$/, 'user', null, c => {
      const m = mom(c.db, c.p[0]), text = cut(c.body.text, 200); if (!text) fail(400, 'Write a comment first.');
      const r = { id: uid('mc_'), userId: c.user.id, text, ts: Date.now() }; m.comments.push(r);
      if (m.userId !== c.user.id) notify(c.db, m.by || m.userId, { type: 'moment', mode: m.biz ? 'business' : 'normal', title: c.user.name + ' commented', body: text, ctx: { momentId: m.id } });
      return { id: r.id, count: m.comments.length };
    });
    route('DELETE', /^\/api\/moments\/group\/([^/]+)$/, 'user', null, c => { const cm = ensure(c.db), before = cm.moments.length; cm.moments = cm.moments.filter(m => !(m.groupId === c.p[0] && (m.userId === c.user.id || m.by === c.user.id))); if (cm.moments.length === before) fail(404, 'Nothing to delete.'); return { ok: true }; });

    /* ------------------------------------------------------------------ identity */
    const hasBank = (db, id) => !!ensure(db).accounts[id];
    route('GET', /^\/api\/me\/identity$/, 'user', null, c => {
      const db = c.db, u = c.user, cm = ensure(db), g = u.guardianId ? byId(db, u.guardianId) : null, k = u.kyc || {};
      return { tier: tierOf(u), idSubmitted: !!(u.idSubmitted || u.verified), minor: !!u.minor, age: u.age || k.age || null, gender: k.gender || null, city: (k.residence || {}).city || '', residence: k.residence || null, workAddress: k.workAddress || '',
        guardian: g ? { id: g.id, name: g.name, relation: u.guardianRelation || 'Parent' } : null, isGuardian: (u.guardianOf || []).length > 0, walletActive: hasBank(db, u.id), gold: tierOf(u) === 'gold', goldUntil: u.goldUntil || null,
        violations: (cm.violations[u.id] || []).length, legend: { yellow: 'Not verified: no National ID / Passport submitted', green: 'Verified: National ID / Passport submitted', gold: 'Gold: verified and on the paid version, with no ads' } };
    });
    route('POST', /^\/api\/me\/identity$/, 'user', null, c => {
      const u = c.user, b = c.body, num = cut(b.idNumber, 20).toUpperCase();
      if (u.role !== 'user') fail(400, 'Organisation accounts are verified with their registration documents.');
      if (!['national_id', 'passport'].includes(b.idType)) fail(400, 'Choose National ID or Passport.');
      if (!/^[A-Za-z0-9-]{6,20}$/.test(num)) fail(400, 'That ID / passport number does not look right.');
      if (c.db.users.some(x => x.id !== u.id && x.kyc && x.kyc.idNumber === num)) fail(409, 'An account already exists for that ID number.');
      u.kyc = Object.assign(u.kyc || { role: 'user' }, { idType: b.idType, idNumber: num, idSubmitted: true, legalName: cut(b.legalName, 80) || (u.kyc && u.kyc.legalName) || u.name }); u.idSubmitted = true;
      return { tier: tierOf(u) };
    });

    /* ------------------------------------------------------------------ location locator (user can switch it on/off) */
    const km = (a, b) => { const R = 6371, r = x => x * Math.PI / 180, dLa = r(b.lat - a.lat), dLo = r(b.lng - a.lng), q = Math.sin(dLa / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(q)); };
    route('GET', /^\/api\/location$/, 'user', null, c => {
      const cm = ensure(c.db), me = cm.loc[c.user.id] || { on: false }, friends = [];
      friendsOf(c.db, c.user.id).forEach(id => { const l = cm.loc[id], u = byId(c.db, id); if (l && l.on && real(u) && u.role === 'user') friends.push({ id, name: u.name, color: u.color, label: l.label, km: me.lat != null ? Math.round(km(me, l) * 10) / 10 : null }); });
      return { me, friends: friends.sort((a, b) => (a.km == null) - (b.km == null) || a.km - b.km) };
    });
    route('POST', /^\/api\/location$/, 'user', null, c => {
      const db = c.db, cm = ensure(db), u = c.user, on = !!c.body.on, prev = cm.loc[u.id] || {};
      const l = cm.loc[u.id] = { on, lat: on ? +c.body.lat || prev.lat || 0.0167 : prev.lat, lng: on ? +c.body.lng || prev.lng || 37.0739 : prev.lng, label: cut(c.body.label, 60) || prev.label || 'Nanyuki', ts: Date.now() };
      if (u.minor && u.guardianId) {
        if (!on && prev.on) minorAlert(db, u, { cat: 'location_off', severity: 'low', text: u.name + ' switched location sharing off.', direction: 'info' });
        if (on) { const z = cm.zones.find(z => km(l, z) * 1000 <= z.r); if (z || riskyLabel(cm, l.label)) minorAlert(db, u, { cat: 'risky_location', severity: 'high', text: u.name + ' is near a place flagged as risky: ' + (z ? z.name : l.label) + '.', direction: 'location' }); }
      }
      act(db, u.id).log.unshift({ ts: Date.now(), type: 'location', detail: on ? 'Turned location sharing on (' + l.label + ')' : 'Turned location sharing off' });
      return l;
    });

    /* ------------------------------------------------------------------ wallet bank account + loans */
    function openAccount(db, u, res, work, when) {
      const cm = ensure(db), n = String(Math.abs(X.hash(u.id + 'bank')) % 900000000 + 100000000);
      cm.accounts[u.id] = { userId: u.id, bank: 'SemaChat Trust Bank', accountNo: '01' + n, branch: (res && res.city) || 'Nanyuki', openedAt: when || Date.now(), status: 'active', residence: res, workAddress: work || '', recordHolders: ['SemaChat (developer)', 'SemaChat Trust Bank'] };
      return cm.accounts[u.id];
    }
    route('GET', /^\/api\/bank$/, 'user', null, c => {
      const cm = ensure(c.db), u = c.user, a = cm.accounts[u.id], k = u.kyc || {};
      return { active: !!a, account: a || null, designatedBank: 'SemaChat Trust Bank', requirements: u.role === 'user' ? [['Verified identity (National ID / Passport)', !!(u.idSubmitted || u.verified)], ['Age 18 or older', !u.minor], ['Residential address', !!((k.residence || {}).city && (k.residence || {}).area)], ['Work address', !!k.workAddress]] : [['Registered organisation', true]], prefill: { city: (k.residence || {}).city || '', area: (k.residence || {}).area || '', work: k.workAddress || '' } };
    });
    route('POST', /^\/api\/wallet\/activate$/, 'user', null, c => {
      const db = c.db, cm = ensure(db), u = c.user, b = c.body;
      if (cm.accounts[u.id]) return cm.accounts[u.id];
      if (u.minor) fail(403, 'Wallets are for adults. Ask your parent / guardian to use theirs.', { code: 'MINOR' });
      if (u.role === 'user' && !(u.idSubmitted || u.verified)) fail(403, 'Submit your National ID or Passport number first. The bank needs it to open your account.', { code: 'ID_REQUIRED' });
      const city = cut(b.city, 60), area = cut(b.area, 100), work = cut(b.workAddress, 120);
      if (u.role === 'user' && (!city || !area)) fail(400, 'Your residential address is required to activate the wallet.');
      if (u.role === 'user' && !work) fail(400, 'Your work address is required to activate the wallet.');
      if (!b.consent) fail(400, 'Please accept the bank account terms to continue.');
      u.kyc = Object.assign(u.kyc || { role: u.role }, { residence: { city: city || (u.kyc && u.kyc.residence && u.kyc.residence.city) || '', area: area || '' }, workAddress: work });
      const a = openAccount(db, u, u.kyc.residence, work);
      addTx(db, u.id, { type: 'in', title: 'Welcome to your SemaChat Trust Bank account', amount: 0, kind: 'bank' });
      notify(db, u.id, { type: 'payment', mode: 'normal', title: 'Bank account opened', body: 'Account ' + a.accountNo + ' with SemaChat Trust Bank is ready.' });
      audit(db, 'Wallet activated: ' + u.name + ' → bank account ' + a.accountNo);
      return a;
    });
    const loansOf = (db, id) => ensure(db).loans.filter(l => l.userId === id);
    function refreshLoan(l) {
      if (l.status === 'active' && l.balance > 0 && l.dueAt < Date.now()) {
        l.status = 'overdue'; const fee = Math.round(l.principal * 0.02); l.balance += fee; l.total += fee; l.ledger.push({ ts: Date.now(), type: 'late_fee', amount: fee, balance: l.balance });
      }
      return l;
    }
    function scoreOf(db, u) {
      const cm = ensure(db), w = wallet(db, u.id), f = [], ls = loansOf(db, u.id).map(refreshLoan);
      const add = (label, pts) => { f.push({ label, pts: Math.round(pts) }); return pts; };
      let s = add('Base', 30);
      s += add('Verified identity', (u.idSubmitted || u.verified) ? 10 : 0);
      s += add('Gold member', tierOf(u) === 'gold' ? 5 : 0);
      s += add('Account age', Math.min(20, (Date.now() - u.joined) / D / 12));
      s += add('Wallet activity', Math.min(20, w.tx.length));
      s += add('Wallet balance', w.balance >= 20000 ? 10 : w.balance >= 5000 ? 5 : 0);
      s += add('Loans repaid on time', Math.min(24, ls.filter(l => l.status === 'repaid' && !l.late).length * 8));
      s += add('Overdue loans', -25 * ls.filter(l => l.status === 'overdue').length);
      s += add('Guideline violations', -Math.min(20, 5 * (cm.violations[u.id] || []).length));
      const score = Math.max(0, Math.min(100, Math.round(s)));
      return { score, band: score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Building', factors: f.filter(x => x.pts !== 0) };
    }
    route('GET', /^\/api\/loans\/offers$/, 'user', null, c => {
      const db = c.db, cm = ensure(db), u = c.user, a = cm.accounts[u.id], sc = scoreOf(db, u), mine = loansOf(db, u.id).map(refreshLoan), owing = mine.filter(l => l.status !== 'repaid').reduce((n, l) => n + l.balance, 0);
      const offers = cm.lenders.map(l => { const cap = Math.floor(l.max * Math.min(1, sc.score / 80) / 500) * 500, avail = Math.max(0, Math.min(cap, l.max) - mine.filter(x => x.lenderId === l.id && x.status !== 'repaid').reduce((n, x) => n + x.principal, 0));
        return { id: l.id, kind: l.kind, name: l.name, tagline: l.tagline, vetted: l.vetted, licence: l.licence, monthlyRatePct: l.monthlyRatePct, terms: l.terms, minScore: l.minScore, max: l.max, available: sc.score >= l.minScore ? avail : 0, eligible: sc.score >= l.minScore && avail >= 500 }; });
      return { active: !!a, account: a || null, minor: !!u.minor, score: sc, owing, offers, loans: mine.slice().sort((x, y) => y.createdAt - x.createdAt).map(loanView) };
    });
    const loanView = l => ({ id: l.id, lender: l.lenderName, lenderId: l.lenderId, principal: l.principal, interest: l.interest, total: l.total, balance: l.balance, termDays: l.termDays, status: l.status, dueAt: l.dueAt, createdAt: l.createdAt, late: !!l.late, recordHolders: l.recordHolders, ledger: l.ledger });
    route('GET', /^\/api\/loans$/, 'user', null, c => loansOf(c.db, c.user.id).map(refreshLoan).sort((a, b) => b.createdAt - a.createdAt).map(loanView));
    route('POST', /^\/api\/loans\/apply$/, 'user', null, c => {
      const db = c.db, cm = ensure(db), u = c.user, b = c.body;
      if (!cm.accounts[u.id]) fail(403, 'Activate your wallet first. It opens your bank account.', { code: 'WALLET_NOT_ACTIVE' });
      if (u.minor) fail(403, 'Loans are for adults.');
      const ln = cm.lenders.find(x => x.id === b.lenderId); if (!ln) fail(404, 'Lender not found.');
      const amount = Math.round(+b.amount), term = +b.termDays; if (!(amount >= 500)) fail(400, 'The minimum loan is KES 500.'); if (!ln.terms.includes(term)) fail(400, 'Choose one of the available repayment periods.');
      const offer = (() => { const sc = scoreOf(db, u), cap = Math.floor(ln.max * Math.min(1, sc.score / 80) / 500) * 500; return { sc, avail: Math.max(0, Math.min(cap, ln.max) - loansOf(db, u.id).filter(x => x.lenderId === ln.id && x.status !== 'repaid').reduce((n, x) => n + x.principal, 0)) }; })();
      if (offer.sc.score < ln.minScore) fail(403, 'Your SemaChat Trust Score (' + offer.sc.score + ') is below ' + ln.name + "'s minimum of " + ln.minScore + '. Keep using your wallet and repaying on time to grow it.');
      if (amount > offer.avail) fail(403, 'You can borrow up to ' + kes(offer.avail) + ' from ' + ln.name + ' right now.');
      if (loansOf(db, u.id).some(l => refreshLoan(l).status === 'overdue')) fail(403, 'Clear your overdue loan before borrowing again.');
      const interest = Math.round(amount * ln.monthlyRatePct / 100 * term / 30), now = Date.now();
      const l = { id: uid('ln'), userId: u.id, lenderId: ln.id, lenderName: ln.name, principal: amount, interest, total: amount + interest, balance: amount + interest, termDays: term, status: 'active', createdAt: now, dueAt: now + term * D, late: false,
        recordHolders: ['SemaChat (developer)', ln.name], ledger: [{ ts: now, type: 'disbursed', amount, balance: amount + interest }] };
      cm.loans.push(l); wallet(db, u.id).balance += amount; addTx(db, u.id, { type: 'in', title: 'Loan from ' + ln.name, amount, kind: 'loan' });
      addRevenue(db, 'loan_referral', amount * 0.01, 'Referral fee • ' + ln.name);
      notify(db, u.id, { type: 'payment', mode: 'normal', title: 'Loan approved', body: kes(amount) + ' from ' + ln.name + ' is in your wallet. Repay ' + kes(l.total) + ' by ' + new Date(l.dueAt).toDateString() + '.' });
      return loanView(l);
    });
    route('POST', /^\/api\/loans\/([^/]+)\/repay$/, 'user', null, c => {
      const db = c.db, l = loansOf(db, c.user.id).find(x => x.id === c.p[0]); if (!l) fail(404, 'Loan not found.'); refreshLoan(l);
      if (l.status === 'repaid') fail(409, 'This loan is already repaid.');
      const amt = Math.min(l.balance, Math.round(+c.body.amount || l.balance)); if (!(amt > 0)) fail(400, 'Enter an amount to repay.');
      X.charge(db, c.user.id, amt, 'Loan repayment • ' + l.lenderName, 'normal', 'loan');
      l.balance -= amt; l.ledger.push({ ts: Date.now(), type: 'repayment', amount: amt, balance: l.balance });
      if (l.status === 'overdue') l.late = true;
      if (l.balance <= 0) { l.status = 'repaid'; l.repaidAt = Date.now(); if (l.dueAt < l.repaidAt) l.late = true; }
      return loanView(l);
    });
    route('POST', /^\/api\/loans\/([^/]+)\/age$/, 'user', null, c => { // demo helper: fast-forward the due date
      const l = loansOf(c.db, c.user.id).find(x => x.id === c.p[0]); if (!l) fail(404, 'Loan not found.'); l.dueAt -= Math.max(1, +c.body.days || l.termDays + 1) * D; return loanView(refreshLoan(l));
    });

    /* ------------------------------------------------------------------ safety: guardians, strikes, scanning */
    const RULES = {
      adult_content: /\b(nude|nudes|naked|porn\w*|xxx|sexting|sex tape|send (me )?(pics|photos)|horny)\b/i,
      stranger_meeting: /(let'?s meet|meet (me|up)|come alone|where do you live|which school|pick you up|don'?t tell (your )?(mum|mom|dad|parents|anyone)|our secret|secret between us|delete this chat)/i,
      risky_location: /\b(night ?club|club|bar|casino|betting|lodging|brewery|liquor|pub)\b/i,
      risky_activity: /\b(drugs?|weed|bhang|get drunk|drinking|dare you|shisha|vape|skip school|run away)\b/i
    };
    const riskyLabel = (cm, label) => { const l = String(label || '').toLowerCase(); return cm.riskyWords.some(w => new RegExp('\\b' + w + '\\b').test(l)); };
    // Pluggable detection: register an extra classifier (e.g. a moderation API) with core.compliance.addClassifier(fn).
    // fn(text) returns a list of category keys (adult_content, stranger_meeting, risky_location, risky_activity). It must be synchronous and fast.
    const EXT_CLASSIFIERS = [];
    core.compliance = { addClassifier: fn => { if (typeof fn === 'function') EXT_CLASSIFIERS.push(fn); }, classifiers: () => EXT_CLASSIFIERS.length };
    const classify = t => {
      const hits = Object.keys(RULES).filter(k => RULES[k].test(t));
      EXT_CLASSIFIERS.forEach(f => { try { (f(t) || []).forEach(k => { if (typeof k === 'string' && RULES[k] && !hits.includes(k)) hits.push(k); }); } catch (e) { /* a broken classifier must never block chat */ } });
      return hits;
    };
    const CAT = { adult_content: 'Adult content', stranger_meeting: 'Meeting a stranger / secrecy', risky_location: 'Risky location', risky_activity: 'Risky activity', location_off: 'Location sharing off' };
    function devNotice(db, kind, userId, msg) { const cm = ensure(db); cm.notices.unshift({ id: uid('dn_'), kind, userId, msg, ts: Date.now(), read: false }); cm.notices.length = Math.min(cm.notices.length, 100); audit(db, msg); }
    function minorAlert(db, minor, a) {
      const cm = ensure(db), g = minor.guardianId ? byId(db, minor.guardianId) : null;
      const rec = { id: uid('sa_'), minorId: minor.id, guardianId: g ? g.id : null, cat: a.cat, severity: a.severity || 'medium', direction: a.direction || 'info', withId: a.withId || null, withName: a.withName || '', stranger: !!a.stranger, text: a.text, excerpt: cut(a.excerpt, 140), chatId: a.chatId || null, ts: Date.now(), ack: false, devCopy: true };
      cm.alerts.unshift(rec); cm.alerts.length = Math.min(cm.alerts.length, 300);
      if (g) notify(db, g.id, { type: 'safety', mode: 'normal', title: '⚠️ Safety alert for ' + minor.name, body: a.text, urgent: rec.severity !== 'low', ctx: { alertId: rec.id } });
      return rec;
    }
    function strike(db, user, cat, excerpt, chatId) {
      const cm = ensure(db), l = cm.violations[user.id] || (cm.violations[user.id] = []);
      l.push({ ts: Date.now(), cat, excerpt: cut(excerpt, 120), chatId }); const n = l.length;
      if (n === 3) devNotice(db, 'strikes', user.id, user.name + ' has broken the community guidelines 3 times. Review for possible action.');
      else if (n > 3) devNotice(db, 'strikes', user.id, user.name + ' now has ' + n + ' community-guideline violations' + (user.minor ? ' (minor account: take-down recommended).' : '. Take-down recommended.'));
      if (user.minor && user.guardianId && n >= 1) notify(db, user.guardianId, { type: 'safety', mode: 'normal', title: 'Community guideline strike ' + n + ' for ' + user.name, body: 'After more than 3 violations SemaChat may remove the account.', urgent: n >= 3 });
    }
    core.onMessage((db, ch, m) => {
      const cm = ensure(db), s = byId(db, m.from); if (!real(s) || !ch.members) return;
      const others = ch.members.filter(id => id !== m.from).map(id => byId(db, id)).filter(real);
      const a = act(db, s.id); a.lastSeen = Date.now();
      others.forEach(o => { a.contacted[o.id] = (a.contacted[o.id] || 0) + 1; });
      if (m.type && m.type !== 'text') { a.shared.unshift({ ts: m.ts, type: m.type, label: (m.type === 'location' && m.meta ? '📍 ' + (m.meta.label || 'location') : m.type) + (others[0] ? ' → ' + others[0].name : '') }); a.shared.length = Math.min(a.shared.length, 40); }
      let txt = m.text || '', hits = classify(txt);
      if (m.type === 'location' && m.meta && riskyLabel(cm, m.meta.label)) { hits = hits.concat('risky_location'); txt = txt || 'Shared location: ' + m.meta.label; }
      if (!hits.length) return;
      if (hits.includes('adult_content') && !(s.minor && false)) strike(db, s, 'adult_content', txt, ch.id);
      const kids = [s].concat(others).filter(x => x.minor);
      kids.forEach(kid => {
        const other = kid.id === s.id ? others[0] : s, stranger = !!other && !friendsOf(db, kid.id).includes(other.id);
        hits.forEach(cat => minorAlert(db, kid, { cat, severity: (cat === 'adult_content' || (cat === 'stranger_meeting' && stranger)) ? 'high' : 'medium', direction: kid.id === s.id ? 'sent' : 'received', withId: other && other.id, withName: other ? other.name : '', stranger,
          text: CAT[cat] + ' ' + (kid.id === s.id ? 'in a message ' + kid.name + ' sent' : 'in a message ' + kid.name + ' received') + (other ? ' ' + (kid.id === s.id ? 'to ' : 'from ') + other.name : '') + (stranger ? ' (not a contact)' : '') + '.', excerpt: txt, chatId: ch.id }));
        if (hits.length && kid.id !== s.id && !hits.includes('adult_content')) { /* received risk: no strike for the minor */ }
        else if (kid.id === s.id && !hits.includes('adult_content')) strike(db, kid, hits[0], txt, ch.id);
      });
    });
    route('GET', /^\/api\/guardian$/, 'user', null, c => {
      const db = c.db, cm = ensure(db), ids = c.user.guardianOf || [];
      return { isGuardian: ids.length > 0, minors: ids.map(id => { const k = byId(db, id), l = cm.loc[id]; return { id, name: k.name, age: k.age, color: k.color, violations: (cm.violations[id] || []).length, location: l && l.on ? { label: l.label, lat: l.lat, lng: l.lng, ts: l.ts } : null, locationOn: !!(l && l.on), status: k.status }; }),
        alerts: cm.alerts.filter(a => a.guardianId === c.user.id).slice(0, 60).map(a => Object.assign({}, a, { minor: (byId(db, a.minorId) || {}).name, label: CAT[a.cat] })) };
    });
    route('POST', /^\/api\/guardian\/alerts\/([^/]+)\/ack$/, 'user', null, c => { const a = ensure(c.db).alerts.find(x => x.id === c.p[0] && x.guardianId === c.user.id); if (!a) fail(404, 'Alert not found.'); a.ack = true; return { ok: true }; });

    /* ------------------------------------------------------------------ activity + money surveillance (taps) */
    const LABEL = [[/^POST \/api\/chats\/[^/]+\/messages/, 'Sent a message'], [/^POST \/api\/moments$/, 'Posted a Moment'], [/^POST \/api\/posts/, 'Posted on AnA'], [/^POST \/api\/wallet\/topup/, 'Topped up wallet'], [/^POST \/api\/wallet\/(send|transfer)/, 'Sent money'],
      [/^POST \/api\/loans\/apply/, 'Took a loan'], [/^POST \/api\/loans\/[^/]+\/repay/, 'Repaid a loan'], [/^POST \/api\/biz\/pages\/[^/]+\/order/, 'Placed an order'], [/^POST \/api\/services\/book/, 'Made a booking'], [/^POST \/api\/calls/, 'Started a call'], [/^POST \/api\/location/, 'Changed location sharing'], [/^POST \/api\/wallet\/activate/, 'Activated wallet']];
    core.tap((c, method, path) => {
      const db = c.db, u = c.user, a = act(db, u.id), now = Date.now(); a.lastSeen = now;
      if (method !== 'GET') { const k = method + ' ' + path, hit = LABEL.find(x => x[0].test(k)); if (hit) { a.lastAction = hit[1]; a.log.unshift({ ts: now, type: 'action', detail: hit[1] }); a.log.length = Math.min(a.log.length, 40); } }
      scanMoney(db, u);
    });
    function aml(db, user, rule, title, detail, amount, key) {
      const cm = ensure(db); if (cm.aml.some(x => x.key === key)) return;
      cm.aml.unshift({ id: uid('aml_'), key, userId: user.id, rule, title, detail, amount: Math.round(amount || 0), ts: Date.now(), status: 'open', law: 'POCAMLA / CBK guidance (demo rules)' });
      cm.aml.length = Math.min(cm.aml.length, 200); devNotice(db, 'aml', user.id, 'Money alert: ' + title + ' • ' + user.name);
    }
    function scanMoney(db, user) {
      const cm = ensure(db), tx = wallet(db, user.id).tx; if (!tx.length || cm.txScan[user.id] === tx[0].id) return; cm.txScan[user.id] = tx[0].id;
      const T = cm.thresholds, now = Date.now(), day = tx.filter(t => now - t.ts < D), hour = tx.filter(t => now - t.ts < H);
      const big = tx.slice(0, 5).find(t => t.amount >= T.largeTx); if (big) aml(db, user, 'large', 'Large transaction ' + kes(big.amount), big.title + ' • threshold ' + kes(T.largeTx), big.amount, 'large:' + big.id);
      if (hour.length >= T.velocityPerHour) aml(db, user, 'velocity', hour.length + ' transactions in one hour', 'More than ' + (T.velocityPerHour - 1) + ' wallet movements within 60 minutes.', hour.reduce((n, t) => n + t.amount, 0), 'vel:' + user.id + ':' + Math.floor(now / H));
      const near = day.filter(t => t.amount >= T.largeTx * 0.8 && t.amount < T.largeTx); if (near.length >= 3) aml(db, user, 'structuring', 'Possible structuring', near.length + ' transactions just under the ' + kes(T.largeTx) + ' threshold in 24 hours.', near.reduce((n, t) => n + t.amount, 0), 'str:' + user.id + ':' + Math.floor(now / D));
      const inn = hour.filter(t => t.type === 'in').reduce((n, t) => n + t.amount, 0), out = hour.filter(t => t.type === 'out').reduce((n, t) => n + t.amount, 0);
      if (inn >= T.passThroughMin && out >= inn * 0.9) aml(db, user, 'pass_through', 'Money in and straight out', kes(inn) + ' received and ' + kes(out) + ' sent within an hour.', out, 'pass:' + user.id + ':' + Math.floor(now / H));
      const moved = day.reduce((n, t) => n + t.amount, 0); if (!(user.idSubmitted || user.verified) && moved >= T.unverifiedDay) aml(db, user, 'unverified', 'Unverified account moving money', kes(moved) + ' moved in 24 hours without a submitted ID.', moved, 'unv:' + user.id + ':' + Math.floor(now / D));
    }

    /* ------------------------------------------------------------------ admin */
    const ageGroup = u => u.minor ? 'minor' : 'adult';
    function personRow(db, u) {
      const cm = ensure(db), a = cm.act[u.id] || {}, k = u.kyc || {}, g = u.guardianId ? byId(db, u.guardianId) : null, seen = Math.max(a.lastSeen || 0, db.seen[u.id] || 0);
      return { id: u.id, name: u.name, phone: u.phone, role: u.role, status: u.status, tier: tierOf(u), gender: k.gender || null, age: u.age || k.age || null, ageGroup: ageGroup(u), city: (k.residence || {}).city || '', area: (k.residence || {}).area || '',
        guardian: g ? { id: g.id, name: g.name, relation: u.guardianRelation || 'Parent' } : null, minorsCount: (u.guardianOf || []).length, lastSeen: seen || null, lastAction: a.lastAction || '', violations: (cm.violations[u.id] || []).length,
        walletActive: !!cm.accounts[u.id], openAlerts: cm.alerts.filter(x => x.minorId === u.id && !x.ack).length };
    }
    route('GET', /^\/api\/admin\/people$/, 'admin', null, c => {
      const db = c.db, q = String(c.query.q || '').toLowerCase(), f = c.query;
      ensure(db); return db.users.filter(real).map(u => personRow(db, u)).filter(r => (!q || (r.name + r.phone + r.city).toLowerCase().includes(q)) && (!f.gender || r.gender === f.gender) && (!f.age || r.ageGroup === f.age) && (!f.tier || r.tier === f.tier)).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
    });
    route('GET', /^\/api\/admin\/people\/([^/]+)$/, 'admin', null, c => {
      const db = c.db, cm = ensure(db), u = byId(db, c.p[0]); if (!real(u)) fail(404, 'User not found.'); const a = act(db, u.id), l = cm.loc[u.id];
      return Object.assign(personRow(db, u), { kyc: Object.assign({}, u.kyc || {}), joined: u.joined, log: a.log.slice(0, 20), contacted: Object.keys(a.contacted).map(id => ({ id, name: (byId(db, id) || {}).name || id, count: a.contacted[id] })).sort((x, y) => y.count - x.count).slice(0, 10), shared: a.shared.slice(0, 15),
        violationList: cm.violations[u.id] || [], alerts: cm.alerts.filter(x => x.minorId === u.id).slice(0, 10).map(x => Object.assign({}, x, { label: CAT[x.cat] })), loans: loansOf(db, u.id).map(loanView), account: cm.accounts[u.id] || null, location: l && l.on ? l : null,
        minors: (u.guardianOf || []).map(id => ({ id, name: (byId(db, id) || {}).name })) });
    });
    route('GET', /^\/api\/admin\/safety$/, 'admin', null, c => {
      const db = c.db, cm = ensure(db), per = {};
      Object.keys(cm.violations).forEach(id => { const u = byId(db, id); if (u) per[id] = { id, name: u.name, minor: !!u.minor, status: u.status, strikes: cm.violations[id].length, last: cm.violations[id].slice(-1)[0] }; });
      return { alerts: cm.alerts.slice(0, 80).map(a => Object.assign({}, a, { minor: (byId(db, a.minorId) || {}).name, guardian: (byId(db, a.guardianId) || {}).name || '—', label: CAT[a.cat] })), strikes: Object.values(per).sort((a, b) => b.strikes - a.strikes), notices: cm.notices.filter(n => n.kind === 'strikes').slice(0, 20),
        minors: db.users.filter(u => u.minor).map(u => personRow(db, u)), rules: Object.keys(RULES).map(k => ({ cat: k, label: CAT[k] })) };
    });
    route('POST', /^\/api\/admin\/safety\/user\/([^/]+)$/, 'admin', null, c => {
      const db = c.db, u = byId(db, c.p[0]); if (!real(u)) fail(404, 'User not found.'); const act2 = c.body.action;
      if (act2 === 'takedown') { u.status = 'suspended'; audit(db, 'Account pulled down for safety: ' + u.name); if (u.guardianId) notify(db, u.guardianId, { type: 'safety', mode: 'normal', title: u.name + "'s account was paused", body: 'SemaChat paused the account after repeated community guideline violations.', urgent: true }); }
      else if (act2 === 'restore') { u.status = 'active'; audit(db, 'Account restored: ' + u.name); }
      else if (act2 === 'clear') { ensure(db).violations[u.id] = []; audit(db, 'Violations cleared: ' + u.name); }
      else fail(400, 'Unknown action.'); return personRow(db, u);
    });
    route('GET', /^\/api\/admin\/aml$/, 'admin', null, c => { const db = c.db, cm = ensure(db); return { thresholds: cm.thresholds, alerts: cm.aml.map(a => Object.assign({}, a, { user: (byId(db, a.userId) || {}).name })), open: cm.aml.filter(a => a.status === 'open').length }; });
    route('POST', /^\/api\/admin\/aml\/thresholds$/, 'admin', null, c => { const T = ensure(c.db).thresholds; if (+c.body.largeTx > 0) T.largeTx = Math.round(+c.body.largeTx); audit(c.db, 'Money-alert threshold set to ' + kes(T.largeTx)); return T; });
    route('POST', /^\/api\/admin\/aml\/([^/]+)$/, 'admin', null, c => {
      const db = c.db, a = ensure(db).aml.find(x => x.id === c.p[0]); if (!a) fail(404, 'Alert not found.'); const act2 = c.body.action, u = byId(db, a.userId);
      if (act2 === 'review') a.status = 'reviewed'; else if (act2 === 'escalate') { a.status = 'escalated'; audit(db, 'Money alert escalated to the Financial Reporting Centre (demo): ' + (u || {}).name); }
      else if (act2 === 'suspend') { a.status = 'escalated'; if (u) u.status = 'suspended'; audit(db, 'Account suspended after a money alert: ' + (u || {}).name); } else fail(400, 'Unknown action.'); return a;
    });
    route('GET', /^\/api\/admin\/lending$/, 'admin', null, c => {
      const db = c.db, cm = ensure(db), ls = cm.loans.map(refreshLoan);
      return { accounts: Object.values(cm.accounts).map(a => Object.assign({}, a, { user: (byId(db, a.userId) || {}).name, balance: wallet(db, a.userId).balance })),
        loans: ls.slice().sort((a, b) => b.createdAt - a.createdAt).map(l => Object.assign(loanView(l), { user: (byId(db, l.userId) || {}).name, score: scoreOf(db, byId(db, l.userId)).score })),
        totals: { disbursed: ls.reduce((n, l) => n + l.principal, 0), outstanding: ls.filter(l => l.status !== 'repaid').reduce((n, l) => n + l.balance, 0), overdue: ls.filter(l => l.status === 'overdue').length, accounts: Object.keys(cm.accounts).length }, lenders: cm.lenders };
    });
    route('POST', /^\/api\/admin\/compliance\/demo$/, 'admin', null, c => {
      const db = c.db, cm = ensure(db), z = byId(db, 'u_zawadi'), bar = byId(db, 'u_baraka'), me = byId(db, 'u_me'); if (!z || !bar) fail(404, 'Demo users missing.');
      let ch = db.chats.find(x => x.type === 'direct' && x.members.includes('u_zawadi') && x.members.includes('u_baraka'));
      if (!ch) { ch = { id: uid('ch_'), type: 'direct', name: '', members: ['u_baraka', 'u_zawadi'], read: {} }; db.chats.push(ch); }
      pushMessage(db, ch, 'u_baraka', 'text', "hey zawadi, where do you live? don't tell your parents, let's meet at the club tonight");
      pushMessage(db, ch, 'u_zawadi', 'text', 'ok maybe, send me the location of the club');
      cm.loc.u_zawadi = { on: true, lat: 0.0191, lng: 37.0771, label: 'Nightclub strip', ts: Date.now() }; minorAlert(db, z, { cat: 'risky_location', severity: 'high', direction: 'location', text: z.name + ' is near a place flagged as risky: Nightclub strip (demo).' });
      const w = wallet(db, 'u_me'); [95000, 92000, 99000].forEach((n, i) => { w.balance += n; addTx(db, 'u_me', { type: 'out', title: 'Transfer to unknown recipient ' + (i + 1), amount: n, kind: 'payment' }); });
      cm.txScan.u_me = null; scanMoney(db, me);
      return { alerts: cm.alerts.length, aml: cm.aml.length };
    });

    /* ------------------------------------------------------------------ audited developer access */
    // Every developer-dashboard request is recorded; requests that open personal data are flagged as sensitive.
    const SENSITIVE = /\/(people|donations|identity|kyc|loans|bank|safety|guardian|users|aml|moments|disputes|access-log|consent|providers|guard)/;
    const norm = p => String(p).split('?')[0].replace(/\/(?:[a-z]{1,3}_[a-z0-9]+|(?=[a-z0-9]*\d)[a-z0-9]{6,})(?=\/|$)/gi, '/:id');
    core.hooks.adminAccess = (db, method, path) => {
      const cm = ensure(db), what = norm(path); if (/\/api\/admin\/(stats|overview)$/.test(what)) return;
      const last = cm.access[0], now = Date.now();
      if (last && last.what === what && last.method === method && now - last.ts < 30000) { last.n++; return; }   // collapse repeats
      cm.access.unshift({ id: uid('ac_'), ts: now, method, what, sensitive: SENSITIVE.test(what), n: 1 }); cm.access.length = Math.min(cm.access.length, 1000);
    };
    route('GET', /^\/api\/admin\/access-log$/, 'admin', null, c => {
      const cm = ensure(c.db), users = c.db.users.filter(u => u.role !== 'system');
      const cons = users.filter(u => u.consent && u.consent.terms && u.consent.privacy).length;
      return { entries: cm.access.slice(0, 200), sensitive: cm.access.filter(a => a.sensitive).length, total: cm.access.length,
        consent: { recorded: cons, ofUsers: users.length, version: '2026-10', note: 'Demo and seeded accounts pre-date the consent screen; every new sign-up records it.' }, classifiers: { builtIn: Object.keys(RULES).length, external: EXT_CLASSIFIERS.length } };
    });
    route('GET', /^\/api\/admin\/consent\/([^/]+)$/, 'admin', null, c => { const u = byId(c.db, c.p[0]); if (!u) fail(404, 'No such user.'); return { userId: u.id, name: u.name, consent: u.consent || null }; });
  });
});
