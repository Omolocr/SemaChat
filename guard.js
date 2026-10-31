/* SemaChat — Content guard (add-on module).
 * The app developer keeps a list of words, slang, phrases, places and restricted zones that must not travel on SemaChat,
 * for the safety and cohesion of the country. A match is stopped BEFORE delivery:
 *   - chat messages: the sender still sees the message in their own chat, marked "Not delivered", and nobody else ever receives it,
 *     however good the network is;
 *   - posts, comments, Moments captions, adverts, appeals, group names and similar: refused with a clear message.
 * Every change to the list is audit-logged. The sender is told generically why (never which word), and hits are visible to the
 * developer in Content guard. Matching is a demo heuristic: it normalises case, accents, letter-swaps (0/o, 1/i, @/a …) and
 * spaced-out letters, but it is a word-list filter, not a language model. Plug a real moderation service in with core.compliance.addClassifier.
 * Works in Node (require('./guard')(core)) and in the browser preview (after core.js).
 */
(function (root, install) {
  if (typeof module === 'object' && module.exports) module.exports = install;
  else install(root.SemaChatCore);
})(typeof self !== 'undefined' ? self : this, function install(core) {
  const CATEGORIES = [['incitement', 'Incitement to violence'], ['hate', 'Hate or tribal / ethnic abuse'], ['security', 'Security-sensitive'], ['cohesion', 'National cohesion'], ['other', 'Other']];
  const TYPES = ['word', 'slang', 'phrase', 'location'];
  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };
  const SHOWN = 'This message contains words or content SemaChat does not allow, to protect the safety and unity of everyone. It was not delivered.';
  // lowercase, strip accents, undo common letter swaps, drop punctuation, join spaced-out letters ("k i l l" -> "kill")
  function normalise(t) {
    let s = String(t == null ? '' : t).slice(0, 4000).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    s = s.replace(/[01345 7@$]/g, ch => (ch === ' ' ? ' ' : LEET[ch]));
    s = s.replace(/[^a-z\s]/g, ' ').replace(/(.)\1{2,}/g, '$1$1');
    s = s.replace(/\b((?:[a-z]\s+){2,}[a-z])\b/g, m => m.replace(/\s+/g, ''));
    return (' ' + s.replace(/\s+/g, ' ').trim() + ' ');
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const termNorm = t => normalise(t).trim();
  // "k i l l  t h e m" -> also test the text with every space removed, but only when letters were spread out on purpose
  const spaced = t => /(^|\s)[a-z]\s+[a-z]\s+[a-z](\s|$)/.test(String(t).toLowerCase());
  function ruleHits(text, rules) {
    const n = normalise(text), sq = spaced(text) ? ' ' + String(text).toLowerCase().replace(/[^a-z]/g, '') + ' ' : null, out = [];
    for (const r of rules) {
      if (!r.enabled) continue; const t = r._n || (r._n = termNorm(r.term)); if (!t) continue;
      const hit = (r.match === 'contains' ? n.includes(t) : n.includes(' ' + t + ' ')) || (sq && sq.includes(t.replace(/ /g, '')));
      if (hit) out.push(r);
    }
    return out;
  }
  const dist = (a, b, c, d) => { const R = 6371000, r = x => x * Math.PI / 180, dl = r(c - a), dg = r(d - b), x = Math.sin(dl / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
  const SKIP = /^(password|code|token|email|idnumber|nationalid|data|img|thumb|photos|idselfie|approvalcode|phone|repid|regnumber|kra|kraPin|passkey)$/i;
  function strings(v, out, depth, key) {
    if (out.length > 200 || depth > 4 || v == null) return;
    if (typeof v === 'string') { if (!SKIP.test(key || '') && !v.startsWith('data:')) out.push(v.slice(0, 4000)); }
    else if (Array.isArray(v)) v.slice(0, 50).forEach(x => strings(x, out, depth + 1, key));
    else if (typeof v === 'object') Object.keys(v).slice(0, 60).forEach(k => strings(v[k], out, depth + 1, k));
  }
  function coords(b) { const c = []; const pick = o => { if (o && isFinite(+o.lat) && isFinite(+o.lng) && o.lat !== '' && o.lng !== '' && o.lat != null) c.push([+o.lat, +o.lng]); }; if (b) { pick(b); pick(b.meta); pick(b.pin); } return c; }
  core.guard = { normalise, ruleHits, CATEGORIES };

  core.use(function (X) {
    'use strict';
    const { route, uid, fail, byId, audit, logEvent, pub } = X;
    function G(db) {
      if (db.guard) return db.guard;
      const now = Date.now(); db.guard = { enabled: true, rules: [], zones: [], hits: [], counters: { blocked: 0 } };
      [['kill them all', 'phrase', 'incitement'], ['burn their houses', 'phrase', 'incitement'], ['chase them out of our county', 'phrase', 'cohesion']].forEach(r => db.guard.rules.push({ id: uid('gr_'), term: r[0], type: r[1], match: 'word', category: r[2], enabled: true, createdAt: now, hits: 0, example: true }));
      return db.guard;
    }
    const ruleView = r => ({ id: r.id, term: r.term, type: r.type, match: r.match, category: r.category, enabled: r.enabled, hits: r.hits, createdAt: r.createdAt, example: !!r.example });
    function check(db, user, method, path, body) {
      const g = G(db); if (!g.enabled || !user) return null;
      if (/^\/api\/(auth|admin|pay)\b/.test(path)) return null;
      const texts = []; strings(body, texts, 0, ''); let hit = null;
      for (const t of texts) { const h = ruleHits(t, g.rules); if (h.length) { hit = { rule: h[0], text: t }; break; } }
      let zone = null; if (!hit) { for (const [la, ln] of coords(body)) { zone = g.zones.find(z => z.enabled && dist(la, ln, z.lat, z.lng) <= z.radiusM); if (zone) break; } }
      if (!hit && !zone) return null;
      const rec = { id: uid('gh_'), ts: Date.now(), userId: user.id, where: method + ' ' + path.replace(/\/[a-z]{1,3}_[a-z0-9]+/gi, '/:id').split('?')[0], category: hit ? hit.rule.category : 'security', ruleId: hit ? hit.rule.id : zone.id, kind: hit ? hit.rule.type : 'zone', zone: zone ? zone.name : null, excerpt: hit ? hit.text.slice(0, 90) : 'Location inside “' + zone.name + '”' };
      if (hit) hit.rule.hits++; else zone.hits++;
      g.hits.unshift(rec); g.hits.length = Math.min(g.hits.length, 500); g.counters.blocked++;
      logEvent(db, 'guard_blocked', user.id, { cat: rec.category });
      const isMsg = /^\/api\/chats\/[^/]+\/messages$/.test(path) && method === 'POST';
      return { rec, softBlock: isMsg, message: zone ? 'Sharing or posting from this location is not allowed on SemaChat.' : 'This was not sent. It contains words or content SemaChat does not allow, to protect the safety and unity of everyone.' };
    }
    // core calls this for every write request from a signed-in user, before the route runs
    core.hooks.guard = (ctx, method, path) => check(ctx.db, ctx.user, method, path, ctx.body);
    core.hooks.guardNotice = SHOWN;

    /* ---------------------------------------------------------------- developer routes */
    const adm = (m, p, fn) => route(m, p, 'admin', null, fn);
    const snapshot = db => { const g = G(db), c = {}; g.hits.forEach(h => { c[h.userId] = (c[h.userId] || 0) + 1; });
      const day = Date.now() - 864e5;
      return { enabled: g.enabled, categories: CATEGORIES.map(x => ({ id: x[0], name: x[1] })), types: TYPES, rules: g.rules.map(ruleView), zones: g.zones.map(z => ({ id: z.id, name: z.name, lat: z.lat, lng: z.lng, radiusM: z.radiusM, enabled: z.enabled, hits: z.hits })),
        stats: { blockedTotal: g.counters.blocked, blocked24h: g.hits.filter(h => h.ts > day).length, activeRules: g.rules.filter(r => r.enabled).length, zones: g.zones.filter(z => z.enabled).length },
        hits: g.hits.slice(0, 60).map(h => Object.assign({}, h, { user: pub(byId(db, h.userId)) })), repeat: Object.keys(c).map(id => ({ user: pub(byId(db, id)), hits: c[id] })).sort((a, b) => b.hits - a.hits).slice(0, 8) }; };
    adm('GET', /^\/api\/admin\/guard$/, c => snapshot(c.db));
    const cleanTerm = t => String(t || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    function addRule(db, term, type, match, category) {
      const g = G(db); term = cleanTerm(term); const n = termNorm(term);
      if (n.length < 2) fail(400, 'Enter at least two letters. Numbers and symbols are ignored when matching.');
      if (!TYPES.includes(type)) type = 'word'; if (!CATEGORIES.some(x => x[0] === category)) category = 'other';
      if (g.rules.some(r => termNorm(r.term) === n)) return null;
      const r = { id: uid('gr_'), term, type, match: match === 'contains' ? 'contains' : 'word', category, enabled: true, createdAt: Date.now(), hits: 0 }; g.rules.push(r); return r;
    }
    adm('POST', /^\/api\/admin\/guard\/rules$/, c => { const r = addRule(c.db, c.body.term, c.body.type, c.body.match, c.body.category); if (!r) fail(409, 'That term is already on the list.'); audit(c.db, 'Content guard: added ' + r.type + ' “' + r.term + '” (' + r.category + ')'); return ruleView(r); });
    adm('POST', /^\/api\/admin\/guard\/bulk$/, c => {
      const lines = String(c.body.text || '').split(/[\n,;]+/).map(cleanTerm).filter(Boolean).slice(0, 500); let n = 0;
      lines.forEach(t => { try { if (addRule(c.db, t, c.body.type, c.body.match, c.body.category)) n++; } catch (e) { /* too short: skipped */ } });
      audit(c.db, 'Content guard: bulk-added ' + n + ' term(s) (' + (c.body.category || 'other') + ')'); return { added: n, skipped: lines.length - n };
    });
    adm('PUT', /^\/api\/admin\/guard\/rules\/(gr_[a-z0-9]+)$/, c => { const r = G(c.db).rules.find(x => x.id === c.p[0]); if (!r) fail(404, 'Rule not found.'); if (typeof c.body.enabled === 'boolean') r.enabled = c.body.enabled; if (c.body.category && CATEGORIES.some(x => x[0] === c.body.category)) r.category = c.body.category; if (c.body.match) r.match = c.body.match === 'contains' ? 'contains' : 'word'; audit(c.db, 'Content guard: “' + r.term + '” ' + (r.enabled ? 'on' : 'off')); return ruleView(r); });
    adm('DELETE', /^\/api\/admin\/guard\/rules\/(gr_[a-z0-9]+)$/, c => { const g = G(c.db), r = g.rules.find(x => x.id === c.p[0]); if (!r) fail(404, 'Rule not found.'); g.rules = g.rules.filter(x => x !== r); audit(c.db, 'Content guard: removed “' + r.term + '”'); return { ok: true }; });
    adm('POST', /^\/api\/admin\/guard\/zones$/, c => {
      const g = G(c.db), b = c.body, lat = Number(b.lat), lng = Number(b.lng), rad = Math.round(Number(b.radiusM));
      if (!cleanTerm(b.name)) fail(400, 'Name the restricted zone.'); if (!isFinite(lat) || !isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) fail(400, 'Enter valid coordinates.'); if (!(rad >= 20 && rad <= 200000)) fail(400, 'Radius must be between 20 m and 200 km.');
      const z = { id: uid('gz_'), name: cleanTerm(b.name), lat, lng, radiusM: rad, enabled: true, hits: 0, createdAt: Date.now() }; g.zones.push(z); audit(c.db, 'Content guard: restricted zone “' + z.name + '” added (' + rad + ' m)'); return z;
    });
    adm('PUT', /^\/api\/admin\/guard\/zones\/(gz_[a-z0-9]+)$/, c => { const z = G(c.db).zones.find(x => x.id === c.p[0]); if (!z) fail(404, 'Zone not found.'); if (typeof c.body.enabled === 'boolean') z.enabled = c.body.enabled; audit(c.db, 'Content guard: zone “' + z.name + '” ' + (z.enabled ? 'on' : 'off')); return z; });
    adm('DELETE', /^\/api\/admin\/guard\/zones\/(gz_[a-z0-9]+)$/, c => { const g = G(c.db), z = g.zones.find(x => x.id === c.p[0]); if (!z) fail(404, 'Zone not found.'); g.zones = g.zones.filter(x => x !== z); audit(c.db, 'Content guard: zone “' + z.name + '” removed'); return { ok: true }; });
    adm('PUT', /^\/api\/admin\/guard\/settings$/, c => { const g = G(c.db); if (typeof c.body.enabled === 'boolean') { g.enabled = c.body.enabled; audit(c.db, 'Content guard switched ' + (g.enabled ? 'ON' : 'OFF')); } return { enabled: g.enabled }; });
    // try a sentence against the list without sending anything
    adm('POST', /^\/api\/admin\/guard\/test$/, c => { const h = ruleHits(String(c.body.text || ''), G(c.db).rules); return { blocked: h.length > 0, matched: h.map(r => ({ term: r.term, category: r.category })) }; });
  });
});
