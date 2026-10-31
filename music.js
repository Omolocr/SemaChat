/* SemaChat — DIRA Music (add-on module).
 * A deterministic cloud catalogue of 300,000 tracks in 24 genres (artist, band, title, album, year),
 * paged browse + search, favourites, recently played and saved equalizer settings.
 * Audio: in production each track resolves to a CDN/object-storage URL (settings.musicCdn); in the demo the
 * client synthesises audio from the track's seed so every track is playable without any media files.
 * Works in Node (require('./music')(core)) and in the browser preview (after core.js).
 */
(function (root, install) {
  if (typeof module === 'object' && module.exports) module.exports = install;
  else install(root.SemaChatCore);
})(typeof self !== 'undefined' ? self : this, function install(core) {
  const GENRES = [
    ['afrobeat', 'Afrobeat', '🥁', 100], ['benga', 'Benga', '🎸', 112], ['bongo', 'Bongo Flava', '🎤', 98], ['gengetone', 'Gengetone', '🔥', 140], ['amapiano', 'Amapiano', '🎹', 112], ['gospel', 'Gospel', '🙏', 84],
    ['rumba', 'Rumba', '💃', 104], ['taarab', 'Taarab', '🪕', 92], ['reggae', 'Reggae', '🌴', 76], ['hiphop', 'Hip Hop', '🎧', 90], ['rnb', 'R&B', '💜', 82], ['pop', 'Pop', '⭐', 118],
    ['rock', 'Rock', '🤘', 128], ['jazz', 'Jazz', '🎷', 110], ['classical', 'Classical', '🎻', 72], ['electronic', 'Electronic', '⚡', 128], ['house', 'House', '🏠', 124], ['lofi', 'Lo-fi', '☕', 70],
    ['country', 'Country', '🤠', 100], ['blues', 'Blues', '🎺', 80], ['folk', 'Folk & Ngoma', '🪘', 96], ['latin', 'Latin', '🌶️', 102], ['dancehall', 'Dancehall', '🕺', 96], ['soul', 'Soul', '❤️', 88]
  ].map(g => ({ id: g[0], name: g[1], emoji: g[2], bpm: g[3] }));
  const PER = 12500, TOTAL = GENRES.length * PER;
  const FIRST = ['Amani', 'Wanjiru', 'Otieno', 'Fatuma', 'Kiprono', 'Zawadi', 'Baraka', 'Neema', 'Juma', 'Akinyi', 'Mwangi', 'Chebet', 'Barasa', 'Nyambura', 'Omondi', 'Halima', 'Tendai', 'Zola', 'Kofi', 'Ama', 'Sauti', 'Imani', 'Jabali', 'Safiya', 'Mosi', 'Tisa', 'Kito', 'Nia', 'Rafiki', 'Zuri', 'Kamau', 'Atieno', 'Wekesa', 'Mutiso', 'Naliaka', 'Lulu', 'Dalila', 'Hamisi', 'Penda', 'Salma'];
  const LAST = ['Kimani', 'Ochieng', 'Mutua', 'Wafula', 'Njeri', 'Karanja', 'Jeptoo', 'Mbugua', 'Okello', 'Said', 'Maina', 'Kariuki', 'Ouma', 'Adhiambo', 'Kiplagat', 'Hassan', 'Nduta', 'Waweru', 'Owino', 'Simiyu', 'Mwende', 'Rono', 'Achieng', 'Juma', 'Githinji', 'Kilonzo', 'Wambui', 'Onyango', 'Mohamed', 'Chege'];
  const BAND_A = ['Savanna', 'Rift Valley', 'Kilimanjaro', 'Lake', 'Mara', 'Coast', 'Tsavo', 'Highland', 'Sunset', 'Golden', 'Midnight', 'Crimson', 'Blue Nile', 'Acacia', 'Baobab', 'Zanzibar', 'Nairobi', 'Kisumu', 'Mombasa', 'Dusk', 'Ivory', 'Rhythm', 'Electric', 'Velvet', 'Thunder', 'Silver', 'Desert', 'Island', 'Urban', 'SemaChat'];
  const BAND_B = ['Boys', 'Sound', 'Collective', 'Express', 'Brothers', 'Syndicate', 'Ensemble', 'Crew', 'Band', 'Allstars', 'Kings', 'Voices', 'Orchestra', 'Riders', 'Roots', 'Project', 'Union', 'Family', 'Machine', 'Society'];
  const T1 = ['Dancing', 'Walking', 'Running', 'Dreaming', 'Waiting', 'Burning', 'Falling', 'Flying', 'Singing', 'Calling', 'Chasing', 'Shining', 'Rolling', 'Breaking', 'Holding', 'Counting', 'Waking', 'Moving', 'Laughing', 'Praying'];
  const T2 = ['in the Rain', 'to Nairobi', 'on the Lake', 'at Midnight', 'Home', 'with the Wind', 'Through the Fire', 'Under Stars', 'by the River', 'in Slow Motion', 'for You', 'Without You', 'to the Coast', 'in the Sun', 'Together', 'on the Mountain', 'Tonight', 'Forever', 'in Your Eyes', 'Across the Rift'];
  const WORDS = ['Mama', 'Baby', 'Moto', 'Jua', 'Mwezi', 'Pole Pole', 'Karibu', 'Safari', 'Harambee', 'Asante', 'Upendo', 'Maisha', 'Furaha', 'Tumaini', 'Amani', 'Shamba', 'Pwani', 'Nyota', 'Mapenzi', 'Baraka', 'Hakuna', 'Jambo', 'Kesho', 'Leo', 'Usiku', 'Asubuhi', 'Mvua', 'Moyo', 'Ngoma', 'Wimbo'];
  const ALB = ['Live', 'Sessions', 'Volume', 'Chapters', 'Stories', 'Anthology', 'Echoes', 'Horizons', 'Season', 'Roots'];
  const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'], SCALES = ['major', 'minor', 'minor', 'major', 'dorian', 'pentatonic'];
  // fast deterministic integer hash (mulberry-style) so the same id always makes the same song
  function h32(n) { let x = (n + 0x9e3779b9) | 0; x = Math.imul(x ^ (x >>> 16), 0x85ebca6b); x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35); return (x ^ (x >>> 16)) >>> 0; }
  const rnd = (n, salt, m) => h32(n * 31 + salt) % m;

  function track(n) {
    if (!(n >= 0 && n < TOTAL)) return null;
    const gi = Math.floor(n / PER), g = GENRES[gi], k = n % PER;
    const bandNo = k % 400, band = BAND_A[(bandNo + gi * 7) % BAND_A.length] + ' ' + BAND_B[Math.floor(bandNo / BAND_A.length + gi) % BAND_B.length] + (bandNo >= 600 ? ' ' + Math.floor(bandNo / 600) : '');
    const bandSeed = gi * 1000 + bandNo, artist = FIRST[rnd(bandSeed, 1, FIRST.length)] + ' ' + LAST[rnd(bandSeed, 2, LAST.length)];
    const useAfr = rnd(n, 3, 3) === 0, title = useAfr ? WORDS[rnd(n, 4, WORDS.length)] + ' ' + WORDS[rnd(n, 5, WORDS.length)] : T1[rnd(n, 6, T1.length)] + ' ' + T2[rnd(n, 7, T2.length)];
    const dur = 150 + rnd(n, 8, 150), bpm = Math.max(60, g.bpm + rnd(n, 9, 21) - 10);
    return { id: 't_' + n, n, title, artist, band, album: ALB[rnd(bandSeed, 10, ALB.length)] + ' ' + (1 + rnd(bandSeed + k % 3, 11, 5)), genre: g.id, genreName: g.name, year: 1998 + rnd(n, 12, 28), durationSec: dur, bpm,
      key: KEYS[rnd(n, 13, 12)], scale: SCALES[rnd(n, 14, SCALES.length)], seed: h32(n), source: 'cloud' };
  }
  const lc = s => String(s).toLowerCase();
  core.music = { GENRES, TOTAL, PER, track };

  core.use(function (X) {
    'use strict';
    const { route, fail, byId } = X;
    const M = (db, id) => { const m = db.music || (db.music = {}); return m[id] || (m[id] = { fav: [], recent: [], eq: null, playlists: [] }); };
    const withFav = (m, t) => Object.assign({}, t, { fav: m.fav.includes(t.id) });
    const cdn = db => (db.settings && db.settings.musicCdn) || '';
    const stream = (db, t) => (cdn(db) ? { url: cdn(db).replace(/\/$/, '') + '/' + t.genre + '/' + t.n + '.mp3' } : { demo: true, note: 'Demo audio is synthesised on your device. Set settings.musicCdn to serve real files.' });

    route('GET', /^\/api\/music\/genres$/, 'user', 'music', c => ({ total: TOTAL, perGenre: PER, genres: GENRES.map(g => Object.assign({}, g, { count: PER })) }));
    route('GET', /^\/api\/music\/tracks$/, 'user', 'music', c => {
      const q = lc(c.query.q || '').trim(), gid = c.query.genre || '', off = Math.max(0, parseInt(c.query.offset, 10) || 0), lim = Math.min(60, Math.max(1, parseInt(c.query.limit, 10) || 30)), m = M(c.db, c.user.id);
      const gi = gid ? GENRES.findIndex(g => g.id === gid) : -1; if (gid && gi < 0) fail(404, 'Unknown genre.');
      const from = gi < 0 ? 0 : gi * PER, to = gi < 0 ? TOTAL : (gi + 1) * PER;
      if (!q) { const items = []; for (let n = from + off; n < Math.min(to, from + off + lim); n++) items.push(withFav(m, track(n))); return { total: to - from, offset: off, items, hasMore: from + off + lim < to }; }
      // search: scan deterministically (early exit once the page is full)
      const items = []; let skipped = 0, more = false;
      for (let n = from; n < to; n++) { const t = track(n); if (lc(t.title).includes(q) || lc(t.artist).includes(q) || lc(t.band).includes(q) || lc(t.album).includes(q)) { if (skipped < off) { skipped++; continue; } if (items.length >= lim) { more = true; break; } items.push(withFav(m, t)); } }
      return { query: q, offset: off, items, hasMore: more, total: null };
    });
    route('GET', /^\/api\/music\/track\/(t_\d+)$/, 'user', 'music', c => {
      const t = track(parseInt(c.p[0].slice(2), 10)); if (!t) fail(404, 'Track not found.');
      const m = M(c.db, c.user.id); m.recent = [t.id].concat(m.recent.filter(x => x !== t.id)).slice(0, 30);
      return Object.assign(withFav(m, t), { stream: stream(c.db, t) });
    });
    route('GET', /^\/api\/music\/library$/, 'user', 'music', c => { const m = M(c.db, c.user.id), P = id => track(parseInt(id.slice(2), 10)); return { favourites: m.fav.map(P).filter(Boolean).map(t => withFav(m, t)), recent: m.recent.map(P).filter(Boolean).map(t => withFav(m, t)), eq: m.eq, playlists: m.playlists.map(p => ({ id: p.id, name: p.name, count: p.ids.length })) }; });
    route('POST', /^\/api\/music\/fav$/, 'user', 'music', c => { const id = String(c.body.id || ''); if (!/^t_\d+$/.test(id) || !track(parseInt(id.slice(2), 10))) fail(400, 'Unknown track.'); const m = M(c.db, c.user.id); const on = !m.fav.includes(id); m.fav = on ? [id].concat(m.fav).slice(0, 2000) : m.fav.filter(x => x !== id); return { id, fav: on, count: m.fav.length }; });
    route('PUT', /^\/api\/music\/eq$/, 'user', 'music', c => {
      const b = c.body || {}, m = M(c.db, c.user.id), bands = Array.isArray(b.bands) ? b.bands.slice(0, 10).map(v => Math.max(-12, Math.min(12, Number(v) || 0))) : [];
      m.eq = { preset: String(b.preset || 'flat').slice(0, 30), bands, noise: Math.max(0, Math.min(100, Number(b.noise) || 0)), clarity: Math.max(0, Math.min(100, Number(b.clarity) || 0)), bass: Math.max(0, Math.min(100, Number(b.bass) || 0)), mood: String(b.mood || '').slice(0, 20), fx: String(b.fx || '').slice(0, 20), boost: Math.max(100, Math.min(300, Number(b.boost) || 100)) };
      return m.eq;
    });
    route('POST', /^\/api\/music\/playlists$/, 'user', 'music', c => { const m = M(c.db, c.user.id), name = String(c.body.name || '').trim().slice(0, 40); if (!name) fail(400, 'Name your playlist.'); if (m.playlists.length >= 50) fail(400, 'Playlist limit reached.'); const p = { id: 'pl_' + (m.playlists.length + 1) + Date.now().toString(36), name, ids: [] }; m.playlists.push(p); return { id: p.id, name }; });
    route('POST', /^\/api\/music\/playlists\/([^/]+)\/add$/, 'user', 'music', c => { const m = M(c.db, c.user.id), p = m.playlists.find(x => x.id === c.p[0]); if (!p) fail(404, 'Playlist not found.'); const id = String(c.body.id || ''); if (!/^t_\d+$/.test(id) || !track(parseInt(id.slice(2), 10))) fail(400, 'Unknown track.'); if (!p.ids.includes(id)) p.ids.push(id); return { id: p.id, count: p.ids.length }; });
    route('GET', /^\/api\/music\/playlists\/([^/]+)$/, 'user', 'music', c => { const m = M(c.db, c.user.id), p = m.playlists.find(x => x.id === c.p[0]); if (!p) fail(404, 'Playlist not found.'); return { id: p.id, name: p.name, items: p.ids.map(i => withFav(m, track(parseInt(i.slice(2), 10)))) }; });
    route('PUT', /^\/api\/admin\/music$/, 'admin', null, c => { if (typeof c.body.cdn === 'string') c.db.settings.musicCdn = c.body.cdn.trim().slice(0, 200); return { cdn: cdn(c.db), total: TOTAL }; });
    route('GET', /^\/api\/admin\/music$/, 'admin', null, c => ({ cdn: cdn(c.db), total: TOTAL, genres: GENRES.length, listeners: Object.keys(c.db.music || {}).length }));
  });
});
