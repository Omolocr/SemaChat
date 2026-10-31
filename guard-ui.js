/* SemaChat — Content guard UI: "Not delivered" marker in the sender's chat, and the developer's Content guard section. */
(function () {
  'use strict';
  const css = document.createElement('style');
  css.textContent = `.nd{opacity:.82}.nd .nn{display:flex;gap:6px;align-items:center;justify-content:flex-end;color:#c53030;font-size:11.5px;font-weight:700;margin:2px 10px 8px}.nd .nn i{font-style:normal}
  .gtag{display:inline-block;padding:2px 8px;border-radius:99px;background:#fff5f5;color:#c53030;font-size:11px;font-weight:800}`;
  document.head.appendChild(css);
  // chat: the sender sees their message, marked as not delivered (no network involved, so a strong signal does not help)
  const _bubble = window.bubble;
  if (_bubble) window.bubble = function (m, ch) {
    const h = _bubble(m, ch); if (!m.blocked) return h;
    return `<div class="nd">${h}<div class="nn"><i>⚠️</i>Not delivered · contains content SemaChat does not allow</div></div>`;
  };

  /* ---------------------------------------------------------------- developer console */
  const _load = window.adminLoadExt;
  window.adminLoadExt = async function (s, A) { if (_load) await _load(s, A); if (s === 'guard') A.guard = await api('GET', '/api/admin/guard', null, true); };
  const tm = ts => new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const catName = (g, id) => ((g.categories.find(c => c.id === id) || {}).name) || id;
  window.aGuard = function () {
    const g = S.a.guard; if (!g) return '<h2>Content guard</h2>';
    const F = S.f, sel = (k, opts, v) => `<select data-bind="f.${k}">${opts.map(o => `<option value="${o[0]}" ${(F[k] || v) === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`;
    const cats = g.categories.map(c => [c.id, c.name]), types = [['word', 'Word'], ['slang', 'Slang'], ['phrase', 'Phrase'], ['location', 'Place name']];
    return `<h2>Content guard</h2><p class="lead">Words, slang, phrases, place names and restricted zones that must not travel on SemaChat, for the safety and unity of the country. A match is stopped before delivery: in chat the <b>sender still sees the message, marked “Not delivered”</b>, and nobody else ever receives it, whatever the network. Posts, comments, captions and adverts are refused with a clear message. Senders are never told which word matched.</p>
    <div class="row" style="margin-bottom:10px"><label class="sw"><input type="checkbox" data-act="a_guardsw" ${g.enabled ? 'checked' : ''}><span></span></label><b>${g.enabled ? 'Guard is ON' : 'Guard is OFF: nothing is being stopped'}</b></div>
    <div class="grid"><div class="gk"><span>Blocked in last 24 h</span><b>${g.stats.blocked24h}</b></div><div class="gk"><span>Blocked in total</span><b>${g.stats.blockedTotal}</b></div><div class="gk"><span>Active terms</span><b>${g.stats.activeRules}</b></div><div class="gk"><span>Restricted zones</span><b>${g.stats.zones}</b></div></div>
    <div class="pn"><h3>Add a word, slang, phrase or place</h3><div class="row" style="flex-wrap:wrap;gap:8px"><input data-bind="f.gTerm" placeholder="e.g. a phrase to stop" value="${esc(F.gTerm || '')}" style="min-width:220px">${sel('gType', types, 'word')}${sel('gCat', cats, 'incitement')}${sel('gMatch', [['word', 'Whole word / phrase'], ['contains', 'Anywhere inside words']], 'word')}<button class="btn sm" data-act="a_guardadd">Add</button></div>
      <details style="margin-top:10px"><summary class="sm"><b>Add many at once</b></summary><textarea data-bind="f.gBulk" rows="4" placeholder="One per line (or separated by commas)" style="width:100%;margin:8px 0">${esc(F.gBulk || '')}</textarea><button class="btn sm alt" data-act="a_guardbulk">Add all (uses the type and category above)</button></details>
      <div class="sm mut" style="margin-top:8px">Matching ignores capitals, accents, punctuation, number-for-letter swaps (0/o, 1/i, 3/e, 4/a, 5/s, @/a) and spaced-out letters. It is a word list, not an AI: review hits regularly.</div></div>
    <div class="pn"><h3>Try a sentence</h3><div class="row"><input data-bind="f.gTest" placeholder="Type a sentence to see if it would be stopped" value="${esc(F.gTest || '')}"><button class="btn sm" data-act="a_guardtest">Test</button></div>${F.gTestRes ? `<div class="sm" style="margin-top:8px">${F.gTestRes.blocked ? '🚫 Would be stopped: ' + F.gTestRes.matched.map(m => `<span class="gtag">${esc(m.term)} · ${esc(catName(g, m.category))}</span>`).join(' ') : '✅ Would be delivered'}</div>` : ''}</div>
    <div class="pn"><h3>The list (${g.rules.length})</h3><table class="tbl"><tr><th>Term</th><th>Type</th><th>Category</th><th>Matches</th><th>Hits</th><th>On</th><th></th></tr>${g.rules.map(r => `<tr><td><b>${esc(r.term)}</b>${r.example ? ' <span class="mut sm">(starter example)</span>' : ''}</td><td>${esc(r.type)}</td><td class="sm">${esc(catName(g, r.category))}</td><td class="sm">${r.match === 'contains' ? 'anywhere' : 'whole word'}</td><td>${r.hits}</td><td><label class="sw"><input type="checkbox" data-act="a_guardrule" data-id="${r.id}" ${r.enabled ? 'checked' : ''}><span></span></label></td><td><button class="btn sm alt" data-act="a_guardrm" data-id="${r.id}">Remove</button></td></tr>`).join('') || '<tr><td colspan="7" class="mut">Nothing on the list yet.</td></tr>'}</table></div>
    <div class="pn"><h3>Restricted zones</h3><p class="mut sm">Messages, location shares and adverts with a pin inside a zone are stopped.</p><div class="row" style="flex-wrap:wrap;gap:8px"><input data-bind="f.zName" placeholder="Zone name" value="${esc(F.zName || '')}"><input data-bind="f.zLat" type="number" step="any" placeholder="Latitude" value="${esc(F.zLat || '')}" style="width:120px"><input data-bind="f.zLng" type="number" step="any" placeholder="Longitude" value="${esc(F.zLng || '')}" style="width:120px"><input data-bind="f.zRad" type="number" placeholder="Radius (m)" value="${esc(F.zRad || '')}" style="width:110px"><button class="btn sm" data-act="a_guardzone">Add zone</button></div>
      ${g.zones.length ? `<table class="tbl" style="margin-top:8px"><tr><th>Zone</th><th>Centre</th><th>Radius</th><th>Hits</th><th>On</th><th></th></tr>${g.zones.map(z => `<tr><td><b>${esc(z.name)}</b></td><td class="sm">${z.lat.toFixed(4)}, ${z.lng.toFixed(4)}</td><td>${z.radiusM.toLocaleString('en-KE')} m</td><td>${z.hits}</td><td><label class="sw"><input type="checkbox" data-act="a_guardzsw" data-id="${z.id}" ${z.enabled ? 'checked' : ''}><span></span></label></td><td><button class="btn sm alt" data-act="a_guardzrm" data-id="${z.id}">Remove</button></td></tr>`).join('')}</table>` : ''}</div>
    <div class="pn"><h3>Recent stops</h3>${g.repeat.length ? `<div class="sm" style="margin-bottom:8px"><b>Most stops:</b> ${g.repeat.map(r => esc(r.user ? r.user.name : '?') + ' (' + r.hits + ')').join(' · ')}</div>` : ''}<table class="tbl"><tr><th>When</th><th>Who</th><th>Where</th><th>Category</th><th>Excerpt</th></tr>${g.hits.map(h => `<tr><td class="sm">${tm(h.ts)}</td><td>${esc(h.user ? h.user.name : '?')}</td><td class="sm"><code>${esc(h.where)}</code></td><td><span class="gtag">${esc(catName(g, h.category))}</span></td><td class="sm">${esc(h.excerpt)}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">Nothing has been stopped yet.</td></tr>'}</table><p class="mut sm">Opening this list is recorded in the Access audit because it shows what people wrote.</p></div>`;
  };
  const refresh = async m => { if (m) toast(m); await adminBoot(); };
  Object.assign(adm, {
    async guardsw(d, el) { await api('PUT', '/api/admin/guard/settings', { enabled: el.checked }, true); await refresh(el.checked ? 'Content guard ON' : 'Content guard OFF'); },
    async guardadd() { const F = S.f; await api('POST', '/api/admin/guard/rules', { term: F.gTerm, type: F.gType || 'word', category: F.gCat || 'incitement', match: F.gMatch || 'word' }, true); F.gTerm = ''; await refresh('Added to the list'); },
    async guardbulk() { const F = S.f, r = await api('POST', '/api/admin/guard/bulk', { text: F.gBulk, type: F.gType || 'word', category: F.gCat || 'incitement', match: F.gMatch || 'word' }, true); F.gBulk = ''; await refresh(r.added + ' added, ' + r.skipped + ' skipped'); },
    async guardtest() { S.f.gTestRes = await api('POST', '/api/admin/guard/test', { text: S.f.gTest }, true); render(); },
    async guardrule(d, el) { await api('PUT', '/api/admin/guard/rules/' + d.id, { enabled: el.checked }, true); await refresh(); },
    async guardrm(d) { if (!confirm('Remove this term from the list?')) return; await api('DELETE', '/api/admin/guard/rules/' + d.id, null, true); await refresh('Removed'); },
    async guardzone() { const F = S.f; await api('POST', '/api/admin/guard/zones', { name: F.zName, lat: F.zLat, lng: F.zLng, radiusM: F.zRad }, true); Object.assign(F, { zName: '', zLat: '', zLng: '', zRad: '' }); await refresh('Zone added'); },
    async guardzsw(d, el) { await api('PUT', '/api/admin/guard/zones/' + d.id, { enabled: el.checked }, true); await refresh(); },
    async guardzrm(d) { if (!confirm('Remove this zone?')) return; await api('DELETE', '/api/admin/guard/zones/' + d.id, null, true); await refresh('Zone removed'); }
  });
})();
