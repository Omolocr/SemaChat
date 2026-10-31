// Brand assets (icon + opening video). Shared by build.js (inlines them as data URIs for the single-file preview)
// and server.js (serves them as normal files under /assets and /manifest.webmanifest).
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'frontend', 'assets');
const b64 = (f, mime) => 'data:' + mime + ';base64,' + fs.readFileSync(path.join(DIR, f)).toString('base64');
const THEME = '#22c000';

const ICONS = [{ src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/assets/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' }, { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }];
// two installable apps: the client app and (separately) the developer console
const MANIFEST = { id: '/', name: 'SemaChat', short_name: 'SemaChat', description: 'Chat, community and life planner', start_url: '/?source=pwa', scope: '/', display: 'standalone', orientation: 'any',
  background_color: THEME, theme_color: THEME, categories: ['social', 'productivity'], icons: ICONS };
const CONSOLE_MANIFEST = { id: '/console', name: 'SemaChat Developer Console', short_name: 'Sema Console', description: 'SemaChat developer console (team only)', start_url: '/console?source=pwa', scope: '/console',
  display: 'standalone', background_color: '#10150f', theme_color: '#22c000', icons: ICONS };

function fill(html, mode, app) {
  app = app === 'console' ? 'console' : 'client';
  const inline = mode === 'inline';
  const u = (f, mime) => inline ? b64(f, mime) : '/assets/' + f;
  const icons = `<meta name="theme-color" content="${THEME}"><link rel="icon" type="image/png" sizes="32x32" href="${u('icon-32.png', 'image/png')}"><link rel="icon" type="image/png" sizes="192x192" href="${u('icon-192.png', 'image/png')}"><link rel="apple-touch-icon" href="${u('icon-180.png', 'image/png')}">` + (inline ? '' : '<link rel="manifest" href="' + (app === 'console' ? '/console.webmanifest' : '/manifest.webmanifest') + '"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="' + (app === 'console' ? 'Sema Console' : 'SemaChat') + '"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">');
  // one source, two separate apps: the client app never contains the developer console code, and the console has no phone home screen / splash
  const cut = (h, tag) => h.replace(new RegExp('<!--' + tag + '-->[\\s\\S]*?<!--/' + tag + '-->', 'g'), '');
  if (app === 'client') html = html.replace(/\/\*@ADMIN-BEGIN\*\/[\s\S]*?\/\*@ADMIN-END\*\//, 'const adm={};function adminBoot(){}function renderAdmin(){}');
  else html = cut(html, 'CLIENTONLY');
  html = html.split('<!--PWA-->').join(inline ? '' : '<script>' + fs.readFileSync(path.join(DIR, '..', 'pwa.js'), 'utf8') + '</script>');
  html = html.split('<!--CLIENTONLY-->').join('').split('<!--/CLIENTONLY-->').join('')
    .split('{{APP}}').join(app).split('{{PREVIEW}}').join(inline ? 'true' : 'false')
    .split('{{TITLE}}').join(app === 'console' ? 'SemaChat Developer Console' : 'SemaChat')
    .split('{{HEADTITLE}}').join(app === 'console' ? '🛠️ SemaChat Developer Console' : '🌍 SemaChat');
  return html.split('<!--ICONS-->').join(icons)
    .split('{{ICON64}}').join(u('icon-64.png', 'image/png'))
    .split('{{ICON192}}').join(u('icon-192.png', 'image/png'))
    .split('{{SHOW_HOME}}').join(inline ? 'true' : 'false')
    .split('{{SPLASH_VIDEO}}').join(u('splash.mp4', 'video/mp4'))
    .split('{{SPLASH_POSTER}}').join(u('splash-poster.jpg', 'image/jpeg'));
}
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };
module.exports = { fill, MANIFEST, CONSOLE_MANIFEST, DIR, TYPES };
