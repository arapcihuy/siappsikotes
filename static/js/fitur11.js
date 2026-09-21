
window.BAYAR = {
aktif: true,              // ubah jadi true setelah detail pembayaran diisi
harga: 'Rp 39.000',
hargaMusiman: 'Rp 79.000',
metode: '',                // mis. 'QRIS' atau 'Transfer BRI 1234567890 a/n Nama'
kontak: '',                // mis. 'WhatsApp 08xx-xxxx-xxxx' atau surel
tautan: '',
catatanTautan: '',
catatanQris: 'Pindai dengan aplikasi bank atau e-wallet apa pun (GoPay, OVO, DANA, ShopeePay, m-banking). Nominal yang harus dibayar tertera di bawah.',
tautanBayar: '',           // halaman checkout platform (QR ditampilkan dari tautan ini)                // tautan marketplace bila ada (Shopee/Tokopedia)
gambarQris: 'static/img/qris-bayar.png',           // diisi bila pemilik mengirim gambar QRIS (tools/pasang-bayar.py --qris)
rekening: 'Bank Mandiri 1370022256982 a/n RASYID ACHMAD FAUZI',
tampilkanRekening: false,
whatsapp: '6281387906930', // nomor WhatsApp pemilik, format 62812xxxxxxx
surel: 'rasyidahmad180@gmail.com',   // surel penerima bukti
instruksi: []              // langkah bayar; bila kosong dipakai langkah baku di bawah
};
window.LAPORAN_BAYAR_AKTIF = false;
window.HARGA_LAPORAN = 'Rp 39.000';
window.TAUTAN_BELI = '';           // diisi pemilik: tautan marketplace/QRIS
window.KERJA_COCOK = {
E: { tinggi: 'Pekerjaan yang banyak berhubungan dengan orang: pemasaran, penjualan, pelayanan, pengajaran, humas.',
rendah: 'Pekerjaan yang butuh fokus sendiri: analis data, penulis, pengembang, riset, akuntansi teknis.' },
A: { tinggi: 'Pekerjaan yang menuntut kerja sama: tim layanan, sumber daya manusia, kesehatan, pendidikan.',
rendah: 'Pekerjaan yang menuntut ketegasan: audit, penegakan aturan, negosiasi, pengawasan mutu.' },
C: { tinggi: 'Hampir semua posisi menilai sifat ini tinggi — teratur, tepat waktu, bisa diandalkan.',
rendah: 'Pilih lingkungan dengan alur kerja jelas dan gunakan pengingat; hindari posisi yang menuntut ketelitian tinggi tanpa dukungan sistem.' },
N: { tinggi: 'Cari lingkungan kerja yang tenang dan terprediksi; latih teknik menenangkan diri sebelum wawancara dan tes.',
rendah: 'Kamu tahan tekanan — cocok untuk posisi dengan tenggat ketat dan situasi cepat berubah.' },
O: { tinggi: 'Pekerjaan yang butuh gagasan baru: perencanaan, desain, riset, produk, pengembangan.',
rendah: 'Pekerjaan dengan prosedur tetap: operasional, administrasi, keuangan, pengawasan.' }
};
window.SKRIP_WAWANCARA = [
{ t: 'Kalau ditanya "apa kelemahanmu?"',
s: 'Sebutkan satu hal nyata yang sedang kamu perbaiki, lalu tunjukkan langkahnya. Contoh: "Saya cenderung terlalu detail sehingga kadang lambat; saya atasi dengan menetapkan batas waktu per tugas dan memakai daftar prioritas." Jangan bilang "tidak ada kelemahan", dan jangan menyebut kelemahan yang bertentangan dengan inti pekerjaan.' },
{ t: 'Kalau ditanya soal kerja sama tim',
s: 'Ceritakan satu kejadian nyata dengan pola: situasi, tugasmu, tindakanmu, hasilnya. Pilih cerita di mana kamu mendengarkan orang lain lebih dulu, lalu menyimpulkan bersama.' },
{ t: 'Kalau ditanya kenapa memilih instansi ini',
s: 'Sebutkan hal spesifik dari instansi itu (tugas, wilayah, atau nilai kerjanya) dan hubungkan dengan kesiapanmu. Hindari jawaban umum seperti "ingin mengabdi" tanpa alasan konkret.' },
{ t: 'Kalau penguji menekan ("kamu sepertinya belum siap")',
s: 'Tetap tenang, jangan membela diri berlebihan. Jawab: akui bagian yang benar, sebutkan bukti kesiapanmu, dan tanyakan hal yang perlu kamu perbaiki. Yang dinilai adalah cara kamu menanggapi tekanan.' }
];
window.RENCANA_14_HARI = function (lemah, lemahKategori) {
var fokus = lemah.length ? lemah : ['pancasila', 'uud', 'silogisme'];
var kat = lemahKategori.length ? lemahKategori : ['Wawasan Kebangsaan'];
var hari = [];
for (var d = 1; d <= 14; d++) {
var t;
if (d % 7 === 0) t = 'Simulasi penuh 110 soal / 100 menit, lalu bahas SEMUA soal yang salah hari itu.';
else if (d % 7 === 3) t = 'Baterai psikotes: Kraepelin 3 kolom + ' + (d % 2 ? 'Digit Span 2 ronde' : 'Daya Ingat 2 ronde') + '.';
else if (d <= 10) t = 'Latihan terarah + ulangi soal salah dari topik: ' + fokus[(d - 1) % fokus.length] + '.';
else t = 'Ulangan soal salah saja (tanpa materi baru) + tes kepribadian untuk latihan konsistensi.';
hari.push({ h: d, t: t });
}
return hari;
};
window.dataLaporan = function () {
var b5 = b5Terakhir();
var kesiapan = (typeof hitungKesiapan === 'function') ? hitungKesiapan() : null;
var stat = (typeof statTopik === 'function') ? statTopik() : [];
var lemah = stat.slice(0, 3).map(function (x) { return x.topik; });
var lemahKat = [];
if (typeof semuaStat === 'function' && typeof getAllSoal === 'function') {
var st = semuaStat(), peta = {};
getAllSoal().forEach(function (q) {
var s = st[q.id]; if (!s || !q.kategori) return;
var p = peta[q.kategori] || (peta[q.kategori] = { b: 0, s: 0 });
p.b += s.b || 0; p.s += s.s || 0;
});
lemahKat = Object.keys(peta).map(function (k) {
var t = peta[k].b + peta[k].s;
return { k: k, persen: t ? Math.round((peta[k].b / t) * 100) : 0, total: t };
}).filter(function (x) { return x.total >= 5; }).sort(function (a, b) { return a.persen - b.persen; })
.slice(0, 3).map(function (x) { return x.k; });
}
var salah = (typeof semuaSoalSalah === 'function') ? semuaSoalSalah() : [];
return { b5: b5, kesiapan: kesiapan, lemahTopik: lemah, lemahKategori: lemahKat, jumlahSalah: salah.length,
profil: (typeof bacaProfil === 'function') ? bacaProfil() : { nama: '' } };
};
window.jumlahSalahTersimpan = function () {
if (typeof bankSalah !== 'function') return 0;
try { return Object.keys(bankSalah()).length; } catch (e) { return 0; }
};
window.isiLaporanLengkap = function () {
var d = dataLaporan();
var nama = d.profil.nama ? escapeHtml(d.profil.nama) : 'Pengguna';
var hariIni = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
var b = '';
b += '<div class="lap-head"><h1>Laporan Lengkap — SiapPsikotes</h1>' +
'<div class="lap-sub">' + nama + ' · ' + hariIni + '</div></div>';
b += '<h2>1. Kesiapan ujianmu</h2>';
if (d.kesiapan) {
b += '<p>Skor kesiapan saat ini <strong>' + (d.kesiapan.nilai || 0) + '</strong> dari 100, ' +
'dihitung dari soal yang sudah kamu kerjakan, bukan dari lama belajar.</p>';
if (d.kesiapan.rincian) {
b += '<table class="lap-tabel"><tr><th>Bagian</th><th>Nilai</th></tr>';
Object.keys(d.kesiapan.rincian).forEach(function (k) {
b += '<tr><td>' + escapeHtml(k) + '</td><td>' + d.kesiapan.rincian[k] + '</td></tr>';
});
b += '</table>';
}
} else {
b += '<p>Belum cukup data. Kerjakan minimal satu simulasi dan 30 soal latihan supaya angkanya bermakna.</p>';
}
b += '<h2>2. Kepribadianmu (Big Five)</h2>';
if (d.b5) {
var skor = d.b5.skor;
b += '<table class="lap-tabel"><tr><th>Sifat</th><th>Skor</th><th>Arti singkat</th></tr>';
Object.keys(skor).forEach(function (k) {
var f = FAKTOR_B5[k];
b += '<tr><td>' + f.nama + '</td><td>' + skor[k].skor + ' / ' + skor[k].maks +
' (' + skor[k].persen + '%)</td><td>' + f.arti + '</td></tr>';
});
b += '</table>';
b += '<h3>Cocok untuk pekerjaan seperti apa</h3><ul>';
Object.keys(skor).forEach(function (k) {
var f = KERJA_COCOK[k];
b += '<li><strong>' + FAKTOR_B5[k].nama + '</strong>: ' +
(skor[k].persen >= 50 ? f.tinggi : f.rendah) + '</li>';
});
b += '</ul>';
} else {
b += '<p>Kamu belum mengerjakan tes kepribadian. Buka Baterai Psikotes → Tes Kepribadian (4 menit), ' +
'lalu buat laporan ini lagi.</p>';
}
b += '<h2>3. Bagian yang perlu kamu kejar</h2>';
if (d.lemahTopik.length) {
b += '<p>Topik dengan jawaban benar paling rendah: <strong>' + d.lemahTopik.map(escapeHtml).join(', ') + '</strong>.</p>';
} else {
b += '<p>Belum ada cukup data per topik (butuh minimal 3 soal per topik).</p>';
}
if (d.lemahKategori.length) {
b += '<p>Kategori paling lemah: <strong>' + d.lemahKategori.map(escapeHtml).join(', ') + '</strong>.</p>';
}
b += '<p>Jumlah soal yang sedang kamu ulang: <strong>' + window.jumlahSalahTersimpan() + '</strong> soal.</p>';
b += '<h2>4. Rencana latihan 14 hari</h2><table class="lap-tabel"><tr><th>Hari</th><th>Yang dikerjakan</th></tr>';
RENCANA_14_HARI(d.lemahTopik, d.lemahKategori).forEach(function (r) {
b += '<tr><td>' + r.h + '</td><td>' + escapeHtml(r.t) + '</td></tr>';
});
b += '</table>';
b += '<h2>5. Cara menjawab di wawancara</h2>';
SKRIP_WAWANCARA.forEach(function (s) {
b += '<p><strong>' + escapeHtml(s.t) + '</strong><br>' + escapeHtml(s.s) + '</p>';
});
b += '<h2>6. Batas laporan ini</h2><p>Laporan ini disusun dari data latihanmu sendiri di perangkat ini. ' +
'Tes kepribadian memakai Mini-IPIP (IPIP, domain publik) dengan terjemahan sederhana yang belum ' +
'divalidasi pada orang Indonesia, jadi hasilnya menggambarkan penilaianmu tentang dirimu sendiri — ' +
'bukan diagnosis psikologi dan bukan penentu kelulusan. Aplikasi ini tidak berafiliasi dengan instansi mana pun.</p>';
b += '<div class="lap-aksi"><button class="btn btn-primary btn-sm" onclick="window.print()">Cetak / simpan PDF</button>' +
'<button class="btn btn-secondary btn-sm" onclick="unduhLaporan()">Unduh berkas laporan</button></div>';
return b;
};
window.unduhLaporan = function () {
var isi = '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Laporan Lengkap SiapPsikotes</title>' +
'<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:820px;margin:32px auto;padding:0 20px;' +
'color:#12181f;line-height:1.6}h1{font-size:26px}h2{font-size:19px;margin-top:28px;border-bottom:1px solid #e3e8ee;padding-bottom:6px}' +
'.lap-tabel{width:100%;border-collapse:collapse;margin:12px 0}.lap-tabel th,.lap-tabel td{border-bottom:1px solid #e3e8ee;' +
'padding:8px;text-align:left;font-size:14px}.lap-aksi{display:none}.lap-sub{color:#5a6b7b}</style></head><body>' +
document.getElementById('main').innerHTML + '</body></html>';
if (typeof unduhBerkas === 'function') unduhBerkas('laporan-lengkap-' + new Date().toISOString().slice(0, 10) + '.html', isi, 'text/html');
};
window.KUNCI_KODE = ['siap', 'psikotes', '2026', 'kode'].join('|');
function sidikKode(data) {
var h = 2166136261;
var s = String(data) + '#' + KUNCI_KODE;
for (var i = 0; i < s.length; i++) {
h = h ^ s.charCodeAt(i);
h = Math.imul(h, 16777619) >>> 0;
}
var pos = h % 1679616;                 // 36^4
var abjad = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
var hasil = '';
while (pos > 0) { hasil = abjad.charAt(pos % 36) + hasil; pos = Math.floor(pos / 36); }
while (hasil.length < 4) hasil = '0' + hasil;
return hasil;
}
window.periksaKode = function (kode) {
var bersih = String(kode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
if (bersih.indexOf('SP') !== 0 || bersih.length < 8) return { sah: false, alasan: 'Format kode tidak dikenali.' };
var isi = bersih.slice(2, bersih.length - 4);
var cek = bersih.slice(-4);
if (sidikKode(isi) === cek) return { sah: true };
return { sah: false, alasan: 'Kode tidak cocok. Periksa kembali huruf dan angkanya.' };
};
window.kirimBuktiBayar = function () {
var kb = kodeBayar();
var pesan = 'Halo, saya ingin membeli Laporan Lengkap SiapPsikotes.\n' +
'Kode rujukan: ' + kb.rujukan + '\n' +
'Nominal dibayar: ' + rupiah(kb.nominal) + '\n' +
'Bukti pembayaran saya lampirkan di bawah ini. Mohon kirim kode aksesnya. Terima kasih.';
try {
if (BAYAR.whatsapp) {
window.open('https://wa.me/' + String(BAYAR.whatsapp).replace(/[^0-9]/g, '') +
'?text=' + encodeURIComponent(pesan), '_blank');
return;
}
if (BAYAR.surel) {
window.open('mailto:' + BAYAR.surel + '?subject=' + encodeURIComponent('Bukti pembayaran ' + kb.rujukan) +
'&body=' + encodeURIComponent(pesan), '_blank');
return;
}
} catch (e) {}
alert('Kontak pengiriman bukti belum diisi pemilik.');
};
window.bukaLaporanDenganKode = function () {
var el = document.getElementById('kodeAkses');
var hasil = periksaKode(el ? el.value : '');
if (!hasil.sah) { alert(hasil.alasan); return; }
try {
localStorage.setItem('tni_laporan_bayar', JSON.stringify({
kode: String(el.value).trim().toUpperCase(), tanggal: new Date().toISOString().slice(0, 10)
}));
} catch (e) {}
render();
};
window.laporanSudahDibuka = function () {
try { return !!JSON.parse(localStorage.getItem('tni_laporan_bayar') || 'null'); } catch (e) { return false; }
};
window.kodeBayar = function () {
// Angka rujukan harus bertahan walau penyimpanan peramban diblokir: kalau berubah
// tiap muat halaman, pembeli bisa membayar nominal yang tidak lagi cocok dengan
// kode rujukan yang ia kirim. Karena itu angkanya juga ditulis ke alamat halaman
// (#sp-594), yang tetap ada sesudah muat ulang.
var angka = '';
var dariAlamat = /^#sp-(\d{3})$/.exec(location.hash || '');
if (dariAlamat) angka = dariAlamat[1];
var ada = null;
try { ada = JSON.parse(localStorage.getItem('tni_kode_bayar') || 'null'); } catch (e) {}
if (!angka && ada && /^\d{3}$/.test(String(ada.angka))) angka = String(ada.angka);
if (!angka) angka = String(Math.floor(Math.random() * 900) + 100);
ada = { angka: angka, waktu: (ada && ada.waktu) || new Date().toISOString() };
try { localStorage.setItem('tni_kode_bayar', JSON.stringify(ada)); } catch (e) {}
try {
if (location.hash !== '#sp-' + angka && window.history && history.replaceState) {
history.replaceState(null, '', location.pathname + location.search + '#sp-' + angka);
}
} catch (e) {}
var dasar = 39000;
var m = String(BAYAR.harga || 'Rp 39.000').match(/[\d.]+/g);
if (m) {
var angkaHarga = parseInt(String(m[0]).replace(/\./g, ''), 10);
if (angkaHarga > 1000) dasar = angkaHarga;
}
return { rujukan: 'SP-' + angka, nominal: dasar + parseInt(angka, 10), dasar: dasar };
};
function rupiah(n) { return 'Rp ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
(function () {
if (document.getElementById('gaya-qris')) return;
var st = document.createElement('style');
st.id = 'gaya-qris';
st.textContent = [
'.qris-blok{margin-top:14px}',
'.qris-bingkai{margin-top:10px;display:flex;justify-content:center;background:#fff;border-radius:16px;padding:14px;max-width:272px}',
'.qris-bingkai img{width:240px;height:240px;display:block}',
'.qris-kosong{width:240px;height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#0e1626;font-weight:600;font-size:14px;gap:6px}',
'.qris-nominal{margin-top:12px;display:flex;flex-direction:column;gap:2px}',
'.qris-nominal strong{font-size:26px;color:var(--gold)}',
'.qris-nominal span{font-size:13px;color:var(--muted)}'
].join('');
document.head.appendChild(st);
})();
window.panelCaraBeli = function () {
return '<div class="card bayar">' +
'<div class="hari-head">' + ic('shield', 16) + ' <strong>Laporan belum terbuka di perangkat ini</strong></div>' +
'<div class="hari-sub">Akses penuh dibuka lewat kode akses dari pembelian. Buka halaman utama untuk ' +
'melanjutkan pembelian atau memasukkan kodemu.</div>' +
'<div class="aksi-bar" style="margin-top:10px">' +
'<button class="btn btn-primary btn-sm" onclick="navTo(\'home\'); render();">' +
ic('arrow-right', 14) + ' Buka halaman utama</button>' +
'</div>' +
'<div class="hari-sub" style="margin-top:12px">Sudah punya kode? Tempel di bawah.</div>' +
'<input class="profil-input" id="kodeAkses" placeholder="Contoh: SPXXXXXXXXXXXX" autocomplete="off" spellcheck="false" style="margin-top:6px">' +
'<button class="btn btn-secondary btn-sm" style="margin-top:8px" onclick="bukaLaporanDenganKode()">' +
ic('hash', 14) + ' Buka laporan</button>' +
'</div>';
};
window.catatMinatLaporan = function () {
try {
localStorage.setItem('tni_minat_laporan', JSON.stringify({ tanggal: new Date().toISOString().slice(0, 10) }));
} catch (e) {}
if (typeof render === 'function') render();
};
window.syaratRingkas = function () {
return '<div class="card">' +
'<div class="hari-head">' + ic('shield', 16) + ' <strong>Syarat &amp; ketentuan singkat</strong></div>' +
'<div class="hari-sub">' + [
'Layanan ini alat bantu belajar. Kami tidak menjanjikan kelulusan, nilai tertentu, atau hasil seleksi apa pun.',
'Laporan disusun dari data latihanmu sendiri di perangkatmu. Kami tidak menyimpan data itu di server.',
'Tes kepribadian memakai Mini-IPIP (domain publik) dengan terjemahan sederhana yang belum divalidasi pada orang Indonesia; hasilnya bukan diagnosis psikologi.',
'Pembelian laporan bersifat sekali bayar dan tidak berulang. Kalau laporan gagal terbuka karena kesalahan kami, kode akan kami ganti.',
'Kami tidak berafiliasi dengan dan tidak mewakili instansi pemerintah mana pun. Materi latihan bukan soal resmi.',
'Soal yang terasa keliru bisa kamu laporkan lewat tombol Laporkan soal dan akan diperiksa.'
].map(function (t) { return '<div class="fokus-item"><span class="fokus-num">' + ic('check', 11) + '</span>' + t + '</div>'; }).join('') +
'</div></div>';
};
window.panelLaporanLengkap = function () {
if (laporanSudahDibuka()) {
return '<div class="card"><div class="hari-head">' + ic('file', 16) +
' <strong>Laporan Lengkapmu</strong><span class="hari-tgl">sudah dibuka</span></div>' +
'<div class="hari-sub">Laporan lengkap tersedia di halaman <strong>Laporan</strong> — bisa dicetak atau disimpan PDF.</div>' +
'<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="navTo(\'laporan\')">' +
ic('file', 14) + ' Buka laporan lengkap</button></div>';
}
return panelCaraBeli() + syaratRingkas();
};
window.renderLaporan = function () {
if (laporanSudahDibuka()) {
return '<div class="card"><div class="hari-head">' + ic('file', 16) + ' <strong>Laporan Lengkap</strong>' +
'<span class="hari-tgl">terbuka</span></div>' +
'<div class="hari-sub">Bagian di bawah ini bisa dicetak (Ctrl/Cmd + P) atau diunduh sebagai berkas.</div></div>' +
'<div class="card lap">' + isiLaporanLengkap() + '</div>';
}
return '<div class="card"><div class="hari-head">' + ic('file', 16) + ' <strong>Laporan Lengkap</strong>' +
'<span class="hari-tgl">belum dibuka</span></div>' +
'<div class="hari-sub">Laporan ini memakai data latihan dan hasil tes kepribadianmu. ' +
'Selesaikan tes kepribadian (4 menit) dan satu simulasi supaya isinya bermakna.</div>' +
'<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="mulaiBigFive()">Isi tes kepribadian dulu</button>' +
'</div>' + panelCaraBeli() + syaratRingkas();
};
var _renderSebelumFitur11 = window.render;
window.render = function () {
if (_renderSebelumFitur11) _renderSebelumFitur11.apply(this, arguments);
try { sisipPanel11(); } catch (e) {}
};
function sisipPanel11() {
var m = document.getElementById('main');
if (!m) return;
if (S.page === 'laporan') {
m.innerHTML = renderLaporan();
return;
}
if (S.page === 'baterai' && !m.querySelector('.jalan-laporan')) {
var kotak = m.querySelector('.card:last-of-type');
if (kotak) {
var w = document.createElement('div');
w.className = 'jalan-laporan';
w.innerHTML = '<div class="card"><div class="hari-head">' + ic('file', 16) +
' <strong>Laporan Lengkap</strong><span class="hari-tgl">' +
(LAPORAN_BAYAR_AKTIF ? HARGA_LAPORAN + ' sekali bayar' : 'sedang disiapkan') + '</span></div>' +
'<div class="hari-sub">Kesiapan ujianmu, kepribadian Big Five, pekerjaan yang cocok, rencana latihan 14 hari, ' +
'dan cara menjawab di wawancara.</div>' +
'<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="navTo(\'laporan\')">' +
ic('arrow-right', 14) + ' Lihat laporan</button></div>';
kotak.insertAdjacentElement('afterend', w);
}
}
}
