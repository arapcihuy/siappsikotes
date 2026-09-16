(function () {
window.SOAL_DATABASE = window.SOAL_DATABASE || {};
window.SOAL_PART = window.SOAL_PART || {};
var INDEX = window.DATA_SOAL_INDEX || {};
var memuat = {};
var pakaiCadangan = false;
function versiAset() {
var s = document.querySelector('script[src*="data-loader.js"]');
if (!s) return '21';
var m = String(s.getAttribute('src') || '').match(/[?&]v=([^&]+)/);
return m ? m[1] : '21';
}
window.daftarKategori = function () {
return Object.keys(INDEX).filter(function (k) { return k !== 'total'; });
};
window.namaKategori = function (k) {
if (SOAL_DATABASE[k] && SOAL_DATABASE[k].nama) return SOAL_DATABASE[k].nama;
if (INDEX[k] && INDEX[k].nama) return INDEX[k].nama;
return k;
};
window.jumlahSoal = function (k) {
if (SOAL_DATABASE[k] && SOAL_DATABASE[k].soal) return SOAL_DATABASE[k].soal.length;
return (INDEX[k] && INDEX[k].jumlah) || 0;
};
window.katSiap = function (k) {
return !!(SOAL_DATABASE[k] && SOAL_DATABASE[k].soal && SOAL_DATABASE[k].soal.length);
};
window.katSiapSemua = function () {
return window.daftarKategori().every(katSiap);
};
window.totalSoal = function () {
if (katSiapSemua()) return getAllSoal().length;
return INDEX.total || 0;
};
window.getAllSoal = function () {
var all = [];
Object.keys(SOAL_DATABASE).forEach(function (k) {
var v = SOAL_DATABASE[k];
if (!v || !v.soal) return;
v.soal.forEach(function (s) {
all.push(Object.assign({}, s, { kategori: v.nama }));
});
});
return all;
};
function pakai(kat) {
if (!SOAL_DATABASE[kat] && window.SOAL_PART[kat]) SOAL_DATABASE[kat] = window.SOAL_PART[kat];
}
function muatSkrip(src) {
return new Promise(function (resolve, reject) {
var s = document.createElement('script');
s.src = src;
s.async = true;
s.onload = function () { resolve(true); };
s.onerror = function () { reject(new Error('gagal memuat ' + src)); };
document.head.appendChild(s);
});
}
function muatCadangan() {
if (pakaiCadangan) return Promise.resolve();
pakaiCadangan = true;
return muatSkrip('data/soal-penuh.js?v=' + versiAset()).catch(function () {});
}
window.pastikanKategori = function (kat) {
if (kat === 'all') return window.pastikanSemua();
if (katSiap(kat)) return Promise.resolve();
if (memuat[kat]) return memuat[kat];
memuat[kat] = muatSkrip('data/soal-' + kat + '.js?v=' + versiAset())
.then(function () {
pakai(kat);
if (!katSiap(kat)) return muatCadangan();
})
.catch(function () {
return muatCadangan();
});
return memuat[kat];
};
window.pastikanSemua = function () {
return Promise.all(window.daftarKategori().map(function (k) { return window.pastikanKategori(k); }));
};
// IQ Lab: generator soal (data/soal-iq.js) sengaja TIDAK dimuat di awal supaya
// beban muat pertama tetap ringan. Baru diunduh saat halaman IQ dibuka.
var memuatIQ = null;
window.pastikanIQ = function () {
if (typeof window.IQ_GEN !== 'undefined') return Promise.resolve(true);
if (memuatIQ) return memuatIQ;
memuatIQ = muatSkrip('data/soal-iq.js?v=' + versiAset())
.then(function () { return typeof window.IQ_GEN !== 'undefined'; })
.catch(function () { memuatIQ = null; return false; });
return memuatIQ;
};
window.htmlMemuat = function (pesan) {
return '<div class="empty"><div class="empty-icon">' + icon('refresh', 40) + '</div><p>' +
escapeHtml(pesan || 'Menyiapkan soal...') + '</p></div>';
};
window.addEventListener('load', function () {
setTimeout(function () {
if (!katSiapSemua()) window.pastikanSemua();
}, 400);
});
})();
