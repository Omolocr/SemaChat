/* Install helper (server mode only): registers the service worker and shows an "Install app" button on phones, tablets and desktops. */
(function () {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () { /* the app still works without it */ }); });
  var standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone) return;
  var ev = null, bar = null;
  function pill(text, onclick, dismiss) {
    if (bar) bar.remove();
    bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:14px;z-index:99990;background:#22c000;color:#fff;border-radius:30px;padding:10px 16px;font:600 14px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.35);display:flex;gap:12px;align-items:center;max-width:92vw';
    var b = document.createElement('span'); b.textContent = text; bar.appendChild(b);
    if (onclick) { bar.style.cursor = 'pointer'; b.onclick = onclick; }
    var x = document.createElement('span'); x.textContent = '✕'; x.setAttribute('aria-label', 'Hide'); x.style.cssText = 'opacity:.8;padding:0 2px;cursor:pointer';
    x.onclick = function (e) { e.stopPropagation(); bar.remove(); try { sessionStorage.setItem('sc_pwa_hide', '1'); } catch (_) { } }; bar.appendChild(x);
    document.body.appendChild(bar);
  }
  var hidden = false; try { hidden = sessionStorage.getItem('sc_pwa_hide') === '1'; } catch (_) { }
  if (hidden) return;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); ev = e;
    pill('⬇️ Install SemaChat on this device', function () { ev.prompt(); ev.userChoice.finally(function () { ev = null; if (bar) bar.remove(); }); });
  });
  window.addEventListener('appinstalled', function () { if (bar) bar.remove(); });
  var ua = navigator.userAgent, ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) setTimeout(function () { if (!ev) pill('Install: tap Share, then “Add to Home Screen”'); }, 2500);
})();
