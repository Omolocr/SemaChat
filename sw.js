/* SemaChat service worker: lets the app be installed on phones, tablets and desktops and open fast.
   It never stores API calls, sign-in data or the live stream: only the page shell and brand assets. */
const VERSION = 'semachat-v1';
const SHELL = ['/', '/console', '/install', '/assets/icon-192.png', '/assets/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname === '/sw.js') return;
  if (r.mode === 'navigate') {            // pages: always try the network first so updates arrive at once, fall back to the last copy offline
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('/'))));
    return;
  }
  if (u.pathname.startsWith('/assets/')) {  // icons and the opening video: serve the saved copy, refresh it quietly
    e.respondWith(caches.match(r).then(m => { const net = fetch(r).then(res => { if (res.ok && res.status === 200) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); } return res; }).catch(() => m); return m || net; }));
  }
});
