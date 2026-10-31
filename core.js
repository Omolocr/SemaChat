/* SemaChat core — shared API logic.
 * Runs in Node (backend/server.js) AND in the browser (preview mock backend).
 * handle(db, method, url, body, token) -> { status, data }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SemaChatCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const OTP = '123ABC';   // demo-mode code (6 uppercase letters/digits); real codes are random and emailed
  const ADMIN = { emails: ['admin@semachat.app'] };   // developer-console emails; set SEMACHAT_ADMIN_EMAILS in production
  const hooks = { emit() {}, persist() {}, otpSend: null, otpCheck: null, adminAccess: null, sms: null };
  // one-time codes: demo code unless a provider (backend/providers.js) installs real ones
  // sign-in and sign-up use EMAIL only: a 6-character code (A-Z and 0-9, uppercase, valid 5 minutes) is emailed from login1@wavehub.co.ke (demo mode: code 123ABC)
  const normEmail = e => String(e == null ? '' : e).trim().toLowerCase();
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const normCode = c => String(c == null ? '' : c).replace(/[\s-]+/g, '').toUpperCase();
  const isAdminEmail = e => ADMIN.emails.map(normEmail).includes(normEmail(e));
  // ---- development team access (staging only; server.js switches it on from SEMACHAT_TEAM_* settings, off by default)
  // Listed team emails can sign in to the client app and the developer console with ONE shared team code instead of an emailed code.
  const TEAM = { enabled: false, emails: [], code: '', pass: '' };   // pass = private entry pass: opens every console with no sign-in (see /team)
  let teamBypass = false;
  const teamFails = new Map();    // email -> { n, until }  (10 wrong tries lock that email for 15 minutes)
  const isTeamEmail = e => TEAM.enabled && TEAM.emails.map(normEmail).includes(normEmail(e));
  const teamCodeOk = (email, code) => {
    if (!isTeamEmail(email) || !TEAM.code) return false;
    const em = normEmail(email), now = Date.now(), f = teamFails.get(em) || { n: 0, until: 0 };
    if (now < f.until) return false;
    const a = Buffer.from(normCode(code)), b = Buffer.from(normCode(TEAM.code));
    if (a.length === b.length && require('crypto').timingSafeEqual(a, b)) { teamFails.delete(em); return true; }
    f.n++; if (f.n >= 10) { f.n = 0; f.until = now + 15 * 60000; } teamFails.set(em, f); return false;
  };
  const otpSend = (email) => hooks.otpSend ? hooks.otpSend(normEmail(email)) : { hint: 'Demo mode: no email is sent. Use code ' + OTP };
  const otpOk = (email, code) => teamBypass || teamCodeOk(email, code) || (hooks.otpCheck ? hooks.otpCheck(normEmail(email), normCode(code)) : normCode(code) === OTP);
  const CONSENT_VERSION = '2026-10';
  const taps = [], scanners = [];
  const uid = p => p + Math.random().toString(36).slice(2, 9);
  const COLORS = ['#C2410C', '#2F855A', '#6B46C1', '#B7791F', '#2B6CB0', '#B83280', '#0F766E', '#9C4221'];
  const H = 36e5, D = 24 * H;

  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  class HttpError extends Error { constructor(s, m, x) { super(m); this.status = s; this.extra = x; } }
  const fail = (s, m, x) => { throw new HttpError(s, m, x); };
  const RL = {}, PEEK = {};
  const pub = u => u && ({ id: u.id, name: u.name, phone: u.phone, color: u.color, role: u.role, verified: !!(u.verified || u.idSubmitted), tier: tierOf(u), minor: !!u.minor, bio: u.bio, tube: u.tube || null, biz: !!u.hasBizAccount && u.bizStatus === 'active' });
  const tierOf = u => !(u.verified || u.idSubmitted) ? 'yellow' : (u.goldUntil > Date.now() ? 'gold' : 'green');
  const normPhone = p => { p = String(p || '').replace(/[\s-]/g, ''); if (p[0] === '0') p = '+254' + p.slice(1); else if (p[0] !== '+') p = '+' + p; return p; };

  /* ------------------------------------------------------------------ seed */
  function seed() {
    const t = Date.now();
    const mk = (id, name, phone, email, role, bio) => ({
      id, name, phone, email, backupEmail: email.replace('@', '.bk@'), role, status: 'active', verified: role !== 'user',
      bio: bio || '', color: COLORS[Math.abs(hash(id)) % COLORS.length], joined: t - (15 + Math.abs(hash(id)) % 240) * D, tube: null,
      activeMode: 'normal', hasBizAccount: false, bizStatus: 'none', bizActivatedAt: null, stats: { informalSales: 0, pinTaps: 0, referredBy: null }, prefs: null
    });
    const users = [
      mk('u_me', 'Amani Njoroge', '+254700111222', 'amani@mail.com', 'user', 'Nanyuki • coffee, code & coastlines'),
      mk('u_wanjiru', 'Wanjiru Kamau', '+254711222333', 'wanjiru@mail.com', 'user', 'Nurse, runner, plant mum 🌿'),
      mk('u_otieno', 'Otieno Odhiambo', '+254722333444', 'otieno@mail.com', 'user', 'Photographer. Lake Victoria soul.'),
      mk('u_fatuma', 'Fatuma Hassan', '+254733444555', 'fatuma@mail.com', 'user', 'Baker • Mombasa ☀️'),
      mk('u_kiprono', 'Kiprono Koech', '+254744555666', 'kiprono@mail.com', 'user', 'Marathon coach, Iten'),
      mk('u_zawadi', 'Zawadi Mwangi', '+254755666777', 'zawadi@mail.com', 'user', 'Student • loves chess ♟️'),
      mk('c_savanna', 'Savanna Coffee Co.', '+254205550000', 'hello@savannacoffee.example', 'corporate', 'Single-origin coffee from the slopes of Mt. Kenya'),
      mk('i_laikipia', 'Laikipia Institute of Tech', '+254620000111', 'info@lit.example', 'institution', 'Open days, scholarships and campus life'),
      mk('u_baraka', 'Baraka Mutua', '+254766777888', 'baraka@mail.com', 'user', 'Bus driver by day, DJ by night'),
      mk('u_neema', 'Neema Wekesa', '+254777888999', 'neema@mail.com', 'user', 'Architecture student'),
      mk('u_juma', 'Juma Barasa', '+254788999000', 'juma@mail.com', 'user', 'Chef • Kisumu'),
      mk('u_ai', 'SemaChat Assistant', '+000000000000', 'assistant@semachat.app', 'system', 'Works in both Normal and Business mode')
    ];
    const friends = {};
    users.forEach(u => friends[u.id] = []);
    const link = (a, b) => { friends[a].push(b); friends[b].push(a); };
    ['u_wanjiru', 'u_otieno', 'u_fatuma', 'u_kiprono', 'u_zawadi', 'c_savanna', 'i_laikipia'].forEach(x => link('u_me', x));
    link('u_wanjiru', 'u_otieno'); link('u_otieno', 'u_kiprono'); link('u_fatuma', 'u_zawadi');
    const U = id => users.find(u => u.id === id);
    Object.assign(U('c_savanna'), { hasBizAccount: true, bizStatus: 'active', bizActivatedAt: t - 40 * D });
    U('u_juma').bizStatus = 'pending'; U('u_neema').bizStatus = 'rejected';
    U('u_me').stats = { informalSales: 3, pinTaps: 4, referredBy: null };
    const bizAccounts = {
      c_savanna: { name: 'Savanna Coffee Co.', category: 'cafe', kind: 'formal', taxPin: 'P051234567X', team: ['u_fatuma'], payoutSchedule: 'weekly', bankLinked: true, lastPayout: t - 3 * D, inboxAccess: 'all', status: 'active', createdAt: t - 40 * D },
      u_juma: { name: "Juma's Kitchen", category: 'restaurant', kind: 'informal', taxPin: null, team: [], payoutSchedule: 'manual', bankLinked: false, inboxAccess: 'all', status: 'pending', createdAt: t - 2 * D },
      u_neema: { name: 'Neema Design Studio', category: 'design', kind: 'informal', taxPin: null, team: [], payoutSchedule: 'manual', bankLinked: false, inboxAccess: 'all', status: 'rejected', rejectReason: 'Please add a clear photo of your ID and try again.', createdAt: t - 6 * D }
    };

    const chats = [
      { id: 'ch_1', type: 'direct', name: '', members: ['u_me', 'u_wanjiru'], read: {} },
      { id: 'ch_2', type: 'direct', name: '', members: ['u_me', 'u_otieno'], read: {} },
      { id: 'ch_3', type: 'group', name: 'Family 🌍', members: ['u_me', 'u_fatuma', 'u_kiprono', 'u_zawadi'], read: {} },
      { id: 'ch_4', type: 'group', name: 'Weekend Hike Crew ⛰️', members: ['u_me', 'u_otieno', 'u_wanjiru', 'u_kiprono'], read: {} },
      { id: 'ch_5', type: 'direct', name: '', members: ['u_me', 'c_savanna'], read: {} }
    ];
    const messages = [];
    const M = (chatId, from, type, text, meta, min) => messages.push({ id: uid('m_'), chatId, from, type, text: text || '', meta: meta || null, ts: t - min * 60000 });
    M('ch_1', 'u_wanjiru', 'text', 'Habari! Are we still on for the Saturday run? 🏃🏾‍♀️', null, 190);
    M('ch_1', 'u_me', 'text', 'Yes! 6am at the Nanyuki stadium.', null, 185);
    M('ch_1', 'u_wanjiru', 'voice', '', { dur: 14 }, 60);
    M('ch_1', 'u_wanjiru', 'location', '', { lat: 0.0167, lng: 37.0740, label: 'Meet-up point • Nanyuki Stadium' }, 55);
    M('ch_2', 'u_otieno', 'photo', 'Sunrise over Rusinga 🌅', { name: 'rusinga.jpg', emoji: '🌅', g: ['#f6ad55', '#c53030'] }, 400);
    M('ch_2', 'u_me', 'text', 'Wow. That light! Print it for me.', null, 380);
    M('ch_3', 'u_fatuma', 'text', 'Mama\'s birthday is on the 28th. Who is bringing the cake? 🎂', null, 900);
    M('ch_3', 'u_kiprono', 'text', 'I will handle the drinks.', null, 880);
    M('ch_3', 'u_zawadi', 'file', '', { name: 'Birthday-budget.xlsx', size: '84 KB' }, 860);
    M('ch_3', 'u_fatuma', 'text', 'Amani, you on logistics?', null, 30);
    M('ch_4', 'u_wanjiru', 'music', '', { title: 'Jambo Bwana (Acoustic)', artist: 'Kilele Band', dur: 214 }, 1500);
    M('ch_4', 'u_otieno', 'contact', '', { name: 'Guide Moses (Mt. Kenya)', phone: '+254712000111' }, 1400);
    M('ch_4', 'u_me', 'call', '', { mode: 'voice', dur: 252, count: 4 }, 1300);
    M('ch_5', 'c_savanna', 'text', 'Karibu! Your order of 2 × Kirinyaga AA is ready for pickup ☕', null, 120);
    chats.forEach(c => { if (c.id !== 'ch_3' && c.id !== 'ch_5') c.read.u_me = t; });
    chats.forEach(c => { c.mode = 'normal'; c.memberMode = {}; c.crossMode = false; c.archivedAt = null; c.bizOwner = null; c.phoneRevealed = false; });
    Object.assign(chats[4], { mode: 'business', memberMode: { u_me: 'normal', c_savanna: 'business' }, bizOwner: 'c_savanna' });
    chats.push({ id: 'ch_6', type: 'group', name: 'Roastery Team ☕', members: ['c_savanna', 'u_fatuma'], read: {}, mode: 'business', memberMode: {}, crossMode: false, archivedAt: null, bizOwner: null, phoneRevealed: false });
    chats.push({ id: 'ch_7', type: 'direct', name: '', members: ['c_savanna', 'u_zawadi'], read: { c_savanna: t, u_zawadi: t }, mode: 'business', memberMode: { u_zawadi: 'normal', c_savanna: 'business' }, crossMode: false, archivedAt: null, bizOwner: 'c_savanna', phoneRevealed: false });
    M('ch_6', 'c_savanna', 'text', 'Team: Kirinyaga AA stock arrives Thursday. Please update the shelf labels.', null, 300);
    M('ch_6', 'u_fatuma', 'text', 'On it! I will also prep the weekend promo.', null, 280);
    M('ch_7', 'u_zawadi', 'text', 'Do you still sell the 250g bags?', null, 60 * 24 * 100);
    M('ch_7', 'c_savanna', 'text', 'Yes, KES 780 each!', null, 60 * 24 * 100 - 5);
    messages.forEach(m => { const ch = chats.find(x => x.id === m.chatId); m.modeContext = ch ? ch.mode : 'normal'; });

    const P = (id, a, kind, cap, emoji, g, dur, likes, views, ago, extra) => Object.assign({
      id, authorId: a, kind, caption: cap, media: { emoji, g, dur }, likes, comments: [], views, ts: t - ago * H, removed: false, promoted: false
    }, extra || {});
    const posts = [
      P('p1', 'u_wanjiru', 'reel', 'Morning 10K done ✅ Nanyuki hills hit different', '🏃🏾‍♀️', ['#38a169', '#2c5282'], 28, ['u_me', 'u_otieno'], 412, 3),
      P('p2', 'u_otieno', 'tube', 'Behind the lens: shooting the Lake Victoria fishermen at dawn', '📸', ['#ed8936', '#744210'], 312, ['u_me'], 1290, 9),
      P('p3', 'u_fatuma', 'reel', 'Mahamri recipe in 45 seconds 🥐', '🥐', ['#ecc94b', '#c05621'], 45, ['u_me', 'u_zawadi', 'u_kiprono'], 2210, 20),
      P('p4', 'c_savanna', 'business', 'New harvest just landed: Kirinyaga AA. Notes of blackcurrant and brown sugar. 15% off this week.', '☕', ['#744210', '#1a202c'], 22, ['u_me', 'u_fatuma'], 5400, 5, { promoted: true }),
      P('p5', 'i_laikipia', 'business', 'Open Day • Saturday 8am. Scholarships in Engineering, Nursing & Agribusiness.', '🎓', ['#2b6cb0', '#1a365d'], 30, ['u_zawadi'], 3120, 28),
      P('p6', 'u_me', 'reel', 'Brewing at home: the pour-over that saved my Monday', '☕', ['#975a16', '#44337a'], 19, ['u_wanjiru'], 188, 40),
      P('p7', 'u_kiprono', 'reel', 'Track Tuesday: 8 × 400m. Who joins?', '🏟️', ['#e53e3e', '#702459'], 36, ['u_me', 'u_wanjiru'], 960, 52)
    ];
    posts[1].comments.push({ userId: 'u_me', text: 'Pure art 🔥', ts: t - 8 * H });
    posts[2].comments.push({ userId: 'u_zawadi', text: 'Making this tonight!', ts: t - 19 * H });

    const explore = [
      { id: 'e1', cat: 'business', tag: 'Jobs', emoji: '💼', title: 'Frontend Developer • Nairobi', sub: 'Savanna Tech • KES 180k / month' },
      { id: 'e2', cat: 'business', tag: 'Marketplace', emoji: '🛍️', title: 'Handwoven Kiondo baskets', sub: 'Mama Njeri Crafts • from KES 1,200' },
      { id: 'e3', cat: 'business', tag: 'Events', emoji: '🎤', title: 'Nairobi Startup Mixer', sub: 'Fri 6pm • iHub • 120 going' },
      { id: 'e4', cat: 'business', tag: 'Deals', emoji: '🏷️', title: 'Flat 20% off farm inputs', sub: 'AgriMart • this week only' },
      { id: 'e5', cat: 'business', tag: 'Jobs', emoji: '🧑🏾‍🏫', title: 'Maths teacher • Nanyuki', sub: 'Mt. Kenya Academy • full time' },
      { id: 'e6', cat: 'business', tag: 'Learning', emoji: '📚', title: 'Digital marketing bootcamp', sub: '6 weeks • online • KES 9,500' },
      { id: 'e7', cat: 'entertainment', tag: 'Music', emoji: '🎧', title: 'Top 10 East Africa this week', sub: 'Updated daily • 1.2M listeners' },
      { id: 'e8', cat: 'entertainment', tag: 'Shows', emoji: '🎭', title: 'Churchill Show live tickets', sub: 'Sun 2pm • KICC grounds' },
      { id: 'e9', cat: 'entertainment', tag: 'Sports', emoji: '⚽', title: 'Gor Mahia vs AFC Leopards', sub: 'Sat 3pm • live scores & chat room' },
      { id: 'e10', cat: 'entertainment', tag: 'Games', emoji: '🎲', title: 'SemaChat Chess Arena', sub: 'Play with friends • 2,310 online' },
      { id: 'e11', cat: 'entertainment', tag: 'Movies', emoji: '🎬', title: 'Afro-cinema night', sub: 'Streams free until Sunday' },
      { id: 'e12', cat: 'entertainment', tag: 'Podcasts', emoji: '🎙️', title: 'Life After Campus', sub: 'Ep. 41 • Building a career at home' }
    ];

    const partners = [
      { id: 'pt_air', category: 'flights', name: 'Savanna Air', tagline: 'Fly across East Africa', enabled: true, commission: 5, items: [
        { id: 'it1', title: 'Nairobi → Mombasa', meta: 'Today 17:40 • 1h 00m', price: 8900 },
        { id: 'it2', title: 'Nairobi → Kisumu', meta: 'Tomorrow 07:10 • 55m', price: 7400 },
        { id: 'it3', title: 'Nairobi → Addis Ababa', meta: 'Fri 09:30 • 2h 10m', price: 24000 }] },
      { id: 'pt_rail', category: 'trains', name: 'Rift Rail Express', tagline: 'Comfortable rail journeys', enabled: true, commission: 4, items: [
        { id: 'it4', title: 'Nairobi → Mombasa (Economy)', meta: 'Daily 08:00 • 5h 30m', price: 1500 },
        { id: 'it5', title: 'Nairobi → Mombasa (First class)', meta: 'Daily 08:00 • 5h 30m', price: 4500 }] },
      { id: 'pt_bus', category: 'buses', name: 'Kilimanjaro Coaches', tagline: 'Long-distance, safe & on time', enabled: true, commission: 6, items: [
        { id: 'it6', title: 'Nairobi → Kisumu', meta: 'Night coach 21:00 • 7h', price: 1800 },
        { id: 'it7', title: 'Nairobi → Nanyuki', meta: 'Every hour • 3h', price: 700 },
        { id: 'it8', title: 'Mombasa → Nairobi', meta: 'Night coach 20:30 • 9h', price: 1600 }] },
      { id: 'pt_taxi', category: 'taxis', name: 'Jambo Rides', tagline: 'Rides in minutes', enabled: true, commission: 8, items: [
        { id: 'it9', title: 'Airport transfer (JKIA → CBD)', meta: 'Sedan • 4 seats', price: 2200 },
        { id: 'it10', title: 'City ride (up to 10 km)', meta: 'Economy • est. 15 min', price: 650 }] },
      { id: 'pt_hotel', category: 'hotels', name: 'Acacia Hotels', tagline: 'Stay close to nature', enabled: true, commission: 10, items: [
        { id: 'it11', title: 'Nanyuki Lodge • Deluxe room', meta: 'per night • breakfast incl.', price: 6800 },
        { id: 'it12', title: 'Mombasa Beach Resort • Sea view', meta: 'per night • half board', price: 12500 }] },
      { id: 'pt_food', category: 'restaurants', name: 'Mama Pima Kitchen', tagline: 'Book a table, taste home', enabled: true, commission: 7, items: [
        { id: 'it13', title: 'Table for 2 • Dinner deposit', meta: 'Westlands • today 19:30', price: 1000 },
        { id: 'it14', title: 'Nyama choma platter (family)', meta: 'Nanyuki • pickup', price: 3200 }] }
    ];

    const products = [
      { id: 'sp1', name: 'Kirinyaga AA coffee 500g', price: 1450, emoji: '☕', seller: 'Savanna Coffee Co.' },
      { id: 'sp2', name: 'Kiondo market basket', price: 1200, emoji: '🧺', seller: 'Mama Njeri Crafts' },
      { id: 'sp3', name: 'Maasai shuka blanket', price: 2300, emoji: '🧣', seller: 'Narok Weavers' },
      { id: 'sp4', name: 'Solar lantern + phone charger', price: 1850, emoji: '🔦', seller: 'SunKenya' },
      { id: 'sp5', name: 'Wireless earbuds', price: 3400, emoji: '🎧', seller: 'Gadget Hub' },
      { id: 'sp6', name: 'Soapstone chess set', price: 2900, emoji: '♟️', seller: 'Kisii Carvers' }
    ];

    const financial = [
      { id: 'f1', name: 'Savings Pots', emoji: '🐖', desc: 'Save towards goals. Up to 7% p.a.', cta: 'Open a pot' },
      { id: 'f2', name: 'Micro-loan', emoji: '🤝', desc: 'Instant loans up to KES 50,000 based on your SemaChat activity.', cta: 'Check limit' },
      { id: 'f3', name: 'Insurance', emoji: '🛡️', desc: 'Medical, device and travel cover from KES 99 / month.', cta: 'Get a quote' },
      { id: 'f4', name: 'Pay bills', emoji: '🧾', desc: 'Power, water, TV, school fees and more.', cta: 'Pay a bill' },
      { id: 'f5', name: 'Send abroad', emoji: '🌍', desc: 'Send money to Uganda, Tanzania, Rwanda and beyond.', cta: 'Start transfer' }
    ];

    const plans = [
      { id: 'user_gold', for: 'user', name: 'SemaChat Gold', price: 300, period: 'month', perks: ['Gold verified badge', 'No ads anywhere', 'Priority support'] },
      { id: 'corp_basic', for: 'corporate', name: 'Business Basic', price: 2500, period: 'month', perks: ['Verified business badge', '10 business posts / month', 'Basic analytics'] },
      { id: 'corp_pro', for: 'corporate', name: 'Business Pro', price: 7500, period: 'month', perks: ['Unlimited business posts', 'Promoted placement in AnA', 'Advanced analytics', 'Customer chat inbox'] },
      { id: 'inst_std', for: 'institution', name: 'Institution Standard', price: 5000, period: 'month', perks: ['Verified institution badge', 'Unlimited posts', 'Announcement broadcasts'] },
      { id: 'inst_plus', for: 'institution', name: 'Institution Plus', price: 12000, period: 'month', perks: ['Everything in Standard', 'Promoted placement in AnA', 'Admissions chat bots', 'Priority support'] }
    ];

    const wallets = {};
    users.forEach(u => wallets[u.id] = { balance: 0, tx: [] });
    wallets.u_me = { balance: 24500, tx: [
      { id: 'tx1', type: 'in', title: 'Top up • M-Pesa', amount: 20000, ts: t - 5 * D },
      { id: 'tx2', type: 'out', title: 'Sent to Wanjiru Kamau', amount: 1500, ts: t - 3 * D },
      { id: 'tx3', type: 'out', title: 'Jambo Rides • City ride', amount: 650, ts: t - 2 * D },
      { id: 'tx4', type: 'in', title: 'Received from Fatuma Hassan', amount: 6650, ts: t - 1 * D }] };
    const savTx = [];
    for (let i = 13; i >= 0; i--) { const n = 2 + (Math.abs(hash('d' + i)) % 4); for (let k = 0; k < n; k++) { const a = 600 + (Math.abs(hash('o' + i + k)) % 4200); savTx.push({ id: uid('tx'), type: 'in', kind: 'payment', mode: 'business', title: 'Order payment • #' + (1000 + i * 10 + k), amount: a, tax: Math.round(a - a / 1.16), ts: t - i * D - k * H }); } }
    savTx.push({ id: uid('tx'), type: 'out', kind: 'payout', mode: 'business', title: 'Weekly payout to bank', amount: 18000, ts: t - 3 * D });
    wallets.c_savanna = { balance: 86400, tx: savTx.sort((a, b) => b.ts - a.ts) };
    Object.values(wallets).forEach(w => w.tx.forEach(x => { x.mode = x.mode || 'normal'; x.kind = x.kind || (x.type === 'in' ? 'topup' : 'payment'); }));
    const events = [], ev = (type, userId, hAgo, x) => events.push(Object.assign({ type, userId, ts: t - hAgo * H }, x || {}));
    ['u_wanjiru', 'u_otieno', 'u_fatuma', 'u_zawadi', 'u_kiprono', 'u_baraka', 'u_juma'].forEach((id, i) => ev('biz_segment_tapped', id, 20 + i * 9));
    ev('biz_registration_submitted', 'c_savanna', 45 * 24); ev('biz_registration_approved', 'c_savanna', 44 * 24); ev('biz_registration_submitted', 'u_juma', 48); ev('biz_registration_submitted', 'u_neema', 150);
    for (let i = 0; i < 14; i++) { ev('mode_switched', i % 2 ? 'c_savanna' : 'u_fatuma', i * 9 + 2, { from: i % 2 ? 'normal' : 'business', to: i % 2 ? 'business' : 'normal', deviceId: 'seed' }); ev('mode_switch_time', i % 2 ? 'c_savanna' : 'u_fatuma', i * 9 + 2, { mode: i % 2 ? 'normal' : 'business', activeSeconds: 1800 + (i % 5) * 900 }); }
    for (let i = 0; i < 12; i++) ev('peek_opened', 'c_savanna', i * 12 + 3, { ntype: i % 3 ? 'order' : 'review', mode: 'business' });
    [3, 15, 27, 39, 51, 63].forEach(h => ev('peek_replied_inline', 'c_savanna', h)); [5, 29, 53, 77, 101].forEach(h => ev('peek_switched_mode', 'c_savanna', h)); [8, 32, 56].forEach(h => ev('peek_dismissed', 'c_savanna', h));
    for (let i = 0; i < 6; i++) ev('biz_gate_blocked', 'u_me', i * 14 + 6, { endpoint: 'GET /api/biz/dashboard' }); for (let i = 0; i < 3; i++) ev('biz_gate_blocked', 'u_zawadi', i * 20 + 9, { endpoint: 'GET /api/biz/orders' });
    ['informal_upgrade', 'informal_upgrade', 'informal_upgrade', 'informal_upgrade', 'maps_claim', 'maps_claim', 'generic', 'generic', 'generic'].forEach((e, i) => ev('discovery_cta_clicked', 'u_me', i * 11 + 4, { entryPoint: e }));
    for (let i = 0; i < 40; i++) ev('notification_delivered', i % 2 ? 'c_savanna' : 'u_fatuma', i * 4 + 1, { mode: i % 4 ? 'business' : 'normal', urgent: i % 9 === 0, silent: i % 3 === 0, batched: i % 4 > 0 && i % 5 === 0, ntype: 'order' });
    for (let i = 0; i < 5; i++) ev('customer_phone_reveal', 'u_zawadi', i * 30 + 10, { how: 'first_order' });
    ev('cross_mode_transfer', 'c_savanna', 60, { from: 'business', to: 'normal', amount: 12000 });

    const revenue = [];
    const R = (type, amount, desc, daysAgo) => revenue.push({ id: uid('r_'), type, amount, desc, ts: t - daysAgo * D });
    for (let m = 5; m >= 0; m--) {
      R('subscription', 7500, 'Business Pro • Savanna Coffee Co.', m * 30 + 4);
      R('subscription', 5000, 'Institution Standard • Laikipia Institute of Tech', m * 30 + 6);
      R('commission', 300 + (hash('c' + m) % 700 + 700) % 700, 'Booking commissions', m * 30 + 12);
      R('fee', 120 + (hash('f' + m) % 300 + 300) % 300, 'Transfer & withdrawal fees', m * 30 + 15);
    }

    const planner = { u_me: {
      tasks: [
        { id: 'tk1', title: 'Saturday run with Wanjiru', when: 'Sat 06:00', tag: 'Health', done: false },
        { id: 'tk2', title: 'Order cake for Mama\'s birthday', when: 'Today 14:00', tag: 'Family', done: false },
        { id: 'tk3', title: 'Send Otieno the print order', when: 'Today 17:00', tag: 'Friends', done: true },
        { id: 'tk4', title: 'Pay electricity bill', when: 'Tomorrow', tag: 'Money', done: false },
        { id: 'tk5', title: 'Plan hiking weekend itinerary', when: 'Fri', tag: 'Travel', done: false }],
      goals: [
        { id: 'g1', title: 'Save KES 100,000 for a laptop', emoji: '💻', progress: 45 },
        { id: 'g2', title: 'Run a half-marathon', emoji: '🏅', progress: 30 },
        { id: 'g3', title: 'Read 12 books this year', emoji: '📖', progress: 70 }],
      habits: [
        { id: 'h1', title: 'Drink 2L of water', emoji: '💧', streak: 6, last: '' },
        { id: 'h2', title: '20 minutes of reading', emoji: '📚', streak: 12, last: '' },
        { id: 'h3', title: 'Morning stretch', emoji: '🧘🏾', streak: 3, last: '' }] } };

    return {
      v: 2, users, friends, chats, messages, posts, explore, partners, products, financial, plans, wallets, revenue, planner, bizAccounts, events,
      notifications: [], bizOrders: [], modeState: {}, seen: {},
      places: [{ id: 'pl_roasters', name: 'Nanyuki Roasters', category: 'cafe', area: 'Nanyuki', claimed: false }, { id: 'pl_chemist', name: 'Westlands Chemist', category: 'pharmacy', area: 'Westlands', claimed: true }],
      density: { 'pharmacy|westlands': 62, 'cafe|nanyuki': 8, 'restaurant|cbd': 41 },
      requests: [
        { id: 'rq1', from: 'u_baraka', to: 'u_me', status: 'pending', ts: t - 3 * H },
        { id: 'rq2', from: 'u_neema', to: 'u_me', status: 'pending', ts: t - 26 * H }],
      subscriptions: [
        { id: 's1', userId: 'c_savanna', planId: 'corp_pro', price: 7500, since: t - 12 * D, until: t + 18 * D },
        { id: 's2', userId: 'i_laikipia', planId: 'inst_std', price: 5000, since: t - 10 * D, until: t + 20 * D }],
      bookings: [], orders: [], applications: [],
      reports: [
        { id: 'rp1', postId: 'p4', by: 'u_zawadi', reason: 'Misleading discount claim', status: 'open', ts: t - 6 * H },
        { id: 'rp2', postId: 'p7', by: 'u_neema', reason: 'Spam / repetitive content', status: 'open', ts: t - 20 * H }],
      audit: [{ id: uid('a_'), msg: 'SemaChat platform initialised with demo data', ts: t - 2 * D }],
      settings: {
        maintenance: false, signupsOpen: true, announcement: null, batchWindowMin: 15, autoApproveBiz: false,
        features: { chats: true, calls: true, videoCalls: true, conference: true, ana: true, explore: true, wallet: true, financial: true, shopping: true, travel: true, planner: true, health: true, music: true, donations: true, onthemove: true },
        fees: { p2pTransferPct: 0, withdrawFeePct: 1, shopCommissionPct: 3 }
      }
    };
  }

  /* --------------------------------------------------------------- helpers */
  const byId = (db, id) => db.users.find(u => u.id === id);
  const friendsOf = (db, id) => db.friends[id] || (db.friends[id] = []);
  const wallet = (db, id) => db.wallets[id] || (db.wallets[id] = { balance: 0, tx: [] });
  const planner = (db, id) => db.planner[id] || (db.planner[id] = { tasks: [], goals: [], habits: [] });
  const audit = (db, msg) => { db.audit.unshift({ id: uid('a_'), msg, ts: Date.now() }); db.audit.length = Math.min(db.audit.length, 60); };
  const activeSub = (db, userId) => db.subscriptions.filter(s => s.userId === userId && s.until > Date.now()).sort((a, b) => b.until - a.until)[0] || null;
  const logEvent = (db, type, userId, data) => { db.events.push(Object.assign({ type, userId: userId || null, ts: Date.now() }, data || {})); if (db.events.length > 4000) db.events.splice(0, 500); };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const addTx = (db, userId, t) => { const w = wallet(db, userId); const rec = Object.assign({ id: uid('tx'), ts: Date.now(), mode: 'normal', kind: 'payment' }, t); w.tx.unshift(rec); return rec; };
  const charge = (db, userId, amount, title, mode, kind) => {
    const w = wallet(db, userId);
    if (w.balance < amount) fail(402, 'Not enough balance in your SemaChat wallet. Top up and try again.');
    w.balance -= amount; addTx(db, userId, { type: 'out', title, amount, mode: mode || 'normal', kind: kind || 'payment' });
  };
  const addRevenue = (db, type, amount, desc) => { if (amount > 0) db.revenue.push({ id: uid('r_'), type, amount: Math.round(amount), desc, ts: Date.now() }); };

  /* ---- Dual-mode (Normal / Business) core helpers ---- */
  const MODES = ['normal', 'business'];
  const teamOf = (db, ownerId) => (db.bizAccounts[ownerId] && db.bizAccounts[ownerId].team) || [];
  const bizOwnerFor = (db, u) => {
    if (!u) return null;
    if (u.hasBizAccount && u.bizStatus === 'active') return u.id;
    return Object.keys(db.bizAccounts).find(o => db.bizAccounts[o].status === 'active' && (db.bizAccounts[o].team || []).includes(u.id)) || null;
  };
  const canBiz = (db, u) => !!bizOwnerFor(db, u);
  const bizAudience = (db, ownerId) => [ownerId].concat(teamOf(db, ownerId)).filter(id => byId(db, id));
  const perspective = (ch, id) => (ch.memberMode && ch.memberMode[id]) || ch.mode || 'normal';
  const activeModeOf = (db, u) => (u.activeMode === 'business' && canBiz(db, u)) ? 'business' : 'normal';
  const header = (h, k) => h && (h[k] || h[k.toLowerCase()]);
  // Mode resolution priority: header (if valid + allowed) -> per-device state -> stored user mode -> normal. Never throws.
  function resolveMode(db, user, headers) {
    try {
      if (!user) return 'normal';
      const can = canBiz(db, user), h = header(headers, 'x-semachat-mode'), dev = header(headers, 'x-semachat-device') || 'default';
      if (h === 'business') return can ? 'business' : 'normal';
      if (h === 'normal') return 'normal';
      const ms = (db.modeState[user.id] || {})[dev];
      if (ms === 'business') return can ? 'business' : 'normal';
      if (ms === 'normal') return 'normal';
      return activeModeOf(db, user);
    } catch (e) { return 'normal'; }
  }
  function setMode(db, u, mode, dev) {
    dev = dev || 'default';
    const forced = mode === 'business' && !canBiz(db, u), next = forced ? 'normal' : mode;
    const prev = activeModeOf(db, u), now = Date.now();
    (db.modeState[u.id] = db.modeState[u.id] || {})[dev] = next;
    u.activeMode = next;
    if (prev !== next) {
      logEvent(db, 'mode_switch_time', u.id, { mode: prev, activeSeconds: Math.round((now - (u.modeSince || now)) / 1000) });
      logEvent(db, 'mode_switched', u.id, { from: prev, to: next, deviceId: dev });
      u.modeSince = now;
    }
    hooks.emit(u.id, { type: 'mode:changed', mode: next, deviceId: dev });
    return { activeMode: next, forced };
  }
  function bizState(db, u) {
    const st = canBiz(db, u) ? 'active' : (u.bizStatus === 'archived' ? 'none' : u.bizStatus);
    const map = { none: ['Register', 'register'], pending: ['Continue', 'continue_registration'], active: [null, 'none'], suspended: ['Contact support', 'view_status'], rejected: ['Resubmit', 'register'] };
    let [ctaLabel, ctaAction] = map[st] || map.none;
    const acc = db.bizAccounts[u.id];
    const canReactivate = u.bizStatus === 'archived' && !!acc && acc.status === 'archived';
    if (canReactivate) { ctaLabel = 'Reactivate'; ctaAction = 'reactivate'; }
    return { status: st, ctaLabel, ctaAction, canReactivate, rejectReason: (acc && acc.status === 'rejected') ? acc.rejectReason : null };
  }
  const visible = (db, ch, u) => ch.members.includes(u.id) || (ch.type === 'direct' && !!ch.bizOwner && teamOf(db, ch.bizOwner).includes(u.id) && canBiz(db, u));
  const PHONE_RE = /(\+?254|0)[17]\d{8}/;

  // viewer-aware public profile: customers' phone numbers are hidden from the business side until revealed
  function viewPub(db, u, viewerId, ch) {
    const p = pub(u);
    if (ch && ch.bizOwner && ch.type === 'direct' && !ch.phoneRevealed && u.id !== ch.bizOwner && ch.memberMode[u.id] === 'normal' && perspective(ch, viewerId) === 'business') { p.phone = null; p.bio = ''; p.phoneHidden = true; }
    return p;
  }
  function chatView(db, ch, meId) {
    const msgs = db.messages.filter(m => m.chatId === ch.id);
    const last = msgs[msgs.length - 1] || null;
    const members = ch.members.map(id => viewPub(db, byId(db, id), meId, ch));
    let other = null;
    if (ch.type === 'direct') {
      const oid = ch.members.includes(meId) ? ch.members.find(id => id !== meId) : (ch.members.find(id => ch.memberMode[id] === 'normal') || ch.members[0]);
      other = members.find(m => m.id === oid);
    }
    const readTs = ch.read[meId] || 0;
    return {
      id: ch.id, type: ch.type, name: ch.type === 'direct' ? other.name : ch.name, color: other ? other.color : COLORS[Math.abs(hash(ch.id)) % COLORS.length], members, other,
      last, lastTs: last ? last.ts : 0, unread: msgs.filter(m => m.from !== meId && m.ts > readTs).length,
      modeContext: perspective(ch, meId), isCrossMode: !!ch.crossMode, isBizChat: !!ch.bizOwner, archivedAt: ch.archivedAt || null, phoneRevealed: !!ch.phoneRevealed, ai: !!ch.ai
    };
  }
  function chatOf(db, id, user) {
    const ch = db.chats.find(c => c.id === id);
    if (!ch || !visible(db, ch, user)) fail(404, 'Chat not found');
    return ch;
  }
  function ensureAi(db, u) {
    if (u.role === 'system' || db.chats.some(c => c.ai && c.members.includes(u.id))) return;
    const ch = { id: 'ch_ai_' + u.id, type: 'direct', name: '', members: [u.id, 'u_ai'], read: {}, mode: 'normal', memberMode: {}, crossMode: true, archivedAt: null, bizOwner: null, phoneRevealed: false, ai: true };
    db.chats.push(ch);
    db.messages.push({ id: uid('m_'), chatId: ch.id, from: 'u_ai', type: 'text', text: 'Habari ' + u.name.split(' ')[0] + '! I am your SemaChat Assistant. I work in both Normal and Business mode. Ask me to plan your day, find places or summarise your business.', meta: null, ts: Date.now(), modeContext: 'normal' });
  }
  function sweepArchive(db) {
    const now = Date.now();
    db.chats.forEach(ch => {
      if (ch.archivedAt || ch.ai) return;
      const last = db.messages.filter(m => m.chatId === ch.id).reduce((n, m) => Math.max(n, m.ts), 0);
      if (last && now - last > (ch.mode === 'business' ? 90 : 365) * D) ch.archivedAt = now;
    });
    // 12-month retention for deactivated businesses
    Object.keys(db.bizAccounts).forEach(o => { const b = db.bizAccounts[o]; if (b.status === 'archived' && b.archivedAt && now - b.archivedAt > 365 * D) { delete db.bizAccounts[o]; db.chats = db.chats.filter(c => c.bizOwner !== o); const u = byId(db, o); if (u) u.bizStatus = 'none'; } });
  }
  function postView(db, p, meId) {
    const a = byId(db, p.authorId);
    return {
      id: p.id, kind: p.kind, caption: p.caption, media: p.media, ts: p.ts, views: p.views, promoted: p.promoted,
      author: pub(a), likeCount: p.likes.length, liked: p.likes.includes(meId), commentCount: p.comments.length,
      comments: p.comments.slice(-3).map(c => ({ text: c.text, name: (byId(db, c.userId) || {}).name || 'Someone', ts: c.ts }))
    };
  }
  const series = (s, base, n) => Array.from({ length: n || 7 }, (_, i) => Math.max(3, Math.round(base * (0.55 + 0.45 * Math.abs(Math.sin(hash(s) + i * 1.7))))));
  const REPLIES = ['Haha, yes! 😄', 'Sawa, tutaonana kesho 👍', 'Let me check and get back to you.', 'Karibu sana! 🌍', 'Nimeona, thanks for sharing!', 'That sounds like a plan 📅', 'Poa! 🙌🏾'];
  const BIZ_REPLIES = ['Thanks for contacting us! A team member will reply shortly. ☕', 'Our current offer: 15% off this week 🎉'];
  function aiReply(text, mode) {
    const t = String(text || '').toLowerCase();
    if (mode === 'business') return /order|sale|revenue|payout/.test(t) ? 'In Business mode I can summarise orders and revenue. Open Dashboard → Revenue for the latest numbers, or Alerts for anything urgent.' : 'Business assistant here. Ask about orders, customers, payouts or invoices.';
    return /plan|task|remind|goal/.test(t) ? 'Add it in your Life Planner (Home → My Life Planner) and tick it off when done. 📅' : 'Habari! I can help plan your day, find places or draft messages. What do you need?';
  }
  const previewOf = m => ({ text: m.text, voice: '🎤 Voice message', photo: '📷 Photo', video: '🎥 Video', file: '📎 ' + ((m.meta && m.meta.name) || 'File'), contact: '👤 Contact card', location: '📍 Location', music: '🎵 ' + ((m.meta && m.meta.title) || 'Music'), call: '📞 Call' }[m.type] || m.text);

  /* ---- notifications (mode-scoped, silent / batched / DND-aware) ---- */
  function prefsOf(u) {
    const d = { enabled: false, start: '22:00', end: '06:00', critical: true };
    const p = u.prefs || {};
    return { autoSwitch: p.autoSwitch !== undefined ? p.autoSwitch : 'critical_only', silentBizInNormal: p.silentBizInNormal !== false, silentNormalInBiz: p.silentNormalInBiz !== false,
      dnd: { normal: Object.assign({}, d, (p.dnd || {}).normal), business: Object.assign({}, d, (p.dnd || {}).business, { enabled: ((p.dnd || {}).business || {}).enabled === true }) } };
  }
  const CHANNEL = { chat: 'chat', chat_biz: 'chat_biz', call: 'calls', order: 'biz_orders', payment: 'biz_payments', ad: 'biz_ads', review: 'biz_reviews', verification: 'system', wallet: 'wallet', system: 'system' };
  function inDnd(d) {
    if (!d || !d.enabled) return false;
    const now = new Date(), m = now.getHours() * 60 + now.getMinutes(), a = d.start.split(':').map(Number), b = d.end.split(':').map(Number), s = a[0] * 60 + a[1], e = b[0] * 60 + b[1];
    return s <= e ? (m >= s && m < e) : (m >= s || m < e);
  }
  function notify(db, userId, n) {
    const u = byId(db, userId); if (!u || u.role === 'system') return null;
    const pr = prefsOf(u), active = activeModeOf(db, u), urgent = !!n.urgent, now = Date.now();
    const cross = active !== n.mode;
    const silent = !urgent && cross && (n.mode === 'business' ? pr.silentBizInNormal : pr.silentNormalInBiz);
    const dnd = pr.dnd[n.mode], dndOn = inDnd(dnd);
    const held = dndOn && !(urgent && dnd.critical !== false);
    let batchId = null, batchTs = null;
    if (!urgent && n.mode === 'business') {
      const win = (db.settings.batchWindowMin || 15) * 60000;
      const open = db.notifications.filter(x => x.userId === userId && x.mode === 'business' && x.batchId && now - x.batchTs < win).sort((a, b) => b.ts - a.ts)[0];
      batchId = open ? open.batchId : uid('b_'); batchTs = open ? open.batchTs : now;
    }
    const rec = { id: uid('n_'), userId, type: n.type, channel: CHANNEL[n.type] || 'system', mode: n.mode, title: (n.mode === 'business' ? 'Business: ' : '') + n.title, body: n.body || '', urgent, ctx: n.ctx || {},
      amount: n.amount || 0, rating: n.rating || null, ts: now, read: false, batchId, batchTs, color: n.mode === 'business' ? '#1EC40B' : '#2B6CB0', delivery: { silent, banner: !silent && !held, sound: !silent && !held, held } };
    db.notifications.push(rec);
    if (db.notifications.length > 1500) db.notifications.splice(0, 300);
    logEvent(db, 'notification_delivered', userId, { mode: n.mode, urgent, silent, batched: !!batchId, ntype: n.type });
    hooks.emit(userId, { type: 'notification', n: rec });
    return rec;
  }
  function summarize(list) {
    const orders = list.filter(x => x.type === 'order'), rev = list.filter(x => x.type === 'review'), msgs = list.filter(x => x.type === 'chat_biz'), pays = list.filter(x => x.type === 'payment');
    const parts = [];
    if (orders.length) parts.push(orders.length + ' new order' + (orders.length > 1 ? 's' : '') + ' (KES ' + orders.reduce((n, x) => n + x.amount, 0).toLocaleString('en-KE') + ')');
    if (rev.length) parts.push(rev.length + ' new review' + (rev.length > 1 ? 's' : ''));
    if (msgs.length) parts.push(msgs.length + ' new message' + (msgs.length > 1 ? 's' : ''));
    if (pays.length) parts.push(pays.length + ' payment update' + (pays.length > 1 ? 's' : ''));
    return parts.join(', ') || list.length + ' updates';
  }
  function collapse(list) {
    const groups = {}, out = [];
    list.slice().sort((a, b) => b.ts - a.ts).forEach(n => {
      if (!n.batchId) { out.push(Object.assign({}, n, { isBatch: false })); return; }
      if (groups[n.batchId]) { groups[n.batchId].children.push(n); return; }
      const h = { head: n, children: [n] }; groups[n.batchId] = h; out.push(h);
    });
    return out.map(x => {
      if (!x.children) return x;
      if (x.children.length === 1) return Object.assign({}, x.head, { isBatch: false });
      return Object.assign({}, x.head, { id: x.head.batchId, isBatch: true, type: 'batch', title: 'Business: ' + x.children.length + ' new updates', body: summarize(x.children), count: x.children.length,
        read: x.children.every(c => c.read), urgent: false, ts: x.children[0].ts });
    });
  }

  function pushMessage(db, ch, from, type, text, meta) {
    const m = { id: uid('m_'), chatId: ch.id, from, type, text: text || '', meta: meta || null, ts: Date.now(), modeContext: ch.mode || 'normal' };
    db.messages.push(m);
    scanners.forEach(f => { try { f(db, ch, m); } catch (e) { /* safety scan must never block chat */ } });
    ch.read[from] = m.ts; ch.archivedAt = null;
    const rec = new Set(ch.members);
    if (ch.bizOwner && ch.type === 'direct') teamOf(db, ch.bizOwner).forEach(x => rec.add(x));
    rec.delete(from);
    const sender = byId(db, from);
    rec.forEach(id => {
      const u = byId(db, id); if (!u || u.role === 'system') return;
      hooks.emit(id, { type: 'message', chatId: ch.id, msg: m });
      const mode = perspective(ch, id);
      const who = (ch.type === 'group' ? ch.name + ' • ' : '') + (sender ? sender.name : 'Someone');
      notify(db, id, { type: mode === 'business' ? 'chat_biz' : 'chat', mode, title: who, body: previewOf(m), ctx: { chatId: ch.id, senderName: sender ? sender.name : '' } });
    });
    return m;
  }
  function autoReply(db, ch, senderId, mode, text) {
    if (ch.ai) {
      setTimeout(() => { pushMessage(db, ch, 'u_ai', 'text', aiReply(text, mode)); hooks.persist(); }, 900);
      return;
    }
    // demo behaviour: members who are not currently using the app answer automatically
    const others = ch.members.filter(id => id !== senderId && (db.seen[id] || 0) < Date.now() - 120000 && byId(db, id) && byId(db, id).role !== 'system');
    if (!others.length) return;
    const who = pick(others), u = byId(db, who);
    const pool = (u.role === 'user' && !(ch.bizOwner === who)) ? REPLIES : BIZ_REPLIES;
    setTimeout(() => { pushMessage(db, ch, who, 'text', pick(pool)); hooks.persist(); }, 1600 + Math.random() * 1400);
  }
  function bizChatFor(db, custId, ownerId) {
    let ch = db.chats.find(c => c.type === 'direct' && c.bizOwner === ownerId && c.members.includes(custId));
    if (!ch) { ch = { id: uid('ch_'), type: 'direct', name: '', members: [custId, ownerId], read: {}, mode: 'business', memberMode: { [custId]: 'normal', [ownerId]: 'business' }, crossMode: false, archivedAt: null, bizOwner: ownerId, phoneRevealed: false }; db.chats.push(ch); }
    return ch;
  }
  function approveBiz(db, uidv, by) {
    const u = byId(db, uidv), b = db.bizAccounts[uidv]; if (!u || !b) fail(404, 'No registration found.');
    b.status = 'active'; b.approvedAt = Date.now(); u.hasBizAccount = true; u.bizStatus = 'active'; u.bizActivatedAt = Date.now(); u.verified = true;
    logEvent(db, 'biz_registration_approved', uidv);
    notify(db, uidv, { type: 'verification', mode: 'normal', title: 'Business verified', body: 'Congratulations! ' + b.name + ' is live. Switch to Business mode to start.', urgent: true });
  }
  function revenueSummary(db, ownerId, days) {
    const since = Date.now() - days * D, w = wallet(db, ownerId), tx = w.tx.filter(t => t.mode === 'business' && t.ts >= since);
    const pays = tx.filter(t => t.type === 'in' && t.kind === 'payment');
    const rev = pays.reduce((n, t) => n + t.amount, 0), byDay = {};
    for (let i = days - 1; i >= 0; i--) byDay[new Date(Date.now() - i * D).toISOString().slice(0, 10)] = 0;
    pays.forEach(t => { const k = new Date(t.ts).toISOString().slice(0, 10); if (k in byDay) byDay[k] += t.amount; });
    return { days, revenue: rev, orders: pays.length, avgOrder: pays.length ? Math.round(rev / pays.length) : 0, taxCollected: pays.reduce((n, t) => n + (t.tax || 0), 0),
      refunds: tx.filter(t => t.kind === 'refund').reduce((n, t) => n + t.amount, 0), adSpend: tx.filter(t => t.kind === 'ad_spend').reduce((n, t) => n + t.amount, 0),
      payouts: tx.filter(t => t.kind === 'payout').reduce((n, t) => n + t.amount, 0), series: Object.keys(byDay).map(k => ({ date: k, revenue: byDay[k] })) };
  }
  function doPayout(db, ownerId, amount, auto) {
    const biz = db.bizAccounts[ownerId];
    if (!biz.bankLinked) fail(400, 'Link a bank account before requesting a payout.');
    const w = wallet(db, ownerId);
    const sweepable = w.tx.filter(t => t.mode === 'business' && t.type === 'in' && t.kind === 'payment' && t.ts > (biz.lastPayout || 0)).reduce((n, t) => n + t.amount, 0);
    amount = Math.round(amount || Math.min(sweepable, w.balance));
    if (!(amount > 0)) fail(400, 'Nothing to pay out yet.');
    if (amount > w.balance) fail(402, 'Not enough balance for that payout.');
    const fee = Math.round(amount * db.settings.fees.withdrawFeePct / 100);
    w.balance -= amount;
    addTx(db, ownerId, { type: 'out', kind: 'payout', mode: 'business', title: (auto ? 'Scheduled' : 'Manual') + ' payout to bank', amount, fee });
    addRevenue(db, 'fee', fee, 'Payout fee');
    biz.lastPayout = Date.now();
    notify(db, ownerId, { type: 'payment', mode: 'business', title: 'Payout sent', body: 'KES ' + (amount - fee).toLocaleString('en-KE') + ' is on its way to your bank' });
    return { amount, fee, net: amount - fee, balance: w.balance };
  }
  function runScheduledPayout(db, ownerId) {
    const b = db.bizAccounts[ownerId]; if (!b || !b.bankLinked) return;
    const gap = b.payoutSchedule === 'weekly' ? 7 * D : b.payoutSchedule === 'monthly' ? 30 * D : 0;
    if (gap && Date.now() - (b.lastPayout || 0) >= gap) { try { doPayout(db, ownerId, 0, true); } catch (e) { /* nothing to sweep */ } }
  }
  function invoiceHtml(db, o) {
    const biz = db.bizAccounts[o.ownerId] || {}, cust = byId(db, o.customerId), ch = db.chats.find(c => c.id === o.chatId);
    const phone = ch && ch.phoneRevealed && cust ? cust.phone : '(hidden until customer shares)';
    const rows = o.items.map(i => '<tr><td>' + i.name + '</td><td>' + i.qty + '</td><td>' + i.price.toLocaleString('en-KE') + '</td><td>' + (i.qty * i.price).toLocaleString('en-KE') + '</td></tr>').join('');
    return '<!doctype html><meta charset="utf-8"><title>Invoice ' + o.number + '</title><style>body{font:14px system-ui;max-width:640px;margin:30px auto;padding:0 20px;color:#1f1b2e}table{width:100%;border-collapse:collapse;margin:14px 0}td,th{border-bottom:1px solid #eee;padding:7px;text-align:left}h1{color:#c2410c}</style>' +
      '<h1>SemaChat Biz Invoice</h1><b>Invoice #' + o.number + '</b><br>Date: ' + new Date(o.ts).toDateString() + '<p><b>Bill to:</b> ' + (cust ? cust.name : '') + ' ' + phone + '</p>' +
      '<p><b>Business:</b> ' + (biz.name || '') + '<br>Tax PIN: ' + (biz.taxPin || 'n/a') + '</p><table><tr><th>Item</th><th>Qty</th><th>Unit (KES)</th><th>Total (KES)</th></tr>' + rows + '</table>' +
      '<p>Subtotal: KES ' + o.subtotal.toLocaleString('en-KE') + '<br>VAT (16%, included): KES ' + o.vat.toLocaleString('en-KE') + '<br><b>Total: KES ' + o.total.toLocaleString('en-KE') + '</b></p><p>Payment: SemaChat Wallet — Ref ' + o.id + '</p><p>Thank you for shopping with ' + (biz.name || 'us') + '!</p>';
  }
  function modeMetrics(db, since) {
    const ev = db.events.filter(e => e.ts >= since), now = Date.now();
    const cnt = t => ev.filter(e => e.type === t).length, uniq = t => new Set(ev.filter(e => e.type === t).map(e => e.userId)).size;
    const users = db.users.filter(u => u.role !== 'system'), bizUsers = users.filter(u => u.hasBizAccount && u.bizStatus === 'active');
    const days = Math.max(1, (now - since) / D), secs = m => ev.filter(e => e.type === 'mode_switch_time' && e.mode === m).reduce((n, e) => n + (e.activeSeconds || 0), 0);
    const group = (t, k) => { const g = {}; ev.filter(e => e.type === t).forEach(e => { g[e[k]] = (g[e[k]] || 0) + 1; }); return Object.keys(g).map(x => ({ key: x, count: g[x] })).sort((a, b) => b.count - a.count); };
    const del = ev.filter(e => e.type === 'notification_delivered'), peeks = cnt('peek_opened'), pct = (a, b) => b ? Math.round(a / b * 1000) / 10 : 0;
    const switches = cnt('mode_switched'), biz = users.filter(u => u.hasBizAccount).length;
    return {
      adoption: { totalUsers: users.length, bizAccounts: biz, bizPct: pct(biz, users.length), tappedBusinessPct: pct(uniq('biz_segment_tapped'), users.length), registrationsSubmitted: cnt('biz_registration_submitted'), registrationsApproved: cnt('biz_registration_approved'), registrationConversionPct: pct(cnt('biz_registration_approved'), cnt('biz_registration_submitted')) },
      engagement: { switches, switchesPerUserPerDay: Math.round(switches / Math.max(1, users.length) / days * 100) / 100, avgBizHoursPerDayPerBizUser: Math.round(secs('business') / 3600 / days / Math.max(1, bizUsers.length) * 100) / 100, avgNormalHoursPerDayPerBizUser: Math.round(secs('normal') / 3600 / days / Math.max(1, bizUsers.length) * 100) / 100 },
      peek: { opened: peeks, repliedInline: cnt('peek_replied_inline'), switchedMode: cnt('peek_switched_mode'), dismissed: cnt('peek_dismissed'), autoSwitchTriggered: cnt('auto_switch_triggered'), replyPct: pct(cnt('peek_replied_inline'), peeks), switchPct: pct(cnt('peek_switched_mode'), peeks), dismissPct: pct(cnt('peek_dismissed'), peeks) },
      notifications: { delivered: del.length, silent: del.filter(e => e.silent).length, batched: del.filter(e => e.batched).length, critical: del.filter(e => e.urgent).length },
      gate: { blocks: cnt('biz_gate_blocked'), topEndpoints: group('biz_gate_blocked', 'endpoint').slice(0, 5) },
      discovery: { clicks: cnt('discovery_cta_clicked'), byEntryPoint: group('discovery_cta_clicked', 'entryPoint') },
      wallet: { crossModeTransfers: cnt('cross_mode_transfer') },
      identity: { phoneReveals: cnt('customer_phone_reveal'), customerChats: db.chats.filter(c => c.bizOwner && c.type === 'direct').length, revealPct: pct(cnt('customer_phone_reveal'), db.chats.filter(c => c.bizOwner && c.type === 'direct').length) }
    };
  }

  /* ---------------------------------------------------------------- routes */
  const R = [];
  const route = (m, p, auth, feat, fn) => R.push({ m, p, auth, feat, fn });

  // ---- auth
  // send a verification code to an email address. purpose 'signup' refuses addresses that already have an account.
  const sendCode = c => {
    const em = normEmail(c.body.email);
    if (!EMAIL_RE.test(em)) fail(400, 'Enter a valid email address.');
    if (isTeamEmail(em)) return { sent: true, team: true, masked: em.replace(/^(.).*(@.*)$/, '$1•••$2'), hint: 'Development team access is on for this address. No email is sent: type the team access code you were given.' };
    const exists = c.db.users.find(u => normEmail(u.email) === em);
    if (c.body.purpose === 'signup' && exists) fail(409, 'That email already has an SemaChat account. Sign in instead.');
    if (c.body.purpose === 'signin' && !exists) fail(404, 'No SemaChat account with that email. Sign up first.');
    return Object.assign({ sent: true, masked: em.replace(/^(.).*(@.*)$/, '$1•••$2') }, otpSend(em));
  };
  route('POST', /^\/api\/auth\/otp$/, null, null, sendCode);
  route('POST', /^\/api\/auth\/email\/send$/, null, null, sendCode);
  // ---- sign-up requirements per account type (KYC)
  const ID_TYPES = ['national_id', 'passport'];
  const clean = (v, n) => String(v == null ? '' : v).trim().slice(0, n || 120);
  function kycFor(db, role, b) {
    const k = b.kyc || {}, e = [];
    const need = (v, msg) => { if (!clean(v)) e.push(msg); };
    const out = { role };
    if (role === 'user') {
      need(k.legalName, 'Enter your real name exactly as on your National ID or Passport.');
      out.legalName = clean(k.legalName, 80);
      out.gender = ['male', 'female'].includes(k.gender) ? k.gender : (e.push('Choose Male or Female.'), null);
      out.age = Math.floor(+k.age); if (!(out.age >= 13 && out.age <= 120)) e.push('Enter your age. SemaChat is for people 13 and older.');
      if (clean(k.idNumber)) {
        if (!ID_TYPES.includes(k.idType)) e.push('Choose National ID or Passport.');
        if (!/^[A-Za-z0-9-]{6,20}$/.test(clean(k.idNumber))) e.push('That ID / passport number does not look right.');
        out.idType = k.idType; out.idNumber = clean(k.idNumber, 20).toUpperCase();
        if (db.users.some(u => u.kyc && u.kyc.idNumber === out.idNumber && u.role === 'user')) e.push('An account already exists for that ID number.');
      }
      out.residence = { city: clean(k.city, 60), area: clean(k.area, 100) };
      need(k.city, 'Enter your city, town or village of residence.');
      out.workAddress = clean(k.workAddress, 120);
      out.minor = out.age < 18;
    } else {
      const isCorp = role === 'corporate';
      need(k.orgName, (isCorp ? 'Business' : 'Institution') + ' registered name is required.'); out.orgName = clean(k.orgName, 100);
      need(k.regNumber, 'Registration number is required (certificate of incorporation / registration).'); out.regNumber = clean(k.regNumber, 40).toUpperCase();
      if (isCorp) { need(k.kraPin, 'KRA PIN is required.'); out.kraPin = clean(k.kraPin, 20).toUpperCase(); out.sector = clean(k.sector, 60); }
      else { need(k.instType, 'Choose the type of institution.'); out.instType = clean(k.instType, 40); out.kraPin = clean(k.kraPin, 20).toUpperCase(); out.accreditation = clean(k.accreditation, 80); }
      out.residence = { city: clean(k.city, 60), area: clean(k.area, 100) }; need(k.city, 'Enter the city or town of your head office.'); need(k.area, 'Enter the physical address of your head office.');
      out.rep = { name: clean(k.repName, 80), title: clean(k.repTitle, 60), idNumber: clean(k.repId, 20).toUpperCase() };
      if (!out.rep.name || !out.rep.idNumber) e.push('Authorised representative name and ID number are required.');
      out.gender = ['male', 'female'].includes(k.repGender) ? k.repGender : null;
      out.document = clean(k.document, 120); need(k.document, 'Attach your registration certificate.');
      out.website = clean(k.website, 120); out.age = null; out.minor = false;
    }
    if (e.length) fail(400, e[0], { errors: e });
    out.idSubmitted = role === 'user' ? !!out.idNumber : true;
    return out;
  }
  const signUp = c => {
    const { name, phone, code, role } = c.body, email = normEmail(c.body.email);
    if (!c.db.settings.signupsOpen) fail(403, 'Sign-ups are closed for now.');
    if (!name || name.trim().length < 2) fail(400, 'Please enter your full name.');
    if (!EMAIL_RE.test(email)) fail(400, 'Enter a valid email address. You will sign in with it.');
    if (clean(phone) && !/^\+?[0-9]{9,15}$/.test(String(phone).replace(/[\s-]/g, ''))) fail(400, 'That phone number does not look right. It is optional, so you can leave it blank.');
    if (!otpOk(email, code)) fail(400, 'Wrong or expired email verification code.', { code: 'EMAIL_CODE_INVALID' });
    if (!(c.body.consent && c.body.consent.terms === true && c.body.consent.privacy === true)) fail(400, 'Please accept the Terms of Use and the Privacy Policy to create an account.', { code: 'CONSENT_REQUIRED' });
    const ph = clean(phone) ? normPhone(phone) : '';
    if (c.db.users.some(u => normEmail(u.email) === email)) fail(409, 'That email already has an SemaChat account. Sign in instead.');
    if (ph && c.db.users.some(u => u.phone === ph)) fail(409, 'That phone number is already linked to another account.');
    const r = ['corporate', 'institution'].includes(role) ? role : 'user';
    const kyc = kycFor(c.db, r, c.body);
    const id = uid('u_');
    let guardian = null;
    if (kyc.minor) {
      const g = c.body.guardian || {}, ge = [];
      if (!clean(g.name)) ge.push('Parent / guardian full name is required.');
      if (!EMAIL_RE.test(normEmail(g.email))) ge.push('Parent / guardian email is required: the approval code is sent there.');
      if (!ID_TYPES.includes(g.idType) || !/^[A-Za-z0-9-]{6,20}$/.test(clean(g.idNumber))) ge.push('Parent / guardian ID or passport number is required.');
      if (!['male', 'female'].includes(g.gender)) ge.push('Parent / guardian gender is required.');
      if (!(+g.age >= 18)) ge.push('A parent / guardian must be 18 or older.');
      if (!clean(g.city)) ge.push('Parent / guardian city or town is required.');
      if (EMAIL_RE.test(normEmail(g.email)) && !otpOk(normEmail(g.email), g.approvalCode)) ge.push('Parent / guardian approval code is wrong. They receive a code by email to approve this account.');
      if (ge.length) fail(400, ge[0], { errors: ge, code: 'GUARDIAN_REQUIRED' });
      guardian = g;
    }
    const mkUser = (uidv, nm, phn, em, role2, k) => ({ id: uidv, name: nm, phone: phn, email: em, backupEmail: em, role: role2,
      status: 'active', verified: false, idSubmitted: !!k.idSubmitted, bio: '', color: COLORS[Math.abs(hash(uidv)) % COLORS.length], joined: Date.now(), tube: null,
      activeMode: 'normal', hasBizAccount: false, bizStatus: 'none', bizActivatedAt: null, stats: { informalSales: 0, pinTaps: 0, referredBy: null }, prefs: null, kyc: k, minor: !!k.minor, age: k.age });
    const u = mkUser(id, name.trim(), ph, email, r, kyc); u.emailVerified = true; u.emailVerifiedAt = Date.now();
    u.consent = { terms: true, privacy: true, version: CONSENT_VERSION, ts: Date.now(), ip: String((c.headers || {})['x-client-ip'] || '').slice(0, 64), minorWithGuardian: !!kyc.minor };
    c.db.users.push(u); c.db.friends[id] = []; c.db.wallets[id] = { balance: 0, tx: [] };
    if (guardian) {
      const gp = clean(guardian.phone) ? normPhone(guardian.phone) : '', gem = normEmail(guardian.email);
      let gu = c.db.users.find(x => normEmail(x.email) === gem);
      if (!gu) {
        const gid = uid('u_');
        gu = mkUser(gid, clean(guardian.name, 80), gp, gem, 'user', { role: 'user', legalName: clean(guardian.name, 80), gender: guardian.gender, age: Math.floor(+guardian.age), idType: guardian.idType, idNumber: clean(guardian.idNumber, 20).toUpperCase(), residence: { city: clean(guardian.city, 60), area: clean(guardian.area, 100) }, workAddress: '', minor: false, idSubmitted: true });
        gu.guardianAccount = true; c.db.users.push(gu); c.db.friends[gid] = []; c.db.wallets[gid] = { balance: 0, tx: [] };
      }
      u.guardianId = gu.id; gu.guardianOf = (gu.guardianOf || []).concat(id); u.guardianRelation = clean(guardian.relation, 30) || 'Parent';
      audit(c.db, 'Minor account created: ' + u.name + ' (guardian ' + gu.name + ')');
    }
    return { token: 'tok_' + id };
  };
  route('POST', /^\/api\/auth\/signup$/, null, null, signUp);
  // Team entry pass: the dev team opens the client app AND the developer console with no sign-up or sign-in.
  // The private link is /team#pass=<SEMACHAT_TEAM_PASS>&who=<name>; the pass travels in the URL fragment, so it is never sent in a request URL or logged.
  route('POST', /^\/api\/team\/enter$/, null, null, c => {
    if (!TEAM.pass) fail(404, 'Team entry is not switched on.');
    const given = Buffer.from(normCode(c.body.pass)), want = Buffer.from(normCode(TEAM.pass));
    const now = Date.now(), f = teamFails.get('pass') || { n: 0, until: 0 };
    if (now < f.until) fail(429, 'Too many wrong passes. Try again in a few minutes.');
    if (given.length !== want.length || !require('crypto').timingSafeEqual(given, want)) { f.n++; if (f.n >= 10) { f.n = 0; f.until = now + 15 * 60000; } teamFails.set('pass', f); fail(401, 'That team pass is not valid.'); }
    teamFails.delete('pass');
    const who = String(c.body.who || 'tester').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'tester', em = 'team-' + who + '@semachat.team';
    let u = c.db.users.find(x => normEmail(x.email) === em);
    if (!u) {
      const nm = 'Team ' + who.charAt(0).toUpperCase() + who.slice(1);
      teamBypass = true;
      try { signUp(Object.assign({}, c, { body: { name: nm, email: em, code: 'x', role: 'user', consent: { terms: true, privacy: true },
        kyc: { legalName: nm, gender: 'male', age: 30, idType: 'national_id', idNumber: '9' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0'), city: 'Nairobi', area: 'Team' } } })); } finally { teamBypass = false; }
      u = c.db.users.find(x => normEmail(x.email) === em); if (u) { u.team = true; u.emailVerified = true; audit(c.db, 'Team pass: test account created for ' + who); }
    }
    audit(c.db, 'Team pass entry (client app + developer console): ' + who);
    return { token: 'tok_' + u.id, adminToken: 'tok_admin', who, name: u.name };
  });
  // sign in: email + the code we emailed. The app keeps the person signed in (tokens never expire) until they sign off.
  const signIn = c => {
    const em = normEmail(c.body.email); let u = c.db.users.find(x => normEmail(x.email) === em);
    if (!u && isTeamEmail(em) && teamCodeOk(em, c.body.code)) {      // first visit of a team member: make a test account for them
      const nm = em.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, m => m.toUpperCase()).slice(0, 40) || 'Team Tester';
      signUp(Object.assign({}, c, { body: { name: nm.length < 2 ? 'Team Tester' : nm, email: em, code: c.body.code, role: 'user', consent: { terms: true, privacy: true },
        kyc: { legalName: nm.length < 2 ? 'Team Tester' : nm, gender: 'male', age: 30, idType: 'national_id', idNumber: '9' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0'), city: 'Nairobi', area: 'Team' } } }));
      u = c.db.users.find(x => normEmail(x.email) === em); if (u) { u.team = true; audit(c.db, 'Team test account created: ' + em); }
    }
    if (!u) fail(404, 'No SemaChat account with that email. Sign up first.');
    if (!otpOk(em, c.body.code)) fail(400, 'Wrong or expired email verification code.', { code: 'EMAIL_CODE_INVALID' });
    if (u.status === 'suspended') fail(403, 'Your account has been suspended. Contact SemaChat support.');
    u.lastSignInAt = Date.now(); u.emailVerified = true; if (isTeamEmail(em)) audit(c.db, 'Team access sign-in (client app): ' + em); return { token: 'tok_' + u.id };
  };
  route('POST', /^\/api\/auth\/signin$/, null, null, signIn);
  // "recover" is the same flow: losing a phone no longer matters because the email is the account
  route('POST', /^\/api\/auth\/recover$/, null, null, c => c.body.code ? signIn(c) : sendCode(Object.assign({}, c, { body: Object.assign({}, c.body, { purpose: 'signin' }) })));
  route('POST', /^\/api\/auth\/signout$/, 'user', null, c => { c.user.lastSignOutAt = Date.now(); logEvent(c.db, 'signed_out', c.user.id, {}); return { ok: true }; });

  // ---- me
  route('GET', /^\/api\/me$/, 'user', null, c => {
    const db = c.db, u = c.user;
    const chats = db.chats.filter(x => visible(db, x, u) && !x.archivedAt).map(x => chatView(db, x, u.id));
    const unread = chats.filter(x => x.modeContext === c.mode || x.isCrossMode).reduce((n, x) => n + x.unread, 0);
    const sub = activeSub(db, u.id), owner = bizOwnerFor(db, u);
    return Object.assign({}, pub(u), { email: u.email, backupEmail: u.backupEmail, status: u.status, balance: wallet(db, u.id).balance, unread,
      requests: db.requests.filter(r => r.to === u.id && r.status === 'pending').length, features: db.settings.features, announcement: db.settings.announcement,
      subscription: sub ? { planId: sub.planId, until: sub.until } : null, friendCount: friendsOf(db, u.id).length,
      activeMode: c.mode, hasBizAccount: !!owner, bizStatus: bizState(db, u).status, bizOwnerId: owner, isBizOwner: owner === u.id, prefs: prefsOf(u) });
  });
  route('PATCH', /^\/api\/me$/, 'user', null, c => {
    if (c.body.name) c.user.name = String(c.body.name).slice(0, 60);
    if (typeof c.body.bio === 'string') c.user.bio = c.body.bio.slice(0, 140);
    if (['user', 'corporate', 'institution'].includes(c.body.role)) c.user.role = c.body.role; // demo convenience
    return { ok: true };
  });
  route('GET', /^\/api\/me\/preferences$/, 'user', null, c => prefsOf(c.user));
  route('PATCH', /^\/api\/me\/preferences$/, 'user', null, c => {
    const b = c.body, p = c.user.prefs = c.user.prefs || {};
    if ([true, false, 'critical_only'].includes(b.autoSwitch)) p.autoSwitch = b.autoSwitch;
    if (typeof b.silentBizInNormal === 'boolean') p.silentBizInNormal = b.silentBizInNormal;
    if (typeof b.silentNormalInBiz === 'boolean') p.silentNormalInBiz = b.silentNormalInBiz;
    if (b.dnd) ['normal', 'business'].forEach(m => { if (b.dnd[m]) { const d = p.dnd = p.dnd || {}; d[m] = Object.assign({}, d[m], b.dnd[m]); } });
    return prefsOf(c.user);
  });
  route('POST', /^\/api\/tube$/, 'user', 'ana', c => {
    if (!c.body.name || c.body.name.trim().length < 2) fail(400, 'Give your Tube a name.');
    c.user.tube = { name: c.body.name.trim().slice(0, 40), desc: (c.body.desc || '').slice(0, 120), created: Date.now() };
    return c.user.tube;
  });

  // ---- dual mode: foundation, widget, discovery
  route('GET', /^\/api\/mode\/current$/, 'user', null, c => { const s = bizState(c.db, c.user); return { activeMode: c.mode, hasBizAccount: canBiz(c.db, c.user), bizAccountStatus: s.status }; });
  route('POST', /^\/api\/mode\/switch$/, 'user', null, c => {
    const mode = c.body.mode;
    if (!MODES.includes(mode)) fail(400, 'Mode must be “normal” or “business”.', { code: 'INVALID_MODE' });
    if (mode === 'business') logEvent(c.db, 'biz_segment_tapped', c.user.id);
    if (mode === 'business' && c.user.bizStatus === 'suspended' && !canBiz(c.db, c.user)) fail(403, 'Your business account is suspended. Contact support.', { code: 'BIZ_ACCOUNT_SUSPENDED' });
    const r = setMode(c.db, c.user, mode, c.body.deviceId || header(c.headers, 'x-semachat-device'));
    return Object.assign(r, { hasBizAccount: canBiz(c.db, c.user), bizAccountStatus: bizState(c.db, c.user).status });
  });
  route('GET', /^\/api\/mode\/widget-state$/, 'user', null, c => {
    const db = c.db, u = c.user, st = bizState(db, u);
    const chats = db.chats.filter(x => visible(db, x, u) && !x.archivedAt).map(x => chatView(db, x, u.id));
    const badge = m => chats.filter(x => x.modeContext === m || x.isCrossMode).reduce((n, x) => n + x.unread, 0) +
      db.notifications.filter(n => n.userId === u.id && n.mode === m && !n.read && n.type !== 'chat' && n.type !== 'chat_biz').length;
    const enabled = canBiz(db, u);
    return { activeMode: c.mode, segments: [
      { id: 'normal', label: 'Normal', enabled: true, badgeCount: badge('normal') },
      { id: 'business', label: 'Business', enabled, badgeCount: enabled ? badge('business') : 0, ctaLabel: enabled ? null : st.ctaLabel }],
      bizState: { status: st.status, ctaLabel: st.ctaLabel, ctaAction: st.ctaAction, canReactivate: st.canReactivate, rejectReason: st.rejectReason } };
  });
  route('GET', /^\/api\/mode\/discovery$/, 'user', null, c => {
    const u = c.user, db = c.db, out = [], s = u.stats || {};
    if (canBiz(db, u)) return { entries: [] };
    if (s.referredBy) out.push({ type: 'referral', inviterId: s.referredBy, action: 'register_with_referral', label: 'You were invited by a business owner' });
    if ((s.informalSales || 0) >= 3) out.push({ type: 'informal_upgrade', reason: 'sold_' + s.informalSales + '_times', action: 'upgrade', label: 'You have made ' + s.informalSales + ' sales. Upgrade to a verified business page.' });
    const place = (s.pinTaps || 0) >= 3 ? db.places.find(p => !p.claimed) : null;
    if (place) out.push({ type: 'maps_claim', placeId: place.id, placeName: place.name, action: 'claim_page', label: 'Is “' + place.name + '” yours? Claim its page.' });
    out.push({ type: 'generic', action: 'register', label: 'Grow your business on SemaChat' });
    return { entries: out };
  });
  route('POST', /^\/api\/mode\/discovery\/click$/, 'user', null, c => { logEvent(c.db, 'discovery_cta_clicked', c.user.id, { entryPoint: String(c.body.entryPoint || 'generic').slice(0, 40) }); return { ok: true }; });

  // ---- business: public entry points
  route('GET', /^\/api\/biz\/welcome$/, null, null, c => {
    logEvent(c.db, 'biz_welcome_viewed', c.user ? c.user.id : null);
    return { headline: 'Welcome to SemaChat for Business',
      requirements: ['A phone number and an SemaChat account', 'Business name and category', 'Tax PIN (for registered businesses only)', 'A bank account to receive payouts (optional, later)'],
      benefits: ['A shared business inbox for you and up to 5 teammates', 'One wallet, two views: keep business money separate from personal', 'Verified badge, orders, invoices with VAT', 'Switch between Normal and Business with one tap'],
      ctaButtons: [{ label: 'Start Registration', action: 'register' }, { label: 'Learn More', action: 'learn_more' }, { label: 'Maybe Later', action: 'dismiss' }] };
  });
  route('GET', /^\/api\/biz\/preview$/, null, null, c => {
    const key = header(c.headers, 'x-client-ip') || 'local', now = Date.now(), r = RL[key] = (RL[key] || []).filter(t => now - t < 60000);
    if (r.length >= 10) fail(429, 'Too many preview requests. Try again in a minute.');
    r.push(now); logEvent(c.db, 'biz_preview_viewed', null);
    return { sample: true, banner: 'This is sample data. Register to see your actual metrics.', businessName: String(c.query.name || 'Your Business'),
      kpis: { revenueLastMonth: 45000, orders: 38, avgOrder: 1184, rating: 4.6 },
      chart: [3200, 4100, 2800, 5200, 4700, 6100, 5300, 3900, 4400, 5600, 6200, 5100, 4800, 6400],
      orders: [{ customer: 'Jane M.', items: '3 items', total: 850, status: 'new' }, { customer: 'Peter O.', items: '1 item', total: 1200, status: 'completed' }, { customer: 'Amina H.', items: '5 items', total: 2400, status: 'completed' }],
      reviews: [{ name: 'Jane M.', rating: 5, text: 'Fast delivery and great service!' }, { name: 'Peter O.', rating: 4, text: 'Good prices, will order again.' }] };
  });
  route('GET', /^\/api\/biz\/categories\/([^/]+)\/waitlist-status$/, null, null, c => {
    const cat = decodeURIComponent(c.p[0]).toLowerCase(); let area = String(c.query.area || '').toLowerCase();
    if (!area && c.query.lat && c.query.lng) area = (Math.abs(+c.query.lat + 1.2676) < 0.06 && Math.abs(+c.query.lng - 36.8108) < 0.06) ? 'westlands' : 'unknown';
    const count = c.db.density[cat + '|' + area] || 0, sat = count > 50;
    return { category: cat, area, businessesWithin2km: count, isSaturated: sat, alternativeActions: sat ? [
      { type: 'waitlist', label: 'Join the waitlist for ' + cat + ' in ' + area },
      { type: 'nearby_area', label: 'Register in a nearby area (Parklands)' },
      { type: 'alt_category', label: 'Register as “health & wellness”' },
      { type: 'informal', label: 'List informally (no verification needed)' }] : [] };
  });
  route('GET', /^\/api\/biz\/concierge-available$/, null, null, c => { const used = Object.keys(c.db.bizAccounts).length; return { available: used < 100, slotsUsed: used, slotsTotal: 100 }; });

  // ---- business: registration, status, deactivate / reactivate
  route('POST', /^\/api\/biz\/register$/, 'user', null, c => {
    const { name, category, kind, taxPin } = c.body, u = c.user, db = c.db;
    if (canBiz(db, u) && bizOwnerFor(db, u) === u.id) fail(409, 'You already have a business account.');
    if (!name || name.trim().length < 2) fail(400, 'Enter your business name.');
    if (!category) fail(400, 'Choose a business category.');
    if (kind === 'formal' && !/^[A-Z][0-9]{9}[A-Z]$/i.test(String(taxPin || ''))) fail(400, 'Registered businesses need a valid tax PIN, e.g. P051234567X.');
    const old = db.bizAccounts[u.id] || {};
    db.bizAccounts[u.id] = { name: name.trim().slice(0, 60), category, kind: kind === 'formal' ? 'formal' : 'informal', taxPin: kind === 'formal' ? String(taxPin).toUpperCase() : null, team: old.team || [], payoutSchedule: 'manual', bankLinked: false, inboxAccess: 'all', status: 'pending', createdAt: Date.now() };
    u.bizStatus = 'pending';
    logEvent(db, 'biz_registration_submitted', u.id);
    if (db.settings.autoApproveBiz) approveBiz(db, u.id);
    return { status: db.bizAccounts[u.id].status };
  });
  route('GET', /^\/api\/biz\/status$/, 'user', null, c => Object.assign({ business: c.db.bizAccounts[c.user.id] || null }, bizState(c.db, c.user)));
  route('POST', /^\/api\/biz\/deactivate$/, 'user', null, c => {
    if (c.body.confirm !== true) fail(400, 'Please confirm deactivation.', { code: 'CONFIRM_REQUIRED' });
    const u = c.user, db = c.db, b = db.bizAccounts[u.id];
    if (!b || b.status !== 'active') fail(400, 'You have no active business account.');
    b.status = 'archived'; b.archivedAt = Date.now(); u.hasBizAccount = false; u.bizStatus = 'archived'; u.activeMode = 'normal';
    db.modeState[u.id] = {};
    db.chats.forEach(ch => { if (ch.bizOwner === u.id) { ch.bizArchived = true; ch.archivedAt = Date.now(); } });
    notify(db, u.id, { type: 'system', mode: 'normal', title: 'Business deactivated', body: 'Your Biz account has been deactivated. Reactivate anytime within 12 months.' });
    hooks.emit(u.id, { type: 'mode:changed', mode: 'normal', deviceId: 'all' });
    return { ok: true, activeMode: 'normal', retentionMonths: 12 };
  });
  route('POST', /^\/api\/biz\/reactivate$/, 'user', null, c => {
    const u = c.user, db = c.db, b = db.bizAccounts[u.id];
    if (!b || b.status !== 'archived') fail(400, 'No archived business to reactivate.');
    if (u.role !== 'user' && !activeSub(db, u.id)) { const e = new HttpError(402, 'Your plan has lapsed. Choose a plan to reactivate.'); e.code = 'plan_required'; throw e; }
    b.status = 'active'; delete b.archivedAt; u.hasBizAccount = true; u.bizStatus = 'active';
    db.chats.forEach(ch => { if (ch.bizOwner === u.id && ch.bizArchived) { ch.bizArchived = false; ch.archivedAt = null; } });
    notify(db, u.id, { type: 'system', mode: 'normal', title: 'Welcome back!', body: 'Your Biz page is live again.' });
    return { ok: true };
  });

  // ---- business (gated): dashboard, orders, team, settings, simulator
  route('GET', /^\/api\/biz\/dashboard$/, 'biz', null, c => {
    const db = c.db, u = c.user, o = bizOwnerFor(db, u), biz = db.bizAccounts[o];
    if (o === u.id) runScheduledPayout(db, o);
    const orders = db.bizOrders.filter(x => x.ownerId === o), today = new Date().toDateString();
    const inbox = db.chats.filter(ch => visible(db, ch, u) && !ch.archivedAt && perspective(ch, u.id) === 'business').map(ch => chatView(db, ch, u.id)).reduce((n, x) => n + x.unread, 0);
    const rev = revenueSummary(db, o, 30);
    return { business: biz, ownerName: byId(db, o).name, isOwner: o === u.id, team: teamOf(db, o).length,
      kpis: { newOrders: orders.filter(x => x.status === 'new').length, ordersToday: orders.filter(x => new Date(x.ts).toDateString() === today).length, revenue30: rev.revenue, unreadInbox: inbox, rating: 4.7 } };
  });
  route('GET', /^\/api\/biz\/orders$/, 'biz', null, c => {
    const o = bizOwnerFor(c.db, c.user);
    return c.db.bizOrders.filter(x => x.ownerId === o).sort((a, b) => b.ts - a.ts).slice(0, 30).map(x => { const ch = c.db.chats.find(k => k.id === x.chatId); return Object.assign({}, x, { customer: viewPub(c.db, byId(c.db, x.customerId), c.user.id, ch) }); });
  });
  const orderAction = (accept) => c => {
    const o = bizOwnerFor(c.db, c.user), ord = c.db.bizOrders.find(x => x.id === c.p[0] && x.ownerId === o);
    if (!ord) fail(404, 'Order not found.');
    if (ord.status !== 'new') fail(409, 'This order was already ' + ord.status + '.');
    if (!accept) {
      ord.status = 'rejected';
      if (ord.paid && !ord.refunded) { // customer paid upfront through the business page: give it back
        ord.refunded = true; wallet(c.db, ord.customerId).balance += ord.total;
        addTx(c.db, ord.customerId, { type: 'in', kind: 'refund', mode: 'normal', title: 'Refund • order #' + ord.number, amount: ord.total });
        notify(c.db, ord.customerId, { type: 'wallet', mode: 'normal', title: 'Order declined, refunded', body: 'KES ' + ord.total.toLocaleString('en-KE') + ' is back in your wallet.' });
      }
      return ord;
    }
    const fee = Math.round(ord.total * c.db.settings.fees.shopCommissionPct / 100);
    ord.status = 'completed'; ord.completedAt = Date.now();
    const w = wallet(c.db, o); w.balance += ord.total - fee;
    addTx(c.db, o, { type: 'in', kind: 'payment', mode: 'business', title: 'Order payment • #' + ord.number, amount: ord.total - fee, tax: ord.vat, orderId: ord.id });
    addRevenue(c.db, 'commission', fee, 'Order commission • ' + (c.db.bizAccounts[o] || {}).name);
    notify(c.db, o, { type: 'payment', mode: 'business', title: 'Payment received', body: 'KES ' + (ord.total - fee).toLocaleString('en-KE') + ' for order #' + ord.number, amount: ord.total - fee });
    return ord;
  };
  route('POST', /^\/api\/biz\/orders\/([^/]+)\/accept$/, 'biz', null, orderAction(true));
  route('POST', /^\/api\/biz\/orders\/([^/]+)\/reject$/, 'biz', null, orderAction(false));
  route('GET', /^\/api\/biz\/orders\/([^/]+)\/invoice$/, 'biz', null, c => {
    const o = bizOwnerFor(c.db, c.user), ord = c.db.bizOrders.find(x => x.id === c.p[0] && x.ownerId === o);
    if (!ord) fail(404, 'Order not found.'); if (ord.status !== 'completed') fail(409, 'Invoices are issued when an order is completed.');
    return { filename: 'invoice-' + ord.number + '.html', html: invoiceHtml(c.db, ord) };
  });
  route('GET', /^\/api\/biz\/team$/, 'biz', null, c => { const o = bizOwnerFor(c.db, c.user); return { ownerId: o, isOwner: o === c.user.id, max: 5, members: teamOf(c.db, o).map(id => pub(byId(c.db, id))) }; });
  route('POST', /^\/api\/biz\/team$/, 'biz', null, c => {
    const o = bizOwnerFor(c.db, c.user); if (o !== c.user.id) fail(403, 'Only the business owner can manage the team.');
    const t = teamOf(c.db, o), target = byId(c.db, c.body.userId);
    if (!target || !friendsOf(c.db, o).includes(target.id)) fail(400, 'Pick someone from your contacts.');
    if (t.includes(target.id)) fail(409, 'Already on the team.'); if (t.length >= 5) fail(400, 'A team can have at most 5 members.');
    t.push(target.id); return { ok: true, members: t.length };
  });
  route('DELETE', /^\/api\/biz\/team\/([^/]+)$/, 'biz', null, c => {
    const o = bizOwnerFor(c.db, c.user); if (o !== c.user.id) fail(403, 'Only the business owner can manage the team.');
    const b = c.db.bizAccounts[o]; b.team = b.team.filter(x => x !== c.p[0]); return { ok: true };
  });
  route('GET', /^\/api\/biz\/settings$/, 'biz', null, c => c.db.bizAccounts[bizOwnerFor(c.db, c.user)]);
  route('PATCH', /^\/api\/biz\/settings$/, 'biz', null, c => {
    const o = bizOwnerFor(c.db, c.user); if (o !== c.user.id) fail(403, 'Only the business owner can change settings.');
    const b = c.db.bizAccounts[o];
    if (['weekly', 'monthly', 'manual'].includes(c.body.payoutSchedule)) b.payoutSchedule = c.body.payoutSchedule;
    if (typeof c.body.bankLinked === 'boolean') b.bankLinked = c.body.bankLinked;
    if (['all', 'assigned_only'].includes(c.body.inboxAccess)) b.inboxAccess = c.body.inboxAccess;
    return b;
  });
  // demo/test endpoint: simulate customer activity so notifications, batching, peek and revenue can be exercised
  route('POST', /^\/api\/dev\/simulate$/, 'biz', null, c => {
    const db = c.db, o = bizOwnerFor(db, c.user), kind = c.body.kind;
    const pool = ['u_zawadi', 'u_otieno', 'u_kiprono', 'u_wanjiru', 'u_fatuma'].filter(id => id !== o && !teamOf(db, o).includes(id));
    const cust = byId(db, pick(pool)), ch = bizChatFor(db, cust.id, o);
    if (kind === 'chat') pushMessage(db, ch, cust.id, 'text', pick(['Hi! Are you open today?', 'Do you deliver to Nanyuki town?', 'Can I get a discount for 5 bags?']));
    else if (kind === 'order') {
      const big = !!c.body.big, items = big ? [{ name: 'Kirinyaga AA 1kg', qty: 6, price: 1450 }] : [{ name: 'Kirinyaga AA 500g', qty: 1, price: 780 }, { name: 'Ceramic mug', qty: 2, price: 350 }];
      const total = items.reduce((n, i) => n + i.qty * i.price, 0), vat = Math.round(total - total / 1.16), number = 2000 + db.bizOrders.length + 1;
      const ord = { id: uid('bo_'), number, ownerId: o, customerId: cust.id, chatId: ch.id, items, subtotal: total - vat, vat, total, status: 'new', ts: Date.now(), deadline: Date.now() + 2 * 3600000 };
      db.bizOrders.push(ord);
      if (!ch.phoneRevealed) { ch.phoneRevealed = true; logEvent(db, 'customer_phone_reveal', cust.id, { how: 'first_order' }); }
      bizAudience(db, o).forEach(id => notify(db, id, { type: 'order', mode: 'business', title: 'New order', body: cust.name + ' ordered ' + items.reduce((n, i) => n + i.qty, 0) + ' items — KES ' + total.toLocaleString('en-KE'), amount: total, urgent: total > 5000, ctx: { orderId: ord.id, chatId: ch.id, customerId: cust.id, senderName: cust.name } }));
    } else if (kind === 'review') {
      const rating = Math.max(1, Math.min(5, c.body.rating | 0 || 5));
      bizAudience(db, o).forEach(id => notify(db, id, { type: 'review', mode: 'business', title: rating <= 2 ? 'Negative review' : 'New review', body: cust.name + ' left ' + rating + ' star' + (rating > 1 ? 's' : ''), rating, urgent: rating <= 2, ctx: { chatId: ch.id, senderName: cust.name } }));
    } else if (kind === 'call') {
      bizAudience(db, o).forEach(id => notify(db, id, { type: 'call', mode: 'business', title: 'Incoming call', body: cust.name + ' is calling the shop', urgent: true, ctx: { chatId: ch.id, senderName: cust.name } }));
    } else if (kind === 'normal_chat') {
      const pch = db.chats.find(x => x.type === 'direct' && x.mode === 'normal' && x.members.includes(c.user.id) && !x.ai);
      if (pch) { const other = pch.members.find(i => i !== c.user.id); pushMessage(db, pch, other, 'text', 'Hey, quick personal question 🙂'); }
    } else fail(400, 'Unknown simulation.');
    return { ok: true, kind, customer: cust.name };
  });

  // ---- notifications (mode-scoped) + peek
  const modeParam = c => { const q = c.query.mode || 'auto'; return q === 'auto' ? c.mode : q; };
  route('GET', /^\/api\/notifications$/, 'user', null, c => {
    const mode = modeParam(c), mine = c.db.notifications.filter(n => n.userId === c.user.id);
    const items = collapse(mine.filter(n => mode === 'all' || n.mode === mode)).slice(0, 60);
    const unread = m => mine.filter(n => n.mode === m && !n.read).length;
    return { mode, items, unread: { normal: unread('normal'), business: unread('business') } };
  });
  route('POST', /^\/api\/notifications\/read$/, 'user', null, c => { const mode = c.body.mode || c.mode; c.db.notifications.forEach(n => { if (n.userId === c.user.id && (mode === 'all' || n.mode === mode)) n.read = true; }); return { ok: true }; });
  const findNotif = c => { const n = c.db.notifications.find(x => x.id === c.p[0] && x.userId === c.user.id); if (!n) fail(404, 'Notification not found.'); return n; };
  route('GET', /^\/api\/notifications\/batch\/([^/]+)\/peek$/, 'user', null, c => {
    const kids = c.db.notifications.filter(n => n.userId === c.user.id && n.batchId === c.p[0]).sort((a, b) => b.ts - a.ts);
    if (!kids.length) fail(404, 'Batch not found.');
    logEvent(c.db, 'peek_opened', c.user.id, { ntype: 'batch', mode: kids[0].mode });
    return { batchId: c.p[0], summary: summarize(kids), items: kids.map(k => Object.assign({}, k, { order: k.ctx.orderId ? c.db.bizOrders.find(o => o.id === k.ctx.orderId) || null : null })) };
  });
  route('GET', /^\/api\/notifications\/([^/]+)\/peek$/, 'user', null, c => {
    const n = findNotif(c); PEEK[c.user.id + ':' + n.id] = Date.now();
    logEvent(c.db, 'peek_opened', c.user.id, { ntype: n.type, mode: n.mode });
    const order = n.ctx.orderId ? c.db.bizOrders.find(o => o.id === n.ctx.orderId) || null : null;
    const actions = [];
    if (n.ctx.chatId) actions.push({ id: 'reply_inline', label: 'Reply without switching' });
    if (n.mode !== c.mode) actions.push({ id: 'switch_mode', label: 'Switch to ' + (n.mode === 'business' ? 'Business' : 'Normal') });
    actions.push({ id: 'dismiss', label: 'Dismiss' });
    return { notification: n, context: { chatId: n.ctx.chatId || null, orderId: n.ctx.orderId || null, senderName: n.ctx.senderName || null, order }, actions, activeMode: c.mode };
  });
  route('POST', /^\/api\/notifications\/([^/]+)\/reply$/, 'user', null, c => {
    const n = findNotif(c); if (!n.ctx.chatId) fail(400, 'This notification has no conversation to reply to.');
    if (!String(c.body.body || '').trim()) fail(400, 'Write a reply first.');
    const ch = chatOf(c.db, n.ctx.chatId, c.user), m = pushMessage(c.db, ch, c.user.id, 'text', String(c.body.body).slice(0, 2000));
    n.read = true; delete PEEK[c.user.id + ':' + n.id];
    logEvent(c.db, 'peek_replied_inline', c.user.id, { ntype: n.type });
    autoReply(c.db, ch, c.user.id, n.mode, m.text);
    return { sent: true, message: m, activeMode: c.mode };
  });
  route('POST', /^\/api\/notifications\/([^/]+)\/read$/, 'user', null, c => { findNotif(c).read = true; return { ok: true }; });
  route('POST', /^\/api\/notifications\/([^/]+)\/dismiss$/, 'user', null, c => { const n = findNotif(c); n.read = true; delete PEEK[c.user.id + ':' + n.id]; logEvent(c.db, 'peek_dismissed', c.user.id, { ntype: n.type }); return { ok: true }; });
  route('POST', /^\/api\/notifications\/([^/]+)\/switch$/, 'user', null, c => {
    const n = findNotif(c); n.read = true;
    logEvent(c.db, c.body.auto ? 'auto_switch_triggered' : 'peek_switched_mode', c.user.id, { ntype: n.type, critical: !!n.urgent });
    return Object.assign(setMode(c.db, c.user, n.mode, c.body.deviceId || header(c.headers, 'x-semachat-device')), { ctx: n.ctx });
  });

  // ---- chats (mode-scoped)
  route('GET', /^\/api\/chats$/, 'user', 'chats', c => {
    ensureAi(c.db, c.user); sweepArchive(c.db);
    const mode = modeParam(c), archived = c.query.archived === '1';
    return c.db.chats.filter(ch => visible(c.db, ch, c.user) && !!ch.archivedAt === archived).map(ch => chatView(c.db, ch, c.user.id))
      .filter(v => mode === 'all' || v.modeContext === mode || v.isCrossMode).sort((a, b) => b.lastTs - a.lastTs);
  });
  route('POST', /^\/api\/chats$/, 'user', 'chats', c => {
    const { type, name, members, withBusiness } = c.body, db = c.db;
    const ids = Array.from(new Set([c.user.id].concat(members || []))).filter(id => byId(db, id));
    if (type === 'direct') {
      if (ids.length !== 2) fail(400, 'A direct chat needs exactly one other person.');
      const target = byId(db, ids.find(i => i !== c.user.id));
      if (withBusiness) {
        if (!canBiz(db, target) || bizOwnerFor(db, target) !== target.id) fail(400, 'That person has no active business.');
        return chatView(db, bizChatFor(db, c.user.id, target.id), c.user.id);
      }
      const ex = db.chats.find(x => x.type === 'direct' && !x.bizOwner && !x.ai && x.members.length === 2 && ids.every(i => x.members.includes(i)));
      if (ex) return chatView(db, ex, c.user.id);
    } else if (ids.length < 3) fail(400, 'Pick at least two people for a group.');
    const gm = (c.body.mode === 'business' && canBiz(db, c.user)) ? 'business' : 'normal';
    const ch = { id: uid('ch_'), type: type === 'direct' ? 'direct' : 'group', name: (name || 'New group').slice(0, 40), members: ids, read: { [c.user.id]: Date.now() }, mode: type === 'direct' ? 'normal' : gm, memberMode: {}, crossMode: !!c.body.crossMode, archivedAt: null, bizOwner: null, phoneRevealed: false };
    db.chats.push(ch);
    if (ch.type === 'group') pushMessage(db, ch, c.user.id, 'text', 'Created the group “' + ch.name + '”');
    return chatView(db, ch, c.user.id);
  });
  route('GET', /^\/api\/chats\/([^/]+)\/messages$/, 'user', 'chats', c => {
    const ch = chatOf(c.db, c.p[0], c.user); ch.read[c.user.id] = Date.now();
    c.db.notifications.forEach(n => { if (n.userId === c.user.id && n.ctx && n.ctx.chatId === ch.id && (n.type === 'chat' || n.type === 'chat_biz')) n.read = true; });
    return c.db.messages.filter(m => m.chatId === ch.id).concat((c.db.blockedMsgs || []).filter(m => m.chatId === ch.id && m.from === c.user.id)).sort((a, b) => a.ts - b.ts).slice(-200);
  });
  route('POST', /^\/api\/chats\/([^/]+)\/messages$/, 'user', 'chats', c => {
    const ch = chatOf(c.db, c.p[0], c.user);
    const { type = 'text', text, meta } = c.body;
    if (!['text', 'voice', 'photo', 'video', 'file', 'contact', 'location', 'music'].includes(type)) fail(400, 'Unsupported message type.');
    if (type === 'text' && !String(text || '').trim()) fail(400, 'Message is empty.');
    if (type === 'video' && meta && meta.dur > 120) fail(400, 'Videos can be at most 2 minutes.');
    if (c.guardHit) {   // blocked by the developer's list: the sender sees it in their own chat, marked "Not delivered"; nobody else ever gets it
      const bm = { id: uid('m_'), chatId: ch.id, from: c.user.id, type, text: String(text || '').slice(0, 2000), meta: meta || null, ts: Date.now(), modeContext: ch.mode || 'normal', blocked: true, blockReason: hooks.guardNotice };
      (c.db.blockedMsgs || (c.db.blockedMsgs = [])).push(bm); if (c.db.blockedMsgs.length > 2000) c.db.blockedMsgs.splice(0, 500); return bm;
    }
    const m = pushMessage(c.db, ch, c.user.id, type, String(text || '').slice(0, 2000), meta);
    // customer identity protection: sharing a phone number in chat reveals it to the business
    if (ch.bizOwner && !ch.phoneRevealed && ch.memberMode[c.user.id] === 'normal' && (type === 'contact' || (type === 'text' && PHONE_RE.test(m.text.replace(/[\s-]/g, ''))))) { ch.phoneRevealed = true; logEvent(c.db, 'customer_phone_reveal', c.user.id, { how: 'shared_in_chat' }); }
    autoReply(c.db, ch, c.user.id, perspective(ch, c.user.id), m.text);
    return m;
  });
  route('POST', /^\/api\/chats\/([^/]+)\/reveal-phone$/, 'user', 'chats', c => {
    const ch = chatOf(c.db, c.p[0], c.user);
    if (!ch.bizOwner || ch.memberMode[c.user.id] !== 'normal') fail(400, 'Only customers of a business chat can share their number.');
    if (!ch.phoneRevealed) { ch.phoneRevealed = true; logEvent(c.db, 'customer_phone_reveal', c.user.id, { how: 'explicit' }); }
    return { ok: true };
  });
  route('POST', /^\/api\/chats\/([^/]+)\/read$/, 'user', null, c => { const ch = chatOf(c.db, c.p[0], c.user); ch.read[c.user.id] = Date.now(); c.db.notifications.forEach(n => { if (n.userId === c.user.id && n.ctx && n.ctx.chatId === ch.id && (n.type === 'chat' || n.type === 'chat_biz')) n.read = true; }); return { ok: true }; });
  route('POST', /^\/api\/chats\/([^/]+)\/call$/, 'user', 'calls', c => {
    const ch = chatOf(c.db, c.p[0], c.user);
    const mode = c.body.mode === 'video' ? 'video' : 'voice';
    if (mode === 'video' && !c.db.settings.features.videoCalls) fail(403, 'Video calls are currently switched off by SemaChat.');
    if (ch.members.length > 2 && !c.db.settings.features.conference) fail(403, 'Group & conference calls are currently switched off by SemaChat.');
    return pushMessage(c.db, ch, c.user.id, 'call', '', { mode, dur: Math.max(0, Math.min(86400, c.body.dur | 0)), count: ch.members.length });
  });

  // ---- contacts & requests
  route('GET', /^\/api\/contacts$/, 'user', null, c => friendsOf(c.db, c.user.id).map(id => pub(byId(c.db, id))).sort((a, b) => a.name.localeCompare(b.name)));
  route('GET', /^\/api\/people$/, 'user', null, c => {
    const q = String(c.query.q || '').toLowerCase().trim(); if (q.length < 2) return [];
    const fr = friendsOf(c.db, c.user.id);
    return c.db.users.filter(u => u.role !== 'system' && u.id !== c.user.id && !fr.includes(u.id) && (u.name.toLowerCase().includes(q) || (u.phone || '').includes(q) || normEmail(u.email) === q))
      .map(u => Object.assign(pub(u), { requested: c.db.requests.some(r => r.from === c.user.id && r.to === u.id && r.status === 'pending') }));
  });
  route('GET', /^\/api\/requests$/, 'user', null, c => ({
    incoming: c.db.requests.filter(r => r.to === c.user.id && r.status === 'pending').map(r => ({ id: r.id, ts: r.ts, from: pub(byId(c.db, r.from)) })),
    outgoing: c.db.requests.filter(r => r.from === c.user.id && r.status === 'pending').map(r => ({ id: r.id, ts: r.ts, to: pub(byId(c.db, r.to)) }))
  }));
  route('POST', /^\/api\/requests$/, 'user', null, c => {
    const to = byId(c.db, c.body.to); if (!to || to.id === c.user.id) fail(400, 'Unknown person.');
    if (friendsOf(c.db, c.user.id).includes(to.id)) fail(409, 'You are already contacts.');
    if (c.db.requests.some(r => r.from === c.user.id && r.to === to.id && r.status === 'pending')) fail(409, 'Request already sent.');
    const r = { id: uid('rq'), from: c.user.id, to: to.id, status: 'pending', ts: Date.now() };
    c.db.requests.push(r); hooks.emit(to.id, { type: 'request', from: pub(c.user) });
    return r;
  });
  route('POST', /^\/api\/requests\/([^/]+)$/, 'user', null, c => {
    const r = c.db.requests.find(x => x.id === c.p[0] && x.to === c.user.id && x.status === 'pending'); if (!r) fail(404, 'Request not found.');
    r.status = c.body.accept ? 'accepted' : 'declined';
    if (c.body.accept) { friendsOf(c.db, r.from).push(r.to); friendsOf(c.db, r.to).push(r.from); }
    return { ok: true, status: r.status };
  });

  // ---- AnA (Around & About)
  route('GET', /^\/api\/feed$/, 'user', 'ana', c => {
    const scope = c.query.scope || 'contacts', fr = friendsOf(c.db, c.user.id);
    let list = c.db.posts.filter(p => !p.removed);
    if (scope === 'mine') list = list.filter(p => p.authorId === c.user.id);
    else if (scope === 'business') list = list.filter(p => p.kind === 'business');
    else list = list.filter(p => fr.includes(p.authorId) || p.authorId === c.user.id);
    return list.sort((a, b) => (b.promoted - a.promoted) || (b.ts - a.ts)).map(p => postView(c.db, p, c.user.id));
  });
  route('POST', /^\/api\/posts$/, 'user', 'ana', c => {
    const { kind, caption, media } = c.body;
    if (!['reel', 'tube', 'business'].includes(kind)) fail(400, 'Unknown post type.');
    if (!String(caption || '').trim()) fail(400, 'Write a caption.');
    if (kind === 'tube' && !c.user.tube) fail(400, 'Start your Tube first, then post to it.');
    let promoted = false;
    if (kind === 'business') {
      if (c.user.role === 'user') fail(403, 'Business posts are for corporate and institution accounts.');
      const sub = activeSub(c.db, c.user.id);
      if (!sub) { const e = new HttpError(402, 'Business posting is a paid feature. Choose a plan to continue.'); e.code = 'plan_required'; throw e; }
      promoted = /pro|plus/.test(sub.planId);
    }
    const p = { id: uid('p'), authorId: c.user.id, kind, caption: String(caption).slice(0, 400), media: media || { emoji: '🎬', g: ['#c05621', '#44337a'], dur: 20 },
      likes: [], comments: [], views: 0, ts: Date.now(), removed: false, promoted };
    c.db.posts.push(p);
    return postView(c.db, p, c.user.id);
  });
  route('POST', /^\/api\/posts\/([^/]+)\/like$/, 'user', 'ana', c => {
    const p = c.db.posts.find(x => x.id === c.p[0]); if (!p) fail(404, 'Post not found.');
    const i = p.likes.indexOf(c.user.id); if (i >= 0) p.likes.splice(i, 1); else p.likes.push(c.user.id);
    return { liked: i < 0, likeCount: p.likes.length };
  });
  route('POST', /^\/api\/posts\/([^/]+)\/view$/, 'user', 'ana', c => { const p = c.db.posts.find(x => x.id === c.p[0]); if (p) p.views++; return { ok: true }; });
  route('GET', /^\/api\/posts\/([^/]+)\/comments$/, 'user', 'ana', c => {
    const p = c.db.posts.find(x => x.id === c.p[0]); if (!p) fail(404, 'Post not found.');
    return p.comments.map(m => ({ text: m.text, ts: m.ts, name: (byId(c.db, m.userId) || {}).name || 'Someone' }));
  });
  route('POST', /^\/api\/posts\/([^/]+)\/comment$/, 'user', 'ana', c => {
    const p = c.db.posts.find(x => x.id === c.p[0]); if (!p) fail(404, 'Post not found.');
    if (!String(c.body.text || '').trim()) fail(400, 'Comment is empty.');
    p.comments.push({ userId: c.user.id, text: String(c.body.text).slice(0, 300), ts: Date.now() });
    return { ok: true, commentCount: p.comments.length };
  });
  route('POST', /^\/api\/posts\/([^/]+)\/report$/, 'user', 'ana', c => {
    const p = c.db.posts.find(x => x.id === c.p[0]); if (!p) fail(404, 'Post not found.');
    c.db.reports.push({ id: uid('rp'), postId: p.id, by: c.user.id, reason: String(c.body.reason || 'Reported by user').slice(0, 120), status: 'open', ts: Date.now() });
    return { ok: true };
  });
  route('GET', /^\/api\/analytics$/, 'user', 'ana', c => {
    const mine = c.db.posts.filter(p => p.authorId === c.user.id && !p.removed);
    const views = mine.reduce((n, p) => n + p.views, 0), likes = mine.reduce((n, p) => n + p.likes.length, 0), comments = mine.reduce((n, p) => n + p.comments.length, 0);
    const followers = Object.keys(c.db.friends).filter(k => c.db.friends[k].includes(c.user.id)).length;
    return { views, likes, comments, followers, posts: mine.length, series: series(c.user.id, Math.max(20, views / 4)),
      top: mine.slice().sort((a, b) => b.views - a.views).slice(0, 3).map(p => postView(c.db, p, c.user.id)) };
  });

  // ---- explore
  route('GET', /^\/api\/explore$/, 'user', 'explore', c => c.db.explore.filter(e => !c.query.cat || e.cat === c.query.cat));

  // ---- wallet (one balance, mode-tagged ledger)
  route('GET', /^\/api\/wallet$/, 'user', 'wallet', c => {
    const w = wallet(c.db, c.user.id), mode = modeParam(c);
    return { currency: 'KES', fees: c.db.settings.fees, balance: w.balance, mode, tx: w.tx.filter(t => mode === 'all' || t.mode === mode).slice(0, 120) };
  });
  route('POST', /^\/api\/wallet\/topup$/, 'user', 'wallet', c => {
    const a = Math.round(+c.body.amount); if (!(a >= 10 && a <= 150000)) fail(400, 'Enter an amount between KES 10 and KES 150,000.');
    if (hooks.payments && /m-?pesa/i.test(String(c.body.method || 'M-Pesa'))) return hooks.payments.topup(c, a);   // live provider: money arrives via the callback
    const w = wallet(c.db, c.user.id); w.balance += a; addTx(c.db, c.user.id, { type: 'in', kind: 'topup', mode: c.mode, title: 'Top up • ' + (c.body.method || 'M-Pesa'), amount: a });
    return { balance: w.balance };
  });
  route('POST', /^\/api\/wallet\/send$/, 'user', 'wallet', c => {
    const to = byId(c.db, c.body.to); if (!to || to.id === c.user.id) fail(400, 'Choose who to send to.');
    const a = Math.round(+c.body.amount); if (!(a >= 10)) fail(400, 'Minimum transfer is KES 10.');
    const fee = Math.round(a * c.db.settings.fees.p2pTransferPct / 100);
    charge(c.db, c.user.id, a + fee, 'Sent to ' + to.name, c.mode, 'transfer');
    const rw = wallet(c.db, to.id); rw.balance += a; addTx(c.db, to.id, { type: 'in', kind: 'transfer', mode: 'normal', title: 'Received from ' + c.user.name, amount: a });
    addRevenue(c.db, 'fee', fee, 'Transfer fee');
    return { balance: wallet(c.db, c.user.id).balance, fee };
  });
  // moves money between the two *views* of the same wallet: balance is unchanged, two linked ledger rows are written
  route('POST', /^\/api\/wallet\/cross-transfer$/, 'biz', 'wallet', c => {
    const o = bizOwnerFor(c.db, c.user); if (o !== c.user.id) fail(403, 'Only the business owner can move money between modes.');
    const from = c.body.from === 'normal' ? 'normal' : 'business', to = from === 'business' ? 'normal' : 'business';
    const a = Math.round(+c.body.amount); if (!(a >= 10)) fail(400, 'Minimum transfer is KES 10.');
    const w = wallet(c.db, o); if (a > w.balance) fail(402, 'Not enough balance for that transfer.');
    const ref = uid('xfer_');
    const label = from === 'business' ? ['Owner draw to personal', 'Owner draw from business'] : ['Capital injection to business', 'Capital injection from personal'];
    addTx(c.db, o, { type: 'out', kind: 'cross_mode_transfer', mode: from, title: label[0], amount: a, referenceId: ref });
    addTx(c.db, o, { type: 'in', kind: 'cross_mode_transfer', mode: to, title: label[1], amount: a, referenceId: ref });
    audit(c.db, c.user.name + ' moved KES ' + a + ' ' + from + ' → ' + to + ' (' + ref + ')'); logEvent(c.db, 'cross_mode_transfer', c.user.id, { from, to, amount: a });
    return { referenceId: ref, balance: w.balance, from, to, amount: a };
  });
  route('GET', /^\/api\/wallet\/biz\/revenue$/, 'biz', 'wallet', c => {
    const o = bizOwnerFor(c.db, c.user); if (o !== c.user.id) fail(403, 'Only the business owner can view revenue.');
    return Object.assign({ vatRatePct: 16, payoutSchedule: c.db.bizAccounts[o].payoutSchedule, bankLinked: c.db.bizAccounts[o].bankLinked, lastPayout: c.db.bizAccounts[o].lastPayout || null }, revenueSummary(c.db, o, Math.min(90, Math.max(7, +c.query.days || 30))));
  });
  route('POST', /^\/api\/wallet\/biz\/payout$/, 'biz', 'wallet', c => {
    const o = bizOwnerFor(c.db, c.user); if (o !== c.user.id) fail(403, 'Only the business owner can request payouts.');
    return doPayout(c.db, o, +c.body.amount || 0, false);
  });
  route('GET', /^\/api\/wallet\/biz\/export$/, 'biz', 'wallet', c => {
    const o = bizOwnerFor(c.db, c.user); if (o !== c.user.id) fail(403, 'Only the business owner can export.');
    const rows = wallet(c.db, o).tx.filter(t => t.mode === 'business').map(t => [new Date(t.ts).toISOString(), '"' + String(t.title).replace(/"/g, '""') + '"', t.type, t.kind, t.amount, t.tax || 0].join(','));
    return { filename: 'semachat-business-ledger.csv', csv: 'date,title,direction,kind,amount_kes,vat_kes\n' + rows.join('\n') };
  });

  // ---- third-party services (travel, stays, food)
  route('GET', /^\/api\/services$/, 'user', 'travel', c => c.db.partners.filter(p => p.enabled).map(p => ({ id: p.id, category: p.category, name: p.name, tagline: p.tagline, items: p.items })));
  route('POST', /^\/api\/services\/book$/, 'user', 'travel', c => {
    const p = c.db.partners.find(x => x.id === c.body.partnerId && x.enabled); if (!p) fail(404, 'That partner is not available right now.');
    const it = p.items.find(i => i.id === c.body.itemId); if (!it) fail(404, 'Item not found.');
    charge(c.db, c.user.id, it.price, p.name + ' • ' + it.title, c.mode, 'bill');
    addRevenue(c.db, 'commission', it.price * p.commission / 100, 'Booking commission • ' + p.name);
    const b = { id: uid('bk'), userId: c.user.id, partnerId: p.id, category: p.category, title: p.name + ' • ' + it.title, price: it.price, ts: Date.now(), ref: 'UBU-' + Math.random().toString(36).slice(2, 8).toUpperCase() };
    c.db.bookings.push(b); return b;
  });
  route('GET', /^\/api\/bookings$/, 'user', 'travel', c => c.db.bookings.filter(b => b.userId === c.user.id).reverse());

  // ---- shopping & financial
  route('GET', /^\/api\/shop$/, 'user', 'shopping', c => c.db.products);
  route('POST', /^\/api\/shop\/order$/, 'user', 'shopping', c => {
    const items = (c.body.items || []).map(id => c.db.products.find(p => p.id === id)).filter(Boolean);
    if (!items.length) fail(400, 'Your cart is empty.');
    const total = items.reduce((n, p) => n + p.price, 0);
    charge(c.db, c.user.id, total, 'Shop order • ' + items.length + ' item(s)', c.mode, 'shopping');
    addRevenue(c.db, 'commission', total * c.db.settings.fees.shopCommissionPct / 100, 'Shop commission');
    const o = { id: uid('o'), userId: c.user.id, items: items.map(i => i.name), total, ts: Date.now(), ref: 'ORD-' + Math.random().toString(36).slice(2, 7).toUpperCase() };
    c.db.orders.push(o); return o;
  });
  route('GET', /^\/api\/financial$/, 'user', 'financial', c => c.db.financial);
  route('POST', /^\/api\/financial\/apply$/, 'user', 'financial', c => {
    const f = c.db.financial.find(x => x.id === c.body.id); if (!f) fail(404, 'Service not found.');
    const a = { id: uid('fa'), userId: c.user.id, serviceId: f.id, ts: Date.now() }; c.db.applications.push(a);
    return { ok: true, message: f.name + ': request received. Our partner will contact you shortly.' };
  });

  // ---- business plans (fees charged by the app developer)
  route('GET', /^\/api\/plans$/, 'user', null, c => {
    const sub = activeSub(c.db, c.user.id);
    return { plans: c.db.plans.filter(p => p.for === c.user.role), current: sub ? { planId: sub.planId, until: sub.until } : null };
  });
  route('POST', /^\/api\/plans\/subscribe$/, 'user', null, c => {
    const p = c.db.plans.find(x => x.id === c.body.planId && x.for === c.user.role); if (!p) fail(404, 'Plan not available for your account type.');
    charge(c.db, c.user.id, p.price, 'SemaChat ' + p.name, 'business', 'subscription');
    addRevenue(c.db, 'subscription', p.price, p.name + ' • ' + c.user.name);
    if (c.user.role === 'user' && !c.user.idSubmitted && !c.user.verified) fail(403, 'Submit your National ID or Passport number first. Gold is for verified accounts.', { code: 'ID_REQUIRED' });
    if (c.user.role !== 'user') c.user.verified = true; c.user.goldUntil = Date.now() + 30 * D;
    const s = { id: uid('s'), userId: c.user.id, planId: p.id, price: p.price, since: Date.now(), until: Date.now() + 30 * D };
    c.db.subscriptions.push(s); return { ok: true, until: s.until };
  });

  // ---- life planner
  route('GET', /^\/api\/planner$/, 'user', 'planner', c => planner(c.db, c.user.id));
  route('POST', /^\/api\/planner\/tasks$/, 'user', 'planner', c => {
    if (!String(c.body.title || '').trim()) fail(400, 'Give the task a title.');
    const t = { id: uid('tk'), title: String(c.body.title).slice(0, 120), when: c.body.when || 'Today', tag: c.body.tag || 'Personal', done: false };
    planner(c.db, c.user.id).tasks.unshift(t); return t;
  });
  route('POST', /^\/api\/planner\/tasks\/([^/]+)\/toggle$/, 'user', 'planner', c => {
    const t = planner(c.db, c.user.id).tasks.find(x => x.id === c.p[0]); if (!t) fail(404, 'Task not found.'); t.done = !t.done; return t;
  });
  route('DELETE', /^\/api\/planner\/tasks\/([^/]+)$/, 'user', 'planner', c => {
    const pl = planner(c.db, c.user.id); pl.tasks = pl.tasks.filter(x => x.id !== c.p[0]); return { ok: true };
  });
  route('POST', /^\/api\/planner\/goals$/, 'user', 'planner', c => {
    if (!String(c.body.title || '').trim()) fail(400, 'Give the goal a title.');
    const g = { id: uid('g'), title: String(c.body.title).slice(0, 100), emoji: c.body.emoji || '🎯', progress: 0 }; planner(c.db, c.user.id).goals.push(g); return g;
  });
  route('POST', /^\/api\/planner\/goals\/([^/]+)\/progress$/, 'user', 'planner', c => {
    const g = planner(c.db, c.user.id).goals.find(x => x.id === c.p[0]); if (!g) fail(404, 'Goal not found.');
    g.progress = Math.max(0, Math.min(100, g.progress + (c.body.delta | 0))); return g;
  });
  route('POST', /^\/api\/planner\/habits$/, 'user', 'planner', c => {
    if (!String(c.body.title || '').trim()) fail(400, 'Give the habit a title.');
    const h = { id: uid('h'), title: String(c.body.title).slice(0, 80), emoji: c.body.emoji || '✨', streak: 0, last: '' }; planner(c.db, c.user.id).habits.push(h); return h;
  });
  route('POST', /^\/api\/planner\/habits\/([^/]+)\/check$/, 'user', 'planner', c => {
    const h = planner(c.db, c.user.id).habits.find(x => x.id === c.p[0]); if (!h) fail(404, 'Habit not found.');
    const today = new Date().toDateString();
    if (h.last === today) { h.last = ''; h.streak = Math.max(0, h.streak - 1); } else { h.last = today; h.streak++; }
    return h;
  });

  // ---- developer console (admin)
  // developer sign-in is by email code too (no password): a code is emailed only to listed developer addresses,
  // and the answer is the same for everyone else so the list cannot be probed.
  route('POST', /^\/api\/admin\/otp$/, null, null, c => {
    const em = normEmail(c.body.email);
    if (!EMAIL_RE.test(em)) fail(400, 'Enter a valid email address.');
    if (isTeamEmail(em)) return { sent: true, team: true, hint: 'Development team access is on for this address. No email is sent: type the team access code you were given.' };
    if (!isAdminEmail(em)) return { sent: true, hint: 'If that address belongs to a developer, a sign-in code is on its way. Check the inbox and spam folder.' };
    return Object.assign({ sent: true }, otpSend(em));
  });
  route('POST', /^\/api\/admin\/signin$/, null, null, c => {
    const em = normEmail(c.body.email);
    if ((isAdminEmail(em) || isTeamEmail(em)) && otpOk(em, c.body.code)) { if (isTeamEmail(em)) audit(c.db, 'Team access sign-in (developer console): ' + em); return { token: 'tok_admin' }; }
    fail(401, 'Wrong or expired developer code.');
  });
  route('GET', /^\/api\/admin\/stats$/, 'admin', null, c => {
    const db = c.db, users = db.users.filter(u => u.role !== 'system'), sum = t => db.revenue.filter(r => r.type === t).reduce((n, r) => n + r.amount, 0);
    const m30 = Date.now() - 30 * D;
    const mrr = db.subscriptions.filter(s => s.until > Date.now()).reduce((n, s) => n + s.price, 0);
    return {
      users: { total: users.length, active: users.filter(u => u.status === 'active').length, suspended: users.filter(u => u.status === 'suspended').length,
        new30: users.filter(u => u.joined > m30).length, byRole: { user: users.filter(u => u.role === 'user').length, corporate: users.filter(u => u.role === 'corporate').length, institution: users.filter(u => u.role === 'institution').length } },
      content: { posts: db.posts.filter(p => !p.removed).length, messages: db.messages.length, chats: db.chats.length, openReports: db.reports.filter(r => r.status === 'open').length },
      revenue: { total: db.revenue.reduce((n, r) => n + r.amount, 0), subscriptions: sum('subscription'), commissions: sum('commission'), fees: sum('fee'), mrr },
      walletFloat: Object.values(db.wallets).reduce((n, w) => n + w.balance, 0),
      dau: series('dau', Math.max(10, users.length * 6), 14), signups: series('su', Math.max(4, users.length), 14),
      settings: db.settings
    };
  });
  route('GET', /^\/api\/admin\/users$/, 'admin', null, c => {
    const q = String(c.query.q || '').toLowerCase();
    return c.db.users.filter(u => u.role !== 'system' && (!q || u.name.toLowerCase().includes(q) || (u.phone || '').includes(q) || (u.email || '').toLowerCase().includes(q))).map(u => ({
      id: u.id, name: u.name, phone: u.phone, email: u.email, role: u.role, status: u.status, verified: u.verified, joined: u.joined, color: u.color,
      balance: wallet(c.db, u.id).balance, messages: c.db.messages.filter(m => m.from === u.id).length, posts: c.db.posts.filter(p => p.authorId === u.id).length
    }));
  });
  route('POST', /^\/api\/admin\/users\/([^/]+)$/, 'admin', null, c => {
    const u = byId(c.db, c.p[0]); if (!u) fail(404, 'User not found.');
    if (c.body.status) { u.status = c.body.status === 'suspended' ? 'suspended' : 'active'; audit(c.db, (u.status === 'suspended' ? 'Suspended ' : 'Reactivated ') + u.name); }
    if (typeof c.body.verified === 'boolean') { u.verified = c.body.verified; audit(c.db, (u.verified ? 'Verified ' : 'Removed verification from ') + u.name); }
    return { ok: true };
  });
  route('GET', /^\/api\/admin\/revenue$/, 'admin', null, c => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      const label = d.toLocaleString('en', { month: 'short' }), key = d.getFullYear() * 12 + d.getMonth();
      const tot = c.db.revenue.filter(r => { const x = new Date(r.ts); return x.getFullYear() * 12 + x.getMonth() === key; }).reduce((n, r) => n + r.amount, 0);
      months.push({ label, total: tot });
    }
    return { months, plans: c.db.plans,
      subscriptions: c.db.subscriptions.map(s => Object.assign({}, s, { user: (byId(c.db, s.userId) || {}).name, plan: (c.db.plans.find(p => p.id === s.planId) || {}).name, active: s.until > Date.now() })).sort((a, b) => b.since - a.since),
      recent: c.db.revenue.slice().sort((a, b) => b.ts - a.ts).slice(0, 14) };
  });
  route('POST', /^\/api\/admin\/plans\/([^/]+)$/, 'admin', null, c => {
    const p = c.db.plans.find(x => x.id === c.p[0]); if (!p) fail(404, 'Plan not found.');
    const price = Math.round(+c.body.price); if (!(price >= 0 && price <= 1000000)) fail(400, 'Enter a valid price.');
    audit(c.db, 'Changed ' + p.name + ' price from KES ' + p.price + ' to KES ' + price); p.price = price; return p;
  });
  route('GET', /^\/api\/admin\/settings$/, 'admin', null, c => c.db.settings);
  route('POST', /^\/api\/admin\/settings$/, 'admin', null, c => {
    const s = c.db.settings, b = c.body;
    if (typeof b.maintenance === 'boolean') { s.maintenance = b.maintenance; audit(c.db, 'Maintenance mode ' + (b.maintenance ? 'ON' : 'OFF')); }
    if (typeof b.autoApproveBiz === 'boolean') { s.autoApproveBiz = b.autoApproveBiz; audit(c.db, 'Auto-approve business registrations ' + (b.autoApproveBiz ? 'ON' : 'OFF')); }
    if (typeof b.signupsOpen === 'boolean') { s.signupsOpen = b.signupsOpen; audit(c.db, 'Sign-ups ' + (b.signupsOpen ? 'opened' : 'closed')); }
    if (b.feature && b.feature.key in s.features) { s.features[b.feature.key] = !!b.feature.on; audit(c.db, 'Feature “' + b.feature.key + '” switched ' + (b.feature.on ? 'ON' : 'OFF')); }
    if (b.fees) { ['p2pTransferPct', 'withdrawFeePct', 'shopCommissionPct'].forEach(k => { if (k in b.fees) { const v = +b.fees[k]; if (v >= 0 && v <= 30) s.fees[k] = v; } }); audit(c.db, 'Updated platform fees'); }
    return s;
  });
  route('POST', /^\/api\/admin\/broadcast$/, 'admin', null, c => {
    const text = String(c.body.text || '').trim().slice(0, 200);
    c.db.settings.announcement = text ? { text, ts: Date.now() } : null;
    audit(c.db, text ? 'Broadcast sent: “' + text + '”' : 'Broadcast cleared');
    if (text) c.db.users.forEach(u => hooks.emit(u.id, { type: 'announce', text }));
    return c.db.settings;
  });
  route('GET', /^\/api\/admin\/moderation$/, 'admin', null, c =>
    c.db.reports.filter(r => r.status === 'open').map(r => { const p = c.db.posts.find(x => x.id === r.postId); return Object.assign({}, r, { reporter: (byId(c.db, r.by) || {}).name, post: p ? postView(c.db, p, '') : null }); }));
  route('POST', /^\/api\/admin\/moderation\/([^/]+)$/, 'admin', null, c => {
    const r = c.db.reports.find(x => x.id === c.p[0]); if (!r) fail(404, 'Report not found.');
    if (c.body.action === 'remove') { const p = c.db.posts.find(x => x.id === r.postId); if (p) p.removed = true; r.status = 'actioned'; audit(c.db, 'Removed reported post ' + r.postId); }
    else { r.status = 'dismissed'; audit(c.db, 'Dismissed report ' + r.id); }
    return { ok: true };
  });
  route('GET', /^\/api\/admin\/partners$/, 'admin', null, c => c.db.partners.map(p => ({ id: p.id, category: p.category, name: p.name, enabled: p.enabled, commission: p.commission, items: p.items.length })));
  route('POST', /^\/api\/admin\/partners\/([^/]+)$/, 'admin', null, c => {
    const p = c.db.partners.find(x => x.id === c.p[0]); if (!p) fail(404, 'Partner not found.');
    if (typeof c.body.enabled === 'boolean') { p.enabled = c.body.enabled; audit(c.db, p.name + ' ' + (p.enabled ? 'enabled' : 'disabled')); }
    if (c.body.commission !== undefined) { const v = +c.body.commission; if (v >= 0 && v <= 30) { p.commission = v; audit(c.db, p.name + ' commission set to ' + v + '%'); } }
    return { ok: true };
  });
  route('GET', /^\/api\/admin\/audit$/, 'admin', null, c => c.db.audit);
  // ---- developer console: business verification, mode override, mode analytics
  route('GET', /^\/api\/admin\/biz$/, 'admin', null, c => Object.keys(c.db.bizAccounts).map(id => { const u = byId(c.db, id), b = c.db.bizAccounts[id]; return { userId: id, owner: u ? u.name : '?', phone: u ? u.phone : '', color: u ? u.color : '#888', name: b.name, category: b.category, kind: b.kind, status: b.status, taxPin: b.taxPin || null, team: (b.team || []).length, createdAt: b.createdAt, rejectReason: b.rejectReason || null }; }).sort((a, b) => b.createdAt - a.createdAt));
  route('POST', /^\/api\/admin\/biz\/([^/]+)$/, 'admin', null, c => {
    const u = byId(c.db, c.p[0]), b = c.db.bizAccounts[c.p[0]]; if (!u || !b) fail(404, 'Business not found.');
    const act = c.body.action;
    if (act === 'approve' || act === 'reinstate') { approveBiz(c.db, u.id); audit(c.db, (act === 'approve' ? 'Approved business ' : 'Reinstated business ') + b.name); }
    else if (act === 'reject') { b.status = 'rejected'; b.rejectReason = String(c.body.reason || 'Details could not be verified.').slice(0, 140); u.bizStatus = 'rejected'; u.hasBizAccount = false; audit(c.db, 'Rejected business ' + b.name);
      notify(c.db, u.id, { type: 'verification', mode: 'normal', title: 'Business verification update', body: b.rejectReason + ' You can resubmit.', urgent: true }); }
    else if (act === 'suspend') { b.status = 'suspended'; u.bizStatus = 'suspended'; u.hasBizAccount = false; u.activeMode = 'normal'; c.db.modeState[u.id] = {}; audit(c.db, 'Suspended business ' + b.name);
      notify(c.db, u.id, { type: 'verification', mode: 'normal', title: 'Business suspended', body: 'Please contact SemaChat support.', urgent: true }); hooks.emit(u.id, { type: 'mode:changed', mode: 'normal', deviceId: 'all' }); }
    else fail(400, 'Unknown action.');
    return { ok: true, status: b.status };
  });
  route('POST', /^\/api\/admin\/users\/([^/]+)\/mode$/, 'admin', null, c => {
    const u = byId(c.db, c.p[0]); if (!u) fail(404, 'User not found.');
    if (!MODES.includes(c.body.mode)) fail(400, 'Mode must be normal or business.', { code: 'INVALID_MODE' });
    if (!String(c.body.reason || '').trim()) fail(400, 'A reason is required for the audit log.');
    c.db.modeState[u.id] = {}; const r = setMode(c.db, u, c.body.mode, 'admin');
    c.db.modeState[u.id] = {}; // clear per-device pins so the override takes effect everywhere
    audit(c.db, 'Admin forced ' + u.name + ' → ' + r.activeMode + ' mode. Reason: ' + String(c.body.reason).slice(0, 100));
    notify(c.db, u.id, { type: 'system', mode: 'normal', title: 'Mode changed by support', body: 'An admin has switched your mode for support reasons.', urgent: true });
    return r;
  });
  route('GET', /^\/api\/admin\/mode-analytics$/, 'admin', null, c => ({ since: Date.now() - 30 * D, metrics: modeMetrics(c.db, Date.now() - 30 * D) }));
  route('GET', /^\/api\/admin\/weekly-report$/, 'admin', null, c => {
    const now = Date.now(), cur = modeMetrics(c.db, now - 7 * D), all = modeMetrics(c.db, now - 14 * D);
    const hi = [];
    hi.push(cur.adoption.bizAccounts + ' business accounts (' + cur.adoption.bizPct + '% of users); ' + cur.adoption.registrationsSubmitted + ' registrations submitted, ' + cur.adoption.registrationsApproved + ' approved this week.');
    hi.push(cur.engagement.switches + ' mode switches (' + cur.engagement.switchesPerUserPerDay + ' per user per day; target 3–5).');
    hi.push('Peek: ' + cur.peek.opened + ' opened → ' + cur.peek.replyPct + '% replied inline, ' + cur.peek.switchPct + '% switched mode, ' + cur.peek.dismissPct + '% dismissed.');
    hi.push('Notifications: ' + cur.notifications.delivered + ' delivered, ' + cur.notifications.silent + ' silent, ' + cur.notifications.batched + ' batched, ' + cur.notifications.critical + ' critical.');
    hi.push('Customer phone reveal rate: ' + cur.identity.revealPct + '% of business chats.');
    return { generatedAt: now, period: { from: now - 7 * D, to: now }, highlights: hi, metrics: cur, previous14d: { switches: all.engagement.switches, notifications: all.notifications.delivered } };
  });

  route('GET', /^\/api\/health$/, null, null, () => ({ ok: true, app: 'SemaChat', time: Date.now() }));

  /* --------------------------------------------------------------- handler */
  function handle(db, method, url, body, token, headers) {
    try {
      const i = url.indexOf('?'), path = i < 0 ? url : url.slice(0, i);
      const query = Object.fromEntries(new URLSearchParams(i < 0 ? '' : url.slice(i + 1)));
      for (const r of R) {
        if (r.m !== method) continue;
        const m = path.match(r.p); if (!m) continue;
        const user = token && token.startsWith('tok_') && token !== 'tok_admin' ? db.users.find(u => 'tok_' + u.id === token) : null;
        if (user) db.seen[user.id] = Date.now();
        const mode = resolveMode(db, user, headers);
        if (r.auth === 'admin' && token !== 'tok_admin') fail(401, 'Developer sign-in required.');
        if (r.auth === 'user' || r.auth === 'biz') {
          if (!user) fail(401, 'Please sign in.');
          if (user.status === 'suspended') fail(403, 'Your account has been suspended. Contact SemaChat support.');
          if (db.settings.maintenance) fail(503, 'SemaChat is under maintenance. We will be right back.');
        }
        if (r.auth === 'biz' && !canBiz(db, user)) {
          logEvent(db, 'biz_gate_blocked', user.id, { endpoint: method + ' ' + path.replace(/\/[a-z]_[a-z0-9]+/gi, '/:id') });
          if (user.bizStatus === 'suspended') fail(403, 'Your business account is suspended. Contact support.', { code: 'BIZ_ACCOUNT_SUSPENDED' });
          fail(403, 'Register your business to access this feature', { code: 'BIZ_ACCOUNT_REQUIRED', ctaAction: 'register', ctaLabel: 'Start Registration', ctaUrl: 'semachat://biz/register' });
        }
        if (r.feat && !db.settings.features[r.feat]) fail(403, 'This feature is currently switched off by SemaChat.');
        const ctx = { db, user, body: body || {}, query, p: m.slice(1), mode, headers: headers || {} };
        // content guard: the developer's word / place list is applied to every write before it runs (chat messages are stopped softly below)
        if (user && method !== 'GET' && hooks.guard) { const v = hooks.guard(ctx, method, path); if (v) { ctx.guardHit = v; if (!v.softBlock) fail(422, v.message, { code: 'CONTENT_BLOCKED' }); } }
        const data = r.fn(ctx);
        if (r.auth === 'admin' && hooks.adminAccess) { try { hooks.adminAccess(db, method, path, query); } catch (e) { /* the audit trail must never break a request */ } }
        if (user) taps.forEach(f => { try { f(ctx, method, path, data); } catch (e) { /* monitoring must never break a request */ } });
        return { status: 200, data };
      }
      return { status: 404, data: { error: 'Not found' } };
    } catch (e) {
      if (e instanceof HttpError) return { status: e.status, data: Object.assign({ error: e.message, code: e.code }, e.extra || {}) };
      return { status: 500, data: { error: 'Server error: ' + e.message } };
    }
  }

  // extension hook: lets add-on modules (backend/business.js) register routes against the same internals
  const X = { tierOf, route, uid, fail, byId, wallet, addTx, charge, addRevenue, notify, pushMessage, bizChatFor, bizOwnerFor, bizAudience, teamOf, canBiz, logEvent, audit, pick, pub, hash, friendsOf, D, H };
  const use = fn => fn(X);

  return { seed, handle, hooks, OTP, ADMIN, TEAM, use, tap: f => taps.push(f), onMessage: f => scanners.push(f) };
});
