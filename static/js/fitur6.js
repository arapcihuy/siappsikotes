
var TAUTAN_LAIN = [
{ t: 'Ruang belajar saya', k: 'akun', f: "navTo('akun')", ic: 'user' },
{ t: 'Tips & alur belajar', k: 'tips', f: "navTo('tips')", ic: 'bulb' },
{ t: 'Latihan IQ', k: 'iq', f: "navTo('iq')", ic: 'brain' },
{ t: 'Halaman psikotes (bagikan ke teman)', k: 'psikotes', f: "window.open('psikotes/','_blank')", ic: 'globe' },
{ t: 'Ringkasan Hafalan', k: 'ringkasan', f: 'bukaRingkasan()', ic: 'bulb' },
{ t: 'Hafalan Cepat (kartu)', k: 'hafalan', f: 'bukaHafalan()', ic: 'layers' },
{ t: 'Laporan soal', k: 'laporan', f: "navTo('prog')", ic: 'flag' },
{ t: 'Riwayat versi', k: 'riwayat', f: 'bukaRiwayat()', ic: 'file' },
{ t: 'Tentang & data', k: 'tentang', f: 'bukaTentang()', ic: 'shield' }
];
window.menuLainTerbuka = false;
window.bukaMenuLain = function () {
menuLainTerbuka = true;
var isi = TAUTAN_LAIN.map(function (l) {
return '<button class="menu-lain-item" onclick="tutupMenuLain();' + l.f + '">' +
ic(l.ic, 15) + ' <span>' + escapeHtml(l.t) + '</span></button>';
}).join('');
// Bila sedang masuk dengan Google, beri jalan keluar yang jelas dari menu ini juga.
try {
if (typeof bacaAkunGoogle === 'function' && bacaAkunGoogle()) {
isi += '<button class="menu-lain-item" onclick="tutupMenuLain();keluarGoogle()">' +
ic('x-circle', 15) + ' <span>Keluar dari Google</span></button>';
}
} catch (e) {}
var lama = document.getElementById('menuLain');
if (lama) lama.remove();
var d = document.createElement('div');
d.id = 'menuLain';
d.className = 'menu-lain-bg';
d.innerHTML = '<div class="menu-lain-box" role="dialog" aria-label="Menu lainnya">' +
'<div class="hari-head">' + ic('list', 15) + ' <strong>Menu lainnya</strong>' +
'<span class="hari-tgl">tekan di luar untuk menutup</span></div>' +
isi + '</div>';
d.addEventListener('click', function (e) { if (e.target === d) { menuLainTerbuka = false; d.remove(); } });
document.body.appendChild(d);
};
window.tutupMenuLain = function () {
var d = document.getElementById('menuLain');
if (d) d.remove();
menuLainTerbuka = false;
};
var ALUR = [
['Kerjakan satu sesi', 'Simulasi Format Seleksi (60 soal/90 menit) atau Mode Belajar satu kategori. Kunci disembunyikan selama tryout supaya hasilnya jujur, lalu terbuka di layar hasil.'],
['Baca pembahasan tiap soal salah', 'Setiap pembahasan berformat JAWABAN / cara mengerjakan / INGAT. Soal hitung memakai langkah eksplisit, soal bergambar kadang disertai gambar penjelasan bernomor.'],
['Ulangi soal yang jatuh tempo', 'Soal yang pernah salah dijadwalkan ulang 1-3-7-14-30 hari. Beranda menampilkan berapa yang jatuh tempo hari ini — ini bagian yang paling cepat menaikkan nilai.'],
['Latih yang lemah saja', 'Progress menampilkan topik terlemah dan Kesiapan Ujian. Pakai Latihan Adaptif (soal zona sulit) atau Mode 5 menit kalau waktu terbatas.'],
['Hafalkan kiatnya', 'Ringkasan Hafalan merangkum semua kiat dari pembahasan, dikelompokkan per bidang dan siap dicetak. Latihan kartu ada di Hafalan Cepat.'],
['Pantau kesiapan', 'Skor Kesiapan Ujian = perkiraan nilai + rentang. Setel target nilaimu (70-90) supaya status dan saran menyesuaikan.'],
['Tandai yang mencurigakan', 'Kalau ada soal yang terasa keliru, tekan Laporkan soal, lalu ekspor laporannya dari Progress untuk diaudit ulang.']
];
window.panelAlurTips = function () {
var li = ALUR.map(function (a, i) {
return '<div class="tur-item"><div class="tur-num">' + (i + 1) + '</div>' +
'<div><div class="tur-judul">' + escapeHtml(a[0]) + '</div><div class="hari-sub">' + escapeHtml(a[1]) + '</div></div></div>';
}).join('');
return '<div class="card" style="margin-bottom:14px">' +
'<div class="hari-head">' + ic('compass', 16) + ' <strong>Alur belajar yang dianjurkan</strong></div>' +
li +
'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
'<button class="btn btn-primary btn-sm" onclick="startSimulasiFormat()">' + ic('flag', 14) + ' Mulai simulasi</button>' +
'<button class="btn btn-secondary btn-sm" onclick="bukaRingkasan()">' + ic('bulb', 14) + ' Ringkasan hafalan</button>' +
'<button class="btn btn-ghost btn-sm" onclick="navTo(\'prog\')">' + ic('chart', 14) + ' Lihat kesiapan</button>' +
'</div></div>';
};
window.panelFiturBaru = function () {
var fitur = [
['Pengulangan berjadwal', 'Soal salah otomatis muncul lagi (1-3-7-14-30 hari) sampai benar terus.'],
['Latihan adaptif', 'Memprioritaskan soal dengan tingkat benarmu 40-75% — zona belajar paling efektif.'],
['Simulasi format seleksi', 'Komposisi tetap per kategori, kunci terkunci sampai sesi selesai.'],
['Kesiapan ujian + target', 'Perkiraan nilai dengan rentang, dinilai terhadap target yang kamu setel.'],
['Ringkasan hafalan', 'Semua kiat dari pembahasan, siap dicetak untuk dibaca ulang sebelum ujian.'],
['Laporan soal', 'Menandai soal yang dicurigai keliru supaya bisa diaudit ulang.'],
['Mode offline & sinkron', 'Bisa dipakai tanpa internet; pindah perangkat lewat kode sinkron.'],
['Jelang ujian 7 hari', 'Rencana pekan terakhir: hafalan + soal jatuh tempo + satu simulasi per hari.']
];
return '<div class="card" style="margin-bottom:14px">' +
'<div class="hari-head">' + ic('star', 16) + ' <strong>Fitur yang bisa kamu pakai</strong></div>' +
fitur.map(function (f) {
return '<div class="rencana-item" style="margin-bottom:8px"><span><strong>' + escapeHtml(f[0]) + '</strong> — ' + escapeHtml(f[1]) + '</span></div>';
}).join('') + '</div>';
};
window.jelangInfo = function () {
var mulai = localStorage.getItem('tni_jelang');
if (!mulai) return null;
var hari = fSelisihHari(mulai) + 1;
if (hari < 1) hari = 1;
return { mulai: mulai, hari: hari, selesai: hari > 7 };
};
window.mulaiJelang = function () {
localStorage.setItem('tni_jelang', fHariIni());
render();
};
window.akhiriJelang = function () {
if (!confirm('Akhiri mode Jelang Ujian 7 Hari?')) return;
localStorage.removeItem('tni_jelang');
render();
};
window.panelJelang = function () {
var j = jelangInfo();
if (!j) {
return '<div class="card latihan-card" style="border-style:dashed">' +
'<div class="hari-head">' + ic('flag', 16) + ' <strong>Jelang Ujian 7 Hari</strong></div>' +
'<div class="hari-sub">Ujian sudah dekat? Nyalakan mode ini: 7 hari terakhir tanpa materi baru — ' +
'hafalan, soal yang jatuh tempo, dan satu simulasi setiap hari.</div>' +
'<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="mulaiJelang()">Nyalakan mode jelang ujian</button>' +
'</div>';
}
var h = harian();
var ulang = (typeof jumlahUlang === 'function') ? jumlahUlang() : 0;
var langkah = [
{ t: 'Hafalan: baca Ringkasan Hafalan 15 menit', ok: true, f: 'bukaRingkasan()', b: 'Buka' },
{ t: 'Ulangi ' + (ulang > 0 ? ulang + ' soal yang jatuh tempo' : 'soal yang jatuh tempo (belum ada)'),
ok: ulang === 0 ? true : false, f: 'drillUlang()', b: 'Ulangi' },
{ t: 'Satu Simulasi Format Seleksi (60 soal/90 menit)', ok: h.tryout > 0, f: 'startSimulasiFormat()', b: 'Simulasi' },
{ t: 'Latihan topik terlemah (25 soal)', ok: false, f: "drillTopik((statTopik()[0]||{topik:'uud'}).topik, 25)", b: 'Latih' }
];
var li = langkah.map(function (l) {
return '<div class="tur-item"><div class="tur-num">' + (l.ok ? '✓' : '·') + '</div>' +
'<div style="flex:1"><div class="tur-judul">' + escapeHtml(l.t) + '</div></div>' +
'<button class="btn btn-ghost btn-sm" onclick="' + l.f + '">' + l.b + '</button></div>';
}).join('');
var persen = Math.min(100, Math.round((j.hari / 7) * 100));
return '<div class="card latihan-card">' +
'<div class="hari-head">' + ic('flag', 16) + ' <strong>Jelang Ujian — hari ' + Math.min(j.hari, 7) + ' / 7</strong>' +
'<span class="hari-tgl">' + (h.soal) + ' soal hari ini</span></div>' +
'<div class="hari-track"><div class="hari-bar" style="width:' + persen + '%"></div></div>' +
li +
(j.selesai ? '<div class="hari-aman">' + ic('check-circle', 14) + ' Tujuh hari sudah lewat. Semoga sukses!</div>' : '') +
'<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="akhiriJelang()">Akhiri mode jelang ujian</button>' +
'</div>';
};
var _renderSebelumFitur6 = window.render;
window.render = function () {
if (_renderSebelumFitur6) _renderSebelumFitur6.apply(this, arguments);
try { sisipPanel6(); } catch (e) {}
};
function sisipPanel6() {
var m = document.getElementById('main');
if (!m) return;
var bar = document.querySelector('.topbar-right');
if (bar && !document.getElementById('btnMenuLain')) {
var b = document.createElement('div');
b.id = 'btnMenuLain';
b.innerHTML = '<button class="btn btn-ghost btn-sm" onclick="bukaMenuLain()" aria-label="Menu lainnya" title="Menu lainnya">' + ic('list', 15) + ' Lainnya</button>';
bar.appendChild(b);
}
if (S.page === 'tips') {
var atas = m.querySelector('.tips-box') || m.firstElementChild;
if (atas && !m.querySelector('.alur-tips')) {
var w = document.createElement('div');
w.className = 'alur-tips';
w.innerHTML = panelAlurTips() + panelFiturBaru();
atas.insertAdjacentElement('beforebegin', w);
}
}
if (S.page === 'home') {
var kotak = m.querySelector('.grid-3');
if (kotak && !m.querySelector('.latihan-card.jelang')) {
var w2 = document.createElement('div');
w2.className = 'latihan-card jelang';
w2.innerHTML = panelJelang();
kotak.insertAdjacentElement('afterend', w2);
}
}
}
