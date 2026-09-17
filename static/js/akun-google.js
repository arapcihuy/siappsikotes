
window.AKUN_GOOGLE = window.AKUN_GOOGLE || {
aktif: true,
clientId: '1093622424912-nmkq3j5boa6tgf834qp6903i8vnet14a.apps.googleusercontent.com',
driveSync: true,
namaBerkas: 'siappsikotes-cadangan.json',
lingkup: 'openid email profile https://www.googleapis.com/auth/drive.appdata'
};
window.__gToken = null;
window.__gAkun = null;
window.__gSkrip = false;
window.googleSiap = function () {
return !!(AKUN_GOOGLE && AKUN_GOOGLE.aktif && AKUN_GOOGLE.clientId);
};
window.googleMasuk = function () {
return !!__gToken;
};
function bacaAkunTersimpan() {
try {
var a = JSON.parse(localStorage.getItem('tni_google_akun') || 'null');
// catatan tanpa surel sah (mis. sisa percobaan masuk yang gagal) dianggap belum masuk
return a && a.email && a.email.indexOf('@') > 0 ? a : null;
} catch (e) { return null; }
}
function simpanAkun(a) {
try {
if (a) localStorage.setItem('tni_google_akun', JSON.stringify(a));
else localStorage.removeItem('tni_google_akun');
} catch (e) {}
}
window.uraiTokenGoogle = function (jwt) {
try {
var bagian = String(jwt).split('.');
if (bagian.length < 2) return null;
var s = bagian[1].replace(/-/g, '+').replace(/_/g, '/');
while (s.length % 4) s += '=';
var isi = JSON.parse(decodeURIComponent(escape(atob(s))));
return { email: isi.email || '', nama: isi.name || '', foto: isi.picture || '', sub: isi.sub || '' };
} catch (e) { return null; }
};
function muatSkripGoogle() {
if (__gSkrip || (window.google && google.accounts)) return Promise.resolve();
return new Promise(function (selesai, gagal) {
var s = document.createElement('script');
s.src = 'https://accounts.google.com/gsi/client';
s.async = true; s.defer = true;
s.onload = function () { __gSkrip = true; selesai(); };
s.onerror = function () { gagal(new Error('skrip Google gagal dimuat')); };
document.head.appendChild(s);
});
}
function pakaiAkunGoogle(a, idToken) {
__gAkun = a;
simpanAkun(a);
try { if (typeof dbMasuk === 'function') dbMasuk(idToken || ''); } catch (e) {}
render();
if (AKUN_GOOGLE.driveSync) {
var sudahPunya = (typeof punyaAkses === 'function') && punyaAkses();
if (!sudahPunya && typeof googleAmbilDariDrive === 'function') {
googleAmbilDariDrive(true);
} else {
googleKirimKeDrive(true);
}
}
}
function selesaikanMasukGoogle(idToken) {
var a = uraiTokenGoogle(idToken);
if (a && a.email && a.email.indexOf('@') > 0) { pakaiAkunGoogle(a, idToken); return; }
// Sebagian peramban tidak menyertakan id_token di alur token. Jangan menyerah:
// baca profil dari API userinfo memakai token akses yang sudah kita pegang.
fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + __gToken } })
.then(function (r) { return r.ok ? r.json() : null; })
.then(function (p) {
if (p && p.email) {
pakaiAkunGoogle({ email: p.email, nama: p.name || '', foto: p.picture || '', sub: p.sub || '' }, idToken);
} else {
alert('Masuk ke Google berhasil, tetapi email tidak terbaca. Coba lagi ya, atau pakai kode akses.');
}
})
.catch(function () {
alert('Tidak bisa membaca email dari Google sekarang. Coba lagi ya, atau pakai kode akses.');
});
}
window.masukkanGoogle = function () {
if (!googleSiap()) { alert('Fitur Masuk dengan Google belum diaktifkan pemilik.'); return; }
muatSkripGoogle().then(function () {
var klien = google.accounts.oauth2.initTokenClient({
client_id: AKUN_GOOGLE.clientId,
scope: AKUN_GOOGLE.lingkup,
prompt: 'consent',
callback: function (jawab) {
if (jawab && jawab.access_token) {
__gToken = jawab.access_token;
selesaikanMasukGoogle(jawab.id_token || '');
} else {
alert('Masuk dibatalkan atau gagal. Bahan belajarmu tetap aman di perangkat ini.');
}
}
});
klien.requestAccessToken();
}).catch(function (e) {
alert('Tidak bisa memuat layanan Google sekarang. Aplikasi tetap jalan seperti biasa.');
});
};
window.keluarGoogle = function () {
if (!confirm('Keluar dari Google? Bahan belajar di perangkat ini tetap ada.')) return;
try {
if (__gToken && window.google && google.accounts && google.accounts.oauth2) {
google.accounts.oauth2.revoke(__gToken, function () {});
}
} catch (e) {}
try { if (typeof dbKeluar === 'function') dbKeluar(); } catch (e) {}
__gToken = null; __gAkun = null; simpanAkun(null);
render();
};
function cariBerkasCadangan() {
var q = encodeURIComponent("name='" + AKUN_GOOGLE.namaBerkas + "'");
return fetch('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1&fields=files(id,name)&q=' + q, {
headers: { Authorization: 'Bearer ' + __gToken }
}).then(function (r) { return r.ok ? r.json() : { files: [] }; })
.then(function (j) { return (j.files && j.files[0]) || null; });
}
window.googleKirimKeDrive = function (manual) {
if (!googleMasuk()) return Promise.resolve(false);
var data = '';
try {
data = (typeof kodeSinkron === 'function') ? kodeSinkron() : '';
} catch (e) { data = ''; }
if (!data) return Promise.resolve(false);
var isi = JSON.stringify({ aplikasi: 'SiapPsikotes', versi: 1, waktu: new Date().toISOString(), data: data });
return cariBerkasCadangan().then(function (ada) {
if (ada) {
return fetch('https://www.googleapis.com/upload/drive/v3/files/' + ada.id + '?uploadType=media', {
method: 'PATCH',
headers: { Authorization: 'Bearer ' + __gToken, 'Content-Type': 'application/json' },
body: isi
});
}
var batas = 'siappsikotes' + Date.now();
var badan = '--' + batas + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
JSON.stringify({ name: AKUN_GOOGLE.namaBerkas, parents: ['appDataFolder'] }) + '\r\n--' + batas +
'\r\nContent-Type: application/json\r\n\r\n' + isi + '\r\n--' + batas + '--';
return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
method: 'POST',
headers: { Authorization: 'Bearer ' + __gToken, 'Content-Type': 'multipart/related; boundary=' + batas },
body: badan
});
}).then(function (r) {
if (r && r.ok) {
try { localStorage.setItem('tni_drive_sinkron', new Date().toISOString()); } catch (e) {}
if (manual) alert('Bahan belajarmu sudah tersalin ke Google Drive milikmu.');
return true;
}
if (manual) alert('Gagal menyalin ke Drive. Coba lagi, atau tetap pakai kode ruang belajar.');
return false;
}).catch(function () {
if (manual) alert('Tidak bisa menghubungi Google. Aplikasi tetap jalan seperti biasa.');
return false;
});
};
window.terapkanBundel = function (bundel, senyap) {
var paket = null;
try { paket = JSON.parse(decodeURIComponent(escape(atob(String(bundel).trim())))); } catch (e) { paket = null; }
if (!paket || paket.v !== 1 || typeof paket.data !== 'object' || paket.data === null) {
if (!senyap) alert('Cadangan tidak terbaca.');
return { ok: false, alasan: 'format' };
}
if (JSON.stringify(paket.data).length > 3000000) {
if (!senyap) alert('Cadangan terlalu besar; dibatalkan demi keamanan.');
return { ok: false, alasan: 'terlalu besar' };
}
var daftar = (typeof KUNCI_SINKRON !== 'undefined' && KUNCI_SINKRON) ? KUNCI_SINKRON : null;
if (!daftar) return { ok: false, alasan: 'daftar kunci tidak tersedia' };
var n = 0;
Object.keys(paket.data).forEach(function (k) {
if (daftar.indexOf(k) === -1) return;
var v = paket.data[k];
if (typeof v !== 'string' || v.length > 500000) return;
try { localStorage.setItem(k, v); n++; } catch (e) {}
});
return { ok: n > 0, jumlah: n };
};
window.googleAmbilDariDrive = function (senyap) {
if (!googleMasuk()) { alert('Masuk dengan Google dulu.'); return; }
cariBerkasCadangan().then(function (ada) {
if (!ada) {
// mode senyap (otomatis usai masuk akun) tidak boleh mengganggu dengan pesan ini
if (!senyap) alert('Belum ada cadangan di Drive untuk akun ini.');
return;
}
return fetch('https://www.googleapis.com/drive/v3/files/' + ada.id + '?alt=media', {
headers: { Authorization: 'Bearer ' + __gToken }
}).then(function (r) { return r.text(); }).then(function (teks) {
var bundel = null;
try { bundel = JSON.parse(teks).data; } catch (e) { bundel = teks; }
if (!bundel) { if (!senyap) alert('Cadangan tidak terbaca.'); return; }
if (!senyap && !confirm('Pulihkan bahan belajar dari Drive? Data di perangkat ini akan diganti.')) return;
var hasil = window.terapkanBundel(bundel, senyap);
if (hasil && hasil.ok) {
try { localStorage.setItem('tni_pulih_dari_drive', new Date().toISOString()); } catch (e) {}
if (senyap) { location.reload(); return; }
alert('Bahan belajarmu dipulihkan (' + hasil.jumlah + ' bagian). Halaman akan dimuat ulang.');
location.reload();
} else if (!senyap) {
alert('Cadangan tidak bisa diterapkan.');
}
});
});
};
window.kartuGoogle = function () {
if (!googleSiap()) {
return '<div class="card">' +
'<div class="hari-head">' + ic('user', 16) + ' <strong>Masuk dengan Google</strong><span class="hari-tgl">opsional</span></div>' +
'<div class="hari-sub">Belum diaktifkan. Bila nanti diaktifkan, kamu bisa masuk sekali klik supaya salinan ' +
'bahan belajarmu tersimpan di Google Drive milikmu sendiri — jadi bisa dibuka dari HP lain. ' +
'Kami tidak menyimpan datamu di server kami.</div>' +
'</div>';
}
var a = __gAkun || bacaAkunTersimpan();
if (!a) {
return '<div class="card">' +
'<div class="hari-head">' + ic('user', 16) + ' <strong>Masuk dengan Google</strong><span class="hari-tgl">opsional</span></div>' +
'<div class="hari-sub">Masuk sekali klik agar salinan bahan belajarmu tersimpan di Google Drive milikmu sendiri ' +
'(bisa dibuka dari perangkat lain). Latihan tetap bisa dipakai tanpa masuk.</div>' +
'<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="masukkanGoogle()">' +
ic('user', 14) + ' Masuk dengan Google</button>' +
'</div>';
}
var sinkron = '';
try { sinkron = localStorage.getItem('tni_drive_sinkron') || ''; } catch (e) {}
return '<div class="card">' +
'<div class="hari-head">' + ic('user', 16) + ' <strong>' + escapeHtml(a.nama || a.email) + '</strong>' +
'<span class="hari-tgl">tersambung</span></div>' +
'<div class="hari-sub">Salinan bahan belajarmu disimpan di folder aplikasi pada Google Drive milikmu' +
(sinkron ? ' (terakhir: ' + escapeHtml(sinkron.slice(0, 10)) + ')' : '') + '.</div>' +
'<div class="aksi-bar" style="margin-top:10px">' +
'<button class="btn btn-secondary btn-sm" onclick="googleKirimKeDrive(true)">' + ic('upload', 14) + ' Salin ke Drive</button>' +
'<button class="btn btn-secondary btn-sm" onclick="googleAmbilDariDrive()">' + ic('download', 14) + ' Pulihkan dari Drive</button>' +
'<button class="btn btn-ghost btn-sm" onclick="keluarGoogle()">' + ic('x-circle', 14) + ' Keluar</button>' +
'</div>' +
'<div class="hari-sub" style="margin-top:10px">Data belajar tetap ada di perangkat ini walau kamu keluar. ' +
'Mencabut izin Google bisa dilakukan kapan saja di myaccount.google.com/permissions.</div>' +
'</div>';
};
(function () {
var lama = window.renderAkun;
if (typeof lama !== 'function') return;
window.renderAkun = function () {
var html = lama.apply(this, arguments);
try {
var kartu = kartuGoogle();
var i = html.lastIndexOf('</div>');
if (i >= 0) html = html.slice(0, i) + kartu + html.slice(i);
} catch (e) {}
return html;
};
})();
