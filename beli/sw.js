const CACHE = "beli-pwa-v3";
// /beli/ + /beli/index.html TIDAK di-cache: Worker menukar copy A/B server-side via
// cookie sp_beli_var (spesifikasi-ab-beli.md) — HTML varian yang ter-cache akan
// membekukan satu varian untuk pengunjung berulang. script.js juga selalu lewat
// jaringan supaya tag beacon varian ikut terbaru.
const ASSETS = ["/beli/manifest.json", "/beli/sw.js", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const jalur = new URL(e.request.url).pathname;
  if (jalur === "/beli/" || jalur === "/beli" || jalur === "/beli/index.html" || jalur === "/beli/script.js") return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === self.location.origin) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  })));
});
