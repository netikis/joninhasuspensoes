/* Joninha Suspensões — PWA com atualização automática (PC + celular) */
var CACHE = 'joninha-suspensoes-v22';
var ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/config.js',
  './js/storage.js',
  './js/ui.js',
  './js/auth.js',
  './js/os.js',
  './js/nuvem.js',
  './js/caixa.js',
  './js/comissoes.js',
  './js/app.js',
  './assinar-joninha.html',
  './manifest.webmanifest',
  './firebase-config.js',
  './logo-joninha.jpg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE;
      }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Sempre busca na rede quando online. Cache só entra se estiver sem internet.
   Evita ficar preso em versão antiga (ex.: 1.3.18) depois do deploy. */
self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (cache) {
          cache.put(event.request, copy);
        });
      }
      return res;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        return cached || caches.match('./index.html');
      });
    })
  );
});
