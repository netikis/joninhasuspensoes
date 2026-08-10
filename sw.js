/* Joninha Suspensões — PWA com atualização automática (PC + celular) */
var CACHE = 'joninha-suspensoes-v20';
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

function isDocumento(request, url) {
  if (request.mode === 'navigate') return true;
  var path = url.pathname || '';
  return path.endsWith('/') ||
    path.endsWith('.html') ||
    path.endsWith('sw.js') ||
    path.endsWith('manifest.webmanifest') ||
    path.endsWith('firebase-env.js') ||
    path.endsWith('firebase-config.js');
}

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isDocumento(event.request, url)) {
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
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy);
          });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
