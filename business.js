/* SemaChat — Business Mode build-out (add-on module).
 * Business page / mini-app, catalog (products, services, videos), customer ordering with escrow-style
 * refunds, reviews, disputes, the ad marketplace, business analytics and the matching admin tools.
 * Works in Node (require('./business')(core)) and in the browser preview (after core.js).
 */
(function (root, install) {
  if (typeof module === 'object' && module.exports) module.exports = install;
  else install(root.SemaChatCore);
})(typeof self !== 'undefined' ? self : this, function install(core) {
  core.use(function (X) {
    'use strict';
    const { route, uid, fail, byId, wallet, addTx, charge, addRevenue, notify, bizChatFor, bizOwnerFor, bizAudience, teamOf, logEvent, audit, pick, hash, D, H } = X;
    const IMP_PER_KES = 12;            // ad impressions bought per KES spent
    const AD_MIN_DAILY = 100, AD_MAX_DAYS = 30;
    const KINDS = ['product', 'service', 'video'];
    const owner = c => bizOwnerFor(c.db, c.user);
    const kes = n => 'KES ' + Math.round(n).toLocaleString('en-KE');

    /* ------------------------------------------------------------ lazy init + demo data */
    function ensure(db) {
      if (db.catalog) return db;
      db.catalog = []; db.reviews = []; db.ads = []; db.disputes = []; db.follows = {}; db.pageViews = [];
      const now = Date.now();
      const bz = byId(db, 'u_baraka');
      if (bz && !db.bizAccounts.u_baraka) {
        Object.assign(bz, { hasBizAccount: true, bizStatus: 'active', bizActivatedAt: now - 20 * D });
        db.bizAccounts.u_baraka = { name: 'Baraka Sounds', category: 'events', kind: 'informal', taxPin: null, team: [], payoutSchedule: 'manual', bankLinked: false, inboxAccess: 'all', status: 'active', createdAt: now - 20 * D,
          page: { emoji: '🎧', cover: ['#6b46c1', '#b83280'], about: 'DJ and sound hire for weddings, parties and corporate events across Laikipia.', hours: 'Every day, by booking', area: 'Nanyuki' } };
      }
      const sav = db.bizAccounts.c_savanna; if (sav && !sav.page) sav.page = { emoji: '☕', cover: ['#744210', '#1a202c'], about: 'Single-origin coffee roasted in Nanyuki, on the slopes of Mt. Kenya. Beans, brewing gear and barista classes.', hours: 'Mon–Sat 7:00–19:00', area: 'Nanyuki town' };
      const C = (o, kind, name, price, emoji, desc, stock, extra) => db.catalog.push(Object.assign({ id: uid('ci_'), ownerId: o, kind, name, price, emoji, desc, stock: kind === 'product' ? stock : null, active: true, views: 20 + Math.abs(hash(name)) % 90, sold: 0, createdAt: now - 10 * D }, extra || {}));
      C('c_savanna', 'product', 'Kirinyaga AA 500g', 1450, '☕', 'Single-origin, notes of blackcurrant and brown sugar.', 40);
      C('c_savanna', 'product', 'Pour-over filter set', 980, '🫖', 'Ceramic dripper plus 100 filters.', 25);
      C('c_savanna', 'product', 'Ceramic mug', 450, '🍵', 'Hand-glazed, 350 ml.', 60);
      C('c_savanna', 'service', 'Barista masterclass', 2500, '🎓', 'Two hours, hands-on, up to 4 people.', null, { duration: 120 });
      C('c_savanna', 'video', 'Brew guide: the perfect pour-over', 0, '🎬', 'A three-minute walkthrough from our head roaster.', null, { dur: 184 });
      C('u_baraka', 'service', 'DJ for your event (4 hours)', 18000, '🎧', 'Sound system and a playlist built around your crowd.', null, { duration: 240 });
      C('u_baraka', 'service', 'Wedding sound package', 45000, '💍', 'Full PA, wireless mics and a day-of coordinator.', null, { duration: 480 });
      const RV = (o, cust, rating, text, ago) => db.reviews.push({ id: uid('rv_'), ownerId: o, customerId: cust, orderId: null, rating, text, ts: now - ago * D, reply: null });
      RV('c_savanna', 'u_zawadi', 5, 'Best coffee in Nanyuki. The Kirinyaga AA is unreal.', 6);
      RV('c_savanna', 'u_otieno', 5, 'Quick delivery and beautifully packed.', 12);
      RV('c_savanna', 'u_kiprono', 4, 'Great beans. Mug arrived with a tiny chip but they fixed it fast.', 20);
      RV('c_savanna', 'u_wanjiru', 5, 'The barista class was a highlight of my month.', 25);
      RV('u_baraka', 'u_fatuma', 5, 'Our wedding dance floor never emptied!', 9);
      RV('u_baraka', 'u_zawadi', 4, 'Great energy. Arrived a little late but made up for it.', 30);
      return db;
    }

    /* ------------------------------------------------------------ helpers */
    const rating = (db, o) => { const rv = db.reviews.filter(r => r.ownerId === o); return { avg: rv.length ? Math.round(rv.reduce((n, r) => n + r.rating, 0) / rv.length * 10) / 10 : null, count: rv.length }; };
    const activeBiz = (db, id) => db.bizAccounts[id] && db.bizAccounts[id].status === 'active';
    function pageOf(db, o, viewerId) {
      const b = db.bizAccounts[o], pg = b.page || {}, r = rating(db, o), items = db.catalog.filter(i => i.ownerId === o && i.active);
      const prices = items.filter(i => i.kind !== 'video').map(i => i.price);
      return { ownerId: o, name: b.name, category: b.category, verified: b.kind === 'formal', emoji: pg.emoji || '🏪', cover: pg.cover || ['#1b7f4a', '#0f766e'], about: pg.about || '', hours: pg.hours || 'Mon–Sat 8:00–18:00', area: pg.area || '',
        rating: r.avg, reviewCount: r.count, followers: Object.keys(db.follows).filter(u => db.follows[u].includes(o)).length, following: (db.follows[viewerId] || []).includes(o), itemCount: items.length, fromPrice: prices.length ? Math.min.apply(null, prices) : null };
    }
    const itemView = i => ({ id: i.id, kind: i.kind, name: i.name, desc: i.desc, price: i.price, emoji: i.emoji, stock: i.stock, duration: i.duration || null, dur: i.dur || null, active: i.active, views: i.views, sold: i.sold });
    const isStaff = (db, u, o) => u.id === o || teamOf(db, o).includes(u.id);
    const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

    /* ------------------------------------------------------------ ads engine */
    function adTick(db, ad, to) {
      if (ad.status !== 'active') return ad;
      const hours = Math.max(0, (to - ad.lastTick) / H); ad.lastTick = to;
      if (!hours) return ad;
      const spend = Math.min(ad.dailyBudget / 24 * hours, ad.budget - ad.spent);
      if (spend > 0) {
        const jitter = 0.85 + (Math.abs(hash(ad.id + Math.floor(to / H))) % 30) / 100, imp = Math.round(spend * IMP_PER_KES * jitter), ctr = ad.objective === 'awareness' ? 0.012 : 0.028;
        ad.spent += spend; ad.impressions += imp; ad.clicks += Math.round(imp * ctr);
        const due = Math.floor(ad.spent) - ad.billed; if (due > 0) { addRevenue(db, 'ads', due, 'Ad spend • ' + ad.name); ad.billed += due; }
      }
      if (ad.spent >= ad.budget - 0.5) {
        ad.spent = ad.budget; const due = Math.floor(ad.spent) - ad.billed; if (due > 0) { addRevenue(db, 'ads', due, 'Ad spend • ' + ad.name); ad.billed += due; }
        ad.status = 'completed'; ad.endedAt = to;
        bizAudience(db, ad.ownerId).forEach(id => notify(db, id, { type: 'ad', mode: 'business', title: 'Campaign finished', body: '“' + ad.name + '” delivered ' + ad.impressions.toLocaleString('en-KE') + ' impressions and ' + ad.clicks + ' clicks.', ctx: { adId: ad.id } }));
      }
      return ad;
    }
    const adView = (db, ad) => { const it = ad.itemId ? db.catalog.find(i => i.id === ad.itemId) : null; return Object.assign({}, ad, { spent: Math.round(ad.spent), ctr: ad.impressions ? Math.round(ad.clicks / ad.impressions * 1000) / 10 : 0, remaining: Math.max(0, Math.round(ad.budget - ad.spent)), item: it ? itemView(it) : null, business: (db.bizAccounts[ad.ownerId] || {}).name }); };
    const refundAd = (db, ad, why) => {
      const back = Math.max(0, Math.floor(ad.budget - ad.spent)); if (!back) return 0;
      wallet(db, ad.ownerId).balance += back; addTx(db, ad.ownerId, { type: 'in', kind: 'ad', mode: 'business', title: 'Ad refund • ' + ad.name + (why ? ' (' + why + ')' : ''), amount: back }); return back;
    };

    /* ============================================================ CUSTOMER SIDE */
    route('GET', /^\/api\/biz\/pages$/, 'user', 'explore', c => {
      const db = ensure(c.db), q = String(c.query.q || '').toLowerCase().trim(), cat = c.query.category;
      return Object.keys(db.bizAccounts).filter(o => activeBiz(db, o)).map(o => pageOf(db, o, c.user.id))
        .filter(p => (!q || (p.name + ' ' + p.category + ' ' + p.about).toLowerCase().includes(q)) && (!cat || p.category === cat))
        .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    });
    route('GET', /^\/api\/biz\/pages\/([^/]+)$/, 'user', 'explore', c => {
      const db = ensure(c.db), o = c.p[0]; if (!activeBiz(db, o)) fail(404, 'This business page is not available.');
      const staff = isStaff(db, c.user, o);
      if (!staff) { db.pageViews.push({ ownerId: o, userId: c.user.id, ts: Date.now() }); if (db.pageViews.length > 6000) db.pageViews.splice(0, 1000); }
      const items = db.catalog.filter(i => i.ownerId === o && i.active); if (!staff) items.forEach(i => { i.views++; });
      return { page: pageOf(db, o, c.user.id), items: items.map(itemView), canOrder: !staff,
        reviews: db.reviews.filter(r => r.ownerId === o).sort((a, b) => b.ts - a.ts).slice(0, 12).map(r => ({ id: r.id, rating: r.rating, text: r.text, ts: r.ts, reply: r.reply, name: (byId(db, r.customerId) || {}).name || 'Customer' })) };
    });
    route('POST', /^\/api\/biz\/pages\/([^/]+)\/follow$/, 'user', 'explore', c => {
      const db = ensure(c.db), o = c.p[0]; if (!activeBiz(db, o)) fail(404, 'This business page is not available.');
      const l = db.follows[c.user.id] || (db.follows[c.user.id] = []), i = l.indexOf(o); if (i >= 0) l.splice(i, 1); else l.push(o);
      return { following: i < 0 };
    });
    route('POST', /^\/api\/biz\/pages\/([^/]+)\/chat$/, 'user', 'chats', c => {
      const db = ensure(c.db), o = c.p[0]; if (!activeBiz(db, o)) fail(404, 'This business page is not available.');
      if (isStaff(db, c.user, o)) fail(400, 'This is your own business.');
      return { chatId: bizChatFor(db, c.user.id, o).id };
    });
    route('POST', /^\/api\/biz\/pages\/([^/]+)\/order$/, 'user', 'shopping', c => {
      const db = ensure(c.db), o = c.p[0], b = db.bizAccounts[o]; if (!activeBiz(db, o)) fail(404, 'This business page is not available.');
      if (isStaff(db, c.user, o)) fail(400, 'You cannot order from your own business.');
      const lines = (c.body.items || []).map(l => ({ it: db.catalog.find(i => i.id === l.id && i.ownerId === o && i.active), qty: Math.max(1, Math.min(20, l.qty | 0 || 1)) })).filter(l => l.it && l.it.kind !== 'video');
      if (!lines.length) fail(400, 'Your basket is empty.');
      lines.forEach(l => { if (l.it.stock != null && l.it.stock < l.qty) fail(409, l.it.name + ' has only ' + l.it.stock + ' left.'); });
      const total = lines.reduce((n, l) => n + l.qty * l.it.price, 0);
      charge(db, c.user.id, total, 'Order • ' + b.name, 'normal', 'payment');   // held until the business accepts (refunded on decline)
      lines.forEach(l => { if (l.it.stock != null) l.it.stock -= l.qty; l.it.sold += l.qty; });
      const vat = Math.round(total - total / 1.16), number = 2000 + db.bizOrders.length + 1, ch = bizChatFor(db, c.user.id, o);
      const ord = { id: uid('bo_'), number, ownerId: o, customerId: c.user.id, chatId: ch.id, items: lines.map(l => ({ name: l.it.name, qty: l.qty, price: l.it.price, itemId: l.it.id })), subtotal: total - vat, vat, total, status: 'new', ts: Date.now(), deadline: Date.now() + 2 * H, paid: true, note: cut(c.body.note, 200), source: 'page' };
      db.bizOrders.push(ord);
      if (!ch.phoneRevealed) { ch.phoneRevealed = true; logEvent(db, 'customer_phone_reveal', c.user.id, { how: 'first_order' }); }
      bizAudience(db, o).forEach(id => notify(db, id, { type: 'order', mode: 'business', title: 'New order', body: c.user.name + ' ordered ' + lines.reduce((n, l) => n + l.qty, 0) + ' item' + (lines.length > 1 || lines[0].qty > 1 ? 's' : '') + ' — ' + kes(total), amount: total, urgent: total > 5000, ctx: { orderId: ord.id, chatId: ch.id, customerId: c.user.id, senderName: c.user.name } }));
      return ord;
    });

    route('GET', /^\/api\/me\/orders$/, 'user', 'shopping', c => {
      const db = ensure(c.db);
      return db.bizOrders.filter(o => o.customerId === c.user.id).sort((a, b) => b.ts - a.ts).map(o => ({ id: o.id, number: o.number, ownerId: o.ownerId, business: (db.bizAccounts[o.ownerId] || {}).name || 'Business', items: o.items, total: o.total, status: o.status, ts: o.ts, refunded: !!o.refunded,
        reviewed: db.reviews.some(r => r.orderId === o.id), dispute: (db.disputes.find(d => d.orderId === o.id) || {}).status || null, chatId: o.chatId }));
    });
    route('POST', /^\/api\/me\/orders\/([^/]+)\/review$/, 'user', 'shopping', c => {
      const db = ensure(c.db), o = db.bizOrders.find(x => x.id === c.p[0] && x.customerId === c.user.id); if (!o) fail(404, 'Order not found.');
      if (o.status !== 'completed') fail(409, 'You can review an order once the business has accepted it.');
      if (db.reviews.some(r => r.orderId === o.id)) fail(409, 'You already reviewed this order.');
      const stars = Math.max(1, Math.min(5, c.body.rating | 0)); if (!stars) fail(400, 'Choose 1 to 5 stars.');
      const r = { id: uid('rv_'), ownerId: o.ownerId, customerId: c.user.id, orderId: o.id, rating: stars, text: cut(c.body.text, 300), ts: Date.now(), reply: null }; db.reviews.push(r);
      bizAudience(db, o.ownerId).forEach(id => notify(db, id, { type: 'review', mode: 'business', title: stars <= 2 ? 'Negative review' : 'New review', body: c.user.name + ' left ' + stars + ' star' + (stars > 1 ? 's' : '') + (r.text ? ': “' + r.text.slice(0, 60) + '”' : ''), rating: stars, urgent: stars <= 2, ctx: { chatId: o.chatId, orderId: o.id, senderName: c.user.name } }));
      return { ok: true, review: r };
    });
    route('POST', /^\/api\/me\/orders\/([^/]+)\/dispute$/, 'user', 'shopping', c => {
      const db = ensure(c.db), o = db.bizOrders.find(x => x.id === c.p[0] && x.customerId === c.user.id); if (!o) fail(404, 'Order not found.');
      if (o.status !== 'completed' || o.refunded) fail(409, 'Only accepted, unrefunded orders can be disputed.');
      if (Date.now() - o.ts > 14 * D) fail(409, 'The 14-day dispute window has closed.');
      if (db.disputes.some(d => d.orderId === o.id)) fail(409, 'A dispute is already open for this order.');
      const reason = cut(c.body.reason, 240); if (reason.length < 5) fail(400, 'Tell us what went wrong (a few words).');
      const d = { id: uid('dp_'), orderId: o.id, number: o.number, ownerId: o.ownerId, customerId: c.user.id, amount: o.total, reason, status: 'open', ts: Date.now(), note: '' }; db.disputes.push(d);
      bizAudience(db, o.ownerId).forEach(id => notify(db, id, { type: 'order', mode: 'business', title: 'Order dispute opened', body: c.user.name + ' disputed order #' + o.number + ': ' + reason.slice(0, 70), urgent: true, ctx: { orderId: o.id, chatId: o.chatId, senderName: c.user.name } }));
      logEvent(db, 'dispute_opened', c.user.id, { ownerId: o.ownerId });
      return d;
    });

    /* ------------------------------------------------------------ ad feed (sponsored placements in Explore) */
    route('GET', /^\/api\/ads\/feed$/, 'user', 'explore', c => {
      const db = ensure(c.db), now = Date.now();
      if (X.tierOf(c.user) === 'gold') return []; // Gold members see no ads
      return db.ads.filter(a => a.status === 'active' && a.ownerId !== c.user.id && !teamOf(db, a.ownerId).includes(c.user.id)).map(a => { adTick(db, a, now); a.impressions++; return a; }).filter(a => a.status === 'active')
        .map(a => ({ id: a.id, headline: a.headline, ownerId: a.ownerId, business: pageOf(db, a.ownerId, c.user.id), item: a.itemId ? (() => { const i = db.catalog.find(x => x.id === a.itemId); return i ? itemView(i) : null; })() : null })).slice(0, 4);
    });
    route('POST', /^\/api\/ads\/([^/]+)\/click$/, 'user', 'explore', c => {
      const db = ensure(c.db), a = db.ads.find(x => x.id === c.p[0]); if (!a) fail(404, 'Ad not found.'); a.clicks++; return { ownerId: a.ownerId };
    });

    /* ============================================================ BUSINESS SIDE (gated) */
    route('GET', /^\/api\/biz\/catalog$/, 'biz', null, c => { const db = ensure(c.db); return db.catalog.filter(i => i.ownerId === owner(c)).map(itemView); });
    route('POST', /^\/api\/biz\/catalog$/, 'biz', null, c => {
      const db = ensure(c.db), b = c.body, kind = b.kind;
      if (!KINDS.includes(kind)) fail(400, 'Choose product, service or video.');
      const name = cut(b.name, 60); if (name.length < 2) fail(400, 'Give it a name.');
      const price = Math.round(+b.price || 0); if (kind !== 'video' && price <= 0) fail(400, 'Enter a price above zero.'); if (price < 0 || price > 5e6) fail(400, 'Enter a valid price.');
      const it = { id: uid('ci_'), ownerId: owner(c), kind, name, price: kind === 'video' ? 0 : price, emoji: cut(b.emoji, 4) || ({ product: '📦', service: '🛎️', video: '🎬' })[kind], desc: cut(b.desc, 200),
        stock: kind === 'product' ? Math.max(0, b.stock == null || b.stock === '' ? 10 : b.stock | 0) : null, active: true, views: 0, sold: 0, createdAt: Date.now() };
      if (kind === 'service') it.duration = Math.max(15, b.duration | 0 || 60); if (kind === 'video') it.dur = Math.max(5, b.dur | 0 || 60);
      db.catalog.push(it); return itemView(it);
    });
    const mine = c => { const db = ensure(c.db), it = db.catalog.find(i => i.id === c.p[0] && i.ownerId === owner(c)); if (!it) fail(404, 'Item not found.'); return it; };
    route('PATCH', /^\/api\/biz\/catalog\/([^/]+)$/, 'biz', null, c => {
      const it = mine(c), b = c.body;
      if (b.name != null) { const n = cut(b.name, 60); if (n.length < 2) fail(400, 'Give it a name.'); it.name = n; }
      if (b.price != null && it.kind !== 'video') { const p = Math.round(+b.price); if (!(p > 0 && p <= 5e6)) fail(400, 'Enter a valid price.'); it.price = p; }
      if (b.desc != null) it.desc = cut(b.desc, 200); if (b.emoji) it.emoji = cut(b.emoji, 4);
      if (b.stock != null && it.kind === 'product') it.stock = Math.max(0, b.stock | 0);
      if (typeof b.active === 'boolean') it.active = b.active;
      return itemView(it);
    });
    route('DELETE', /^\/api\/biz\/catalog\/([^/]+)$/, 'biz', null, c => { const it = mine(c); c.db.catalog = c.db.catalog.filter(i => i !== it); return { ok: true }; });

    route('GET', /^\/api\/biz\/page$/, 'biz', null, c => { const db = ensure(c.db), o = owner(c), b = db.bizAccounts[o]; return { edit: Object.assign({ emoji: '🏪', about: '', hours: 'Mon–Sat 8:00–18:00', area: '' }, b.page || {}), preview: pageOf(db, o, c.user.id) }; });
    route('PATCH', /^\/api\/biz\/page$/, 'biz', null, c => {
      const db = ensure(c.db), o = owner(c); if (o !== c.user.id && !teamOf(db, o).includes(c.user.id)) fail(403, 'Not allowed.');
      const b = db.bizAccounts[o], pg = b.page || (b.page = {}), q = c.body;
      if (q.about != null) pg.about = cut(q.about, 300); if (q.hours != null) pg.hours = cut(q.hours, 60); if (q.area != null) pg.area = cut(q.area, 60); if (q.emoji) pg.emoji = cut(q.emoji, 4);
      if (Array.isArray(q.cover) && q.cover.length === 2 && q.cover.every(x => /^#[0-9a-f]{6}$/i.test(x))) pg.cover = q.cover;
      return pageOf(db, o, c.user.id);
    });
    route('GET', /^\/api\/biz\/reviews$/, 'biz', null, c => {
      const db = ensure(c.db), o = owner(c), r = rating(db, o), rv = db.reviews.filter(x => x.ownerId === o).sort((a, b) => b.ts - a.ts);
      return { rating: r.avg, count: r.count, breakdown: [5, 4, 3, 2, 1].map(s => ({ stars: s, n: rv.filter(x => x.rating === s).length })), reviews: rv.slice(0, 30).map(x => Object.assign({}, x, { name: (byId(db, x.customerId) || {}).name || 'Customer' })) };
    });
    route('POST', /^\/api\/biz\/reviews\/([^/]+)\/reply$/, 'biz', null, c => {
      const db = ensure(c.db), r = db.reviews.find(x => x.id === c.p[0] && x.ownerId === owner(c)); if (!r) fail(404, 'Review not found.');
      const t = cut(c.body.text, 240); if (!t) fail(400, 'Write a reply.'); r.reply = t;
      notify(db, r.customerId, { type: 'system', mode: 'normal', title: (db.bizAccounts[r.ownerId] || {}).name + ' replied to your review', body: t.slice(0, 100) });
      return r;
    });
    route('GET', /^\/api\/biz\/disputes$/, 'biz', null, c => { const db = ensure(c.db), o = owner(c); return db.disputes.filter(d => d.ownerId === o).sort((a, b) => b.ts - a.ts).map(d => Object.assign({}, d, { customer: (byId(db, d.customerId) || {}).name })); });

    /* ---- ads marketplace */
    route('GET', /^\/api\/biz\/ads$/, 'biz', null, c => {
      const db = ensure(c.db), o = owner(c), now = Date.now(), list = db.ads.filter(a => a.ownerId === o).sort((a, b) => b.createdAt - a.createdAt); list.forEach(a => adTick(db, a, now));
      const tot = list.reduce((t, a) => { t.spent += a.spent; t.impressions += a.impressions; t.clicks += a.clicks; return t; }, { spent: 0, impressions: 0, clicks: 0 });
      return { ads: list.map(a => adView(db, a)), totals: { spent: Math.round(tot.spent), impressions: tot.impressions, clicks: tot.clicks, ctr: tot.impressions ? Math.round(tot.clicks / tot.impressions * 1000) / 10 : 0 },
        pricing: { impressionsPerKes: IMP_PER_KES, minDaily: AD_MIN_DAILY, maxDays: AD_MAX_DAYS }, balance: wallet(db, o).balance };
    });
    route('POST', /^\/api\/biz\/ads$/, 'biz', null, c => {
      const db = ensure(c.db), o = owner(c), b = c.body, name = cut(b.name, 50), headline = cut(b.headline, 80);
      if (name.length < 2) fail(400, 'Name your campaign.'); if (headline.length < 5) fail(400, 'Write a headline people will see (5+ characters).');
      const daily = Math.round(+b.dailyBudget), days = b.days | 0;
      if (!(daily >= AD_MIN_DAILY)) fail(400, 'Daily budget starts at KES ' + AD_MIN_DAILY + '.'); if (!(days >= 1 && days <= AD_MAX_DAYS)) fail(400, 'Run it for 1 to ' + AD_MAX_DAYS + ' days.');
      if (db.ads.filter(a => a.ownerId === o && ['pending_review', 'active', 'paused'].includes(a.status)).length >= 5) fail(409, 'You can run up to 5 campaigns at once.');
      const item = b.itemId ? db.catalog.find(i => i.id === b.itemId && i.ownerId === o && i.active) : null; if (b.itemId && !item) fail(400, 'That catalog item is not available.');
      const budget = daily * days;
      charge(db, o, budget, 'Ad campaign • ' + name, 'business', 'ad');
      const ad = { id: uid('ad_'), ownerId: o, name, headline, objective: ['visits', 'orders', 'awareness'].includes(b.objective) ? b.objective : 'visits', placement: 'explore', itemId: item ? item.id : null, dailyBudget: daily, days, budget, spent: 0, billed: 0, impressions: 0, clicks: 0, status: 'pending_review', createdAt: Date.now(), lastTick: Date.now(), reason: '' };
      db.ads.push(ad); logEvent(db, 'ad_created', c.user.id, { budget });
      return adView(db, ad);
    });
    const myAd = c => { const db = ensure(c.db), a = db.ads.find(x => x.id === c.p[0] && x.ownerId === owner(c)); if (!a) fail(404, 'Campaign not found.'); return a; };
    route('POST', /^\/api\/biz\/ads\/([^/]+)\/pause$/, 'biz', null, c => { const a = myAd(c); if (a.status !== 'active') fail(409, 'Only live campaigns can be paused.'); adTick(c.db, a, Date.now()); a.status = 'paused'; return adView(c.db, a); });
    route('POST', /^\/api\/biz\/ads\/([^/]+)\/resume$/, 'biz', null, c => { const a = myAd(c); if (a.status !== 'paused') fail(409, 'This campaign is not paused.'); a.status = 'active'; a.lastTick = Date.now(); return adView(c.db, a); });
    route('POST', /^\/api\/biz\/ads\/([^/]+)\/stop$/, 'biz', null, c => {
      const a = myAd(c); if (!['pending_review', 'active', 'paused'].includes(a.status)) fail(409, 'This campaign has already ended.');
      adTick(c.db, a, Date.now()); a.status = 'stopped'; a.endedAt = Date.now(); const back = refundAd(c.db, a, 'unspent budget'); return Object.assign(adView(c.db, a), { refunded: back });
    });
    route('POST', /^\/api\/biz\/ads\/([^/]+)\/simulate-day$/, 'biz', null, c => { // demo helper: fast-forward 24h of delivery
      const a = myAd(c); if (a.status !== 'active') fail(409, 'Only live campaigns can be fast-forwarded. Wait for approval first.');
      a.lastTick -= D; adTick(c.db, a, Date.now()); return adView(c.db, a);
    });

    /* ---- analytics */
    route('GET', /^\/api\/biz\/analytics$/, 'biz', null, c => {
      const db = ensure(c.db), o = owner(c), days = Math.max(7, Math.min(30, +c.query.days || 14)), now = Date.now(), since = now - days * D;
      const bucket = ts => days - 1 - Math.floor((now - ts) / D), blank = () => Array.from({ length: days }, () => 0);
      const views = blank(), orders = blank(), revenue = blank();
      db.pageViews.filter(v => v.ownerId === o && v.ts >= since).forEach(v => { const i = bucket(v.ts); if (i >= 0 && i < days) views[i]++; });
      const ords = db.bizOrders.filter(x => x.ownerId === o && x.ts >= since && x.status !== 'rejected');
      ords.forEach(x => { const i = bucket(x.ts); if (i >= 0 && i < days) { orders[i]++; if (x.status === 'completed') revenue[i] += x.total; } });
      const done = ords.filter(x => x.status === 'completed'), units = {};
      ords.forEach(x => x.items.forEach(i => { const u = units[i.name] || (units[i.name] = { name: i.name, units: 0, revenue: 0 }); u.units += i.qty; u.revenue += i.qty * i.price; }));
      const counts = {}; ords.forEach(x => { counts[x.customerId] = (counts[x.customerId] || 0) + 1; });
      const uniq = Object.keys(counts).length, repeat = Object.keys(counts).filter(k => counts[k] > 1).length;
      const rv = db.reviews.filter(r => r.ownerId === o), ads = db.ads.filter(a => a.ownerId === o); ads.forEach(a => adTick(db, a, now));
      const pv = views.reduce((n, x) => n + x, 0), adSpend = ads.reduce((n, a) => n + a.spent, 0);
      return { days, series: { views, orders, revenue }, totals: { views: pv, orders: ords.length, completed: done.length, revenue: done.reduce((n, x) => n + x.total, 0), followers: Object.keys(db.follows).filter(u => db.follows[u].includes(o)).length },
        funnel: { views: pv, itemViews: db.catalog.filter(i => i.ownerId === o).reduce((n, i) => n + i.views, 0), orders: ords.length, completed: done.length }, conversionPct: pv ? Math.round(ords.length / pv * 1000) / 10 : 0,
        topItems: Object.keys(units).map(k => units[k]).sort((a, b) => b.revenue - a.revenue).slice(0, 5), repeatPct: uniq ? Math.round(repeat / uniq * 100) : 0,
        rating: { avg: rating(db, o).avg, count: rv.length, breakdown: [5, 4, 3, 2, 1].map(s => ({ stars: s, n: rv.filter(r => r.rating === s).length })) },
        ads: { spent: Math.round(adSpend), impressions: ads.reduce((n, a) => n + a.impressions, 0), clicks: ads.reduce((n, a) => n + a.clicks, 0), costPerOrder: ords.length && adSpend ? Math.round(adSpend / ords.length) : null } };
    });
    route('POST', /^\/api\/biz\/demo-history$/, 'biz', null, c => { // demo helper: back-fill two weeks of traffic, orders and reviews
      const db = ensure(c.db), o = owner(c), now = Date.now(), fee = db.settings.fees.shopCommissionPct;
      const pool = ['u_zawadi', 'u_otieno', 'u_kiprono', 'u_wanjiru', 'u_fatuma'].filter(id => id !== o && !teamOf(db, o).includes(id));
      for (let d = 0; d < 14; d++) { const n = 5 + Math.abs(hash(o + d)) % 14; for (let k = 0; k < n; k++) db.pageViews.push({ ownerId: o, userId: pick(pool), ts: now - d * D - k * 40 * 60000 }); }
      const items = db.catalog.filter(i => i.ownerId === o && i.active && i.kind !== 'video'), fallback = [{ name: 'Signature item', price: 900 }, { name: 'Gift bundle', price: 1700 }];
      let made = 0;
      for (let k = 0; k < 10; k++) {
        const cust = pool[k % pool.length], ts = now - (0.4 + k * 1.3) * D, lines = [pick(items.length ? items : fallback)].concat(k % 3 === 0 ? [pick(items.length ? items : fallback)] : []);
        const its = lines.map(l => ({ name: l.name, qty: 1 + (k % 2), price: l.price, itemId: l.id })), total = its.reduce((n, i) => n + i.qty * i.price, 0), vat = Math.round(total - total / 1.16), ch = bizChatFor(db, cust, o);
        const ord = { id: uid('bo_'), number: 2000 + db.bizOrders.length + 1, ownerId: o, customerId: cust, chatId: ch.id, items: its, subtotal: total - vat, vat, total, status: 'completed', ts, completedAt: ts, source: 'demo' };
        db.bizOrders.push(ord); const net = total - Math.round(total * fee / 100); wallet(db, o).balance += net;
        addTx(db, o, { type: 'in', kind: 'payment', mode: 'business', title: 'Order payment • #' + ord.number, amount: net, tax: vat, orderId: ord.id, ts }); addRevenue(db, 'commission', total - net, 'Order commission');
        lines.forEach(l => { const it = db.catalog.find(i => i.id === l.id); if (it) it.sold += 1; });
        if (k % 2 === 0) db.reviews.push({ id: uid('rv_'), ownerId: o, customerId: cust, orderId: null, rating: k % 5 === 4 ? 3 : 5, text: pick(['Lovely service!', 'Fast and friendly.', 'Exactly as described.', 'Will order again.']), ts: ts + H, reply: null });
        made++;
      }
      return { ok: true, orders: made };
    });

    /* ============================================================ ADMIN */
    route('GET', /^\/api\/admin\/ads$/, 'admin', null, c => { const db = ensure(c.db), now = Date.now(); db.ads.forEach(a => adTick(db, a, now)); return db.ads.slice().sort((a, b) => b.createdAt - a.createdAt).map(a => adView(db, a)); });
    route('POST', /^\/api\/admin\/ads\/([^/]+)$/, 'admin', null, c => {
      const db = ensure(c.db), a = db.ads.find(x => x.id === c.p[0]); if (!a) fail(404, 'Campaign not found.'); const act = c.body.action;
      if (act === 'approve') {
        if (a.status !== 'pending_review') fail(409, 'This campaign is not waiting for review.'); a.status = 'active'; a.lastTick = Date.now(); a.startedAt = Date.now(); audit(db, 'Approved ad “' + a.name + '”');
        bizAudience(db, a.ownerId).forEach(id => notify(db, id, { type: 'ad', mode: 'business', title: 'Your ad is live', body: '“' + a.name + '” is now showing in Explore.', ctx: { adId: a.id } }));
      } else if (act === 'reject') {
        if (!['pending_review', 'active', 'paused'].includes(a.status)) fail(409, 'This campaign has already ended.'); adTick(db, a, Date.now()); const why = cut(c.body.reason, 140) || 'Does not meet the ad policy.';
        a.status = 'rejected'; a.reason = why; a.endedAt = Date.now(); const back = refundAd(db, a, 'rejected'); audit(db, 'Rejected ad “' + a.name + '”: ' + why);
        bizAudience(db, a.ownerId).forEach(id => notify(db, id, { type: 'ad', mode: 'business', title: 'Ad not approved', body: why + (back ? ' ' + kes(back) + ' was refunded.' : ''), urgent: true, ctx: { adId: a.id } }));
      } else if (act === 'pause') { if (a.status !== 'active') fail(409, 'Only live campaigns can be paused.'); adTick(db, a, Date.now()); a.status = 'paused'; audit(db, 'Paused ad “' + a.name + '”'); }
      else fail(400, 'Unknown action.');
      return adView(db, a);
    });
    route('GET', /^\/api\/admin\/disputes$/, 'admin', null, c => { const db = ensure(c.db); return db.disputes.slice().sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || b.ts - a.ts).map(d => Object.assign({}, d, { customer: (byId(db, d.customerId) || {}).name, business: (db.bizAccounts[d.ownerId] || {}).name })); });
    route('POST', /^\/api\/admin\/disputes\/([^/]+)$/, 'admin', null, c => {
      const db = ensure(c.db), d = db.disputes.find(x => x.id === c.p[0]); if (!d) fail(404, 'Dispute not found.'); if (d.status !== 'open') fail(409, 'This dispute is already ' + d.status + '.');
      const o = db.bizOrders.find(x => x.id === d.orderId), act = c.body.action; d.note = cut(c.body.note, 200);
      if (act === 'refund') {
        wallet(db, d.customerId).balance += d.amount; addTx(db, d.customerId, { type: 'in', kind: 'refund', mode: 'normal', title: 'Dispute refund • order #' + d.number, amount: d.amount });
        const net = d.amount - Math.round(d.amount * db.settings.fees.shopCommissionPct / 100), w = wallet(db, d.ownerId), take = Math.min(net, w.balance);
        if (take > 0) { w.balance -= take; addTx(db, d.ownerId, { type: 'out', kind: 'refund', mode: 'business', title: 'Dispute refund • order #' + d.number, amount: take }); }
        if (o) o.refunded = true; d.status = 'refunded'; audit(db, 'Refunded dispute on order #' + d.number);
        notify(db, d.customerId, { type: 'wallet', mode: 'normal', title: 'Dispute resolved', body: kes(d.amount) + ' was refunded to your wallet.', urgent: true });
        bizAudience(db, d.ownerId).forEach(id => notify(db, id, { type: 'order', mode: 'business', title: 'Dispute decided: refunded', body: 'Order #' + d.number + ' was refunded to the customer.', urgent: true, ctx: { orderId: d.orderId } }));
      } else if (act === 'dismiss') {
        d.status = 'dismissed'; audit(db, 'Dismissed dispute on order #' + d.number);
        notify(db, d.customerId, { type: 'system', mode: 'normal', title: 'Dispute closed', body: 'We reviewed order #' + d.number + ' and could not approve a refund.' + (d.note ? ' ' + d.note : '') });
        bizAudience(db, d.ownerId).forEach(id => notify(db, id, { type: 'order', mode: 'business', title: 'Dispute decided: dismissed', body: 'Order #' + d.number + ' dispute was dismissed in your favour.', ctx: { orderId: d.orderId } }));
      } else fail(400, 'Unknown action.');
      return d;
    });
  });
});
