/* SemaChat — Exercise & Health (add-on module).
 * Step sessions with walking-style recognition + calories, heart-rate meter, breath-hold lung report,
 * BMI / obesity assessment, and everyday health logs (water, sleep, blood pressure) with a daily health score.
 * IMPORTANT: everything here is wellness guidance, not a medical diagnosis. Reports always say so.
 * Works in Node (require('./health')(core)) and in the browser preview (after core.js).
 */
(function (root, install) {
  if (typeof module === 'object' && module.exports) module.exports = install;
  else install(root.SemaChatCore);
})(typeof self !== 'undefined' ? self : this, function install(core) {
  const DISCLAIMER = 'This is general wellness guidance from SemaChat, not a medical diagnosis. If you feel unwell, or a result worries you, please see a doctor or visit a clinic.';

  /* ---- pure helpers (also exposed as core.wellness for tests / reuse) ---- */
  // steps per minute -> walking style. met = metabolic equivalent; stride = fraction of height per step
  const STYLES = [
    { key: 'stroll', label: 'Strolling', max: 70, met: 2.3, stride: 0.37, emoji: '🚶', type: 'Light activity' },
    { key: 'walk', label: 'Walking', max: 100, met: 3.3, stride: 0.413, emoji: '🚶‍♂️', type: 'Light–moderate activity' },
    { key: 'brisk', label: 'Brisk walking', max: 120, met: 4.8, stride: 0.45, emoji: '🚶‍♀️', type: 'Moderate activity' },
    { key: 'jog', label: 'Jogging', max: 150, met: 7.0, stride: 0.6, emoji: '🏃', type: 'Vigorous activity' },
    { key: 'run', label: 'Running', max: 175, met: 9.8, stride: 0.75, emoji: '🏃‍♂️', type: 'Vigorous activity' },
    { key: 'sprint', label: 'Sprinting', max: Infinity, met: 12.5, stride: 0.95, emoji: '⚡', type: 'High-intensity activity' }
  ];
  const IDLE = { key: 'idle', label: 'Standing / shuffling', met: 1.5, stride: 0.2, emoji: '🧍', type: 'Resting' };
  function classifyCadence(spm) { if (!(spm >= 35)) return IDLE; return STYLES.find(s => spm < s.max) || STYLES[STYLES.length - 1]; }
  const num = (v, lo, hi, name) => { const n = Number(v); if (!isFinite(n) || n < lo || n > hi) { const e = new Error(name + ' must be between ' + lo + ' and ' + hi + '.'); e.bad = true; throw e; } return n; };
  function analyseSession(segments, kg, heightCm) {
    const out = { steps: 0, seconds: 0, calories: 0, distanceM: 0, byStyle: {} };
    segments.forEach(g => {
      const steps = Math.round(num(g.steps, 0, 100000, 'Steps')), sec = num(g.seconds, 1, 86400, 'Seconds');
      const spm = steps / (sec / 60), st = classifyCadence(spm);
      const kcal = st.met * kg * (sec / 3600), dist = steps * st.stride * (heightCm / 100);
      const b = out.byStyle[st.key] || (out.byStyle[st.key] = { key: st.key, label: st.label, emoji: st.emoji, type: st.type, met: st.met, steps: 0, seconds: 0, calories: 0, distanceM: 0 });
      b.steps += steps; b.seconds += sec; b.calories += kcal; b.distanceM += dist;
      out.steps += steps; out.seconds += sec; out.calories += kcal; out.distanceM += dist;
    });
    const list = Object.values(out.byStyle).map(b => Object.assign(b, { calories: Math.round(b.calories), distanceM: Math.round(b.distanceM), cadence: Math.round(b.steps / (b.seconds / 60)) })).sort((a, b) => b.seconds - a.seconds);
    const top = list[0];
    return { steps: out.steps, seconds: Math.round(out.seconds), calories: Math.round(out.calories), distanceM: Math.round(out.distanceM), styles: list, dominant: top ? top.key : 'idle', dominantLabel: top ? top.label : IDLE.label, activityType: top ? top.type : IDLE.type };
  }
  const bmiOf = (kg, cm) => kg / Math.pow(cm / 100, 2);
  function bmiCategory(b) {
    if (b < 16) return { key: 'severe_under', label: 'Severely underweight' };
    if (b < 18.5) return { key: 'under', label: 'Underweight' };
    if (b < 25) return { key: 'healthy', label: 'Healthy weight' };
    if (b < 30) return { key: 'over', label: 'Overweight' };
    if (b < 35) return { key: 'ob1', label: 'Obesity — class I' };
    if (b < 40) return { key: 'ob2', label: 'Obesity — class II' };
    return { key: 'ob3', label: 'Obesity — class III' };
  }
  function assess(p) {
    const kg = num(p.weightKg, 10, 400, 'Weight (kg)'), cm = num(p.heightCm, 80, 250, 'Height (cm)'), age = Math.round(num(p.age, 2, 120, 'Age'));
    const b = bmiOf(kg, cm), cat = bmiCategory(b), lo = 18.5 * Math.pow(cm / 100, 2), hi = 24.9 * Math.pow(cm / 100, 2);
    const risks = [], advice = []; let clean = false, level = 'ok';
    if (age < 18) { advice.push('Under 18, BMI is judged against growth charts for age and sex, so treat this number as a rough guide and ask a clinic nurse or doctor to plot it properly.'); }
    if (cat.key === 'healthy') {
      clean = age >= 18; advice.push('Your weight is in the healthy range for your height. Keep it up: aim for 150 minutes of moderate activity a week, plenty of vegetables and water, and 7–9 hours of sleep.');
    } else if (cat.key === 'under' || cat.key === 'severe_under') {
      level = cat.key === 'severe_under' ? 'high' : 'watch';
      risks.push('Weakened immunity and frequent infections', 'Low energy, anaemia and nutrient shortages', 'Bone thinning (osteoporosis) over time');
      advice.push('Add energy- and protein-rich foods (beans, eggs, groundnuts, fish, milk, ugali with sukuma and meat), eat 4–5 smaller meals, and do light strength exercise.', cat.key === 'severe_under' ? 'A BMI this low needs a doctor’s check soon to look for an underlying cause.' : 'If you are losing weight without trying, see a doctor.');
    } else if (cat.key === 'over') {
      level = 'watch';
      risks.push('Higher chance of high blood pressure and type 2 diabetes', 'Extra strain on knees and back', 'Higher cholesterol and heart-disease risk if it keeps rising');
      advice.push('Aim to lose about 0.25–0.5 kg a week: walk briskly 30–45 minutes most days, cut sugary drinks, fried snacks and large portions of starch, and sleep well.', 'A target of about ' + lo.toFixed(0) + '–' + hi.toFixed(0) + ' kg would put you in the healthy range.');
    } else {
      level = cat.key === 'ob1' ? 'high' : 'urgent';
      risks.push('Type 2 diabetes', 'High blood pressure, heart disease and stroke', 'Sleep apnoea (breathing pauses at night)', 'Joint wear (knees, hips, back), fatty liver and some cancers', 'Reduced fertility and low mood');
      advice.push('Please book a check-up: blood pressure, blood sugar and cholesterol tests are quick and cheap at most clinics.', 'Start gently with 20–30 minutes of walking daily and build up; small steady cuts to sugary drinks, fried food and big portions work better than crash diets.', 'A first target is losing 5–10% of your weight (about ' + (kg * 0.05).toFixed(0) + '–' + (kg * 0.1).toFixed(0) + ' kg), which already lowers risk a lot. Healthy range for your height: ' + lo.toFixed(0) + '–' + hi.toFixed(0) + ' kg.');
    }
    if (p.waistCm) { const w = Number(p.waistCm); if (w > 0) { const lim = p.sex === 'f' ? 88 : 102; if (w > lim) { risks.push('A waist of ' + w + ' cm points to extra belly fat, which raises heart and diabetes risk'); if (level === 'ok') level = 'watch'; clean = false; } } }
    const bmr = (p.sex === 'f' ? 10 * kg + 6.25 * cm - 5 * age - 161 : 10 * kg + 6.25 * cm - 5 * age + 5);
    return { bmi: Math.round(b * 10) / 10, category: cat.label, categoryKey: cat.key, level, cleanBillOfHealth: clean, healthyRangeKg: [Math.round(lo), Math.round(hi)], dailyCalories: Math.round(bmr * 1.4), risks, advice,
      headline: clean ? 'Clean bill of health on these numbers' : cat.label + (level === 'ok' ? '' : ' — worth acting on'), disclaimer: DISCLAIMER };
  }
  function hrZone(bpm, age) {
    const max = 220 - age, pct = bpm / max;
    const z = pct < 0.5 ? ['Rest / very light', 1] : pct < 0.6 ? ['Warm-up', 2] : pct < 0.7 ? ['Fat-burn', 3] : pct < 0.8 ? ['Aerobic / cardio', 4] : pct < 0.9 ? ['Hard / threshold', 5] : ['Maximum effort', 6];
    return { zone: z[0], zoneNo: z[1], maxHr: max, pctMax: Math.round(pct * 100) };
  }
  function restingHr(bpm, age) {
    if (bpm < 40) return { label: 'Very low', note: 'Trained athletes can sit this low, but if you feel dizzy or faint see a doctor.', level: 'watch' };
    if (bpm < 60) return { label: 'Low (athletic)', note: 'Common in people who exercise a lot. Fine if you feel well.', level: 'ok' };
    if (bpm <= 80) return { label: 'Healthy resting rate', note: 'A typical resting heart rate for adults is 60–100 beats per minute.', level: 'ok' };
    if (bpm <= 100) return { label: 'Upper normal', note: 'Regular exercise, less caffeine and good sleep help bring it down.', level: 'watch' };
    return { label: 'High for rest', note: 'Rest for five minutes and measure again. If it stays above 100 at rest, or you feel chest pain or palpitations, see a doctor.', level: 'high' };
  }
  function breathReport(sec, age, kind) {
    const s = num(sec, 1, 600, 'Breath-hold seconds'), mult = kind === 'exhale' ? 0.5 : 1; const eq = s / mult; // exhale-holds are naturally about half as long
    const adj = age >= 60 ? 0.8 : age >= 40 ? 0.9 : 1, v = eq / adj;
    let r;
    if (v < 10) r = { key: 'very_short', label: 'Very short hold', likely: 'Reduced lung reserve, possibly from a chest infection, asthma flare, smoking, anxiety or poor fitness', level: 'high', advice: ['If you also cough, wheeze or get breathless on stairs, see a clinic for a lung check (peak-flow or spirometry).', 'Avoid smoke and dust; try the guided breathing exercise daily.'] };
    else if (v < 20) r = { key: 'short', label: 'Below average', likely: 'Mildly reduced lung capacity: often low fitness, smoking, allergies or mild asthma-type airway tightness', level: 'watch', advice: ['Regular brisk walking and diaphragmatic breathing can improve this within weeks.', 'If you smoke, quitting gives the biggest gain. A persistent cough for more than 3 weeks should be checked.'] };
    else if (v < 30) r = { key: 'average', label: 'Average', likely: 'Normal lung function for an untrained healthy adult', level: 'ok', advice: ['Keep active; aerobic exercise gradually lengthens breath-holds.'] };
    else if (v < 45) r = { key: 'good', label: 'Good', likely: 'Good lung capacity and efficient oxygen use, typical of active people', level: 'ok', advice: ['Great result. Keep up regular cardio and avoid smoke.'] };
    else r = { key: 'excellent', label: 'Excellent', likely: 'Excellent lung capacity and breathing control, typical of well-trained athletes and swimmers', level: 'ok', advice: ['Outstanding. Do not push past dizziness: never practise breath-holds in water alone.'] };
    return Object.assign({ seconds: s, kind: kind || 'inhale', headline: r.label + ' — ' + r.likely, disclaimer: DISCLAIMER + ' A breath-hold is a rough screening game, not a lung test.' }, r);
  }
  function bpCategory(sys, dia) {
    if (sys >= 180 || dia >= 120) return { label: 'Hypertensive crisis range', level: 'urgent', advice: 'Sit down, rest and re-measure in 5 minutes. If still this high, or you have chest pain, severe headache or confusion, go to a hospital now.' };
    if (sys >= 140 || dia >= 90) return { label: 'High (stage 2)', level: 'high', advice: 'See a clinic soon for a proper check. Cut salt, stay active and manage stress.' };
    if (sys >= 130 || dia >= 80) return { label: 'Elevated (stage 1)', level: 'watch', advice: 'Reduce salt, lose extra weight, exercise, and recheck in a week or two.' };
    if (sys >= 120) return { label: 'Slightly elevated', level: 'watch', advice: 'Healthy habits now keep it from rising.' };
    if (sys < 90 || dia < 60) return { label: 'Low', level: 'watch', advice: 'Drink water and stand up slowly. See a doctor if you feel faint often.' };
    return { label: 'Normal', level: 'ok', advice: 'Great. Keep it up.' };
  }
  function sleepNote(h) {
    if (h < 5) return { label: 'Very short', level: 'high', advice: 'Chronic short sleep raises risk of weight gain, accidents and low mood. Try a fixed bedtime and no screens for the last hour.' };
    if (h < 7) return { label: 'A bit short', level: 'watch', advice: 'Most adults need 7–9 hours. Move your bedtime earlier by 20 minutes at a time.' };
    if (h <= 9) return { label: 'Healthy', level: 'ok', advice: 'Right in the healthy 7–9 hour range.' };
    return { label: 'Long', level: 'watch', advice: 'Regularly sleeping over 9 hours can be tiredness from another cause. Mention it to a doctor if it persists.' };
  }
  const goalWater = kg => Math.round(Math.max(1500, kg * 33) / 50) * 50;
  core.wellness = { STYLES, classifyCadence, analyseSession, bmiOf, bmiCategory, assess, hrZone, restingHr, breathReport, bpCategory, sleepNote, goalWater };

  core.use(function (X) {
    'use strict';
    const { route, uid, fail, notify } = X;
    const DAY = 864e5, startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
    function H(db, id) {
      const h = db.health || (db.health = {});
      if (!h[id]) {
        h[id] = { profile: null, sessions: [], hr: [], breath: [], water: [], sleep: [], bp: [], goalSteps: 8000 };
        if (id === 'u_me') seedMe(h[id]);
      }
      return h[id];
    }
    function seedMe(h) {
      const now = Date.now(); h.profile = { weightKg: 72, heightCm: 175, age: 31, sex: 'm' };
      [[1, 6400, 3800], [2, 9100, 5400], [3, 4800, 2900], [4, 11200, 6300], [5, 7300, 4300]].forEach(([d, steps, sec]) => {
        const a = analyseSession([{ steps, seconds: sec }], 72, 175); h.sessions.push(Object.assign({ id: uid('hs_'), ts: startOfDay(now) - d * DAY + 7 * 36e5, note: 'Morning walk' }, a));
      });
      h.hr.push({ id: uid('hr_'), ts: now - 2 * DAY, bpm: 68, method: 'manual', state: 'rest' });
      h.water.push({ id: uid('hw_'), ts: now - DAY, ml: 1800 }); h.sleep.push({ id: uid('hz_'), ts: now - DAY, hours: 7.5 });
      h.breath.push({ id: uid('hb_'), ts: now - 3 * DAY, seconds: 32, key: 'good' });
    }
    const prof = h => h.profile || { weightKg: 70, heightCm: 170, age: 30, sex: 'm' };
    const today = (arr, t0) => arr.filter(x => x.ts >= t0);
    function summary(db, u) {
      const h = H(db, u.id), p = prof(h), t0 = startOfDay(Date.now());
      const ts = today(h.sessions, t0), steps = ts.reduce((n, s) => n + s.steps, 0), kcal = ts.reduce((n, s) => n + s.calories, 0), sec = ts.reduce((n, s) => n + s.seconds, 0);
      const dist = ts.reduce((n, s) => n + s.distanceM, 0), water = today(h.water, t0).reduce((n, w) => n + w.ml, 0);
      const sl = h.sleep.filter(s => s.ts >= t0 - DAY).sort((a, b) => b.ts - a.ts)[0], lastHr = h.hr[0] || null, lastBp = h.bp[0] || null;
      const week = []; for (let i = 6; i >= 0; i--) { const a = t0 - i * DAY, b = a + DAY; const ss = h.sessions.filter(s => s.ts >= a && s.ts < b); week.push({ day: a, steps: ss.reduce((n, s) => n + s.steps, 0), calories: ss.reduce((n, s) => n + s.calories, 0) }); }
      const wGoal = goalWater(p.weightKg);
      // health score 0-100 from what the user has logged today / recently
      let score = 40, parts = [];
      const sp = Math.min(1, steps / h.goalSteps); score += Math.round(sp * 25); parts.push(['Steps', Math.round(sp * 100)]);
      const wp = Math.min(1, water / wGoal); score += Math.round(wp * 15); parts.push(['Water', Math.round(wp * 100)]);
      if (sl) { const ok = sl.hours >= 7 && sl.hours <= 9; score += ok ? 12 : 5; parts.push(['Sleep', ok ? 100 : 45]); } else parts.push(['Sleep', 0]);
      if (h.profile) { const c = bmiCategory(bmiOf(p.weightKg, p.heightCm)).key; score += c === 'healthy' ? 8 : 3; parts.push(['Weight', c === 'healthy' ? 100 : 40]); } else parts.push(['Weight', 0]);
      return { profile: h.profile, goalSteps: h.goalSteps, today: { steps, calories: Math.round(kcal), seconds: sec, distanceM: Math.round(dist), waterMl: water, waterGoalMl: wGoal, sleepHours: sl ? sl.hours : null },
        week, lastHr, lastBp, lastBreath: h.breath[0] || null, score: Math.min(100, score), scoreParts: parts, sessions: h.sessions.slice(0, 15), streak: streak(h), disclaimer: DISCLAIMER };
    }
    function streak(h) { let n = 0, d = startOfDay(Date.now()); const has = t => h.sessions.some(s => s.ts >= t && s.ts < t + DAY && s.steps >= 2000); if (!has(d)) d -= DAY; while (has(d)) { n++; d -= DAY; } return n; }
    const wrap = fn => c => { try { return fn(c); } catch (e) { if (e.bad) fail(400, e.message); throw e; } };

    route('GET', /^\/api\/wellness$/, 'user', 'health', c => summary(c.db, c.user));
    route('POST', /^\/api\/wellness\/profile$/, 'user', 'health', wrap(c => {
      const b = c.body, h = H(c.db, c.user.id);
      h.profile = { weightKg: num(b.weightKg, 10, 400, 'Weight (kg)'), heightCm: num(b.heightCm, 80, 250, 'Height (cm)'), age: Math.round(num(b.age, 2, 120, 'Age')), sex: b.sex === 'f' ? 'f' : 'm', waistCm: b.waistCm ? num(b.waistCm, 30, 250, 'Waist (cm)') : undefined };
      if (b.goalSteps) h.goalSteps = Math.round(num(b.goalSteps, 1000, 50000, 'Step goal'));
      return summary(c.db, c.user);
    }));
    route('POST', /^\/api\/wellness\/assess$/, 'user', 'health', wrap(c => {
      const h = H(c.db, c.user.id), p = Object.assign({}, prof(h), c.body);
      const out = assess(p), lb = h.breath[0], lh = h.hr.find(x => x.state === 'rest');
      if (lb && lb.key === 'very_short') { out.cleanBillOfHealth = false; out.risks.push('Your last breath-hold was very short, so a lung check is worthwhile'); }
      if (lh && lh.bpm > 100) { out.cleanBillOfHealth = false; out.risks.push('Your resting heart rate reading was high'); }
      if (c.body.save !== false) h.profile = { weightKg: Number(p.weightKg), heightCm: Number(p.heightCm), age: Math.round(Number(p.age)), sex: p.sex === 'f' ? 'f' : 'm', waistCm: p.waistCm ? Number(p.waistCm) : undefined };
      return out;
    }));
    route('POST', /^\/api\/wellness\/session$/, 'user', 'health', wrap(c => {
      const h = H(c.db, c.user.id), p = prof(h), segs = Array.isArray(c.body.segments) && c.body.segments.length ? c.body.segments : [{ steps: c.body.steps, seconds: c.body.seconds }];
      if (segs.length > 500) fail(400, 'Too many segments.');
      const a = analyseSession(segs, c.body.weightKg ? num(c.body.weightKg, 10, 400, 'Weight') : p.weightKg, p.heightCm);
      if (a.steps < 1) fail(400, 'No steps were recorded.');
      const rec = Object.assign({ id: uid('hs_'), ts: Date.now(), note: String(c.body.note || '').slice(0, 60), source: c.body.source === 'sensor' ? 'sensor' : c.body.source === 'demo' ? 'demo' : 'manual' }, a);
      h.sessions.unshift(rec); h.sessions.length = Math.min(h.sessions.length, 300);
      const t0 = startOfDay(Date.now()), total = h.sessions.filter(s => s.ts >= t0).reduce((n, s) => n + s.steps, 0);
      const hit = total >= h.goalSteps && total - a.steps < h.goalSteps;
      if (hit) notify(c.db, c.user.id, { type: 'health', mode: 'normal', title: '🎯 Step goal reached', body: 'You have walked ' + total.toLocaleString('en-KE') + ' steps today. Well done!' });
      return { session: rec, goalReached: hit, todaySteps: total, summary: summary(c.db, c.user) };
    }));
    route('DELETE', /^\/api\/wellness\/session\/([^/]+)$/, 'user', 'health', c => { const h = H(c.db, c.user.id); h.sessions = h.sessions.filter(s => s.id !== c.p[0]); return { ok: true }; });
    route('POST', /^\/api\/wellness\/hr$/, 'user', 'health', wrap(c => {
      const h = H(c.db, c.user.id), p = prof(h), bpm = Math.round(num(c.body.bpm, 25, 240, 'Heart rate')), state = c.body.state === 'active' ? 'active' : 'rest';
      const rec = { id: uid('hr_'), ts: Date.now(), bpm, state, method: ['camera', 'tap', 'manual', 'demo'].includes(c.body.method) ? c.body.method : 'manual' };
      h.hr.unshift(rec); h.hr.length = Math.min(h.hr.length, 100);
      const z = hrZone(bpm, p.age), r = state === 'rest' ? restingHr(bpm, p.age) : null;
      return { record: rec, zone: z, resting: r, headline: r ? bpm + ' bpm — ' + r.label : bpm + ' bpm — ' + z.zone + ' zone (' + z.pctMax + '% of max)', disclaimer: DISCLAIMER + ' Phone-camera readings are estimates.' };
    }));
    route('POST', /^\/api\/wellness\/breath$/, 'user', 'health', wrap(c => {
      const h = H(c.db, c.user.id), p = prof(h), r = breathReport(c.body.seconds, p.age, c.body.kind === 'exhale' ? 'exhale' : 'inhale');
      h.breath.unshift({ id: uid('hb_'), ts: Date.now(), seconds: r.seconds, key: r.key, kind: r.kind }); h.breath.length = Math.min(h.breath.length, 60); return r;
    }));
    route('POST', /^\/api\/wellness\/water$/, 'user', 'health', wrap(c => { const h = H(c.db, c.user.id); h.water.unshift({ id: uid('hw_'), ts: Date.now(), ml: Math.round(num(c.body.ml, 50, 2000, 'Water (ml)')) }); h.water.length = Math.min(h.water.length, 300); return summary(c.db, c.user); }));
    route('POST', /^\/api\/wellness\/sleep$/, 'user', 'health', wrap(c => { const h = H(c.db, c.user.id), hrs = num(c.body.hours, 0.5, 20, 'Sleep hours'); h.sleep.unshift({ id: uid('hz_'), ts: Date.now(), hours: hrs }); h.sleep.length = Math.min(h.sleep.length, 100); return Object.assign({ hours: hrs }, sleepNote(hrs), { summary: summary(c.db, c.user) }); }));
    route('POST', /^\/api\/wellness\/bp$/, 'user', 'health', wrap(c => { const h = H(c.db, c.user.id), s = Math.round(num(c.body.sys, 50, 300, 'Systolic')), d = Math.round(num(c.body.dia, 30, 200, 'Diastolic')); if (d >= s) fail(400, 'Systolic (top) must be higher than diastolic (bottom).'); h.bp.unshift({ id: uid('hp_'), ts: Date.now(), sys: s, dia: d }); h.bp.length = Math.min(h.bp.length, 100); return Object.assign({ sys: s, dia: d, disclaimer: DISCLAIMER }, bpCategory(s, d)); }));
    route('GET', /^\/api\/wellness\/history$/, 'user', 'health', c => { const h = H(c.db, c.user.id); return { hr: h.hr.slice(0, 20), breath: h.breath.slice(0, 20), bp: h.bp.slice(0, 20), sleep: h.sleep.slice(0, 20), water: h.water.slice(0, 20) }; });
  });
});
