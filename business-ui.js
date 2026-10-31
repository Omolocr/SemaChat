/* SemaChat — Business Mode UI add-on. Loaded after the main app script (see <!--BIZ--> in index.html).
 * Customer side: business directory, sponsored cards, business page, basket, my orders, reviews, disputes.
 * Business side: catalog, page editor, reviews, ads marketplace, analytics. Admin: ad review, disputes.
 * It wraps existing functions (load, pageView, sheetView, exploreView, meExtra, bhomeView, bsetView) instead of editing them. */
(function () {
  'use strict';
  const bx = S.bx = {
    cart: {}, note: '', dir: [], feed: [], pg: null, cat: [], page: null, reviews: null, disputes: [], ads: null, an: null, mo: [],
    f: { id: '', kind: 'product', name: '', price: '', stock: '10', duration: '60', desc: '', emoji: '' },
    pf: { emoji: '', about: '', hours: '', area: '' }, af: { name: '', headline: '', objective: 'visits', itemId: '', dailyBudget: '200', days: '7' },
    rf: { id: '', text: '' }, rv: { id: '', stars: 5, text: '' }, dp: { id: '', reason: '' }
  };
  const css = document.createElement('style');
  css.textContent = `
  .bxcover{padding:22px 18px 16px;color:#fff;position:relative}.bxcover h1{font-size:24px}.bxcover .big{font-size:46px;margin-bottom:4px}
  .bxcover .meta{opacity:.92;font-size:13.5px;margin-top:2px}
  .bxrow{display:flex;gap:10px;overflow-x:auto;padding:2px 16px 12px;scrollbar-width:none}
  .bxcard{min-width:210px;max-width:210px;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 1px 0 var(--line);text-align:left;flex-shrink:0}
  .bxcard .top{height:64px;display:flex;align-items:center;padding:0 14px;font-size:30px;color:#fff}
  .bxcard .bd{padding:10px 12px 12px}.bxcard .bd b{display:block}
  .stp{display:flex;align-items:center;gap:10px;background:var(--soft);border-radius:99px;padding:3px}.stp button{width:30px;height:30px;border-radius:50%;background:#fff;font-weight:800}
  .bxbar{position:sticky;bottom:0;margin:10px 16px 0;padding:10px;background:var(--brand);color:#fff;border-radius:16px;display:flex;align-items:center;gap:10px;box-shadow:0 6px 20px #0004}
  .bxbar button{background:#fff;color:var(--brand);border-radius:12px;padding:8px 14px;font-weight:800}
  .star{font-size:26px;filter:grayscale(1);opacity:.5}.star.on{filter:none;opacity:1}
  .stat{display:flex;justify-content:space-between;font-size:13px;margin:4px 0}
  .fun{height:30px;border-radius:9px;background:linear-gradient(90deg,var(--brand),var(--brand2));color:#fff;display:flex;align-items:center;padding:0 10px;font-size:12.5px;font-weight:700;margin-bottom:6px;white-space:nowrap}`;
  document.head.appendChild(css);

  const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
  const KT = { product: '📦 Product', service: '🛎️ Service', video: '🎬 Video' };
  const ST = { pending_review: ['In review', 'o'], active: ['Live', ''], paused: ['Paused', 'b'], completed: ['Finished', 'b'], stopped: ['Stopped', 'b'], rejected: ['Rejected', 'o'] };
  const grad = c => `linear-gradient(135deg,${(c || ['#1b7f4a', '#0f766e']).join(',')})`;
  const tryA = async (m, p, b) => { try { return await api(m, p, b); } catch (e) { return null; } };
  const reload = async () => { await load(); render(); };
  const dayLabels = n => Array.from({ length: n }, (_, i) => String(new Date(Date.now() - (n - 1 - i) * 864e5).getDate()));
  const cartOf = o => bx.cart[o] || (bx.cart[o] = {});

  /* ------------------------------------------------------------------ data loading */
  const _load = window.load;
  window.load = async function () {
    await _load();
    const v = cur(), k = v ? v.n : S.tab;
    if (k === 'explore' && !isBiz()) { bx.dir = (await tryA('GET', '/api/biz/pages')) || []; bx.feed = (await tryA('GET', '/api/ads/feed')) || []; }
    else if (k === 'bizpage') bx.pg = await api('GET', '/api/biz/pages/' + v.id);
    else if (k === 'myorders') bx.mo = await api('GET', '/api/me/orders');
    else if (k === 'bcat') bx.cat = await api('GET', '/api/biz/catalog');
    else if (k === 'bpage') { bx.page = await api('GET', '/api/biz/page'); bx.reviews = await api('GET', '/api/biz/reviews'); bx.disputes = await api('GET', '/api/biz/disputes'); }
    else if (k === 'bads') { bx.ads = await api('GET', '/api/biz/ads'); bx.cat = await api('GET', '/api/biz/catalog'); }
    else if (k === 'bstats') bx.an = await api('GET', '/api/biz/analytics?days=14');
  };

  /* ------------------------------------------------------------------ customer side */
  function dirHtml() {
    const feed = bx.feed || [], dir = bx.dir || []; if (!feed.length && !dir.length) return '';
    const card = (p, ad) => `<button class="bxcard" data-act="${ad ? 'bxadopen' : 'bxopen'}" data-id="${ad ? ad.id : p.ownerId}" data-o="${p.ownerId}"><div class="top" style="background:${grad(p.cover)}">${esc(p.emoji)}</div><div class="bd">${ad ? '<span class="tagb o">Sponsored</span>' : ''}<b class="ell">${esc(ad ? ad.headline : p.name)}</b><span class="mut sm ell" style="display:block">${ad ? esc(p.name) : esc(p.category) + (p.area ? ' · ' + esc(p.area) : '')}</span><span class="sm">${p.rating ? '⭐ ' + p.rating + ' (' + p.reviewCount + ')' : 'New'}${p.fromPrice ? ' · from ' + money(p.fromPrice) : ''}</span></div></button>`;
    return `<div class="sec">Businesses on SemaChat</div><div class="bxrow">${feed.map(a => card(a.business, a)).join('')}${dir.filter(p => !feed.some(a => a.ownerId === p.ownerId)).map(p => card(p)).join('')}</div>`;
  }
  const _explore = window.exploreView;
  window.exploreView = function () { const h = _explore(), i = h.indexOf('</div>'); return i < 0 || !dirHtml() ? h : h.slice(0, i + 6) + dirHtml() + h.slice(i + 6); };

  const _meExtra = window.meExtra;
  window.meExtra = function () {
    return `<div class="sec">Shopping</div><div class="li" data-act="go" data-p="myorders"><div class="fi" style="background:var(--soft)">🧾</div><div class="grow"><b>My orders</b><div class="mut sm">Track, review or dispute purchases from businesses</div></div>›</div>` + _meExtra();
  };

  function bizpagePage(v) {
    const d = bx.pg; if (!d || d.page.ownerId !== v.id) return ph('Business') + '<div class="empty">Loading…</div>';
    const p = d.page, cart = cartOf(v.id), lines = d.items.filter(i => cart[i.id] > 0), n = lines.reduce((a, i) => a + cart[i.id], 0), total = lines.reduce((a, i) => a + cart[i.id] * i.price, 0);
    const row = i => {
      const q = cart[i.id] || 0, act = (val, label) => `<button data-act="bxqty" data-o="${v.id}" data-id="${i.id}" data-v="${val}">${label}</button>`;
      const ctl = i.kind === 'video' ? `<button class="btn sm alt" data-act="bxwatch">▶ Watch</button>` : i.stock === 0 ? '<span class="mut sm">Sold out</span>' : !d.canOrder ? '' : q ? `<div class="stp">${act(-1, '−')}<b>${q}</b>${act(1, '+')}</div>` : `<button class="btn sm" data-act="bxqty" data-o="${v.id}" data-id="${i.id}" data-v="1">Add</button>`;
      return `<div class="exc"><div class="em">${esc(i.emoji)}</div><div class="grow"><b>${esc(i.name)}</b> <span class="tagb b">${i.kind}</span><div class="mut sm">${esc(i.desc)}</div><b>${i.kind === 'video' ? 'Free' : money(i.price)}</b>${i.duration ? ` <span class="mut sm">· ${i.duration} min</span>` : ''}${i.stock != null && i.stock > 0 && i.stock <= 5 ? ` <span class="tagb o">${i.stock} left</span>` : ''}</div>${ctl}</div>`;
    };
    return `<div class="bxcover" style="background:${grad(p.cover)}"><button class="ib" style="position:absolute;left:12px;top:12px" data-act="back">‹</button><div style="height:34px"></div><div class="big">${esc(p.emoji)}</div><h1>${esc(p.name)} ${p.verified ? '<span class="vf" style="position:static;display:inline-flex">✓</span>' : ''}</h1>
      <div class="meta">${p.rating ? '⭐ ' + p.rating + ' · ' + p.reviewCount + ' reviews' : 'New on SemaChat'} · ${p.followers} follower${p.followers === 1 ? '' : 's'}</div><div class="meta">${esc(p.category)}${p.area ? ' · ' + esc(p.area) : ''} · ${esc(p.hours)}</div></div>
    ${d.canOrder ? `<div class="row" style="padding:12px 16px"><button class="btn ${p.following ? 'alt' : ''} grow" data-act="bxfollow" data-id="${v.id}">${p.following ? '✓ Following' : '＋ Follow'}</button><button class="btn alt grow" data-act="bxmsg" data-id="${v.id}">💬 Message</button></div>` : `<div class="hint" style="margin:12px 16px">👀 This is how customers see your page.</div>`}
    ${p.about ? `<div class="card" style="margin:0 16px 8px">${esc(p.about)}</div>` : ''}
    <div class="sec">Catalog</div>${d.items.map(row).join('') || '<div class="empty">Nothing listed yet.</div>'}
    <div class="sec">Reviews</div>${d.reviews.map(r => `<div class="card" style="margin:0 16px 8px"><div class="row"><b class="grow">${esc(r.name)}</b><span style="color:#d69e2e">${stars(r.rating)}</span></div><div>${esc(r.text)}</div>${r.reply ? `<div class="mut sm" style="margin-top:6px;border-left:3px solid var(--line);padding-left:8px"><b>Owner reply:</b> ${esc(r.reply)}</div>` : ''}</div>`).join('') || '<div class="empty" style="padding:14px">No reviews yet.</div>'}
    ${n ? `<div class="bxbar"><div class="grow"><b>${n} item${n > 1 ? 's' : ''}</b><div class="sm" style="opacity:.9">${money(total)}</div></div><button data-act="bxbasket" data-id="${v.id}">View basket</button></div>` : ''}`;
  }
  function myordersPage() {
    const l = bx.mo || [], tag = { new: ['Waiting for business', 'o'], completed: ['Accepted', ''], rejected: ['Declined', 'o'] };
    return ph('My orders') + (l.map(o => { const t = tag[o.status] || [o.status, 'b'];
      return `<div class="card" style="margin:0 16px 10px"><div class="row"><b class="grow">${esc(o.business)}</b><span class="tagb ${t[1]}">${t[0]}</span></div><div class="mut sm">#${o.number} · ${dt(o.ts)} · ${o.items.map(i => esc(i.name) + ' ×' + i.qty).join(', ')}</div><div class="row" style="margin-top:6px"><b class="grow">${money(o.total)}</b>${o.refunded ? '<span class="tagb b">Refunded</span>' : ''}${o.dispute ? `<span class="tagb o">Dispute ${o.dispute}</span>` : ''}</div>
        <div class="row" style="margin-top:8px;flex-wrap:wrap"><button class="btn sm alt" data-act="go" data-p="bizpage" data-id="${o.ownerId}">Open shop</button>${o.chatId ? `<button class="btn sm alt" data-act="bxchat" data-id="${o.chatId}">💬 Chat</button>` : ''}${o.status === 'completed' && !o.reviewed ? `<button class="btn sm" data-act="bxreview" data-id="${o.id}">⭐ Review</button>` : ''}${o.status === 'completed' && !o.refunded && !o.dispute ? `<button class="btn sm alt" data-act="bxdispute" data-id="${o.id}">Report a problem</button>` : ''}</div></div>`; }).join('') || '<div class="empty"><b>🧾</b>No orders yet. Open a business from Explore.</div>');
  }

  /* ------------------------------------------------------------------ business side */
  function growTiles() {
    return `<div class="sec">Grow your business</div><div class="tiles">${[['bcat', '📦', 'Catalog'], ['bpage', '🏪', 'My page'], ['bads', '📣', 'Ads'], ['bstats', '📈', 'Analytics']].map(t => `<button class="tile" data-act="go" data-p="${t[0]}"><span>${t[1]}</span>${t[2]}</button>`).join('')}</div>`;
  }
  const _bhome = window.bhomeView;
  window.bhomeView = function () { const h = _bhome(), a = '<div class="sec">🧪 Demo'; const i = h.indexOf(a); return i < 0 ? h + growTiles() : h.slice(0, i) + growTiles() + h.slice(i); };
  const _bset = window.bsetView;
  window.bsetView = function () { const h = _bset(), a = '<div class="lh">Business</div>'; return h.includes(a) ? h.replace(a, a + growTiles()) : h; };

  function bcatPage() {
    const l = bx.cat || [];
    return ph('Catalog', `<button class="btn sm" data-act="bxitem">＋ Add</button>`) + `<p class="mut sm" style="padding:0 16px 8px">Products, services and videos shown on your public page. Customers pay from their SemaChat wallet.</p>` +
      (l.map(i => `<div class="exc" style="${i.active ? '' : 'opacity:.55'}"><div class="em">${esc(i.emoji)}</div><div class="grow"><b>${esc(i.name)}</b> <span class="tagb b">${i.kind}</span><div class="mut sm">${i.kind === 'video' ? 'Free video' : money(i.price)}${i.stock != null ? ' · ' + i.stock + ' in stock' : ''}${i.duration ? ' · ' + i.duration + ' min' : ''} · ${i.sold} sold · ${i.views} views</div>
        <div class="row" style="margin-top:6px"><button class="chip" data-act="bxitem" data-id="${i.id}">Edit</button><button class="chip" data-act="bxtoggle" data-id="${i.id}" data-v="${i.active ? 0 : 1}">${i.active ? 'Hide' : 'Show'}</button><button class="chip" data-act="bxdel" data-id="${i.id}">Delete</button></div></div></div>`).join('') || '<div class="empty"><b>📦</b>Add your first product or service.</div>');
  }
  function bpagePage() {
    const d = bx.page, rv = bx.reviews; if (!d || !rv) return ph('My page') + '<div class="empty">Loading…</div>';
    if (!bx.pf.touched) Object.assign(bx.pf, { emoji: d.edit.emoji, about: d.edit.about, hours: d.edit.hours, area: d.edit.area, touched: true });
    return ph('My business page') + `<div class="card col" style="margin:0 16px 10px"><div class="row"><div style="width:84px"><label class="lb">Icon</label><input data-bind="bx.pf.emoji" value="${esc(bx.pf.emoji)}" maxlength="4"></div><div class="grow"><label class="lb">Area</label><input data-bind="bx.pf.area" value="${esc(bx.pf.area)}"></div></div>
      <label class="lb">About</label><textarea rows="3" data-bind="bx.pf.about">${esc(bx.pf.about)}</textarea><label class="lb">Opening hours</label><input data-bind="bx.pf.hours" value="${esc(bx.pf.hours)}">
      <div class="row"><button class="btn grow" data-act="bxsavepage">Save page</button><button class="btn alt grow" data-act="go" data-p="bizpage" data-id="${d.preview.ownerId}">View as customer</button></div></div>
    <div class="sec">Reviews · ${rv.rating ? '⭐ ' + rv.rating : 'none yet'} (${rv.count})</div>${rv.reviews.slice(0, 8).map(r => `<div class="card" style="margin:0 16px 8px"><div class="row"><b class="grow">${esc(r.name)}</b><span style="color:#d69e2e">${stars(r.rating)}</span></div><div>${esc(r.text)}</div>${r.reply ? `<div class="mut sm" style="margin-top:6px">↩ ${esc(r.reply)}</div>` : `<button class="chip" style="margin-top:6px" data-act="bxreply" data-id="${r.id}">Reply</button>`}</div>`).join('') || '<div class="empty" style="padding:12px">No reviews yet.</div>'}
    ${(bx.disputes || []).length ? `<div class="sec">Disputes</div>${bx.disputes.map(x => `<div class="card" style="margin:0 16px 8px"><div class="row"><b class="grow">Order #${x.number} · ${money(x.amount)}</b><span class="tagb ${x.status === 'open' ? 'o' : 'b'}">${x.status}</span></div><div class="mut sm">${esc(x.customer || '')}: ${esc(x.reason)}</div></div>`).join('')}` : ''}`;
  }
  function badsPage() {
    const d = bx.ads; if (!d) return ph('Ads') + '<div class="empty">Loading…</div>'; const t = d.totals;
    return ph('Ads', `<button class="btn sm" data-act="bxad">＋ New</button>`) + `<div class="kpis"><div class="kpi"><b>${money(t.spent).replace('KES ', '')}</b><span>Spent (KES)</span></div><div class="kpi"><b>${t.impressions.toLocaleString()}</b><span>Impressions</span></div><div class="kpi"><b>${t.clicks}</b><span>Clicks</span></div><div class="kpi"><b>${t.ctr}%</b><span>Click rate</span></div></div>
    <p class="mut sm" style="padding:10px 16px 4px">Your ad appears as a Sponsored card in customers' Explore tab. Budget is paid upfront from your wallet (${money(d.balance)}); unspent money is refunded if you stop.</p>
    ${d.ads.map(a => { const s = ST[a.status] || [a.status, 'b'], pct = a.budget ? Math.min(100, Math.round(a.spent / a.budget * 100)) : 0; return `<div class="card" style="margin:0 16px 10px"><div class="row"><b class="grow">${esc(a.name)}</b><span class="tagb ${s[1]}">${s[0]}</span></div><div class="mut sm">“${esc(a.headline)}”${a.item ? ' · ' + esc(a.item.name) : ''}</div>
      <div class="pb" style="margin:8px 0 3px"><i style="width:${pct}%"></i></div><div class="stat"><span>${money(a.spent)} of ${money(a.budget)}</span><span>${a.impressions.toLocaleString()} views · ${a.clicks} clicks · ${a.ctr}%</span></div>${a.status === 'rejected' ? `<div class="err">${esc(a.reason)}</div>` : ''}
      <div class="row" style="flex-wrap:wrap;margin-top:6px">${a.status === 'active' ? `<button class="btn sm alt" data-act="bxadact" data-id="${a.id}" data-v="pause">Pause</button><button class="btn sm alt" data-act="bxadact" data-id="${a.id}" data-v="simulate-day">⏩ Simulate a day</button>` : ''}${a.status === 'paused' ? `<button class="btn sm" data-act="bxadact" data-id="${a.id}" data-v="resume">Resume</button>` : ''}${['pending_review', 'active', 'paused'].includes(a.status) ? `<button class="btn sm alt" data-act="bxadact" data-id="${a.id}" data-v="stop">Stop & refund unspent</button>` : ''}</div></div>`; }).join('') || '<div class="empty"><b>📣</b>No campaigns yet. Start one to reach new customers.</div>'}`;
  }
  function bstatsPage() {
    const a = bx.an; if (!a) return ph('Analytics') + '<div class="empty">Loading…</div>'; const lb = dayLabels(a.days), none = !a.totals.views && !a.totals.orders, f = a.funnel, mx = Math.max(1, f.views, f.itemViews);
    const fun = (l, n) => `<div class="fun" style="width:${Math.max(18, Math.round(n / mx * 100))}%">${l}: ${n.toLocaleString()}</div>`;
    return ph('Analytics') + (none ? `<div class="card" style="margin:0 16px 10px"><b>No traffic yet</b><p class="mut sm" style="margin:4px 0 8px">Share your page, run an ad, or load two weeks of sample activity to see how this looks.</p><button class="btn sm" data-act="bxhist">📈 Load sample history</button></div>` : '') +
    `<div class="kpis"><div class="kpi"><b>${a.totals.views}</b><span>Page views (${a.days}d)</span></div><div class="kpi"><b>${a.totals.orders}</b><span>Orders</span></div><div class="kpi"><b>${money(a.totals.revenue).replace('KES ', '')}</b><span>Revenue (KES)</span></div><div class="kpi"><b>${a.conversionPct}%</b><span>View → order</span></div></div>
    <div class="card" style="margin:12px 16px"><b>Page views</b>${bars(a.series.views, { h: 70, labels: lb })}</div><div class="card" style="margin:0 16px 12px"><b>Revenue</b>${bars(a.series.revenue, { h: 70, labels: lb, color: '#2f855a', fmt: money })}</div>
    <div class="card" style="margin:0 16px 12px"><b>Funnel</b><div style="margin-top:8px">${fun('Page views', f.views)}${fun('Item views', f.itemViews)}${fun('Orders', f.orders)}${fun('Accepted', f.completed)}</div></div>
    <div class="card" style="margin:0 16px 12px"><b>Top sellers</b>${a.topItems.map(t => `<div class="stat"><span>${esc(t.name)} · ${t.units} sold</span><b>${money(t.revenue)}</b></div>`).join('') || '<div class="mut sm">No sales yet.</div>'}</div>
    <div class="card" style="margin:0 16px 12px"><div class="row"><b class="grow">Ratings</b><span>${a.rating.avg ? '⭐ ' + a.rating.avg : '—'} (${a.rating.count})</span></div>${a.rating.breakdown.map(r => `<div class="row" style="gap:8px;margin-top:4px"><span class="sm" style="width:22px">${r.stars}★</span><div class="pb grow"><i style="width:${a.rating.count ? Math.round(r.n / a.rating.count * 100) : 0}%"></i></div><span class="sm" style="width:20px">${r.n}</span></div>`).join('')}</div>
    <div class="kpis" style="padding-bottom:12px"><div class="kpi"><b>${a.repeatPct}%</b><span>Repeat customers</span></div><div class="kpi"><b>${a.totals.followers}</b><span>Followers</span></div><div class="kpi"><b>${money(a.ads.spent).replace('KES ', '')}</b><span>Ad spend (KES)</span></div><div class="kpi"><b>${a.ads.costPerOrder ? money(a.ads.costPerOrder).replace('KES ', '') : '—'}</b><span>Ad cost / order</span></div></div>`;
  }

  /* ------------------------------------------------------------------ pages + sheets wiring */
  const PAGES = { bizpage: bizpagePage, myorders: myordersPage, bcat: bcatPage, bpage: bpagePage, bads: badsPage, bstats: bstatsPage };
  const _pv = window.pageView; window.pageView = v => PAGES[v.n] ? PAGES[v.n](v) : _pv(v);
  const SH = {
    bxcart() {
      const o = S.sheet.o, cart = cartOf(o), d = bx.pg, lines = d.items.filter(i => cart[i.id] > 0), total = lines.reduce((a, i) => a + cart[i.id] * i.price, 0), short = S.me.balance < total;
      return `<h3>Your basket · ${esc(d.page.name)}</h3>${lines.map(i => `<div class="li" style="padding:6px 0"><span style="font-size:26px">${esc(i.emoji)}</span><b class="grow sm">${esc(i.name)} ×${cart[i.id]}</b><b>${money(i.price * cart[i.id])}</b></div>`).join('')}
        <h3 style="margin:8px 0">Total ${money(total)}</h3><input data-bind="bx.note" placeholder="Note for the business (optional)" value="${esc(bx.note)}" style="margin-bottom:8px"><p class="mut sm" style="margin-bottom:8px">Pay from your SemaChat wallet (${money(S.me.balance)}). If the business declines, you are refunded automatically.</p>
        ${short ? `<div class="err" style="margin-bottom:8px">Your wallet is short by ${money(total - S.me.balance)}.</div><button class="btn full" data-act="topup">Top up wallet</button>` : `<button class="btn full" data-act="bxpay" data-o="${o}">Pay ${money(total)}</button>`}`;
    },
    bxitem() {
      const f = bx.f, kinds = ['product', 'service', 'video'];
      return `<h3>${f.id ? 'Edit item' : 'Add to catalog'}</h3>${f.id ? '' : `<div class="row" style="flex-wrap:wrap;margin-bottom:10px">${kinds.map(k => `<button class="chip ${f.kind === k ? 'on' : ''}" data-act="bxkind" data-v="${k}">${KT[k]}</button>`).join('')}</div>`}
        <div class="col"><div class="row"><input style="width:84px" data-bind="bx.f.emoji" placeholder="🎁" value="${esc(f.emoji)}" maxlength="4"><input data-bind="bx.f.name" placeholder="Name" value="${esc(f.name)}"></div>
        ${f.kind !== 'video' ? `<input type="number" data-bind="bx.f.price" placeholder="Price (KES)" value="${esc(f.price)}">` : ''}${f.kind === 'product' ? `<input type="number" data-bind="bx.f.stock" placeholder="Stock" value="${esc(f.stock)}">` : ''}${f.kind === 'service' ? `<input type="number" data-bind="bx.f.duration" placeholder="Duration (minutes)" value="${esc(f.duration)}">` : ''}
        <input data-bind="bx.f.desc" placeholder="Short description" value="${esc(f.desc)}"><button class="btn full" data-act="bxsaveitem">${f.id ? 'Save changes' : 'Add item'}</button></div>`;
    },
    bxreply() { return `<h3>Reply to review</h3><textarea rows="3" data-bind="bx.rf.text" placeholder="Thank them or make it right…">${esc(bx.rf.text)}</textarea><button class="btn full" style="margin-top:10px" data-act="bxsendreply">Send reply</button>`; },
    bxad() {
      const a = bx.af, daily = +a.dailyBudget || 0, days = +a.days || 0, cost = daily * days, est = Math.round(cost * (bx.ads ? bx.ads.pricing.impressionsPerKes : 12));
      return `<h3>New ad campaign</h3><div class="col"><input data-bind="bx.af.name" placeholder="Campaign name" value="${esc(a.name)}"><input data-bind="bx.af.headline" placeholder="Headline people will see" value="${esc(a.headline)}">
        <div class="row" style="flex-wrap:wrap">${[['visits', 'More visits'], ['orders', 'More orders'], ['awareness', 'Awareness']].map(x => `<button class="chip ${a.objective === x[0] ? 'on' : ''}" data-act="bxobj" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
        <select data-bind="bx.af.itemId"><option value="">Promote my whole page</option>${(bx.cat || []).filter(i => i.active).map(i => `<option value="${i.id}" ${a.itemId === i.id ? 'selected' : ''}>${esc(i.name)}</option>`).join('')}</select>
        <div class="row"><input type="number" data-bind="bx.af.dailyBudget" data-live="1" placeholder="Daily budget" value="${esc(a.dailyBudget)}"><input type="number" data-bind="bx.af.days" data-live="1" placeholder="Days" value="${esc(a.days)}"></div>
        <div class="hint">Total <b>${money(cost)}</b> · about <b>${est.toLocaleString()}</b> impressions. Reviewed by the SemaChat team before it goes live.</div><button class="btn full" data-act="bxsavead">Pay ${money(cost)} & submit</button></div>`;
    },
    bxreview() { const r = bx.rv; return `<h3>Rate your order</h3><div class="row" style="justify-content:center;margin-bottom:10px">${[1, 2, 3, 4, 5].map(n => `<button class="star ${n <= r.stars ? 'on' : ''}" data-act="bxstar" data-v="${n}">⭐</button>`).join('')}</div><textarea rows="3" data-bind="bx.rv.text" placeholder="Tell others about it (optional)">${esc(r.text)}</textarea><button class="btn full" style="margin-top:10px" data-act="bxsendreview">Post review</button>`; },
    bxdispute() { return `<h3>Report a problem</h3><p class="mut sm" style="margin-bottom:8px">SemaChat reviews disputes within the 14-day window and can refund you.</p><textarea rows="3" data-bind="bx.dp.reason" placeholder="What went wrong?">${esc(bx.dp.reason)}</textarea><button class="btn full" style="margin-top:10px" data-act="bxsenddispute">Submit dispute</button>`; }
  };
  const _sv = window.sheetView;
  window.sheetView = function () { const n = S.sheet && S.sheet.n; return SH[n] ? `<div class="shade" data-act="closesheet"></div><div class="sheet"><div class="grip"></div>${SH[n]()}</div>` : _sv(); };

  /* ------------------------------------------------------------------ actions */
  const done = async msg => { if (msg) toast(msg); await reload(); };
  Object.assign(acts, {
    bxopen(d) { return go('bizpage', { id: d.id }); },
    bxadopen(d) { return guard(async () => { await api('POST', '/api/ads/' + d.id + '/click'); await go('bizpage', { id: d.o }); }); },
    bxfollow(d) { return guard(async () => { const r = await api('POST', '/api/biz/pages/' + d.id + '/follow'); await done(r.following ? '✓ Following' : 'Unfollowed'); }); },
    bxmsg(d) { return guard(async () => { const r = await api('POST', '/api/biz/pages/' + d.id + '/chat'); await go('chat', { id: r.chatId }); }); },
    bxchat(d) { return go('chat', { id: d.id }); },
    bxwatch() { toast('▶ Playing video (sample)'); },
    bxqty(d) { const it = bx.pg.items.find(i => i.id === d.id), c = cartOf(d.o), q = Math.max(0, Math.min(it.stock == null ? 20 : Math.min(20, it.stock), (c[d.id] || 0) + (+d.v))); if (q) c[d.id] = q; else delete c[d.id]; render(); },
    bxbasket(d) { S.sheet = { n: 'bxcart', o: d.id }; render(); },
    bxpay(d) { return guard(async () => { const cart = cartOf(d.o), items = Object.keys(cart).map(id => ({ id, qty: cart[id] })); const o = await api('POST', '/api/biz/pages/' + d.o + '/order', { items, note: bx.note }); bx.cart[d.o] = {}; bx.note = ''; S.sheet = null; await done('🎉 Order #' + o.number + ' placed. Paid from your wallet; refunded if declined.'); }); },
    bxitem(d) { const it = d.id && bx.cat.find(i => i.id === d.id); bx.f = it ? { id: it.id, kind: it.kind, name: it.name, price: String(it.price), stock: it.stock == null ? '' : String(it.stock), duration: String(it.duration || 60), desc: it.desc || '', emoji: it.emoji } : { id: '', kind: 'product', name: '', price: '', stock: '10', duration: '60', desc: '', emoji: '' }; S.sheet = { n: 'bxitem' }; render(); },
    bxkind(d) { bx.f.kind = d.v; render(); },
    bxsaveitem() { const f = bx.f; return guard(async () => { const body = { kind: f.kind, name: f.name, price: f.price, stock: f.stock, duration: f.duration, desc: f.desc, emoji: f.emoji }; if (f.id) await api('PATCH', '/api/biz/catalog/' + f.id, body); else await api('POST', '/api/biz/catalog', body); S.sheet = null; await done(f.id ? 'Saved' : 'Added to your catalog'); }); },
    bxtoggle(d) { return guard(async () => { await api('PATCH', '/api/biz/catalog/' + d.id, { active: d.v === '1' }); await done(); }); },
    bxdel(d) { if (!confirm('Delete this item?')) return; return guard(async () => { await api('DELETE', '/api/biz/catalog/' + d.id); await done('Deleted'); }); },
    bxsavepage() { return guard(async () => { await api('PATCH', '/api/biz/page', { emoji: bx.pf.emoji, about: bx.pf.about, hours: bx.pf.hours, area: bx.pf.area }); bx.pf.touched = false; await done('Page saved'); }); },
    bxreply(d) { bx.rf = { id: d.id, text: '' }; S.sheet = { n: 'bxreply' }; render(); },
    bxsendreply() { return guard(async () => { await api('POST', '/api/biz/reviews/' + bx.rf.id + '/reply', { text: bx.rf.text }); S.sheet = null; await done('Reply sent'); }); },
    bxad() { bx.af = { name: '', headline: '', objective: 'visits', itemId: '', dailyBudget: '200', days: '7' }; S.sheet = { n: 'bxad' }; render(); },
    bxobj(d) { bx.af.objective = d.v; render(); },
    bxsavead() { return guard(async () => { await api('POST', '/api/biz/ads', bx.af); S.sheet = null; await done('📣 Submitted for review. Budget held from your wallet.'); }); },
    bxadact(d) { return guard(async () => { const r = await api('POST', '/api/biz/ads/' + d.id + '/' + d.v); await done(d.v === 'stop' ? 'Stopped. ' + money(r.refunded || 0) + ' refunded' : d.v === 'simulate-day' ? '⏩ A day of delivery added' : 'Updated'); }); },
    bxhist() { return guard(async () => { const r = await api('POST', '/api/biz/demo-history'); await done('Loaded ' + r.orders + ' sample orders and two weeks of traffic'); }); },
    bxreview(d) { bx.rv = { id: d.id, stars: 5, text: '' }; S.sheet = { n: 'bxreview' }; render(); },
    bxstar(d) { bx.rv.stars = +d.v; render(); },
    bxsendreview() { return guard(async () => { await api('POST', '/api/me/orders/' + bx.rv.id + '/review', { rating: bx.rv.stars, text: bx.rv.text }); S.sheet = null; await done('Thanks for your review ⭐'); }); },
    bxdispute(d) { bx.dp = { id: d.id, reason: '' }; S.sheet = { n: 'bxdispute' }; render(); },
    bxsenddispute() { return guard(async () => { await api('POST', '/api/me/orders/' + bx.dp.id + '/dispute', { reason: bx.dp.reason }); S.sheet = null; await done('Dispute submitted. We will review it.'); }); }
  });
  // the chat-start helper used by other screens passes `id`; keep old behaviour for go() with params
  const _go = acts.go; acts.go = d => d.id ? go(d.p, { id: d.id }) : _go(d);

  /* ------------------------------------------------------------------ admin */
  window.aAds = function () {
    const l = S.a.ads || [];
    return `<h2>Ad review</h2><p class="lead">Approve campaigns before they run. Spend becomes platform revenue as ads deliver.</p><div class="pn"><table class="tbl"><tr><th>Campaign</th><th>Business</th><th>Budget</th><th>Spent</th><th>Views</th><th>Clicks</th><th>Status</th><th></th></tr>${l.map(a => { const s = ST[a.status] || [a.status, 'b']; return `<tr><td><b>${esc(a.name)}</b><div class="mut sm">${esc(a.headline)}</div></td><td>${esc(a.business || '')}</td><td>${money(a.budget)}</td><td>${money(a.spent)}</td><td>${a.impressions.toLocaleString()}</td><td>${a.clicks}</td><td><span class="tagb ${s[1]}">${s[0]}</span></td><td>${a.status === 'pending_review' ? `<button class="btn sm gr" data-act="a_adact" data-id="${a.id}" data-v="approve">Approve</button> <button class="btn sm alt" data-act="a_adact" data-id="${a.id}" data-v="reject">Reject</button>` : a.status === 'active' ? `<button class="btn sm alt" data-act="a_adact" data-id="${a.id}" data-v="pause">Pause</button> <button class="btn sm alt" data-act="a_adact" data-id="${a.id}" data-v="reject">Stop & refund</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="8" class="mut">No campaigns yet.</td></tr>'}</table></div>`;
  };
  window.aDisputes = function () {
    const l = S.a.disputes || [];
    return `<h2>Disputes</h2><p class="lead">Customers can dispute an accepted order within 14 days. A refund returns the money to the customer and recovers the business's net payout.</p><div class="pn"><table class="tbl"><tr><th>Order</th><th>Customer</th><th>Business</th><th>Amount</th><th>Reason</th><th>Status</th><th></th></tr>${l.map(x => `<tr><td>#${x.number}</td><td>${esc(x.customer || '')}</td><td>${esc(x.business || '')}</td><td>${money(x.amount)}</td><td>${esc(x.reason)}</td><td><span class="tagb ${x.status === 'open' ? 'o' : 'b'}">${x.status}</span></td><td>${x.status === 'open' ? `<button class="btn sm gr" data-act="a_dpact" data-id="${x.id}" data-v="refund">Refund</button> <button class="btn sm alt" data-act="a_dpact" data-id="${x.id}" data-v="dismiss">Dismiss</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="mut">No disputes.</td></tr>'}</table></div>`;
  };
  adm.adact = async d => { let reason = ''; if (d.v === 'reject') { reason = prompt('Reason shown to the business:', 'Does not meet the ad policy.'); if (reason == null) return; } await api('POST', '/api/admin/ads/' + d.id, { action: d.v, reason }, true); toast('Ad ' + d.v + (d.v === 'approve' ? 'd' : 'ed')); await adminBoot(); };
  adm.dpact = async d => { await api('POST', '/api/admin/disputes/' + d.id, { action: d.v }, true); toast(d.v === 'refund' ? 'Refunded the customer' : 'Dispute dismissed'); await adminBoot(); };

  if (S.token && S.me) render();
})();
