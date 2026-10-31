/* SemaChat — Community add-on: DIRA TECH apps, Donations (double verification), "On the move!" quick adverts.
 * Works in Node (require('./community')(core)) and in the browser preview (after core.js).
 */
(function (root, install) {
  if (typeof module === 'object' && module.exports) module.exports = install;
  else install(root.SemaChatCore);
})(typeof self !== 'undefined' ? self : this, function install(core) {
  /* ---- On the move! pricing (pure, exported for tests) ---- */
  const TOWNS = [ // [name, lat, lng, premium]
    ['Nairobi', -1.2864, 36.8172, 1], ['Kisumu', -0.0917, 34.768, 1], ['Nakuru', -0.3031, 36.08, 1], ['Mombasa', -4.0435, 39.6682, 1], ['Eldoret', 0.5143, 35.2698, 1],
    ['Nanyuki', 0.0167, 37.0722, 0], ['Thika', -1.0332, 37.0693, 0], ['Nyeri', -0.4201, 36.9476, 0], ['Meru', 0.047, 37.649, 0], ['Embu', -0.5388, 37.4596, 0], ['Machakos', -1.5177, 37.2634, 0],
    ['Kakamega', 0.2827, 34.7519, 0], ['Kisii', -0.6817, 34.7667, 0], ['Kitale', 1.0157, 35.0062, 0], ['Naivasha', -0.7172, 36.431, 0], ['Malindi', -3.2192, 40.1169, 0], ['Garissa', -0.4532, 39.6461, 0], ['Iten', 0.6703, 35.5081, 0], ['Kericho', -0.3689, 35.2863, 0], ['Narok', -1.0783, 35.8601, 0]
  ];
  const km = (a, b, c, d) => { const R = 6371, r = x => x * Math.PI / 180, dl = r(c - a), dg = r(d - b), x = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  function nearestTown(lat, lng) {
    let best = null; TOWNS.forEach(t => { const d = km(lat, lng, t[1], t[2]); if (!best || d < best.d) best = { name: t[0], premium: !!t[3], d }; });
    // within 35 km of a listed town it counts as that town; otherwise it is "another town" at the standard rate
    return best && best.d <= 35 ? best : { name: 'Other town', premium: false, d: best ? best.d : 0 };
  }
  const OTM_DEFAULT = { premiumRate: 100, otherRate: 50, unitSqm: 50, hours: 3, minSqm: 50, maxSqm: 1000000 };
  function quote(sqm, town, cfg) {
    cfg = cfg || OTM_DEFAULT; const s = Number(sqm); if (!isFinite(s) || s < cfg.minSqm || s > cfg.maxSqm) { const e = new Error('Area must be between ' + cfg.minSqm + ' and ' + cfg.maxSqm.toLocaleString('en-KE') + ' square metres.'); e.bad = true; throw e; }
    const units = Math.ceil(s / cfg.unitSqm), rate = town.premium ? cfg.premiumRate : cfg.otherRate;
    return { sqm: s, units, rate, cost: units * rate, town: town.name, premium: !!town.premium, rule: town.premium ? 'KES ' + cfg.premiumRate + ' per ' + cfg.unitSqm + ' sq m' : 'KES ' + cfg.otherRate + ' per ' + cfg.unitSqm + ' sq m', radiusM: Math.round(Math.sqrt(s / Math.PI)), hours: cfg.hours };
  }
  core.community = { TOWNS, nearestTown, quote, km };
  core.otmTowns = TOWNS.map(t => [t[0], t[1], t[2]]);

  const CHECKLIST = [
    { key: 'nationalId', label: 'National ID card of the uploader', hint: 'Your National ID number (7–9 digits)' },
    { key: 'fullName', label: 'Full name', hint: 'First and last name, exactly as on the ID' },
    { key: 'idSelfie', label: 'Selfie with ID held in the hand across the face', hint: 'Hold the ID next to your face so both are clear' },
    { key: 'address', label: 'Location address', hint: 'Town, area and a landmark' },
    { key: 'media', label: 'Video or photos of the situation', hint: 'At least one photo or a short video (up to 6)' },
    { key: 'description', label: 'Summarized description', hint: '20–600 characters: what happened and what the money is for' },
    { key: 'amount', label: 'Amount needed in KES', hint: 'Between KES 500 and KES 5,000,000' },
    { key: 'deadline', label: 'Deadline', hint: 'A date within the next 180 days' }
  ];

  core.use(function (X) {
    'use strict';
    const { route, uid, fail, byId, wallet, addTx, charge, addRevenue, notify, audit, logEvent, pub, D, H } = X;
    const kes = n => 'KES ' + Math.round(n).toLocaleString('en-KE');
    const clamp = (s, n) => String(s == null ? '' : s).slice(0, n);
    const isImg = s => typeof s === 'string' && /^data:image\//.test(s) && s.length < 3e6;

    /* ================================================================ DIRA TECH apps */
    function dira(db) {
      if (db.dira) return db.dira;
      const mk = (id, name, blurb, emoji, scheme, store) => ({ id, name, blurb, emoji, scheme, storeUrl: store, enabled: false });
      return (db.dira = { footer: 'DIRA TECH | Spiker Group Company', apps: [
        mk('comrades', 'COMRADES / COLLEGIATE', 'Campus life & student network', '🎓', 'comrades://open', 'https://play.google.com/store/apps/details?id=tech.dira.comrades'),
        mk('meeting', 'DIRA Meeting', 'Video meetings', '📹', 'dirameeting://open', 'https://play.google.com/store/apps/details?id=tech.dira.meeting'),
        mk('tracker', 'Tracker', 'Track people, assets & trips', '📍', 'diratracker://open', 'https://play.google.com/store/apps/details?id=tech.dira.tracker'),
        mk('pingsat', 'PINGsat', 'Satellite-ping messaging', '🛰️', 'pingsat://open', 'https://play.google.com/store/apps/details?id=tech.dira.pingsat'),
        mk('pamoja', 'PAMOJA', 'Community & chama savings', '🤝', 'pamoja://open', 'https://play.google.com/store/apps/details?id=tech.dira.pamoja'),
        mk('workmate', 'WORKMATE', 'Teams & work management', '💼', 'workmate://open', 'https://play.google.com/store/apps/details?id=tech.dira.workmate'),
        mk('countygrid', 'COUNTYgrid', 'County services & data', '🗺️', 'countygrid://open', 'https://play.google.com/store/apps/details?id=tech.dira.countygrid')
      ] });
    }
    const appView = a => ({ id: a.id, name: a.name, blurb: a.blurb, emoji: a.emoji, scheme: a.scheme, storeUrl: a.storeUrl });
    // clients always get the footnote; the apps are returned only once the developer has switched them on
    route('GET', /^\/api\/dira$/, 'user', null, c => { const d = dira(c.db); return { footer: d.footer, apps: d.apps.filter(a => a.enabled).map(appView) }; });
    route('GET', /^\/api\/admin\/dira$/, 'admin', null, c => { const d = dira(c.db); return { footer: d.footer, apps: d.apps.map(a => Object.assign(appView(a), { enabled: a.enabled })) }; });
    route('PUT', /^\/api\/admin\/dira\/([a-z]+)$/, 'admin', null, c => {
      const a = dira(c.db).apps.find(x => x.id === c.p[0]); if (!a) fail(404, 'App not found.'); const b = c.body;
      if (typeof b.enabled === 'boolean') a.enabled = b.enabled;
      ['name', 'blurb', 'scheme', 'storeUrl'].forEach(k => { if (typeof b[k] === 'string' && b[k].trim()) a[k] = b[k].trim().slice(0, 200); });
      if (a.storeUrl && !/^https?:\/\//i.test(a.storeUrl)) a.storeUrl = 'https://' + a.storeUrl;
      audit(c.db, 'DIRA TECH app “' + a.name + '” ' + (a.enabled ? 'ACTIVATED for clients' : 'hidden from clients')); return Object.assign(appView(a), { enabled: a.enabled });
    });
    route('POST', /^\/api\/admin\/dira$/, 'admin', null, c => { const d = dira(c.db); if (typeof c.body.enabled === 'boolean') d.apps.forEach(a => a.enabled = c.body.enabled); audit(c.db, 'All DIRA TECH apps ' + (c.body.enabled ? 'activated' : 'hidden')); return { ok: true, enabled: d.apps.filter(a => a.enabled).length }; });

    /* ================================================================ Donations (double verification) */
    const G = { med: ['#c53030', '#744210'], home: ['#2b6cb0', '#553c9a'], school: ['#38a169', '#2c5282'], farm: ['#dd6b20', '#744210'] };
    function don(db) {
      if (db.don) return db.don;
      const now = Date.now(), d = db.don = { campaigns: [] };
      const seeded = (userId, title, name, address, desc, amount, raised, emoji, g, days, status, ver) => d.campaigns.push({ id: uid('dn_'), userId, title, docs: { nationalId: String(20000000 + Math.abs(X.hash(title)) % 9000000), idSelfie: null }, fullName: name, address, description: desc, amount, deadline: now + days * D, media: [{ type: 'image', emoji, g }],
        status, createdAt: now - 6 * D, raised, donors: raised ? [{ userId: 'u_wanjiru', amount: Math.min(raised, 1000), ts: now - 2 * D }, { userId: 'u_otieno', amount: 500, ts: now - D, anonymous: true }] : [], seed: true, verify: ver });
      const okDocs = { ok: true, note: 'Documents match the ID.', ts: now - 5 * D }, okField = m => ({ ok: true, method: m, when: now - 3 * D, note: 'Situation confirmed.', ts: now - 3 * D });
      seeded('u_juma', 'Rebuild my kiosk after the fire', 'Juma Barasa', 'Kondele, Kisumu', 'A fire destroyed my food kiosk, cooker and stock. I need money for a cooker, utensils and two weeks of stock so I can feed my three children again.', 85000, 31200, '🔥', G.home, 25, 'live', { docs: okDocs, field: okField('visit') });
      seeded('u_neema', 'Surgery for my daughter', 'Neema Wekesa', 'Kibera, Nairobi', 'My 7-year-old daughter needs a hernia operation at Kenyatta National Hospital. The hospital quote is the amount below.', 120000, 64500, '🏥', G.med, 14, 'live', { docs: okDocs, field: okField('video') });
      seeded('u_zawadi', 'School fees to finish Form 4', 'Zawadi Mwangi', 'Nanyuki, Laikipia', 'I lost my father in March and my mother cannot afford my last-year fees. I am top of my class and want to sit KCSE this year.', 38000, 9000, '📚', G.school, 40, 'live', { docs: okDocs, field: okField('visit') });
      seeded('u_kiprono', 'Seeds after the drought', 'Kiprono Koech', 'Iten, Elgeyo Marakwet', 'Our maize failed in the drought. Seeds and fertiliser would let six neighbouring families replant before the rains.', 45000, 0, '🌽', G.farm, 30, 'awaiting_field', { docs: okDocs, field: { ok: null, method: 'video', when: now + 2 * D } });
      seeded('u_otieno', 'Boat engine repair', 'Otieno Odhiambo', 'Dunga Beach, Kisumu', 'My fishing boat engine failed; repairs are needed so I can return to work.', 52000, 0, '🛶', G.home, 20, 'pending_docs', { docs: null, field: null });
      return d;
    }
    function tick(c) { if (c.status === 'live' && c.deadline < Date.now()) c.status = 'ended'; if (c.status === 'live' && c.raised >= c.amount) c.status = 'funded'; return c; }
    const media = m => ({ type: m.type, emoji: m.emoji, g: m.g, data: m.data, thumb: m.thumb, durationSec: m.durationSec, name: m.name });
    const steps = c => ({ docs: !c.verify.docs ? 'waiting' : c.verify.docs.ok ? 'passed' : 'failed', field: !c.verify.field ? 'waiting' : c.verify.field.ok === true ? 'passed' : c.verify.field.ok === false ? 'failed' : 'scheduled' });
    function view(db, c, viewer) {
      const u = byId(db, c.userId);
      return { id: c.id, title: c.title, fullName: c.fullName, address: c.address, description: c.description, amount: c.amount, raised: c.raised, pct: Math.min(100, Math.round(c.raised / c.amount * 100)), deadline: c.deadline, status: c.status, media: c.media.map(media), donorCount: c.donors.length,
        recent: c.donors.slice(-5).reverse().map(d => ({ name: d.anonymous ? 'A kind giver' : (byId(db, d.userId) || { name: 'Someone' }).name.split(' ')[0], amount: d.amount, ts: d.ts })), owner: { id: c.userId, name: u ? u.name : '' },
        steps: steps(c), fieldPlan: c.verify.field && c.verify.field.when ? { method: c.verify.field.method, when: c.verify.field.when } : null, createdAt: c.createdAt };
    }
    const missing = b => {
      const m = [], d = b || {};
      if (!/^\d{7,9}$/.test(String(d.nationalId || '').replace(/\s/g, ''))) m.push('nationalId');
      if (clamp(d.fullName, 80).trim().split(/\s+/).filter(Boolean).length < 2) m.push('fullName');
      if (!isImg(d.idSelfie)) m.push('idSelfie');
      if (clamp(d.address, 200).trim().length < 5) m.push('address');
      const ms = Array.isArray(d.media) ? d.media : [];
      if (!ms.length || ms.length > 6 || !ms.every(x => x && ((x.type === 'image' && isImg(x.data)) || (x.type === 'video' && (x.thumb ? isImg(x.thumb) : true) && clamp(x.name, 80))))) m.push('media');
      const ds = clamp(d.description, 700).trim(); if (ds.length < 20 || ds.length > 600) m.push('description');
      const a = Number(d.amount); if (!isFinite(a) || a < 500 || a > 5e6) m.push('amount');
      const dl = Number(d.deadline); if (!isFinite(dl) || dl < Date.now() + 12 * H || dl > Date.now() + 181 * D) m.push('deadline');
      return m;
    };
    route('GET', /^\/api\/donations\/checklist$/, 'user', 'donations', c => ({ items: CHECKLIST, flow: ['Submit the verification documents', 'Check 1: SemaChat reviews the documents', 'Check 2: SemaChat visits you, or holds a video call', 'Your campaign goes live'] }));
    route('GET', /^\/api\/donations$/, 'user', 'donations', c => {
      const d = don(c.db); d.campaigns.forEach(tick);
      if (c.query.mine) return d.campaigns.filter(x => x.userId === c.user.id).sort((a, b) => b.createdAt - a.createdAt).map(x => view(c.db, x, c.user));
      return d.campaigns.filter(x => x.status === 'live').sort((a, b) => a.deadline - b.deadline).map(x => view(c.db, x, c.user));
    });
    route('POST', /^\/api\/donations$/, 'user', 'donations', c => {
      const b = c.body || {}, m = missing(b);
      if (m.length) fail(400, 'Complete the whole verification list before submitting.', { missing: m });
      if (!b.confirmTruth) fail(400, 'Please confirm that everything you submitted is true.');
      if (c.user.minor) fail(403, 'Campaigns must be started by an adult (18+) with a National ID.');
      const d = don(c.db); if (d.campaigns.filter(x => x.userId === c.user.id && ['pending_docs', 'awaiting_field', 'live'].includes(x.status)).length >= 2) fail(409, 'You already have two open campaigns. Wait for one to finish.');
      const camp = { id: uid('dn_'), userId: c.user.id, title: clamp(b.title || 'Help me get a second chance', 70).trim(), docs: { nationalId: String(b.nationalId).replace(/\s/g, ''), idSelfie: b.idSelfie }, fullName: clamp(b.fullName, 80).trim(), address: clamp(b.address, 200).trim(), description: clamp(b.description, 600).trim(), amount: Math.round(Number(b.amount)), deadline: Number(b.deadline),
        media: b.media.map(x => x.type === 'image' ? { type: 'image', data: x.data, name: clamp(x.name, 80) } : { type: 'video', thumb: x.thumb || null, name: clamp(x.name, 80), durationSec: Math.round(Number(x.durationSec) || 0), sizeKb: Number(x.sizeKb) || 0 }), status: 'pending_docs', createdAt: Date.now(), raised: 0, donors: [], verify: { docs: null, field: null } };
      d.campaigns.push(camp); logEvent(c.db, 'donation_submitted', c.user.id, { id: camp.id });
      notify(c.db, c.user.id, { type: 'donation', mode: 'normal', title: 'Campaign received', body: 'Step 1 of 2: the SemaChat team will review your documents, then visit you or call you on video.' });
      return view(c.db, camp, c.user);
    });
    route('GET', /^\/api\/donations\/(dn_[a-z0-9]+)$/, 'user', 'donations', c => { const x = don(c.db).campaigns.find(k => k.id === c.p[0]); if (!x) fail(404, 'Campaign not found.'); tick(x); if (x.userId !== c.user.id && !['live', 'funded', 'ended'].includes(x.status)) fail(404, 'Campaign not found.'); return view(c.db, x, c.user); });
    route('POST', /^\/api\/donations\/(dn_[a-z0-9]+)\/give$/, 'user', 'donations', c => {
      const x = don(c.db).campaigns.find(k => k.id === c.p[0]); if (!x) fail(404, 'Campaign not found.'); tick(x);
      if (x.status !== 'live') fail(409, 'This campaign is not open for donations.'); if (x.userId === c.user.id) fail(400, 'You cannot donate to your own campaign.');
      const a = Math.round(Number(c.body.amount)); if (!isFinite(a) || a < 10) fail(400, 'The smallest donation is KES 10.'); const left = x.amount - x.raised; if (a > left && left >= 10) fail(400, 'Only ' + kes(left) + ' is still needed.');
      charge(c.db, c.user.id, a, 'Donation: ' + x.title, 'normal', 'donation');   // SemaChat takes no fee: 100% reaches the beneficiary
      wallet(c.db, x.userId).balance += a; addTx(c.db, x.userId, { type: 'in', title: 'Donation from ' + (c.body.anonymous ? 'a kind giver' : c.user.name.split(' ')[0]), amount: a, mode: 'normal', kind: 'donation' });
      x.raised += a; x.donors.push({ userId: c.user.id, amount: a, ts: Date.now(), anonymous: !!c.body.anonymous }); tick(x);
      notify(c.db, x.userId, { type: 'donation', mode: 'normal', title: '💛 New donation', body: (c.body.anonymous ? 'Someone' : c.user.name.split(' ')[0]) + ' gave ' + kes(a) + ' to “' + x.title + '”.' });
      return { ok: true, campaign: view(c.db, x, c.user), balance: wallet(c.db, c.user.id).balance };
    });
    route('POST', /^\/api\/donations\/(dn_[a-z0-9]+)\/close$/, 'user', 'donations', c => { const x = don(c.db).campaigns.find(k => k.id === c.p[0]); if (!x || x.userId !== c.user.id) fail(404, 'Campaign not found.'); if (!['live', 'pending_docs', 'awaiting_field'].includes(x.status)) fail(409, 'This campaign is already closed.'); x.status = 'closed'; return view(c.db, x, c.user); });
    // ---- admin: both checks must pass before a campaign goes live
    const aView = (db, x) => Object.assign(view(db, x, { id: '' }), { docs: x.docs, verify: { docs: x.verify.docs, field: x.verify.field } });
    route('GET', /^\/api\/admin\/donations$/, 'admin', null, c => { const d = don(c.db); d.campaigns.forEach(tick); return { campaigns: d.campaigns.slice().sort((a, b) => b.createdAt - a.createdAt).map(x => aView(c.db, x)), stats: { pending: d.campaigns.filter(x => x.status === 'pending_docs').length, awaiting: d.campaigns.filter(x => x.status === 'awaiting_field').length, live: d.campaigns.filter(x => x.status === 'live').length, raised: d.campaigns.reduce((n, x) => n + x.raised, 0) } }; });
    const find = c => { const x = don(c.db).campaigns.find(k => k.id === c.p[0]); if (!x) fail(404, 'Campaign not found.'); return x; };
    route('POST', /^\/api\/admin\/donations\/(dn_[a-z0-9]+)\/docs$/, 'admin', null, c => {
      const x = find(c); if (x.status !== 'pending_docs') fail(409, 'The documents were already reviewed.'); const ok = !!c.body.approve;
      x.verify.docs = { ok, note: clamp(c.body.note, 200), ts: Date.now() };
      if (ok) { x.status = 'awaiting_field'; notify(c.db, x.userId, { type: 'donation', mode: 'normal', title: 'Check 1 passed ✅', body: 'Your documents are approved. The SemaChat team will now visit you or call on video to confirm.' }); }
      else { x.status = 'rejected'; notify(c.db, x.userId, { type: 'donation', mode: 'normal', title: 'Campaign not approved', body: x.verify.docs.note || 'We could not verify your documents.' }); }
      audit(c.db, 'Donation “' + x.title + '”: documents ' + (ok ? 'APPROVED' : 'REJECTED')); return aView(c.db, x);
    });
    route('POST', /^\/api\/admin\/donations\/(dn_[a-z0-9]+)\/schedule$/, 'admin', null, c => {
      const x = find(c); if (x.status !== 'awaiting_field') fail(409, 'Approve the documents first.'); const method = c.body.method === 'video' ? 'video' : 'visit', when = Number(c.body.when) || Date.now() + 2 * D;
      x.verify.field = { ok: null, method, when };
      notify(c.db, x.userId, { type: 'donation', mode: 'normal', title: method === 'visit' ? 'Visit scheduled' : 'Video call scheduled', body: 'The SemaChat team will ' + (method === 'visit' ? 'visit you' : 'call you on video') + ' on ' + new Date(when).toDateString() + '.' }); return aView(c.db, x);
    });
    route('POST', /^\/api\/admin\/donations\/(dn_[a-z0-9]+)\/field$/, 'admin', null, c => {
      const x = find(c); if (x.status !== 'awaiting_field') fail(409, 'Check 1 (documents) must pass first.'); if (!x.verify.field) fail(409, 'Schedule the visit or video call first.');
      const ok = !!c.body.ok; x.verify.field = Object.assign(x.verify.field, { ok, ts: Date.now() });
      if (ok) { x.status = 'live'; notify(c.db, x.userId, { type: 'donation', mode: 'normal', title: '🎉 Your campaign is live', body: 'Both checks are complete. SemaChat members can now give.' }); }
      else { x.status = 'rejected'; notify(c.db, x.userId, { type: 'donation', mode: 'normal', title: 'Campaign not approved', body: 'We could not confirm your situation.' }); }
      audit(c.db, 'Donation “' + x.title + '”: field check ' + (ok ? 'PASSED → LIVE' : 'FAILED')); return aView(c.db, x);
    });
    route('POST', /^\/api\/admin\/donations\/(dn_[a-z0-9]+)\/takedown$/, 'admin', null, c => { const x = find(c); x.status = 'closed'; notify(c.db, x.userId, { type: 'donation', mode: 'normal', title: 'Campaign taken down', body: 'SemaChat support removed your campaign. Contact support for details.' }); audit(c.db, 'Donation “' + x.title + '” taken down'); return aView(c.db, x); });

    /* ================================================================ On the move! */
    const cfgOf = db => Object.assign({}, OTM_DEFAULT, db.settings.otm || {});
    const live = a => a.status === 'live' && a.expiresAt > Date.now();
    const statusOf = a => a.status === 'live' && a.expiresAt <= Date.now() ? 'ended' : a.status;
    function otm(db) {
      if (db.otm) return db.otm; const now = Date.now(), o = db.otm = { ads: [] };
      const mk = (owner, outlet, text, emoji, g, lat, lng, label, sqm, ageMin) => { const town = nearestTown(lat, lng), q = quote(sqm, town, cfgOf(db)); o.ads.push({ id: uid('ot_'), ownerId: owner, outlet, text, photos: [{ emoji, g }], pin: { lat, lng, label }, town: town.name, sqm, radiusM: q.radiusM, rate: q.rate, cost: q.cost, createdAt: now - ageMin * 60000, expiresAt: now - ageMin * 60000 + 3 * H, views: 20 + ageMin, taps: 3 + (ageMin % 7), status: 'live', seed: true }); };
      mk('c_savanna', 'Savanna Coffee Co.', 'Grab a tasty lunch at only KES. 250!', '🍛', ['#dd6b20', '#c53030'], 0.0170, 37.0724, 'Savanna Coffee, Nanyuki', 20000, 30);
      mk('u_baraka', 'Mama Pima Kiosk', 'Grab fresh juice at mama pima kiosk.', '🧃', ['#38a169', '#dd6b20'], 0.0165, 37.0719, 'Mama Pima kiosk, Nanyuki', 8000, 55);
      mk('c_savanna', 'Nanyuki Auto Spares', 'Get brake pads for your car today at KES. 2000', '🛞', ['#4a5568', '#2d3748'], 0.0163, 37.0725, 'Spares row, Nanyuki', 15000, 90);
      return o;
    }
    const adView = (a, viewer, here) => ({ id: a.id, outlet: a.outlet, text: a.text, photos: a.photos, pin: a.pin, town: a.town, sqm: a.sqm, radiusM: a.radiusM, createdAt: a.createdAt, expiresAt: a.expiresAt, minsLeft: Math.max(0, Math.round((a.expiresAt - Date.now()) / 60000)), status: statusOf(a), ownerId: a.ownerId, mine: a.ownerId === viewer.id,
      distanceM: here ? Math.round(km(here.lat, here.lng, a.pin.lat, a.pin.lng) * 1000) : null, views: a.views, taps: a.taps, cost: a.cost });
    const safeAd = (a, viewer, here) => { const v = adView(a, viewer, here); if (a.ownerId !== viewer.id) { delete v.views; delete v.taps; delete v.cost; } return v; };
    route('GET', /^\/api\/otm\/pricing$/, 'user', 'onthemove', c => Object.assign({}, cfgOf(c.db), { premiumTowns: TOWNS.filter(t => t[3]).map(t => t[0]), presets: [50, 500, 2000, 8000, 20000] }));
    route('POST', /^\/api\/otm\/quote$/, 'user', 'onthemove', c => {
      const lat = Number(c.body.lat), lng = Number(c.body.lng); if (!isFinite(lat) || !isFinite(lng)) fail(400, 'Drop a pin on the map first.');
      try { return quote(c.body.sqm, nearestTown(lat, lng), cfgOf(c.db)); } catch (e) { if (e.bad) fail(400, e.message); throw e; }
    });
    route('GET', /^\/api\/otm\/mine$/, 'user', 'onthemove', c => { const o = otm(c.db), owner = X.bizOwnerFor(c.db, c.user) || c.user.id; return o.ads.filter(a => a.ownerId === owner).sort((a, b) => b.createdAt - a.createdAt).map(a => adView(a, { id: owner }, null)); });
    route('GET', /^\/api\/otm$/, 'user', 'onthemove', c => {
      const o = otm(c.db), has = c.query.lat !== undefined && c.query.lat !== '' && c.query.lng !== undefined && c.query.lng !== '', lat = Number(c.query.lat), lng = Number(c.query.lng), here = has && isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
      const items = o.ads.filter(live).filter(a => !here || km(here.lat, here.lng, a.pin.lat, a.pin.lng) * 1000 <= a.radiusM).map(a => safeAd(a, c.user, here)).sort((a, b) => (a.distanceM || 0) - (b.distanceM || 0));
      if (here) items.forEach(a => { const x = o.ads.find(k => k.id === a.id); if (x && x.ownerId !== c.user.id) x.views++; });
      return { items, town: here ? nearestTown(here.lat, here.lng).name : null, canCreate: !!X.bizOwnerFor(c.db, c.user) };
    });
    route('POST', /^\/api\/otm$/, 'user', 'onthemove', c => {
      const owner = X.bizOwnerFor(c.db, c.user); if (!owner) fail(403, 'On the move! is for registered outlets. Register your business first; you can post from your normal or business account.', { code: 'BIZ_ACCOUNT_REQUIRED', ctaAction: 'register', ctaLabel: 'Register your outlet' });
      const b = c.body, text = clamp(b.text, 140).trim(); if (text.length < 8) fail(400, 'Write your advert (at least 8 characters), e.g. “Grab fresh juice at Mama Pima Kiosk.”');
      const lat = Number(b.lat), lng = Number(b.lng); if (!isFinite(lat) || !isFinite(lng) || lat < -5 || lat > 5.5 || lng < 33 || lng > 42.5) fail(400, 'Drop a pin inside Kenya for your advert.');
      const photos = (Array.isArray(b.photos) ? b.photos : []).slice(0, 4).filter(p => p && (isImg(p.data) || p.emoji)).map(p => p.data ? { data: p.data } : { emoji: clamp(p.emoji, 4), g: p.g }); if (!photos.length) fail(400, 'Add at least one photo.');
      let q; try { q = quote(b.sqm, nearestTown(lat, lng), cfgOf(c.db)); } catch (e) { if (e.bad) fail(400, e.message); throw e; }
      if (otm(c.db).ads.filter(a => a.ownerId === owner && live(a)).length >= 5) fail(409, 'You already have 5 live adverts. Wait for one to finish.');
      const acct = c.db.bizAccounts[owner] || {};
      charge(c.db, c.user.id, q.cost, 'On the move! advert: ' + q.sqm + ' sq m, ' + q.town, 'business', 'ad'); addRevenue(c.db, 'onthemove', q.cost, 'On the move! ' + (acct.name || owner));
      const ad = { id: uid('ot_'), ownerId: owner, outlet: acct.name || byId(c.db, owner).name, text, photos, pin: { lat, lng, label: clamp(b.label || q.town, 80) }, town: q.town, sqm: q.sqm, radiusM: q.radiusM, rate: q.rate, cost: q.cost, createdAt: Date.now(), expiresAt: Date.now() + q.hours * H, views: 0, taps: 0, status: 'live' };
      otm(c.db).ads.push(ad); logEvent(c.db, 'otm_created', c.user.id, { id: ad.id, cost: ad.cost, town: ad.town });
      return { ad: adView(ad, c.user, null), quote: q, balance: wallet(c.db, c.user.id).balance };
    });
    route('POST', /^\/api\/otm\/(ot_[a-z0-9]+)\/tap$/, 'user', 'onthemove', c => { const a = otm(c.db).ads.find(k => k.id === c.p[0]); if (!a || !live(a)) fail(404, 'This advert has ended.'); if (a.ownerId !== c.user.id) a.taps++; return { ok: true, pin: a.pin }; });
    route('DELETE', /^\/api\/otm\/(ot_[a-z0-9]+)$/, 'user', 'onthemove', c => { const a = otm(c.db).ads.find(k => k.id === c.p[0]); if (!a || a.ownerId !== X.bizOwnerFor(c.db, c.user)) fail(404, 'Advert not found.'); a.status = 'stopped'; return { ok: true }; });
    route('GET', /^\/api\/admin\/otm$/, 'admin', null, c => { const o = otm(c.db), g = cfgOf(c.db); return { config: Object.assign({}, g, { premiumTowns: TOWNS.filter(t => t[3]).map(t => t[0]) }), stats: { live: o.ads.filter(live).length, total: o.ads.length, revenue: o.ads.reduce((n, a) => n + a.cost, 0) }, ads: o.ads.slice().sort((a, b) => b.createdAt - a.createdAt).map(a => ({ id: a.id, outlet: a.outlet, town: a.town, text: a.text, sqm: a.sqm, cost: a.cost, status: statusOf(a), minsLeft: Math.max(0, Math.round((a.expiresAt - Date.now()) / 60000)) })) }; });
    route('PUT', /^\/api\/admin\/otm$/, 'admin', null, c => {
      const s = c.db.settings.otm = cfgOf(c.db); ['premiumRate', 'otherRate'].forEach(k => { const n = Number(c.body[k]); if (isFinite(n) && n >= 1 && n <= 10000) s[k] = Math.round(n); }); const h = Number(c.body.hours); if (isFinite(h) && h >= 1 && h <= 48) s.hours = Math.round(h);
      audit(c.db, 'On the move! pricing: premium KES ' + s.premiumRate + ', other KES ' + s.otherRate + ' per ' + s.unitSqm + ' sq m, ' + s.hours + 'h'); return s;
    });
    route('POST', /^\/api\/admin\/otm\/(ot_[a-z0-9]+)\/takedown$/, 'admin', null, c => { const a = otm(c.db).ads.find(k => k.id === c.p[0]); if (!a) fail(404, 'Advert not found.'); a.status = 'removed'; notify(c.db, a.ownerId, { type: 'ad', mode: 'business', title: 'Advert removed', body: 'Your On the move! advert breached the rules and was removed.' }); audit(c.db, 'On the move! advert removed: ' + a.text); return { ok: true }; });
  });
});
