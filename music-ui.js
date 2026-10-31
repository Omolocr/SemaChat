/* SemaChat — DIRA Music UI add-on (loaded via <!--EXT-->).
 * Cloud catalogue (300,000 tracks, 24 genres) + songs from the phone / SD card (ID3 tags: title, artist, band, album, genre),
 * a Web Audio engine with a 10-band equalizer and 40+ presets, noise reduction, vocal & instrument clarity, super bass,
 * moods, effects, and a software volume expander (up to 300%) protected by a limiter.
 * Demo cloud tracks are synthesised on-device from each track's seed; production tracks stream from settings.musicCdn. */
(function () {
  'use strict';
  const FREQS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const FL = ['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  const PRESETS = {
    'Flat': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'Bass Booster': [8, 7, 5, 3, 1, 0, 0, 0, 0, 0], 'Deep Bass': [10, 9, 6, 3, 0, -1, -1, 0, 0, 0], 'Bass Reducer': [-6, -5, -3, -1, 0, 0, 0, 0, 0, 0], 'Treble Booster': [0, 0, 0, 0, 0, 1, 3, 5, 7, 8], 'Treble Reducer': [0, 0, 0, 0, 0, -1, -3, -5, -7, -8],
    'Vocal Booster': [-2, -2, -1, 1, 3, 5, 5, 3, 1, 0], 'Instrumental': [2, 2, 1, 0, 0, 2, 3, 4, 4, 3], 'Acoustic': [4, 4, 3, 1, 2, 2, 3, 4, 3, 2], 'Classical': [0, 0, 0, 0, 0, 0, -2, -3, -4, -5], 'Jazz': [3, 2, 1, 2, -2, -2, 0, 1, 3, 4], 'Rock': [5, 4, 2, 0, -2, -1, 1, 3, 4, 5],
    'Pop': [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2], 'Hip Hop': [6, 5, 2, 3, -1, -1, 1, 0, 2, 3], 'R&B': [4, 7, 5, 1, -2, -1, 2, 2, 3, 3], 'Dance': [6, 5, 3, 0, 0, -3, -4, -4, 0, 0], 'Electronic': [5, 4, 1, -1, -2, 2, 1, 2, 4, 5], 'Techno': [5, 4, 0, -3, -2, 0, 2, 4, 5, 4],
    'House': [6, 5, 3, 1, 0, -1, 1, 2, 3, 3], 'Lounge': [-3, -1, 1, 2, 3, 2, 0, -1, 2, 1], 'Latin': [4, 3, 0, 0, -1, -1, -1, 0, 3, 4], 'Reggae': [4, 4, 1, -2, -2, 0, 1, 3, 3, 2], 'Afrobeat': [5, 5, 3, 1, 0, 1, 2, 3, 3, 2], 'Gospel': [2, 2, 1, 2, 3, 4, 3, 2, 2, 1],
    'Benga': [3, 3, 2, 2, 1, 2, 4, 5, 4, 3], 'Amapiano': [8, 7, 4, 1, -1, 0, 1, 2, 3, 3], 'Taarab': [1, 1, 1, 2, 3, 3, 3, 2, 1, 0], 'Country': [3, 2, 1, 1, 2, 3, 4, 4, 3, 2], 'Blues': [4, 3, 2, 1, -1, -1, 1, 2, 3, 3], 'Metal': [6, 5, 2, 0, -3, -2, 3, 5, 5, 4],
    'Piano': [0, 0, 1, 2, 3, 3, 3, 3, 2, 1], 'Live': [-3, 0, 2, 3, 3, 3, 2, 1, 1, 1], 'Loudness': [6, 4, 0, 0, -1, 0, -1, 0, 4, 2], 'Small Speakers': [6, 5, 4, 2, 0, -1, 0, 1, 2, 3], 'Headphones': [3, 5, 3, 0, -2, -1, 1, 2, 4, 4], 'Podcast / Speech': [-6, -5, -3, 0, 3, 5, 5, 3, 0, -3],
    'Late Night': [3, 2, 1, 0, 0, -1, -2, -3, -2, -1], 'Bright': [-1, -1, 0, 0, 1, 2, 4, 6, 7, 8], 'Warm': [3, 3, 3, 2, 1, 0, -1, -2, -3, -4], 'V-Shape': [7, 6, 3, 0, -3, -3, 0, 3, 6, 7], 'Mid Scoop': [3, 3, 1, -2, -4, -4, -2, 1, 3, 3], 'Studio Monitor': [0, 0, 0, -1, 0, 0, 1, 1, 0, 0]
  };
  const MOODS = { 'Happy': ['😄', 'Pop', { vocal: 40, instr: 40, bass: 30 }, 'Off'], 'Chill': ['😌', 'Lounge', { vocal: 20, instr: 10, bass: 20, noise: 20 }, 'Room'], 'Party': ['🎉', 'Dance', { vocal: 30, instr: 40, bass: 70 }, 'Off'], 'Focus': ['🎯', 'Instrumental', { vocal: 10, instr: 50, bass: 10, noise: 40 }, 'Off'], 'Romantic': ['💞', 'R&B', { vocal: 60, instr: 20, bass: 25 }, 'Hall'],
    'Workout': ['💪', 'Hip Hop', { vocal: 30, instr: 50, bass: 80 }, 'Off'], 'Sad': ['😢', 'Warm', { vocal: 50, instr: 20, bass: 15 }, 'Hall'], 'Night drive': ['🌃', 'Deep Bass', { vocal: 30, instr: 30, bass: 60 }, 'Echo'], 'Worship': ['🙏', 'Gospel', { vocal: 60, instr: 30, bass: 20 }, 'Cathedral'], 'Study': ['📚', 'Late Night', { vocal: 10, instr: 20, bass: 5, noise: 50 }, 'Off'],
    'Sleep': ['😴', 'Warm', { vocal: 0, instr: 0, bass: 10, noise: 60 }, 'Room'], 'Road trip': ['🚗', 'Rock', { vocal: 40, instr: 40, bass: 50 }, 'Off'], 'Dinner': ['🍽️', 'Jazz', { vocal: 30, instr: 30, bass: 15 }, 'Room'], 'Sunrise': ['🌅', 'Acoustic', { vocal: 40, instr: 40, bass: 20 }, 'Off'], 'Afro vibes': ['🌍', 'Afrobeat', { vocal: 40, instr: 40, bass: 60 }, 'Off'], 'Karaoke night': ['🎤', 'Vocal Booster', { vocal: 0, instr: 30, bass: 30 }, 'Karaoke'] };
  const FX = ['Off', 'Room', 'Hall', 'Cathedral', 'Echo', 'Slapback', 'Widener', '8D Audio', 'Karaoke', 'Vinyl', 'Radio', 'Telephone', 'Underwater', 'Concert'];
  const FXI = { Off: '⭕', Room: '🏠', Hall: '🏛️', Cathedral: '⛪', Echo: '🔁', Slapback: '👏', Widener: '↔️', '8D Audio': '🎧', Karaoke: '🎤', Vinyl: '📀', Radio: '📻', Telephone: '☎️', Underwater: '🌊', Concert: '🏟️' };
  const mu = S.mu = { tab: 'cloud', st: 'eq', genres: null, total: 0, genre: '', q: '', items: [], hasMore: false, loading: false, local: [], cur: null, list: [], idx: -1, playing: false, shuffle: false, repeat: 'off', pos: 0, dur: 0, vol: 0.8, devGroup: 'genre', scan: '',
    eq: { preset: 'Flat', bands: PRESETS.Flat.slice(), noise: 0, vocal: 0, instr: 0, bass: 0, mood: '', fx: 'Off', fxAmt: 50, boost: 100 }, favs: null };
  const tryA = async (m, p, b) => { try { return await api(m, p, b); } catch (e) { return null; } };
  const css = document.createElement('style');
  css.textContent = `.mgen{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 16px 12px}.mgen button{border-radius:14px;padding:12px 4px;color:#fff;font-weight:800;font-size:12.5px;display:flex;flex-direction:column;align-items:center;gap:4px;text-shadow:0 1px 3px #0006}.mgen button span{font-size:24px}
  .mt{display:flex;align-items:center;gap:10px;padding:8px 16px}.mt:active{background:var(--soft)}.mt .art{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;flex:0 0 44px}.mt.on .art{outline:3px solid var(--brand)}
  .mt .t{font-weight:700;font-size:14px}.mt .a{font-size:12px;color:var(--muted)}.mt .ell{display:block}
  .mpl{margin:0 16px 12px;background:linear-gradient(160deg,#1f1b2e,#553c9a);color:#fff;border-radius:22px;padding:18px;text-align:center}.mpl .big{width:150px;height:150px;border-radius:24px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:64px;box-shadow:0 10px 30px #0006}
  .mpl h3{font-size:20px}.mpl .meta{font-size:13px;opacity:.9;margin-top:2px}.mpl .mrow{display:flex;gap:6px;justify-content:center;margin:6px 0}.mpl .mrow span{background:#fff2;border-radius:99px;padding:3px 10px;font-size:12px}
  .mpl input[type=range]{width:100%;accent-color:#f6ad55}.mctl{display:flex;align-items:center;justify-content:center;gap:16px;margin:8px 0}.mctl button{font-size:26px;color:#fff;width:48px;height:48px;border-radius:50%}.mctl .pp{background:#f6ad55;color:#1f1b2e;width:64px;height:64px;font-size:28px}.mctl .on{background:#fff3}
  .mviz{width:100%;height:56px;display:block;margin:6px 0}.mseg{display:flex;gap:6px;overflow-x:auto;padding:0 16px 10px;scrollbar-width:none}.mseg button{flex:0 0 auto;padding:7px 12px;border-radius:99px;background:var(--soft);font-weight:700;font-size:12.5px;color:#5c4a33}.mseg button.on{background:#553c9a;color:#fff}
  .eqb{display:flex;gap:3px;justify-content:space-between;padding:0 12px;height:170px}.eqb div{flex:1;text-align:center;font-size:10px;color:var(--muted);display:flex;flex-direction:column;align-items:center}.eqb input[type=range]{writing-mode:vertical-lr;direction:rtl;height:130px;width:26px;accent-color:#553c9a}
  .mini{position:fixed;left:0;right:0;bottom:62px;max-width:520px;margin:0 auto;z-index:50;background:#1f1b2e;color:#fff;display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:16px 16px 0 0}.mini .t{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini .a{font-size:11px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini button{color:#fff;font-size:22px;width:38px;height:38px}
  .mchips{display:flex;flex-wrap:wrap;gap:6px;padding:0 16px 12px}.mchips button{padding:8px 12px;border-radius:12px;background:#fff;box-shadow:0 1px 0 var(--line);font-weight:700;font-size:12.5px}.mchips button.on{background:#553c9a;color:#fff}
  .mwarn{background:#fffaf0;border:1px solid #f6ad55;border-radius:12px;padding:10px;margin:0 16px 10px;font-size:12.5px}`;
  document.head.appendChild(css);
  const mmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const GENRE_G = i => ['#c2410c,#f59e0b', '#2b6cb0,#38b2ac', '#805ad5,#d53f8c', '#2f855a,#2b6cb0', '#c53030,#dd6b20', '#553c9a,#2b6cb0', '#975a16,#c05621', '#2c7a7b,#2f855a'][i % 8];
  const grad = (t, i) => { const h = ((t && t.seed) || i || 0) % 8; return `linear-gradient(135deg,${GENRE_G(h)})`; };
  const gEmoji = t => { const g = mu.genres && mu.genres.find(x => x.id === (t && t.genre)); return (g && g.emoji) || '🎵'; };

  /* ------------------------------------------------------------ ID3 tag reader (mp3) + filename fallback */
  async function readTags(file) {
    const out = { title: '', artist: '', band: '', album: '', genre: '', year: '' };
    try {
      const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
      if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
        const size = ((head[6] & 127) << 21) | ((head[7] & 127) << 14) | ((head[8] & 127) << 7) | (head[9] & 127), ver = head[3];
        const buf = new Uint8Array(await file.slice(10, 10 + Math.min(size, 2e6)).arrayBuffer()); let p = 0;
        const dec = (b, enc) => { try { if (enc === 1 || enc === 2) { let le = true, s = 0; if (b[0] === 0xFE && b[1] === 0xFF) { le = false; s = 2; } else if (b[0] === 0xFF && b[1] === 0xFE) s = 2; else if (enc === 2) le = false; return new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(b.slice(s)).replace(/\0/g, ''); } return new TextDecoder(enc === 3 ? 'utf-8' : 'iso-8859-1').decode(b).replace(/\0/g, ''); } catch (e) { return ''; } };
        while (p + 10 < buf.length) {
          const id = String.fromCharCode(buf[p], buf[p + 1], buf[p + 2], buf[p + 3]); if (!/^[A-Z0-9]{4}$/.test(id)) break;
          const fs = ver === 4 ? ((buf[p + 4] & 127) << 21) | ((buf[p + 5] & 127) << 14) | ((buf[p + 6] & 127) << 7) | (buf[p + 7] & 127) : (buf[p + 4] * 16777216) + (buf[p + 5] << 16) + (buf[p + 6] << 8) + buf[p + 7];
          if (fs <= 0 || p + 10 + fs > buf.length) break; const body = buf.slice(p + 11, p + 10 + fs), enc = buf[p + 10], v = dec(body, enc).trim();
          if (id === 'TIT2') out.title = v; else if (id === 'TPE1') out.artist = v; else if (id === 'TPE2') out.band = v; else if (id === 'TALB') out.album = v; else if (id === 'TCON') out.genre = v.replace(/^\(\d+\)/, '').trim(); else if (id === 'TYER' || id === 'TDRC') out.year = v.slice(0, 4);
          p += 10 + fs;
        }
      } else if (file.size > 128) { const t = new Uint8Array(await file.slice(file.size - 128).arrayBuffer()); if (t[0] === 0x54 && t[1] === 0x41 && t[2] === 0x47) { const s = (a, b) => new TextDecoder('iso-8859-1').decode(t.slice(a, b)).replace(/\0/g, '').trim(); out.title = s(3, 33); out.artist = s(33, 63); out.album = s(63, 93); } }
    } catch (e) { /* unreadable tags: use the filename */ }
    const base = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '); const m = base.match(/^(.+?)\s+-\s+(.+)$/);
    if (!out.title) out.title = m ? m[2].trim() : base; if (!out.artist) out.artist = m ? m[1].trim() : 'Unknown artist';
    return out;
  }
  async function addFiles(files) {
    const list = Array.from(files).filter(f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|wma)$/i.test(f.name)); if (!list.length) { toast('No music files found there.'); return 0; }
    let n = 0;
    for (const f of list) {
      if (mu.local.some(x => x.name === f.name && x.size === f.size)) continue; const t = await readTags(f);
      mu.local.push({ id: 'l_' + Date.now().toString(36) + (n++), source: 'device', name: f.name, size: f.size, title: t.title, artist: t.artist, band: t.band || '—', album: t.album || 'Unknown album', genre: (t.genre || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, ''), genreName: t.genre || 'Unknown genre', year: t.year, url: URL.createObjectURL(f), durationSec: 0, seed: Math.abs(Array.from(f.name).reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) });
    }
    mu.scan = n + ' song' + (n === 1 ? '' : 's') + ' added from your phone / SD card.'; toast(mu.scan); return n;
  }

  /* ------------------------------------------------------------ audio engine */
  const AE = { ctx: null, n: null, el: null, synth: null, mode: null, gateT: null, lfoT: null, started: 0 };
  const crv = amt => { const k = amt, n = 1024, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return c; };
  function impulse(ctx, sec, decay) { const r = ctx.sampleRate, len = Math.floor(r * sec), b = ctx.createBuffer(2, len, r); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
  function initAudio() {
    if (AE.ctx) return AE.ctx; const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    const ctx = AE.ctx = new C(), n = AE.n = {}, G = () => ctx.createGain(), F = (type, f, q) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; if (q) x.Q.value = q; return x; };
    n.in = G(); n.hp = F('highpass', 20, 0.7); n.lp = F('lowpass', 20000, 0.7); n.gate = G(); n.gAn = ctx.createAnalyser(); n.gAn.fftSize = 512;
    n.bands = FREQS.map((f, i) => { const b = F(i === 0 ? 'lowshelf' : i === 9 ? 'highshelf' : 'peaking', f, 1.1); b.gain.value = 0; return b; });
    n.vox = F('peaking', 2800, 1); n.mud = F('peaking', 380, 1); n.air = F('highshelf', 9000); n.ins = F('peaking', 1200, 0.8); n.shim = F('highshelf', 5500); n.bs = F('lowshelf', 95);
    n.mix = G(); n.bLp = F('lowpass', 130, 0.7); n.bSh = ctx.createWaveShaper(); n.bSh.curve = crv(8); n.bHp = F('highpass', 70, 0.7); n.bG = G(); n.bG.gain.value = 0;
    // effects (one active at a time): dry path + reverb/echo sends + wide/karaoke/tone stages
    n.fxIn = G(); n.dry = G(); n.rv = ctx.createConvolver(); n.rvG = G(); n.rvG.gain.value = 0; n.dl = ctx.createDelay(1); n.fb = G(); n.dlG = G(); n.dlG.gain.value = 0; n.fb.gain.value = 0.35;
    n.fxOut = G(); n.pan = ctx.createStereoPanner(); n.tone = F('allpass', 1000); n.tone2 = F('allpass', 1000);
    n.sp = ctx.createChannelSplitter(2); n.mg = ctx.createChannelMerger(2); n.hd = ctx.createDelay(0.1); n.hd.delayTime.value = 0.02; n.wide = G(); n.wide.gain.value = 0; n.wDry = G();
    n.kp = ctx.createChannelSplitter(2); n.km = ctx.createChannelMerger(2); n.kL = G(); n.kR = G(); n.kL.gain.value = 0.5; n.kR.gain.value = -0.5; n.kG = G(); n.kG.gain.value = 0; n.kDry = G();
    n.boost = G(); n.lim = ctx.createDynamicsCompressor(); n.lim.threshold.value = -3; n.lim.knee.value = 0; n.lim.ratio.value = 20; n.lim.attack.value = 0.002; n.lim.release.value = 0.12; n.vol = G(); n.an = ctx.createAnalyser(); n.an.fftSize = 128;
    // wiring
    let p = n.in; [n.hp, n.lp, n.gate].forEach(x => { p.connect(x); p = x; }); n.in.connect(n.gAn); n.bands.forEach(b => { p.connect(b); p = b; }); [n.mud, n.vox, n.air, n.ins, n.shim, n.bs].forEach(x => { p.connect(x); p = x; }); p.connect(n.mix);
    p.connect(n.bLp); n.bLp.connect(n.bSh); n.bSh.connect(n.bHp); n.bHp.connect(n.bG); n.bG.connect(n.mix);
    n.mix.connect(n.fxIn); n.fxIn.connect(n.dry); n.dry.connect(n.tone); n.tone.connect(n.tone2); n.tone2.connect(n.pan);
    n.fxIn.connect(n.rv); n.rv.connect(n.rvG); n.rvG.connect(n.pan); n.fxIn.connect(n.dl); n.dl.connect(n.fb); n.fb.connect(n.dl); n.dl.connect(n.dlG); n.dlG.connect(n.pan);
    n.fxIn.connect(n.sp); n.sp.connect(n.mg, 0, 0); n.sp.connect(n.hd, 1); n.hd.connect(n.mg, 0, 1); n.mg.connect(n.wide); n.wide.connect(n.pan);
    n.fxIn.connect(n.kp); n.kp.connect(n.kL, 0); n.kp.connect(n.kR, 1); n.kL.connect(n.kG); n.kR.connect(n.kG); n.kG.connect(n.pan);
    n.pan.connect(n.boost); n.boost.connect(n.lim); n.lim.connect(n.vol); n.vol.connect(n.an); n.an.connect(ctx.destination);
    n.rv.buffer = impulse(ctx, 2.2, 2.5);
    // gate: closes gently during near-silence so hiss/noise between notes is removed
    const buf = new Uint8Array(n.gAn.fftSize); AE.gateT = setInterval(() => { if (!AE.ctx) return; const th = mu.eq.noise / 100 * 0.012; if (!th) { n.gate.gain.setTargetAtTime(1, ctx.currentTime, 0.05); return; } n.gAn.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v; } n.gate.gain.setTargetAtTime(Math.sqrt(s / buf.length) < th ? 0.2 : 1, ctx.currentTime, 0.08); }, 50);
    AE.lfoT = setInterval(() => { if (mu.eq.fx === '8D Audio' && AE.ctx) n.pan.pan.value = Math.sin(AE.ctx.currentTime * 0.9) * 0.95; else if (n.pan.pan.value) n.pan.pan.value = 0; }, 40);
    return ctx;
  }
  function applyAll() {
    const n = AE.n; if (!n) return; const e = mu.eq, t = AE.ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, t, 0.03);
    e.bands.forEach((g, i) => set(n.bands[i].gain, g)); const no = e.noise / 100; set(n.hp.frequency, 20 + no * 110); set(n.lp.frequency, 20000 - no * 8500);
    set(n.vox.gain, e.vocal / 100 * 7); set(n.mud.gain, -e.vocal / 100 * 3.5); set(n.air.gain, e.vocal / 100 * 3); set(n.ins.gain, e.instr / 100 * 4); set(n.shim.gain, e.instr / 100 * 5);
    set(n.bs.gain, e.bass / 100 * 9); set(n.bG.gain, e.bass / 100 * 0.9);
    const fx = e.fx, a = e.fxAmt / 100; set(n.dry.gain, 1); set(n.rvG.gain, 0); set(n.dlG.gain, 0); set(n.wide.gain, 0); set(n.kG.gain, 0); set(n.tone.frequency, 1000); n.tone.type = 'allpass'; n.tone2.type = 'allpass';
    const tone = (t1, f1, q1, t2, f2) => { n.tone.type = t1; n.tone.frequency.value = f1; n.tone.Q.value = q1 || 0.7; n.tone2.type = t2 || 'allpass'; n.tone2.frequency.value = f2 || 1000; };
    if (fx === 'Room') { n.rv.buffer = AE.rooms ? AE.rooms.room : (AE.rooms = { room: impulse(AE.ctx, 0.6, 3), hall: impulse(AE.ctx, 2.4, 2.4), cath: impulse(AE.ctx, 5, 1.8) }).room; set(n.rvG.gain, 0.2 + a * 0.5); }
    else if (fx === 'Hall' || fx === 'Concert') { AE.rooms = AE.rooms || { room: impulse(AE.ctx, 0.6, 3), hall: impulse(AE.ctx, 2.4, 2.4), cath: impulse(AE.ctx, 5, 1.8) }; n.rv.buffer = AE.rooms.hall; set(n.rvG.gain, 0.25 + a * 0.6); if (fx === 'Concert') set(n.dry.gain, 0.8); }
    else if (fx === 'Cathedral') { AE.rooms = AE.rooms || { room: impulse(AE.ctx, 0.6, 3), hall: impulse(AE.ctx, 2.4, 2.4), cath: impulse(AE.ctx, 5, 1.8) }; n.rv.buffer = AE.rooms.cath; set(n.rvG.gain, 0.3 + a * 0.7); }
    else if (fx === 'Echo') { n.dl.delayTime.value = 0.32; n.fb.gain.value = 0.25 + a * 0.35; set(n.dlG.gain, 0.3 + a * 0.4); }
    else if (fx === 'Slapback') { n.dl.delayTime.value = 0.09; n.fb.gain.value = 0.1; set(n.dlG.gain, 0.3 + a * 0.4); }
    else if (fx === 'Widener') { set(n.dry.gain, 0.0); set(n.wide.gain, 1); }
    else if (fx === 'Karaoke') { set(n.dry.gain, 1 - a); set(n.kG.gain, 0.6 + a * 0.9); }
    else if (fx === 'Vinyl') tone('lowpass', 11000 - a * 4000, 0.7, 'highpass', 45);
    else if (fx === 'Radio') tone('bandpass', 1800, 0.4 + a);
    else if (fx === 'Telephone') tone('bandpass', 1700, 1.2 + a * 2);
    else if (fx === 'Underwater') tone('lowpass', 900 - a * 500, 1.5);
    if (fx !== '8D Audio') n.pan.pan.value = 0;
    set(n.boost.gain, e.boost / 100); set(n.vol.gain, mu.vol);
    if (AE.el) AE.el.volume = 1;
  }
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const SC = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], pentatonic: [0, 2, 4, 7, 9] };
  const KEYI = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };
  const STYLE = { four: { k: [0, 4, 8, 12], s: [4, 12], h: [2, 6, 10, 14], b: [2, 6, 10, 14], bw: 'sawtooth', lw: 'square', lp: 0.4, pad: 0.5 }, afro: { k: [0, 6, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], b: [0, 3, 6, 10, 12], bw: 'triangle', lw: 'triangle', lp: 0.55, pad: 0.4 }, chill: { k: [0, 10], s: [8], h: [4, 12], b: [0, 8], bw: 'sine', lw: 'sine', lp: 0.35, pad: 0.8 }, rock: { k: [0, 8], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], b: [0, 4, 8, 12], bw: 'sawtooth', lw: 'sawtooth', lp: 0.3, pad: 0.5 }, soft: { k: [], s: [], h: [], b: [0, 8], bw: 'sine', lw: 'sine', lp: 0.5, pad: 1 } };
  const GSTYLE = { house: 'four', electronic: 'four', pop: 'four', afrobeat: 'afro', benga: 'afro', bongo: 'afro', gengetone: 'afro', amapiano: 'afro', dancehall: 'afro', latin: 'afro', rumba: 'afro', lofi: 'chill', jazz: 'chill', soul: 'chill', rnb: 'chill', hiphop: 'chill', rock: 'rock', country: 'rock', blues: 'rock', folk: 'rock', reggae: 'rock', classical: 'soft', gospel: 'soft', taarab: 'soft' };
  function hsh(a, b) { let x = (a * 374761393 + b * 668265263) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; }
  function startSynth(t, offset) {
    const ctx = AE.ctx, out = AE.n.in, st = STYLE[GSTYLE[t.genre] || 'afro'], step = 60 / t.bpm / 4, scale = SC[t.scale] || SC.major, root = 48 + (KEYI[t.key] || 0), seed = t.seed % 9973;
    const progs = [[0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 5, 3], [5, 3, 0, 4]], prog = progs[seed % 4];
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const deg = d => { const o = Math.floor(d / scale.length), i = ((d % scale.length) + scale.length) % scale.length; return root + 12 * o + scale[i]; };
    const S2 = { ctx, t0: ctx.currentTime - 0, off: offset, next: Math.floor(offset / step), stop() { clearInterval(this.iv); this.done = true; }, pos() { return this.off + (ctx.currentTime - this.t0); } };
    S2.t0 = ctx.currentTime;
    const osc = (type, f, when, dur, vol, dest) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vol, when + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); o.connect(g); g.connect(dest || out); o.start(when); o.stop(when + dur + 0.05); };
    const noise = (when, dur, vol, hpf) => { const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter(); s.buffer = nb; f.type = 'highpass'; f.frequency.value = hpf; g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); s.connect(f); f.connect(g); g.connect(out); s.start(when); s.stop(when + dur + 0.02); };
    const kick = when => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.12); g.gain.setValueAtTime(0.9, when); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3); o.connect(g); g.connect(out); o.start(when); o.stop(when + 0.32); };
    const sched = () => {
      while (S2.next * step < S2.off + (ctx.currentTime - S2.t0) + 0.35) {
        const i = S2.next, when = S2.t0 + (i * step - S2.off); S2.next++; if (when < ctx.currentTime - 0.05) continue;
        const s16 = i % 16, bar = Math.floor(i / 16), chord = prog[bar % 4]; const swing = (s16 % 2 && t.genre === 'jazz') ? step * 0.25 : 0, w = when + swing;
        if (st.k.includes(s16)) kick(w); if (st.s.includes(s16)) noise(w, 0.14, 0.35, 1500); if (st.h.includes(s16)) noise(w, 0.04, 0.12, 7000);
        if (st.b.includes(s16)) osc(st.bw, midi(deg(chord) - 12), w, step * 3, 0.32);
        if (s16 === 0) [0, 2, 4].forEach(k => osc(st.lw === 'square' ? 'sawtooth' : 'triangle', midi(deg(chord + k) + 12), w, step * 15, 0.06 * st.pad * 2));
        if (s16 % 2 === 0 && hsh(seed, i) < st.lp) { const walk = Math.floor(hsh(seed + 1, i) * 7) - 1; osc(st.lw, midi(deg(chord + walk + 7)), w, step * 1.8, 0.13); }
      }
    };
    S2.iv = setInterval(sched, 90); sched(); return S2;
  }
  async function engineStart(tr) {
    const ctx = initAudio(); if (!ctx) throw new Error('This browser cannot play audio.'); await ctx.resume().catch(() => { });
    if (AE.n && !AE.el) { AE.el = new Audio(); AE.el.crossOrigin = 'anonymous'; AE.src = ctx.createMediaElementSource(AE.el); AE.src.connect(AE.n.in); AE.el.addEventListener('ended', () => ctxNext(true)); AE.el.addEventListener('loadedmetadata', () => { if (mu.cur && isFinite(AE.el.duration)) mu.dur = AE.el.duration; }); }
    engineStop(); applyAll();
    if (tr.source === 'device' || tr.url) { AE.mode = 'el'; AE.el.src = tr.url; await AE.el.play(); }
    else { AE.mode = 'synth'; AE.synth = startSynth(tr, 0); }
  }
  function engineStop() { if (AE.synth) { AE.synth.stop(); AE.synth = null; } if (AE.el) { AE.el.pause(); } AE.mode = null; }
  const enginePos = () => AE.mode === 'synth' && AE.synth ? AE.synth.pos() : AE.mode === 'el' && AE.el ? AE.el.currentTime : 0;
  function seekTo(s) { if (AE.mode === 'synth' && mu.cur) { AE.synth.stop(); AE.synth = startSynth(mu.cur, Math.max(0, s)); } else if (AE.el) AE.el.currentTime = s; }

  /* ------------------------------------------------------------ playback control */
  let tickT = null, vizT = null;
  async function playTrack(list, idx) {
    const tr = list[idx]; if (!tr) return; mu.list = list; mu.idx = idx;
    let full = tr;
    if (tr.source === 'cloud') { const r = await tryA('GET', '/api/music/track/' + tr.id); if (r) { full = Object.assign({}, tr, r); if (r.stream && r.stream.url) full.url = r.stream.url; } }
    mu.cur = full; mu.dur = full.durationSec || 0; mu.pos = 0;
    try { await engineStart(full); } catch (e) { mu.playing = false; toast(e.message || 'Could not play this song.'); render(); return; }
    mu.playing = true; startTick(); startViz(); mediaSession(full); render();
  }
  function mediaSession(t) { try { if ('mediaSession' in navigator) { navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist + ' · ' + t.band, album: t.album }); navigator.mediaSession.setActionHandler('nexttrack', () => ctxNext()); navigator.mediaSession.setActionHandler('previoustrack', () => ctxPrev()); navigator.mediaSession.setActionHandler('play', () => togglePlay()); navigator.mediaSession.setActionHandler('pause', () => togglePlay()); } } catch (e) { /* optional */ } }
  function startTick() { clearInterval(tickT); tickT = setInterval(() => { if (!mu.playing || !mu.cur) return; mu.pos = enginePos(); if (AE.mode === 'el' && AE.el && isFinite(AE.el.duration)) mu.dur = AE.el.duration; if (mu.dur && mu.pos >= mu.dur - 0.2 && AE.mode === 'synth') ctxNext(true);
    const p = document.getElementById('muPos'), s = document.getElementById('muSeek'), m = document.getElementById('muMini'); if (p) p.textContent = mmss(mu.pos) + ' / ' + mmss(mu.dur); if (s && document.activeElement !== s) { s.max = mu.dur || 1; s.value = mu.pos; } if (m) m.style.width = (mu.dur ? mu.pos / mu.dur * 100 : 0) + '%'; }, 250); }
  function startViz() {
    cancelAnimationFrame(vizT); const loop = () => { vizT = requestAnimationFrame(loop); const cv = document.getElementById('muViz'); if (!cv || !AE.n) return; const x = cv.getContext('2d'), w = cv.width = cv.clientWidth * 2, h = cv.height = 112, d = new Uint8Array(AE.n.an.frequencyBinCount); AE.n.an.getByteFrequencyData(d); x.clearRect(0, 0, w, h); const bw = w / d.length; for (let i = 0; i < d.length; i++) { const v = d[i] / 255 * h; x.fillStyle = `hsl(${30 + i * 2},90%,${55 + v / h * 15}%)`; x.fillRect(i * bw + 1, h - v, bw - 2, v); } }; loop();
  }
  function togglePlay() { if (!mu.cur) return; if (mu.playing) { if (AE.mode === 'synth') { AE.ctx.suspend(); } else if (AE.el) AE.el.pause(); mu.playing = false; } else { if (AE.mode === 'synth') AE.ctx.resume(); else if (AE.el) AE.el.play(); mu.playing = true; AE.ctx && AE.ctx.resume(); } render(); }
  function ctxNext(auto) { if (!mu.list.length) return; if (auto && mu.repeat === 'one') return playTrack(mu.list, mu.idx); let i = mu.shuffle ? Math.floor(Math.random() * mu.list.length) : mu.idx + 1; if (i >= mu.list.length) { if (mu.repeat === 'all' || !auto) i = 0; else { mu.playing = false; engineStop(); return render(); } } playTrack(mu.list, i); }
  function ctxPrev() { if (!mu.list.length) return; if (mu.pos > 4) return seekTo(0); playTrack(mu.list, (mu.idx - 1 + mu.list.length) % mu.list.length); }

  /* ------------------------------------------------------------ data */
  const saveEq = (() => { let t; return () => { clearTimeout(t); t = setTimeout(() => tryA('PUT', '/api/music/eq', mu.eq), 600); }; })();
  async function loadTracks(reset) {
    if (mu.loading) return; mu.loading = true;
    try {
      const off = reset ? 0 : mu.items.length, r = await api('GET', '/api/music/tracks?limit=30&offset=' + off + (mu.genre ? '&genre=' + mu.genre : '') + (mu.q ? '&q=' + encodeURIComponent(mu.q) : ''));
      const items = r.items.map(t => Object.assign(t, { source: 'cloud' })); mu.items = reset ? items : mu.items.concat(items); mu.hasMore = r.hasMore; mu.browse = true;
    } finally { mu.loading = false; }
  }
  const _load = window.load;
  window.load = async function () {
    await _load(); const v = cur(), k = v ? v.n : S.tab; if (k !== 'music' || !feat('music')) return;
    if (!mu.genres) { const g = await tryA('GET', '/api/music/genres'); if (g) { mu.genres = g.genres; mu.total = g.total; } const lib = await tryA('GET', '/api/music/library'); if (lib) { mu.favs = lib.favourites; mu.recent = lib.recent; if (lib.eq) { Object.assign(mu.eq, lib.eq); } } }
  };

  /* ------------------------------------------------------------ entry points + pages */
  const _pv = window.pageView; window.pageView = v => v.n === 'music' ? musicPage() : _pv(v);
  const _ov = window.overlayView;
  window.overlayView = function () {
    const base = _ov ? _ov() : ''; const v = cur(); if (!mu.cur || (v && v.n === 'music') || S.call || adminMode()) return base;
    return base + `<div class="mini" data-act="mumini"><div class="grow" style="min-width:0"><div class="t">${esc(mu.cur.title)}</div><div class="a">${esc(mu.cur.artist)} · ${esc(mu.cur.band)}</div><div style="height:2px;background:#fff3;margin-top:4px"><i id="muMini" style="display:block;height:100%;width:${mu.dur ? mu.pos / mu.dur * 100 : 0}%;background:#f6ad55"></i></div></div><button data-act="mutoggle">${mu.playing ? '⏸' : '▶️'}</button><button data-act="munext">⏭</button></div>`;
  };
  function musicPage() {
    if (!feat('music')) return ph('DIRA Music') + offBanner('music', 'DIRA Music');
    const tabs = [['cloud', '☁️ Cloud'], ['device', '💾 My phone / SD'], ['play', '▶ Playing'], ['studio', '🎚 Sound studio']];
    return ph('DIRA Music') + `<div class="mseg">${tabs.map(t => `<button class="${mu.tab === t[0] ? 'on' : ''}" data-act="mutab" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>` + ({ cloud: cloudTab, device: deviceTab, play: playTab, studio: studioTab })[mu.tab]();
  }
  const row = (t, list, i, showGenre) => `<div class="mt ${mu.cur && mu.cur.id === t.id ? 'on' : ''}" data-act="muplay" data-src="${list}" data-i="${i}"><div class="art" style="background:${grad(t)}">${t.source === 'device' ? '💾' : gEmoji(t)}</div><div class="grow" style="min-width:0"><span class="t ell">${esc(t.title)}</span><span class="a ell">🎤 ${esc(t.artist)} · 👥 ${esc(t.band)}</span><span class="a ell">${esc(t.album)}${showGenre ? ' · ' + esc(t.genreName) : ''}${t.durationSec ? ' · ' + mmss(t.durationSec) : ''}</span></div>${t.source === 'cloud' ? `<button data-act="mufav" data-id="${t.id}" style="font-size:20px">${t.fav ? '⭐' : '☆'}</button>` : ''}</div>`;
  function cloudTab() {
    const g = mu.genres; if (!g) return '<div class="empty">Loading…</div>';
    const head = `<div class="row" style="padding:0 16px 8px"><input data-bind="mu.q" id="muQ" placeholder="Search title, artist or band across ${mu.total.toLocaleString('en-KE')} songs" value="${esc(mu.q)}"><button class="btn sm" data-act="musearch">Search</button></div>`;
    if (!mu.browse) return head + `<div class="mut sm" style="padding:0 16px 8px"><b>${mu.total.toLocaleString('en-KE')}</b> songs in the DIRA cloud · ${g.length} genres</div>${mu.favs && mu.favs.length ? `<div class="sec">Favourites</div>${mu.favs.slice(0, 5).map((t, i) => row(Object.assign(t, { source: 'cloud' }), 'favs', i, true)).join('')}` : ''}<div class="sec">Browse by genre</div><div class="mgen">${g.map((x, i) => `<button style="background:linear-gradient(135deg,${GENRE_G(i)})" data-act="mugenre" data-v="${x.id}"><span>${x.emoji}</span>${esc(x.name)}<small style="font-weight:600;opacity:.9">${x.count.toLocaleString('en-KE')}</small></button>`).join('')}</div>`;
    const gn = mu.genre && g.find(x => x.id === mu.genre);
    return head + `<div class="row" style="padding:0 16px 6px"><button class="chip" data-act="muback">‹ All genres</button><b class="grow">${gn ? gn.emoji + ' ' + esc(gn.name) : mu.q ? 'Results for “' + esc(mu.q) + '”' : 'All songs'}</b></div>${mu.items.length ? mu.items.map((t, i) => row(t, 'items', i, !mu.genre)).join('') : '<div class="empty" style="padding:20px">No songs found.</div>'}${mu.hasMore ? '<div style="padding:10px 16px"><button class="btn alt full" data-act="mumore">Load more</button></div>' : ''}`;
  }
  function deviceTab() {
    const L = mu.local, by = {}; L.forEach((t, i) => { const k = mu.devGroup === 'artist' ? t.artist : mu.devGroup === 'band' ? t.band : mu.devGroup === 'album' ? t.album : t.genreName; (by[k] || (by[k] = [])).push([t, i]); });
    return `<div class="card" style="margin:0 16px 12px"><b>💾 Play music from your phone or SD card</b><div class="mut sm" style="margin:2px 0 8px">Choose songs (or a whole folder on the SD card). Title, artist, band, album and genre are read from each file’s tags.</div>
      <div class="row"><label class="btn grow" style="cursor:pointer">＋ Add songs<input type="file" id="muFiles" accept="audio/*,.mp3,.m4a,.flac,.wav,.ogg,.aac" multiple style="display:none"></label><label class="btn alt grow" style="cursor:pointer">📁 Scan a folder<input type="file" id="muDir" webkitdirectory multiple style="display:none"></label></div>${mu.scan ? `<div class="sm" style="margin-top:6px;color:var(--green)">${esc(mu.scan)}</div>` : ''}</div>
    ${L.length ? `<div class="mseg">${[['genre', 'By genre'], ['artist', 'By artist'], ['band', 'By band'], ['album', 'By album']].map(x => `<button class="${mu.devGroup === x[0] ? 'on' : ''}" data-act="mugroup" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>` + Object.keys(by).sort().map(k => `<div class="sec">${esc(k)} · ${by[k].length}</div>` + by[k].map(p => row(p[0], 'local', p[1], false)).join('')).join('') : '<div class="empty"><b>🎶</b>No songs from your phone yet.<br><span class="sm">Tap “Add songs” and pick music from storage or your SD card.</span></div>'}`;
  }
  function playTab() {
    const t = mu.cur; if (!t) return '<div class="empty"><b>🎵</b>Nothing playing yet.<br><span class="sm">Pick a song from the Cloud or your phone.</span></div>';
    return `<div class="mpl"><div class="big" style="background:${grad(t)}">${t.source === 'device' ? '💾' : gEmoji(t)}</div><h3>${esc(t.title)}</h3>
      <div class="mrow"><span>🎤 Artist: <b>${esc(t.artist)}</b></span><span>👥 Band: <b>${esc(t.band)}</b></span></div><div class="meta">${esc(t.album)} · ${esc(t.genreName)}${t.year ? ' · ' + t.year : ''} · ${t.source === 'device' ? 'On your phone / SD card' : 'DIRA cloud'}</div>
      <canvas class="mviz" id="muViz"></canvas><input type="range" id="muSeek" data-mu="seek" min="0" max="${mu.dur || 1}" step="0.5" value="${mu.pos}"><div class="sm" id="muPos" style="opacity:.85">${mmss(mu.pos)} / ${mmss(mu.dur)}</div>
      <div class="mctl"><button class="${mu.shuffle ? 'on' : ''}" data-act="mushuf" title="Shuffle">🔀</button><button data-act="muprev">⏮</button><button class="pp" data-act="mutoggle">${mu.playing ? '⏸' : '▶'}</button><button data-act="munext">⏭</button><button class="${mu.repeat !== 'off' ? 'on' : ''}" data-act="murep" title="Repeat">${mu.repeat === 'one' ? '🔂' : '🔁'}</button></div>
      <div class="row" style="gap:8px"><span>🔈</span><input type="range" data-mu="vol" min="0" max="100" value="${Math.round(mu.vol * 100)}"><span id="muVolL" class="sm" style="width:36px">${Math.round(mu.vol * 100)}%</span></div>
      <div class="sm" style="opacity:.85;margin-top:6px">Sound: ${esc(mu.eq.preset)}${mu.eq.mood ? ' · ' + esc(mu.eq.mood) : ''}${mu.eq.fx !== 'Off' ? ' · ' + esc(mu.eq.fx) : ''} · Volume+ ${mu.eq.boost}%</div><button class="btn alt" style="margin-top:8px" data-act="mutab" data-v="studio">🎚 Open sound studio</button></div>`;
  }
  function studioTab() {
    const e = mu.eq, tabs = [['eq', '🎚 Equalizer'], ['enh', '✨ Enhance'], ['mood', '😊 Moods'], ['fx', '🌀 Effects'], ['vol', '🔊 Volume+']];
    const sl = (k, l, v, mn, mx, u) => `<div class="row" style="padding:4px 16px"><span class="sm" style="width:118px">${l}</span><input type="range" data-mu="${k}" min="${mn}" max="${mx}" value="${v}" class="grow" style="accent-color:#553c9a"><b class="sm" id="v_${k}" style="width:46px;text-align:right">${v}${u}</b></div>`;
    let b = '';
    if (mu.st === 'eq') b = `<div class="row" style="padding:0 16px 8px"><select data-bind="mu.eq.preset" data-onchg="mupreset" style="flex:1">${Object.keys(PRESETS).map(k => `<option ${e.preset === k ? 'selected' : ''}>${k}</option>`).join('')}<option ${e.preset === 'Custom' ? 'selected' : ''}>Custom</option></select><button class="btn alt sm" data-act="mureset">Reset</button></div><div class="mut sm" style="padding:0 16px 6px">${Object.keys(PRESETS).length} presets + your own custom curve · 10 bands · ±12 dB</div><div class="eqb">${e.bands.map((g, i) => `<div><span id="v_b${i}">${g > 0 ? '+' : ''}${g}</span><input type="range" data-mu="b${i}" min="-12" max="12" step="1" value="${g}"><span>${FL[i]}</span></div>`).join('')}</div>`;
    else if (mu.st === 'enh') b = `<div class="sec">Clean &amp; clear</div>${sl('noise', '🔇 Noise reduction', e.noise, 0, 100, '%')}${sl('vocal', '🎤 Vocal clarity', e.vocal, 0, 100, '%')}${sl('instr', '🎸 Instrument clarity', e.instr, 0, 100, '%')}${sl('bass', '🔊 Super bass', e.bass, 0, 100, '%')}<div class="mut sm" style="padding:8px 16px">Noise reduction cuts rumble and hiss and quiets the gaps between notes. Vocal and instrument clarity lift the voice range and sharpen the details. Super bass adds deep low end plus harmonics so bass stays audible on small speakers. All of these work together with the equalizer.</div><div class="mchips"><button class="${e.noise && e.vocal && e.instr && e.bass ? 'on' : ''}" data-act="muallon">⚡ One-tap: Studio clean</button><button data-act="muallOff">Off</button></div>`;
    else if (mu.st === 'mood') b = `<div class="mchips">${Object.keys(MOODS).map(k => `<button class="${e.mood === k ? 'on' : ''}" data-act="mumood" data-v="${k}">${MOODS[k][0]} ${k}</button>`).join('')}</div><div class="mut sm" style="padding:0 16px">A mood sets the equalizer, clarity, bass and an effect in one tap. You can fine-tune afterwards.</div>`;
    else if (mu.st === 'fx') b = `<div class="mchips">${FX.map(k => `<button class="${e.fx === k ? 'on' : ''}" data-act="mufx" data-v="${k}">${FXI[k]} ${k}</button>`).join('')}</div>${e.fx !== 'Off' ? sl('fxAmt', 'Effect amount', e.fxAmt, 0, 100, '%') : ''}<div class="mut sm" style="padding:8px 16px">Karaoke removes centre-panned vocals; 8D Audio circles the sound around your head (best with headphones).</div>`;
    else b = `<div class="card" style="margin:0 16px 12px;text-align:center"><b>🔊 Volume expander</b><div class="mut sm">Boosts loudness beyond your phone’s volume using extra gain. A limiter prevents clipping.</div><div class="hbig" style="font-size:44px;margin:8px 0" id="v_boostBig">${e.boost}%</div><input type="range" data-mu="boost" min="100" max="300" step="5" value="${e.boost}" style="width:100%;accent-color:#c53030"><div class="row sm mut"><span class="grow">100% (normal)</span><span>200%</span><span style="margin-left:40px">300%</span></div><div class="chips" style="justify-content:center;margin-top:8px">${[100, 150, 200, 250, 300].map(x => `<button class="chip ${e.boost === x ? 'on' : ''}" data-act="muboost" data-v="${x}">${x}%</button>`).join('')}</div></div>
      <div class="mwarn" id="boostWarn" style="display:${e.boost > 150 ? 'block' : 'none'}">⚠️ <b>Hearing safety:</b> very loud sound can damage hearing. Above 150% keep the phone away from your ears, avoid long sessions with headphones, and turn down if you feel discomfort or ringing.</div><div class="mut sm" style="padding:0 16px">Tip: raise your phone’s own volume first, then use Volume+ only when you still need more (for example in a noisy matatu or outdoors).</div>`;
    return `<div class="mseg">${tabs.map(t => `<button class="${mu.st === t[0] ? 'on' : ''}" data-act="must" data-v="${t[0]}">${t[1]}</button>`).join('')}</div>${mu.cur ? '' : '<div class="mut sm" style="padding:0 16px 8px">Settings apply when a song plays. Pick one from Cloud or your phone to hear the changes.</div>'}${b}`;
  }

  /* ------------------------------------------------------------ live controls (no re-render while dragging) */
  document.addEventListener('input', e => {
    const el = e.target, k = el.dataset && el.dataset.mu; if (!k) return; const v = +el.value, q = id => document.getElementById(id), eq = mu.eq;
    if (k === 'seek') { seekTo(v); mu.pos = v; return; }
    if (k === 'vol') { mu.vol = v / 100; const l = q('muVolL'); if (l) l.textContent = v + '%'; }
    else if (k[0] === 'b' && k.length <= 3) { const i = +k.slice(1); eq.bands[i] = v; eq.preset = 'Custom'; const l = q('v_' + k); if (l) l.textContent = (v > 0 ? '+' : '') + v; }
    else if (k === 'boost') { eq.boost = v; const l = q('v_boostBig'); if (l) l.textContent = v + '%'; const w = q('boostWarn'); if (w) w.style.display = v > 150 ? 'block' : 'none'; }
    else { eq[k] = v; const l = q('v_' + k); if (l) l.textContent = v + '%'; if (k !== 'fxAmt') eq.mood = ''; }
    if (AE.n) applyAll(); saveEq();
  });
  const fileHandler = async e => { const el = e.target; if (el.id !== 'muFiles' && el.id !== 'muDir') return; const n = await addFiles(el.files); el.value = ''; if (n) render(); };
  document.addEventListener('change', e => { if (e.target && (e.target.id === 'muFiles' || e.target.id === 'muDir')) fileHandler(e); });
  const setEq = (preset) => { mu.eq.preset = preset; mu.eq.bands = PRESETS[preset].slice(); if (AE.n) applyAll(); saveEq(); };
  const listOf = d => d.src === 'items' ? mu.items : d.src === 'local' ? mu.local : (mu.favs || []).map(t => Object.assign(t, { source: 'cloud' }));
  Object.assign(acts, {
    mutab(d) { mu.tab = d.v; render(); }, must(d) { mu.st = d.v; render(); },
    mumini() { mu.tab = 'play'; go('music'); },
    mugenre(d) { return guard(async () => { mu.genre = d.v; mu.q = ''; await loadTracks(true); render(); }); },
    musearch() { return guard(async () => { const i = document.getElementById('muQ'); if (i) mu.q = i.value.trim(); if (!mu.q && !mu.genre) { mu.browse = false; return render(); } await loadTracks(true); render(); }); },
    muback() { mu.browse = false; mu.genre = ''; mu.q = ''; mu.items = []; render(); },
    mumore() { return guard(async () => { await loadTracks(false); render(); }); },
    mugroup(d) { mu.devGroup = d.v; render(); },
    muplay(d) { return guard(async () => { const list = listOf(d); await playTrack(list.slice(), +d.i); }); },
    mufav(d) { return guard(async () => { const r = await api('POST', '/api/music/fav', { id: d.id }); mu.items.forEach(t => { if (t.id === d.id) t.fav = r.fav; }); if (mu.cur && mu.cur.id === d.id) mu.cur.fav = r.fav; const lib = await tryA('GET', '/api/music/library'); if (lib) mu.favs = lib.favourites; render(); }); },
    mutoggle() { togglePlay(); }, munext() { ctxNext(); }, muprev() { ctxPrev(); },
    mushuf() { mu.shuffle = !mu.shuffle; render(); }, murep() { mu.repeat = mu.repeat === 'off' ? 'all' : mu.repeat === 'all' ? 'one' : 'off'; render(); },
    mupreset(d, el) { setEq(el.value); render(); }, mureset() { setEq('Flat'); Object.assign(mu.eq, { noise: 0, vocal: 0, instr: 0, bass: 0, mood: '', fx: 'Off', boost: 100 }); if (AE.n) applyAll(); saveEq(); render(); },
    muallon() { Object.assign(mu.eq, { noise: 50, vocal: 55, instr: 50, bass: 60, mood: '' }); if (AE.n) applyAll(); saveEq(); render(); }, muallOff() { Object.assign(mu.eq, { noise: 0, vocal: 0, instr: 0, bass: 0 }); if (AE.n) applyAll(); saveEq(); render(); },
    mumood(d) { const m = MOODS[d.v]; setEq(m[1]); Object.assign(mu.eq, { noise: 0, vocal: 0, instr: 0, bass: 0 }, m[2], { mood: d.v, fx: m[3] }); if (AE.n) applyAll(); saveEq(); render(); },
    mufx(d) { mu.eq.fx = d.v; if (AE.n) applyAll(); saveEq(); render(); },
    muboost(d) { mu.eq.boost = +d.v; if (+d.v > 150) toast('Loud! Protect your hearing.'); if (AE.n) applyAll(); saveEq(); render(); }
  });
  // exposed for the Quick row and tests
  window.DIRAMusic = { PRESETS, MOODS, FX, state: mu, engine: AE, addFiles, readTags, playTrack, count: () => ({ presets: Object.keys(PRESETS).length, moods: Object.keys(MOODS).length, fx: FX.length }) };
})();
