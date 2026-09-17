
window.AKUN_GOOGLE = window.AKUN_GOOGLE || {
aktif: true,
clientId: '1093622424912-nmkq3j5boa6tgf834qp6903i8vnet14a.apps.googleusercontent.com',
lingkup: 'openid email profile'
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
// Ruang akun = database pribadi pengguna di server aplikasi (menggantikan Google Drive).
// Token akses ikut dikirim; server memeriksanya langsung ke Google sebelum membuka ruang,
// jadi klaim identitas dari peramban tidak pernah dipercaya begitu saja.
try { if (typeof dbMasuk === 'function') dbMasuk(idToken || '', __gToken); } catch (e) {}
render();
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
window.kartuGoogle = function () {
if (!googleSiap()) {
return '<div class="card">' +
'<div class="hari-head">' + ic('user', 16) + ' <strong>Masuk dengan Google</strong><span class="hari-tgl">opsional</span></div>' +
'<div class="hari-sub">Belum diaktifkan. Bila nanti diaktifkan, kamu bisa masuk sekali klik supaya progres ' +
'dan kode aksesmu tersimpan otomatis di ruang akunmu — jadi bisa dibuka dari HP lain.</div>' +
'</div>';
}
var a = __gAkun || bacaAkunTersimpan();
if (!a) {
return '<div class="card">' +
'<div class="hari-head">' + ic('user', 16) + ' <strong>Masuk dengan Google</strong><span class="hari-tgl">opsional</span></div>' +
'<div class="hari-sub">Masuk sekali klik agar progres, nilai, dan kode aksesmu tersimpan otomatis di ruang akunmu ' +
'(bisa dilanjutkan dari HP lain). Izin yang diminta hanya identitas: nama, surel, dan foto — aplikasi tidak ' +
'mengakses berkas apa pun milikmu. Latihan tetap bisa dipakai tanpa masuk.</div>' +
'<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="masukkanGoogle()">' +
ic('user', 14) + ' Masuk dengan Google</button>' +
'</div>';
}
return '<div class="card">' +
'<div class="hari-head">' + ic('user', 16) + ' <strong>' + escapeHtml(a.nama || a.email) + '</strong>' +
'<span class="hari-tgl">tersambung</span></div>' +
'<div class="hari-sub">Progres, nilai, dan kode aksesmu tersimpan otomatis di ruang akun ini, bisa dilanjutkan ' +
'dari perangkat lain. Data belajar tetap ada di perangkat ini walau kamu keluar.</div>' +
'<div class="aksi-bar" style="margin-top:10px">' +
'<button class="btn btn-ghost btn-sm" onclick="keluarGoogle()">' + ic('x-circle', 14) + ' Keluar</button>' +
'</div>' +
'<div class="hari-sub" style="margin-top:10px">Mencabut izin Google bisa dilakukan kapan saja di myaccount.google.com/permissions.</div>' +
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
