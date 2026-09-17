
window.AKSES = window.AKSES || {
aktifGerbang: true,
harga: 'Rp 39.000',
pemilik: ['rasyidahmad180@gmail.com'],
kodePengembang: 'SPDEVPEMILIKB01J4S1',
pesanGratis: false
};
window.bacaAkunGoogle = function () {
try { return JSON.parse(localStorage.getItem('tni_google_akun') || 'null'); } catch (e) { return null; }
};
window.adalahPemilik = function () {
var a = bacaAkunGoogle();
if (!a || !a.email) return false;
return AKSES.pemilik.map(function (x) { return x.toLowerCase(); })
.indexOf(String(a.email).toLowerCase()) !== -1;
};
window.punyaAkses = function () {
if (!AKSES.aktifGerbang) return true;
if (adalahPemilik()) return true;
try {
if (localStorage.getItem('tni_akses_pemilik') === '1') return true;
} catch (e) {}
var kode = '';
try { kode = localStorage.getItem('tni_kode_akses') || ''; } catch (e) {}
if (kode && typeof periksaKode === 'function') {
try { if (periksaKode(kode).sah) return true; } catch (e) {}
}
return false;
};
window.peranAkses = function () {
if (!AKSES.aktifGerbang) return 'bebas';
if (adalahPemilik()) return 'pemilik';
try { if (localStorage.getItem('tni_akses_pemilik') === '1') return 'pemilik-lokal'; } catch (e) {}
if (punyaAkses()) return 'pembeli';
return 'terkunci';
};
window.pembelianSaya = function () {
try { return JSON.parse(localStorage.getItem('tni_pembelian') || 'null'); } catch (e) { return null; }
};
function rupiahKomersial(n) {
return 'Rp ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
window.terapkanKodeAkses = function () {
var el = document.getElementById('kodeAksesGerbang');
var st = document.getElementById('statusGerbang');
var kode = (el && el.value || '').trim().toUpperCase();
if (!kode) { if (st) st.textContent = 'Masukkan kode aksesmu dulu.'; return; }
if (AKSES.kodePengembang && kode === String(AKSES.kodePengembang).toUpperCase()) {
try { localStorage.setItem('tni_akses_pemilik', '1'); } catch (e) {}
if (st) st.textContent = 'Kode pengembang diterima. Membuka seluruh aplikasi...';
setTimeout(function () { location.reload(); }, 700);
return;
}
var sah = false;
try { sah = (typeof periksaKode === 'function') && periksaKode(kode).sah; } catch (e) { sah = false; }
if (sah) {
var kb = (typeof kodeBayar === 'function') ? kodeBayar() : { rujukan: '', nominal: 0, dasar: 0 };
try {
localStorage.setItem('tni_kode_akses', kode);
localStorage.setItem('tni_akses', 'TERBUKA');
localStorage.setItem('tni_laporan_bayar', JSON.stringify({ kode: kode, tanggal: new Date().toISOString().slice(0, 10) }));
localStorage.setItem('tni_pembelian', JSON.stringify({
kode: kode, rujukan: kb.rujukan, nominal: kb.nominal, dasar: kb.dasar,
tanggal: new Date().toISOString(), produk: 'Akses penuh SiapPsikotes + Laporan Lengkap'
}));
} catch (e) {}
if (st) st.textContent = 'Kode sah. Membuka seluruh aplikasi...';
try { if (typeof googleMasuk === 'function' && googleMasuk() && typeof googleKirimKeDrive === 'function') googleKirimKeDrive(false); } catch (e) {}
setTimeout(function () { location.reload(); }, 700);
} else if (st) {
var wa = (typeof BAYAR !== 'undefined' && BAYAR.whatsapp) ? String(BAYAR.whatsapp).replace(/[^0-9]/g, '') : '';
st.innerHTML = 'Kode tidak dikenali. Periksa penulisannya' + (wa
? ', atau <a href="https://wa.me/' + wa + '?text=' + encodeURIComponent('Halo, kode akses saya tidak diterima. Mohon dibantu.') + '" target="_blank" rel="noopener">kirim bukti pembayaran lewat WhatsApp</a>'
: ', atau kirim bukti pembayaran ke pemilik') + '. Kode yang sah selalu diawali SP.';
}
};
window.bukaHalamanBayar = function () {
var u = (typeof BAYAR !== 'undefined' && BAYAR.tautanBayar) ? BAYAR.tautanBayar : '';
if (!u) return;
try { window.open(u, '_blank', 'noopener'); } catch (e) { location.href = u; }
};
window.salinRekening = function () {
var teks = (typeof BAYAR !== 'undefined' && BAYAR.rekening) ? BAYAR.rekening : '';
if (!teks) return;
var st = document.getElementById('statusGerbang');
var beres = function () { if (st) st.textContent = 'Tujuan pembayaran disalin: ' + teks; };
try {
if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(teks).then(beres, beres); return; }
} catch (e) {}
beres();
};
window.pulihkanAksesDariAkun = function () {
if (typeof googleMasuk !== 'function' || !googleMasuk()) {
alert('Masuk dengan Google dulu, lalu tekan lagi untuk memulihkan.');
return;
}
var st = document.getElementById('statusGerbang');
if (st) st.textContent = 'Memeriksa cadangan di Google Drive-mu...';
if (typeof googleAmbilDariDrive !== 'function') return;
try { googleAmbilDariDrive(); } catch (e) {}
};
window.tutupGerbangUlang = function () {
if (!confirm('Kunci kembali aplikasinya di perangkat ini? Kamu perlu kode akses lagi untuk masuk.')) return;
try {
localStorage.removeItem('tni_akses');
localStorage.removeItem('tni_kode_akses');
localStorage.removeItem('tni_akses_pemilik');
} catch (e) {}
location.reload();
};
window.unduhKuitansi = function () {
var b = pembelianSaya();
if (!b) { alert('Belum ada catatan pembelian di perangkat ini.'); return; }
var akun = bacaAkunGoogle();
var tgl = String(b.tanggal || '').slice(0, 10);
var html = '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">' +
'<title>Kuitansi ' + b.kode + '</title><style>' +
'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#111}' +
'h1{font-size:20px;margin:0 0 4px}.sub{color:#555;font-size:13px;margin:0 0 24px}' +
'table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:10px;border-bottom:1px solid #e5e5e5;text-align:left}' +
'th{width:42%;color:#555;font-weight:600}total{display:block;margin-top:18px;font-size:18px;font-weight:700}' +
'.cat{margin-top:22px;font-size:12px;color:#666;border-top:1px solid #e5e5e5;padding-top:12px}' +
'</style></head><body>' +
'<h1>Kuitansi pembelian</h1><p class="sub">SiapPsikotes — bukti pembayaran akses penuh</p>' +
'<table>' +
'<tr><th>Produk</th><td>' + b.produk + '</td></tr>' +
'<tr><th>Kode akses</th><td>' + b.kode + '</td></tr>' +
'<tr><th>Kode rujukan</th><td>' + (b.rujukan || '-') + '</td></tr>' +
'<tr><th>Nominal dibayar</th><td>' + rupiahKomersial(b.nominal || b.dasar || 0) + '</td></tr>' +
'<tr><th>Tanggal</th><td>' + tgl + '</td></tr>' +
'<tr><th>Nama akun</th><td>' + (akun && akun.nama ? akun.nama : '-') + '</td></tr>' +
'<tr><th>Surel akun</th><td>' + (akun && akun.email ? akun.email : '-') + '</td></tr>' +
'</table><total>Lunas</total>' +
'<p class="cat">Kuitansi ini dibuat dari catatan di perangkatmu sendiri, bukan dari server kami. ' +
'Simpan sebagai PDF lewat menu cetak peramban. Pembelian sekali bayar tanpa perpanjangan otomatis.</p>' +
'</body></html>';
var w = window.open('', '_blank');
if (!w) { alert('Peramban memblokir jendela baru. Izinkan jendela baru lalu coba lagi.'); return; }
w.document.write(html);
w.document.close();
setTimeout(function () { try { w.print(); } catch (e) {} }, 400);
};
function kepalaGerbang(peran) {
var akun = bacaAkunGoogle();
if (peran === 'terkunci' && akun && akun.email) {
return { judul: 'Akun ini belum punya akses', sub: 'Kamu sudah masuk sebagai <strong>' + escapeHtml(akun.email) +
'</strong>, tetapi akses penuh belum dibeli di akun ini. Satu pembayaran ' + AKSES.harga +
' membuka semuanya dan berlaku untuk akun ini.' };
}
return { judul: 'Seluruh materi terbuka setelah membeli',
sub: 'Sejak sekarang tidak ada lagi akses gratis. Satu pembayaran <strong>' + AKSES.harga +
'</strong> membuka <strong>semua</strong>: 1.348 soal, seluruh modul tes, pembahasan langkah demi langkah, ' +
'dan Laporan Lengkap. Bukan langganan, tanpa perpanjangan otomatis.' };
}
window.renderGerbang = function () {
  var peran = peranAkses();
  var akun = bacaAkunGoogle();
  var googleSiap = (typeof window.googleSiap === 'function') && window.googleSiap();
  var pesan = '';
  try { pesan = localStorage.getItem('tni_gerbang_pesan') || ''; } catch (e) {}

  var masuk = googleSiap
    ? (akun
        ? '<p class="komer-sub">Tersambung sebagai <strong>' + escapeHtml(akun.nama || akun.surel || akun.email) + '</strong>. ' +
          'Bahan belajarmu tersimpan di akunmu dan bisa dilanjutkan dari perangkat lain.</p>' +
          '<div class="komer-aksi"><button class="btn btn-secondary" onclick="keluarGoogle()">Keluar dari Google</button></div>'
        : '<button class="btn btn-primary" style="width:100%" onclick="masukkanGoogle()">' + ic('user', 16) + ' Masuk dengan Google</button>' +
          '<p class="komer-sub" style="margin-top:10px">Sekali klik, tanpa kata sandi. Latihanmu tersimpan ke akunmu ' +
          'sehingga bisa dilanjutkan dari HP lain dan kode aksesmu tidak hilang.</p>')
    : '<p class="komer-sub">Masuk dengan Google belum diaktifkan pemilik.</p>';

  var belum = '<div class="komer-bagian" style="border-top:1px solid var(--line)">' +
    '<div class="komer-nomor">?</div>' +
    '<div class="komer-isi"><h3>Belum punya akses?</h3>' +
    '<p class="komer-sub">Harga, isi paket, QRIS, dan cara membelinya ada di halaman penjelasan. Mau menilai mutu soalnya dulu? Ada 40 soal berpembahasan yang bisa dikerjakan gratis, tanpa akun.</p>' +
    '<div class="komer-aksi"><button class="btn btn-secondary btn-sm" onclick="window.open(\'psikotes/#harga\',\'_blank\')">' +
    ic('arrow-right', 14) + ' Lihat harga & cara beli</button>' +
    '<button class="btn btn-secondary btn-sm" onclick="window.open(\'contoh/\',\'_blank\')">' +
    ic('book', 14) + ' Coba 40 soal gratis</button></div></div></div>';

  var kode = '<div class="komer-bagian" style="border-top:1px solid var(--line)">' +
    '<div class="komer-nomor">K</div>' +
    '<div class="komer-isi"><h3>Sudah punya kode akses?</h3>' +
    '<p class="komer-sub">Tempel kode yang kamu terima setelah membayar.</p>' +
    '<input id="kodeAksesGerbang" placeholder="Contoh: SPXXXXXXXXXXXX" autocomplete="off" spellcheck="false">' +
    '<div class="komer-aksi"><button class="btn btn-primary btn-sm" onclick="terapkanKodeAkses()">' + ic('hash', 14) + ' Buka</button></div>' +
    '<div id="statusGerbang" class="komer-status">' + escapeHtml(pesan) + '</div></div></div>';

  var judul = akun ? 'Akun ini belum punya akses' : 'Masuk untuk mulai belajar';
  var sub = akun
    ? 'Kamu sudah masuk sebagai <strong>' + escapeHtml(akun.email) + '</strong>, tetapi akun ini belum membeli akses penuh.'
    : 'Satu akun untuk semua perangkatmu. Belum membeli? Lihat harga &amp; cara beli di halaman penjelasan.';

  return '<div class="komer-kartu">' +
      '<div class="komer-kepala">' +
        '<div class="komer-ikon">' + ic('user', 26) + '</div>' +
        '<h2>' + judul + '</h2>' +
        '<p class="komer-sub">' + sub + '</p>' +
      '</div>' +
      '<div class="komer-bagian" style="border-top:1px solid var(--line)">' +
        '<div class="komer-nomor">1</div>' +
        '<div class="komer-isi"><h3>Masuk dengan Google</h3>' + masuk + '</div>' +
      '</div>' +
      belum + kode +
      '<div class="komer-kaki">' +
        '<button class="btn btn-ghost btn-sm" onclick="window.open(\'syarat/\',\'_blank\')">Syarat</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="window.open(\'privasi/\',\'_blank\')">Privasi</button>' +
      '</div>' +
    '</div>';
};

window.kartuPembelian = function () {
var b = pembelianSaya();
var peran = peranAkses();
if (!b && peran === 'terkunci') return '';
var isi = '';
if (b) {
isi = '<div class="hari-sub">Kode: <strong>' + escapeHtml(b.kode) + '</strong> · ' +
rupiahKomersial(b.nominal || b.dasar || 0) + ' · ' + String(b.tanggal || '').slice(0, 10) + '</div>' +
'<div class="aksi-bar" style="margin-top:10px">' +
'<button class="btn btn-secondary btn-sm" onclick="unduhKuitansi()">' + ic('download', 14) + ' Unduh kuitansi</button>' +
'</div>';
} else {
isi = '<div class="hari-sub">Akses dibuka sebagai <strong>' +
(peran === 'pemilik' ? 'akun pemilik' : 'pemilik perangkat (kode pengembang)') +
'</strong> — tanpa catatan pembelian.</div>';
}
return '<div class="card">' +
'<div class="hari-head">' + ic('star', 16) + ' <strong>Pembelian saya</strong>' +
'<span class="hari-tgl">' + (peran === 'pemilik' ? 'pemilik' : 'terbuka') + '</span></div>' + isi +
'<div class="hari-sub" style="margin-top:10px">Satu pembayaran, tanpa perpanjangan otomatis. ' +
'Simpan kode aksesmu: kode itu juga membuka aplikasi di perangkat lain.</div>' +
'<div class="aksi-bar" style="margin-top:10px">' +
'<button class="btn btn-ghost btn-sm" onclick="tutupGerbangUlang()">Kunci aplikasi di perangkat ini</button>' +
'</div></div>';
};
(function () {
if (document.getElementById('gaya-gerbang')) return;
var st = document.createElement('style');
st.id = 'gaya-gerbang';
st.textContent = [
'.komer-kartu{max-width:640px;margin:4vh auto;background:var(--surface);border:1px solid var(--line2);border-radius:20px;padding:24px 20px}',
'.komer-kepala{text-align:center;margin-bottom:18px}',
'.komer-ikon{width:54px;height:54px;margin:0 auto 10px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(230,197,82,.12);color:var(--gold)}',
'.komer-kepala h2{margin:0 0 8px;font-size:clamp(19px,3.2vw,25px)}',
'.komer-sub{color:var(--muted);font-size:14.5px;line-height:1.6;margin:0}',
'.komer-daftar{display:flex;flex-direction:column;gap:7px;margin:0 0 20px;font-size:14.5px}',
'.komer-daftar svg{color:var(--gold);vertical-align:-2px;margin-right:6px}',
'.komer-bagian{display:flex;gap:14px;padding:16px 0;border-top:1px solid var(--line)}',
'.komer-nomor{flex:0 0 30px;height:30px;border-radius:50%;background:rgba(230,197,82,.14);color:var(--gold);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px}',
'.komer-isi{flex:1;min-width:0}',
'.komer-isi h3{margin:4px 0 8px;font-size:16px}',
'.komer-aksi{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}',
'.komer-isi input{width:100%;margin-top:10px;padding:12px 14px;border-radius:12px;border:1px solid var(--line2);background:var(--bg2);color:var(--text);font-size:15px;font-family:inherit}',
'.komer-status{min-height:18px;margin-top:8px;font-size:13.5px;color:var(--gold)}',
'.komer-kaki{margin-top:18px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap}',
// semua tombol di layar gerbang ditinggikan minimal 40 titik supaya nyaman disentuh
'.komer-kartu button,.komer-kartu a.btn{min-height:40px}'
].join('');
document.head.appendChild(st);
})();
(function () {
var lamaRender = window.render;
if (typeof lamaRender === 'function') {
window.render = function () {
if (!punyaAkses()) {
var m = document.getElementById('main');
if (m) { m.innerHTML = renderGerbang(); return; }
}
return lamaRender.apply(this, arguments);
};
}
var lamaNav = window.navTo;
if (typeof lamaNav === 'function') {
window.navTo = function (hal) {
if (!punyaAkses() && hal !== 'tentang') return;
return lamaNav.apply(this, arguments);
};
}
var lamaStart = window.startCat;
if (typeof lamaStart === 'function') {
window.startCat = function () {
if (!punyaAkses()) { render(); return; }
return lamaStart.apply(this, arguments);
};
}
if (typeof window.renderAkun === 'function') {
var lamaAkun = window.renderAkun;
window.renderAkun = function () {
var html = lamaAkun.apply(this, arguments);
try {
var kartu = kartuPembelian();
var i = html.lastIndexOf('</div>');
if (i >= 0) html = html.slice(0, i) + kartu + html.slice(i);
} catch (e) {}
return html;
};
}
})();
