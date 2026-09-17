
window.BAHAN_BELAJAR = [
{ k: 'tni_wrong',          nama: 'Soal yang perlu diulang',    jenis: 'kunci-banyak' },
{ k: 'tni_soal_stat',      nama: 'Statistik tiap soal',        jenis: 'kunci-banyak' },
{ k: 'tni_wawancara',      nama: 'Catatan wawancara',          jenis: 'kunci-banyak' },
{ k: 'tni_gambar_riwayat', nama: 'Riwayat latihan tes gambar', jenis: 'daftar' },
{ k: 'tni_gambar_terakhir',nama: 'Gambar latihan terakhir',    jenis: 'ada' },
{ k: 'tni_hafal',          nama: 'Kartu hafalan',              jenis: 'kunci-banyak' },
{ k: 'tni_psi_progress',   nama: 'Riwayat tes psikologi',      jenis: 'daftar' },
{ k: 'tni_iq_log',         nama: 'Log latihan IQ',             jenis: 'daftar' },
{ k: 'tni_scores',         nama: 'Nilai tryout',               jenis: 'daftar' },
{ k: 'tni_laporan',        nama: 'Laporan soal yang kamu tandai', jenis: 'daftar' },
{ k: 'tni_prog',           nama: 'Kemajuan per kategori',      jenis: 'kunci-banyak' },
{ k: 'tni_harian',         nama: 'Catatan harian belajar',     jenis: 'kunci-banyak' },
{ k: 'tni_profil',         nama: 'Profil & target',            jenis: 'objek' },
{ k: 'tni_sesi_aktif',     nama: 'Sesi yang belum selesai',    jenis: 'objek' }
];
function bacaKunci(k, jenis) {
try {
var mentah = localStorage.getItem(k);
if (!mentah) return null;
if (jenis === 'daftar') { var a = JSON.parse(mentah); return { jumlah: Array.isArray(a) ? a.length : 1 }; }
if (jenis === 'kunci-banyak') { var o = JSON.parse(mentah); return { jumlah: Object.keys(o || {}).length }; }
if (jenis === 'ada') return { jumlah: 1 };
var x = JSON.parse(mentah);
return { jumlah: (x && typeof x === 'object') ? Object.keys(x).length || 1 : 1 };
} catch (e) { return null; }
}
window.ringkasBahanBelajar = function () {
var hasil = [];
BAHAN_BELAJAR.forEach(function (b) {
var r = bacaKunci(b.k, b.jenis);
if (r) hasil.push({ kunci: b.k, nama: b.nama, jumlah: r.jumlah });
});
return hasil;
};
window.hapusBahan = function (kunci, nama) {
if (!confirm('Hapus "' + nama + '"? Data ini tidak bisa dikembalikan.')) return;
try { localStorage.removeItem(kunci); } catch (e) {}
render();
};
window.hapusSemuaBahan = function () {
if (!confirm('Hapus SELURUH data belajar di perangkat ini? Bahan belajarmu akan hilang semua.')) return;
BAHAN_BELAJAR.forEach(function (b) { try { localStorage.removeItem(b.k); } catch (e) {} });
try { localStorage.removeItem('tni_b5'); localStorage.removeItem('tni_jalur'); } catch (e) {}
render();
};
window.renderAkun = function () {
var p = (typeof bacaProfil === 'function') ? bacaProfil() : { nama: '' };
var bahan = ringkasBahanBelajar();
var kode = '';
try { kode = (typeof kodeSinkron === 'function') ? kodeSinkron() : ''; } catch (e) { kode = ''; }
var daftarBahan = bahan.length
? bahan.map(function (b) {
return '<div class="ulang-row"><div class="ulang-teks"><strong>' + escapeHtml(b.nama) + '</strong> ' +
'<span class="hari-sub">(' + b.jumlah + ' item)</span></div>' +
'<div class="ulang-aksi"><button class="btn btn-ghost btn-sm" onclick="hapusBahan(\'' + b.kunci + '\',\'' +
b.nama.replace(/'/g, '') + '\')">hapus</button></div></div>';
}).join('')
: '<div class="hari-sub">Belum ada bahan belajar tersimpan. Mulai satu sesi dulu.</div>';
return '<div class="card">' +
'<div class="hari-head">' + ic('user', 16) + ' <strong>Ruang belajar saya</strong>' +
'<span class="hari-tgl">' + (p.nama ? escapeHtml(p.nama) : 'tanpa nama') + '</span></div>' +
'<div class="hari-sub">Semua bahan belajarmu tersimpan <strong>di perangkat ini</strong>. Bila kamu memakai kode akses, salinannya ikut tersimpan dengan kunci kodemu supaya bisa dilanjutkan dari perangkat lain. ' +
'Tidak ada akun, tidak ada surel, dan tidak ada kata sandi yang perlu diingat.</div>' +
(p.nama ? '' : '<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="goHome()">Isi profil belajar dulu</button>') +
'</div>' +
'<div class="card">' +
'<div class="hari-head">' + ic('layers', 16) + ' <strong>Bahan belajarku</strong>' +
'<span class="hari-tgl">' + bahan.length + ' jenis</span></div>' +
daftarBahan +
(bahan.length ? '<button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="hapusSemuaBahan()">Hapus semua bahan</button>' : '') +
'</div>' +
'<div class="card">' +
'<div class="hari-head">' + ic('hash', 16) + ' <strong>Kode ruang belajar</strong>' +
'<span class="hari-tgl">untuk pindah perangkat</span></div>' +
'<div class="hari-sub">Ini "akunmu" tanpa kata sandi. Simpan kodenya (mis. di catatan pribadi). ' +
'Tempel kode ini di perangkat lain, dan seluruh bahan belajarmu ikut pindah. ' +
'Bila memakai kode akses, progres juga otomatis tersimpan dengan kunci kode itu. ' +
'Kode ini tidak dikirim ke mana pun dan tidak bisa dibaca orang lain tanpa kamu berikan.</div>' +
'<textarea class="profil-input" id="kodeku" rows="3" style="width:100%;margin-top:8px" readonly>' + escapeHtml(kode) + '</textarea>' +
'<div class="aksi-bar" style="margin-top:8px">' +
'<button class="btn btn-secondary btn-sm" onclick="salinKode()">' + ic('copy', 14) + ' Salin kode</button>' +
'<button class="btn btn-secondary btn-sm" onclick="salinBerkas()">' + ic('download', 14) + ' Unduh berkas cadangan</button>' +
'</div>' +
'<div class="hari-sub" style="margin-top:12px"><strong>Pindah ke perangkat ini?</strong> Tempel kodenya di bawah.</div>' +
'<textarea class="profil-input" id="kodeSinkron" rows="3" style="width:100%;margin-top:6px" ' +
'placeholder="Tempel kode ruang belajarmu di sini"></textarea>' +
'<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="pakaiKodeSinkron()">' +
ic('check', 14) + ' Pakai kode ini</button>' +
'</div>' +
'<div class="card">' +
'<div class="hari-head">' + ic('shield', 16) + ' <strong>Kenapa tidak pakai akun biasa</strong></div>' +
'<div class="hari-sub">Kode akses menggantikan akun: tidak ada surel, tidak ada kata sandi, dan tidak ada ' +
'yang perlu didaftarkan. Bahan belajarmu tersimpan dengan kunci kodemu supaya bisa dilanjutkan dari ' +
'perangkat lain — penjelasan lengkapnya ada di kebijakan privasi. Latihan tetap bisa dipakai walau ' +
'internet mati.</div>' +
'<div class="hari-sub" style="margin-top:8px">Kalau cara penyimpanan data berubah, kami umumkan lebih dulu ' +
'dan catatannya selalu ada di halaman kebijakan privasi.</div>' +
'<div class="aksi-bar" style="margin-top:10px">' +
'<button class="btn btn-ghost btn-sm" onclick="window.open(\'privasi/\',\'_blank\')">Baca kebijakan privasi</button>' +
'</div>' +
'</div>';
};
window.salinBerkas = function () {
if (typeof exportData === 'function') { exportData(); return; }
alert('Fitur cadangan belum tersedia.');
};
var _renderSebelumFitur14 = window.render;
window.render = function () {
if (_renderSebelumFitur14) _renderSebelumFitur14.apply(this, arguments);
try { sisipPanel14(); } catch (e) {}
};
function sisipPanel14() {
var m = document.getElementById('main');
if (!m) return;
if (S.page === 'akun') {
m.innerHTML = renderAkun();
return;
}
if (S.page === 'home' && !m.querySelector('.tautan-akun')) {
var kartu = m.querySelector('.profil');
if (kartu) {
var w = document.createElement('div');
w.className = 'tautan-akun';
w.innerHTML = '<button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="navTo(\'akun\')">' +
ic('user', 14) + ' Ruang belajar saya (bahan & kode)</button>';
kartu.appendChild(w);
}
}
}
