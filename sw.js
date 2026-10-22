// Service Worker — SiapPsikotes
// Strategi:
//  - HTML (navigasi): NETWORK-FIRST, supaya update situs langsung kelihatan.
//  - Aset (js/css/gambar/data): cache-first + update di belakang layar
//    (stale-while-revalidate) supaya tetap cepat & bisa offline.
const CACHE = 'siap-psikotes-11fcb2d';
const FILES = [
  './',
  './index.html',
  './manifest.json',
  './sitemap.xml',
  './robots.txt',
  './data/soal-bahasa_inggris.js?v=11fcb2d',
  './data/soal-index.js?v=11fcb2d',
  './data/soal-iq.js?v=11fcb2d',
  './data/soal-kepribadian.js?v=11fcb2d',
  './data/soal-kraepelin.js?v=11fcb2d',
  './data/soal-matematika.js?v=11fcb2d',
  './data/soal-numerik.js?v=11fcb2d',
  './data/soal-penalaran_logika.js?v=11fcb2d',
  './data/soal-penuh.js?v=11fcb2d',
  './data/soal-psikologi.js?v=11fcb2d',
  './data/soal-tes_gambar.js?v=11fcb2d',
  './data/soal-tkw.js?v=11fcb2d',
  './data/soal-verbal.js?v=11fcb2d',
  './data/soal.js?v=11fcb2d',
  './data/tips.js?v=11fcb2d',
  './static/css/style.css?v=11fcb2d',
  './static/js/app.js?v=11fcb2d',
  './static/js/batch2.js?v=11fcb2d',
  './static/js/data-loader.js?v=11fcb2d',
  './static/js/fitur.js?v=11fcb2d',
  './static/js/fitur2.js?v=11fcb2d',
  './static/js/fitur3.js?v=11fcb2d',
  './static/js/fitur4.js?v=11fcb2d',
  './static/js/fitur5.js?v=11fcb2d',
  './static/js/fitur6.js?v=11fcb2d',
  './static/js/fitur7.js?v=11fcb2d',
  './static/js/fitur8.js?v=11fcb2d',
  './static/js/fitur9.js?v=11fcb2d', './static/js/fitur10.js?v=11fcb2d', './static/js/fitur11.js?v=11fcb2d', './static/js/fitur12.js?v=11fcb2d', './static/js/fitur13.js?v=11fcb2d', './static/js/fitur14.js?v=11fcb2d', './static/js/akun-google.js?v=11fcb2d', './static/js/akses.js?v=11fcb2d', './static/js/sinkron-db.js?v=11fcb2d',
  './static/js/icons.js?v=11fcb2d',
  './static/js/mesin-soal.js?v=11fcb2d',
  './static/js/iq.js?v=11fcb2d',
  './static/js/psikologi.js?v=11fcb2d',
  './static/js/qrcode-generator.js?v=11fcb2d',
  './static/js/qris-dinamis.js?v=11fcb2d',
  './static/icons/apple-touch-icon-180.png?v=11fcb2d',
  './static/icons/favicon-32.png?v=11fcb2d',
  './static/icons/icon-192.png?v=11fcb2d',
  './static/icons/icon-512.png?v=11fcb2d',
  './static/icons/icon-maskable-512.png?v=11fcb2d'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // satu file gagal jangan sampai membatalkan seluruh instalasi PWA
      return Promise.all(FILES.map(function (u) {
        return c.add(u).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // 1) Navigasi / HTML: coba jaringan dulu, baru cache (offline)
  var isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') >= 0;
  if (isHTML) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) {
          return r || caches.match('./');
        });
      })
    );
    return;
  }

  // 2) Aset lain: sajikan dari cache, perbarui di belakang layar
  e.respondWith(
    caches.match(req).then(function (cached) {
      var jaringan = fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type !== 'opaque') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || jaringan;
    })
  );
});
