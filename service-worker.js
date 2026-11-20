const scope = self.registration.scope;
const prefix = 'kleine-dinge:' + scope + ':';
const cacheName = prefix + 'v2.0.32';
const shell = new URL('index.html', scope).href;
const files = [
  'index.html', 'style.css', 'app.js', 'store.js', 'emoji.js', 'manifest.webmanifest', 'icon.svg',
  'icon-180.png', 'icon-192.png', 'icon-512.png', 'plattenecke.webp'
].map(file => new URL(file, scope).href);

self.addEventListener('install', event => {
  const requests = files.map(url => new Request(url, { cache: 'reload' }));
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(requests)));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names
    .filter(name => name.startsWith(prefix) && name !== cacheName)
    .map(name => caches.delete(name)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return;
  if (request.mode === 'navigate') {
    const url = new URL(request.url);
    if (![scope, shell].includes(url.origin + url.pathname)) return;
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match(shell) ?? fetch(request)));
  } else if (files.includes(request.url)) {
    event.respondWith(caches.open(cacheName).then(async cache => await cache.match(request.url) ?? fetch(request)));
  }
});
