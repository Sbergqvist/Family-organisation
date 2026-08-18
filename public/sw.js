/**
 * Service worker: gør siden brugbar uden net og hurtig at åbne fra hjemmeskærmen.
 *
 * To regler holder den ude af ballade:
 *
 * 1. Sider hentes altid fra nettet først. Så ser man aldrig en gammel udgave,
 *    og en udløbet session sender én til loginskærmen som den skal. Først når
 *    nettet svigter, bruges den gemte kopi.
 * 2. /api/ og login røres aldrig. Synkronisering og adgangskontrol skal tale
 *    med serveren hver gang — et cachet svar ville være direkte forkert.
 *
 * Det gælder også filerne: css og js hentes fra nettet når der er net, og fra
 * cachen når der ikke er. Det koster nogle få hundrede millisekunder ved opstart,
 * men til gengæld kan man aldrig ende med at køre ny HTML mod gammel kode — og
 * dét er en langt værre oplevelse end et øjebliks ventetid.
 */

const VERSION = 'familieplan-v2';
const SHELL = [
  '/',
  '/index.html',
  '/assets/styles.css',
  '/assets/js/utils.js',
  '/assets/js/store.js',
  '/assets/js/render.js',
  '/assets/js/views/week.js',
  '/assets/js/views/month.js',
  '/assets/js/views/todo.js',
  '/assets/js/views/shopping.js',
  '/assets/js/views/settings.js',
  '/assets/js/sync.js',
  '/assets/js/app.js',
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(VERSION)
      /* Én fil der ikke kan hentes må ikke vælte hele installationen. */
      .then(function (cache) {
        return Promise.all(SHELL.map(function (url) {
          return cache.add(url).catch(function () { /* springes over */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (name) {
          return name === VERSION ? null : caches.delete(name);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/login' || url.pathname === '/logout') return;

  event.respondWith(networkFirst(request));
});

function networkFirst(request) {
  return fetch(request)
    .then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(VERSION).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    })
    .catch(function () {
      return caches.match(request).then(function (hit) {
        return hit || caches.match('/index.html');
      });
    });
}
