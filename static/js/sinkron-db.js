
window.AKUN_DB = window.AKUN_DB || {
api: 'https://siappsikotes-api.rasyidahmad180.workers.dev',
aktif: true,
jedaDorong: 4000          // tunda 4 detik setelah perubahan terakhir sebelum mendorong
};
var __dbToken = null;
var __dbPendorong = null;
var __dbSedangDorong = false;
function dbKunci() {
return ['tni_prog', 'tni_wrong', 'tni_scores', 'tni_to_total', 'tni_harian',
'tni_iq_log', 'tni_iq_meta', 'tni_iq_nb', 'tni_iq_sesi', 'tni_jalur_mulai', 'tni_psi_progress',
'tni_soal_riwayat', 'tni_kode_akses', 'tni_pembelian', 'tni_laporan_bayar',
'tni_wawancara', 'tni_hafal', 'tni_profil', 'tni_soal_stat', 'tni_gambar_riwayat', 'tni_laporan'];
}
window.dbTokenTersimpan = function () {
try { return localStorage.getItem('tni_sesi_db') || ''; } catch (e) { return ''; }
};
window.dbMasuk = function (idToken, accessToken) {
if (!AKUN_DB.aktif || (!idToken && !accessToken)) return Promise.resolve(false);
return fetch(AKUN_DB.api + '/api/masuk', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ id_token: idToken || '', access_token: accessToken || '' })
}).then(function (r) { return r.ok ? r.json() : null; })
.then(function (j) {
if (!j || !j.token) return false;
__dbToken = j.token;
try { localStorage.setItem('tni_sesi_db', j.token); } catch (e) {}
tampilkanStatusSinkron('Tersambung ke akunmu (' + (j.pengguna && j.pengguna.surel) + ')');
return dbTarik().then(function () { return dbDorongSekarang(); });
})
.catch(function () { tampilkanStatusSinkron('Database tidak terjangkau sekarang; latihan tetap jalan.'); return false; });
};
// Masuk memakai KODE AKSES: menyambung "ruang" progres milik kode itu di server.
// Satu kode = satu ruang; kode berbeda = ruang berbeda, jadi progres tiap pengguna terpisah.
window.dbMasukKode = function (kode) {
if (!AKUN_DB.aktif || !kode) return Promise.resolve(false);
// Bila sedang masuk dengan Google, rumah data pengguna = ruang akunnya (bukan ruang kode).
// Kode yang dimasukkan tetap tersimpan di perangkat dan ikut terkirim sebagai pembelian.
if (window.__gToken) return window.dbMasuk('', window.__gToken);
return fetch(AKUN_DB.api + '/api/ruang/masuk', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ kode: String(kode).toUpperCase() })
}).then(function (r) { return r.ok ? r.json() : null; })
.then(function (j) {
if (!j || !j.token) return false;
__dbToken = j.token;
try { localStorage.setItem('tni_sesi_db', j.token); } catch (e) {}
tampilkanStatusSinkron('Progresmu tersimpan pada kode ini.');
return dbTarik().then(function () { return dbDorongSekarang(); });
})
.catch(function () { tampilkanStatusSinkron('Database tidak terjangkau sekarang; latihan tetap jalan.'); return false; });
};
// Mengakhiri sesi sinkron (dipakai tombol "Keluar dari Google"): cabut sesinya di server
// bila asal diizinkan, lalu bersihkan sesi di perangkat. Tetap beres walau jaringan mati.
window.dbKeluar = function () {
var t = dbToken();
__dbToken = null;
try { localStorage.removeItem('tni_sesi_db'); } catch (e) {}
if (!t || !(window.asalSinkronDiizinkan && window.asalSinkronDiizinkan())) return Promise.resolve(true);
return fetch(AKUN_DB.api + '/api/keluar', {
method: 'POST',
headers: { 'Authorization': 'Bearer ' + t }
}).then(function () { return true; }).catch(function () { return true; });
};
window.dbHapusBahan = function (kunci) {
var t = dbToken();
if (!t || !(window.asalSinkronDiizinkan && window.asalSinkronDiizinkan())) return Promise.resolve(false);
return fetch(AKUN_DB.api + '/api/bahan/hapus', {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
body: JSON.stringify({ kunci: kunci })
}).catch(function () { return false; });
};
window.dbHapusSemuaBahan = function () {
var t = dbToken();
if (!t || !(window.asalSinkronDiizinkan && window.asalSinkronDiizinkan())) return Promise.resolve(false);
return fetch(AKUN_DB.api + '/api/bahan/semua/hapus', {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }
}).catch(function () { return false; });
};
function dbToken() {
if (__dbToken) return __dbToken;
__dbToken = dbTokenTersimpan();
return __dbToken;
}
window.dbsudahMasuk = function () { return !!dbToken(); };
function tampilkanStatusSinkron(pesan) {
try {
var el = document.getElementById('statusSinkronDb');
if (el) el.textContent = pesan;
} catch (e) {}
}
window.dbTarik = function () {
var t = dbToken();
if (!t) return Promise.resolve(false);
return fetch(AKUN_DB.api + '/api/saya', { headers: { Authorization: 'Bearer ' + t } })
.then(function (r) { return r.ok ? r.json() : null; })
.then(function (j) {
if (!j) return false;
var prog = {};
try { prog = JSON.parse(localStorage.getItem('tni_prog') || '{}'); } catch (e) {}
(j.progres || []).forEach(function (x) {
var b = x.benar || 0;
var s = x.salah || 0;
var tot = (x.total !== undefined) ? x.total : (b + s);
var lama = prog[x.kategori] || {};
prog[x.kategori] = {
total: Math.max(tot, lama.total || 0, (lama.benar || 0) + (lama.salah || 0)),
benar: Math.max(b, lama.benar || 0),
salah: Math.max(s, lama.salah || 0)
};
});
if (Object.keys(prog).length) {
try { localStorage.setItem('tni_prog', JSON.stringify(prog)); } catch (e) {}
}
var bankLama = {};
try {
var mentah = JSON.parse(localStorage.getItem('tni_wrong') || '{}');
if (mentah && typeof mentah === 'object' && !Array.isArray(mentah)) bankLama = mentah;
} catch (e) {}
var hari = new Date().toISOString().slice(0, 10);
(j.salah || []).forEach(function (x) {
if (!x.id_soal) return;
if (!bankLama[x.id_soal]) {
bankLama[x.id_soal] = { s: x.jumlah || 1, b: 0, tahap: 0, j: hari, t: x.terakhir ? String(x.terakhir).slice(0, 10) : hari };
} else {
bankLama[x.id_soal].s = Math.max(bankLama[x.id_soal].s || 0, x.jumlah || 1);
}
});
if (Object.keys(bankLama).length) {
try { localStorage.setItem('tni_wrong', JSON.stringify(bankLama)); } catch (e) {}
}
(j.bahan || []).forEach(function (x) {
try { localStorage.setItem(x.kunci, x.isi); } catch (e) {}
});
(j.pembelian || []).forEach(function (x) {
try {
if (x.kode) localStorage.setItem('tni_kode_akses', x.kode);
localStorage.setItem('tni_pembelian', JSON.stringify({ kode: x.kode, rujukan: x.rujukan,
nominal: x.nominal, dasar: x.nominal, tanggal: x.tanggal, produk: 'Akses penuh SiapPsikotes' }));
} catch (e) {}
});
tampilkanStatusSinkron('Data dari akunmu sudah ditarik.');
return true;
})
.catch(function () { return false; });
};
window.dbDorongSekarang = function (senyap) {
var t = dbToken();
if (!t || __dbSedangDorong) return Promise.resolve(false);
__dbSedangDorong = true;
var tugas = [];
var prog = {};
try { prog = JSON.parse(localStorage.getItem('tni_prog') || '{}'); } catch (e) {}
Object.keys(prog).forEach(function (k) {
var v = prog[k] || {};
var b = typeof v.benar === 'number' ? v.benar : 0;
var s = typeof v.salah === 'number' ? v.salah : Math.max(0, (typeof v.total === 'number' ? v.total : 0) - b);
tugas.push(fetch(AKUN_DB.api + '/api/progres', {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
body: JSON.stringify({ kategori: k, benar: b, salah: s })
}));
});
var salahRaw = null;
try { salahRaw = JSON.parse(localStorage.getItem('tni_wrong') || '{}'); } catch (e) {}
var ids = Array.isArray(salahRaw) ? salahRaw : (salahRaw && typeof salahRaw === 'object' ? Object.keys(salahRaw) : []);
ids.slice(0, 200).forEach(function (id) {
tugas.push(fetch(AKUN_DB.api + '/api/salah', {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
body: JSON.stringify({ id_soal: String(id) })
}));
});
var kode = '';
var bel = null;
try { kode = localStorage.getItem('tni_kode_akses') || ''; bel = JSON.parse(localStorage.getItem('tni_pembelian') || 'null'); } catch (e) {}
if (kode) {
tugas.push(fetch(AKUN_DB.api + '/api/pembelian', {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
body: JSON.stringify({ kode: kode, rujukan: (bel && bel.rujukan) || '', nominal: (bel && bel.nominal) || 0 })
}));
}
var pf = null;
try { pf = JSON.parse(localStorage.getItem('tni_profil') || 'null'); } catch (e) {}
if (pf && (pf.jalur || pf.target)) {
tugas.push(fetch(AKUN_DB.api + '/api/profil', {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
body: JSON.stringify({ jalur: pf.jalur || '', target_tanggal: pf.target || '' })
}));
}
// Sisa bahan belajar (nilai, log IQ, jalur, laporan, profil, wawancara, dsb.) ikut dikirim per kunci
['tni_scores', 'tni_to_total', 'tni_harian', 'tni_iq_log', 'tni_iq_meta', 'tni_iq_nb',
'tni_iq_sesi', 'tni_jalur_mulai', 'tni_psi_progress', 'tni_soal_riwayat', 'tni_laporan_bayar',
'tni_wawancara', 'tni_hafal', 'tni_profil', 'tni_soal_stat', 'tni_gambar_riwayat', 'tni_laporan']
.forEach(function (k) {
var v = null;
try { v = localStorage.getItem(k); } catch (e) {}
if (typeof v === 'string' && v.length && v.length <= 100000) {
tugas.push(fetch(AKUN_DB.api + '/api/bahan', {
method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
body: JSON.stringify({ jenis: 'kunci', kunci: k, isi: v })
}));
}
});
return Promise.all(tugas).then(function () {
__dbSedangDorong = false;
if (!senyap) tampilkanStatusSinkron('Data terkirim ke akunmu.');
return true;
}).catch(function () {
__dbSedangDorong = false;
if (!senyap) tampilkanStatusSinkron('Gagal mengirim sekarang; akan dicoba lagi.');
return false;
});
};
function jadwalkanDorong() {
if (!dbsudahMasuk()) return;
if (__dbPendorong) clearTimeout(__dbPendorong);
__dbPendorong = setTimeout(function () { dbDorongSekarang(true); }, AKUN_DB.jedaDorong);
}
(function () {
if (window.__dbTerpasang) return;
window.__dbTerpasang = true;
var kunci = dbKunci();
var setAsli = localStorage.setItem.bind(localStorage);
localStorage.setItem = function (k, v) {
setAsli(k, v);
if (kunci.indexOf(k) !== -1) jadwalkanDorong();
};
window.addEventListener('online', function () { if (dbsudahMasuk()) dbDorongSekarang(true); });
// Sinkronisasi hanya diizinkan server dari asal tertentu (daftar ini HARUS sama dengan
// SITUS di server/src/index.js). Dari asal lain - mis. peladen uji berport acak -
// permintaannya pasti ditolak; lebih baik tidak dicoba sama sekali daripada
// memunculkan galat CORS di konsol.
window.asalSinkronDiizinkan = function () {
try {
var o = String(location.origin || '');
return ['https://siappsikotes.my.id', 'https://www.siappsikotes.my.id', 'https://arapcihuy.github.io',
'http://localhost:8000', 'http://127.0.0.1:8000'].indexOf(o) !== -1;
} catch (e) { return false; }
};
// Sambung otomatis ke ruang kode dari kunjungan sebelumnya: bila ada kode tersimpan
// (atau dibuka dengan kode pengembang) dan belum ada sesi, daftarkan sekali lagi.
setTimeout(function () {
try {
if (dbTokenTersimpan()) return;
var kode = '';
try { kode = localStorage.getItem('tni_kode_akses') || ''; } catch (e) {}
if (!kode && localStorage.getItem('tni_akses_pemilik') === '1' &&
typeof AKSES !== 'undefined' && AKSES.kodePengembang) kode = AKSES.kodePengembang;
if (kode && typeof window.dbMasukKode === 'function' && window.asalSinkronDiizinkan()) window.dbMasukKode(kode);
} catch (e) {}
}, 1500);
})();
window.renderPemilik = function () {
var t = dbToken();
if (!t) {
return '<div class="card"><div class="hari-head">' + ic('shield', 16) +
' <strong>Dasbor pemilik</strong></div><div class="hari-sub">Masuk dengan Google memakai akun pemilik ' +
'untuk melihat data pengguna.</div></div>';
}
return '<div class="card" id="kartuPemilik"><div class="hari-head">' + ic('chart', 16) +
' <strong>Dasbor pemilik</strong><span class="hari-tgl" id="pemilikWaktu">memuat...</span></div>' +
'<div id="pemilikIsi" class="hari-sub">Mengambil ringkasan dari database...</div></div>';
};
window.muatDasborPemilik = function () {
var t = dbToken();
var isi = document.getElementById('pemilikIsi');
if (!t || !isi) return;
fetch(AKUN_DB.api + '/api/pemilik/ringkasan', { headers: { Authorization: 'Bearer ' + t } })
.then(function (r) { return r.ok ? r.json() : null; })
.then(function (j) {
if (!j) { isi.innerHTML = '<div class="hari-sub">Hanya akun pemilik yang bisa membuka ringkasan ini.</div>'; return; }
var baris = (j.pengguna || []).map(function (u) {
return '<div class="ulang-row"><div class="ulang-teks"><strong>' + escapeHtml(u.surel || '-') + '</strong>' +
'<div class="hari-sub">terakhir aktif: ' + escapeHtml(String(u.terakhir_aktif || '').slice(0, 16).replace('T', ' ')) +
' · benar: ' + (u.total_benar || 0) + ' · salah: ' + (u.total_salah || 0) +
' · pembelian: ' + (u.jumlah_pembelian || 0) + '</div></div></div>';
}).join('');
isi.innerHTML = '<div class="hari-sub">Total pengguna: <strong>' + (j.total_pengguna || 0) +
'</strong> · aktif hari ini: <strong>' + (j.aktif_hari_ini || 0) + '</strong></div>' +
(baris || '<div class="hari-sub">Belum ada pengguna yang masuk.</div>');
var w = document.getElementById('pemilikWaktu');
if (w) w.textContent = new Date().toLocaleTimeString('id-ID');
})
.catch(function () { isi.innerHTML = '<div class="hari-sub">Tidak bisa menghubungi database sekarang.</div>'; });
};
(function () {
var lamaRender = window.render;
if (typeof lamaRender === 'function') {
window.render = function () {
if (S.page === 'pemilik') {
var m = document.getElementById('main');
if (m) {
m.innerHTML = renderPemilik();
muatDasborPemilik();
return;
}
}
return lamaRender.apply(this, arguments);
};
}
if (typeof window.renderAkun === 'function') {
var lamaAkun = window.renderAkun;
window.renderAkun = function () {
var html = lamaAkun.apply(this, arguments);
try {
var a = (typeof bacaAkunGoogle === 'function') ? bacaAkunGoogle() : null;
var pemilik = !!(a && a.email && AKSES.pemilik.map(function (x) { return x.toLowerCase(); })
.indexOf(String(a.email).toLowerCase()) !== -1);
if (pemilik && dbsudahMasuk()) {
var tautan = '<div class="card"><div class="hari-head">' + ic('chart', 16) +
' <strong>Dasbor pemilik</strong><span class="hari-tgl">khusus kamu</span></div>' +
'<div class="hari-sub">Lihat ringkasan pengguna: siapa aktif, terakhir belajar kapan, nilai, dan pembelian.</div>' +
'<div class="aksi-bar" style="margin-top:10px">' +
'<button class="btn btn-secondary btn-sm" onclick="navTo(\'pemilik\')">Buka dasbor</button></div></div>';
var i = html.lastIndexOf('</div>');
if (i >= 0) html = html.slice(0, i) + tautan + html.slice(i);
}
} catch (e) {}
return html;
};
}
})();
