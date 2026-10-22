(function () {
  'use strict';

  // ?skus=batch2 (link pesan retensi W4) menuju halaman harga khususnya — halaman
  // /beli/ tetap membahas akses penuh Rp 39.000. Nominal khusus datang dari server.
  if (/[?&]skus=batch2/.test(window.location.search)) {
    window.location.replace('batch2-landing.html' + window.location.search);
  }

  // DOM elements
  var elN = document.getElementById('beliNominal');
  var elN2 = document.getElementById('beliNominal2');
  var elR = document.getElementById('beliRujukan');
  var elB = document.getElementById('beliBukti');
  var elBS = document.getElementById('beliBuktiSurel');
  var elS = document.getElementById('beliSalin');
  var elSalinRujukan = document.getElementById('beliSalinRujukan');
  var elSalinKode = document.getElementById('beliSalinKode');
  var elAmbil = document.getElementById('beliAmbilKode');
  var elKode = document.getElementById('beliKodeAkses');
  var elAksiKode = document.getElementById('beliAksiKode');
  var elBuka = document.getElementById('beliBukaKode');
  var elCTA = document.getElementById('ctaBayar');
  var qrisBox = document.querySelector('.qris-kotak');

  if (!elN) return;

  // auto-select rujukan/nominal on click for mudah disalin
  if (elR) elR.addEventListener('click', function(){ var sel = window.getSelection(); var range = document.createRange(); range.selectNodeContents(elR); sel.removeAllRanges(); sel.addRange(range); });
  if (elN) elN.addEventListener('click', function(){ var sel = window.getSelection(); var range = document.createRange(); range.selectNodeContents(elN); sel.removeAllRanges(); sel.addRange(range); });

  // ---------- Constants ----------
  var HARGA_DASAR = 39000;
  var HARGA_REF = 34000;   // diskon Rp 5.000 lewat kode referensi REF-XXXX (divalidasi server)
  var URL_API = 'https://siappsikotes-api.rasyidahmad180.workers.dev';
  var URL_PANTAU = URL_API + '/api/pantau';

  // ---------- Helpers ----------
  function getUtmParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || ''
    };
  }

  function bacaCookie(nama) {
    var cocok = new RegExp('(?:^|;\\s*)' + nama + '=([^;]*)').exec(document.cookie);
    return cocok ? cocok[1] : '';
  }

  function lacak(evt, extra) {
    try {
      var utm = getUtmParams();
      var payload = JSON.stringify(Object.assign({
        jenis: evt,
        rujukan: rujukan,
        utm_source: utm.utm_source,
        utm_medium: utm.utm_medium,
        utm_campaign: utm.utm_campaign,
        // Varian A/B ditetapkan server Worker (window.spBeliVar dari HTML hasil rewrite);
        // fallback: cookie sp_beli_var (direct traffic). Kosong kalau halaman bukan hasil Worker.
        variant: window.spBeliVar || bacaCookie('sp_beli_var') || '',
        // Id kunjungan dari server (window.spLacak, di-inject Worker) — mengikat beacon
        // client dengan baris kunjungan server-side di D1 (t_eece4f7e).
        lacak: window.spLacak || '',
        harga_dasar: HARGA_DASAR
      }, extra || {}));
      if (navigator.sendBeacon) {
        navigator.sendBeacon(URL_PANTAU, new Blob([payload], { type: 'text/plain' }));
      } else {
        fetch(URL_PANTAU, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true, credentials: 'omit' }).catch(function () {});
      }
    } catch (e) { /* jangan biarkan pelacakan menganggu alur pembelian */ }
  }


  // ---------- Kode referensi teman (REF-XXXX) ----------
  // Kode divalidasi SERVER (/api/referensi/cek) sebelum harga diskon ditampilkan; kodenya
  // juga diteruskan ke /api/beli/kode yang menghitung nominal akhir secara resmi.
  var refParam = '';
  try {
    refParam = (new URLSearchParams(window.location.search).get('ref') || '').toUpperCase().trim();
  } catch (e) { refParam = ''; }
  var refAktif = false;
  var hargaDasar = HARGA_DASAR;
  var elCatatanDiskon = document.getElementById('beliCatatanDiskon');

  // ---------- Generate reference code ----------
  var angkaRujukan = '';
  var dariAlamat = /^#sp-(\d{3})$/.exec(location.hash || '');
  if (dariAlamat) angkaRujukan = dariAlamat[1];
  var kode = null;
  try { kode = JSON.parse(localStorage.getItem('tni_kode_bayar') || 'null'); } catch (e) { kode = null; }
  if (!angkaRujukan && kode && /^\d{3}$/.test(String(kode.angka))) angkaRujukan = String(kode.angka);
  if (!angkaRujukan) angkaRujukan = String(Math.floor(Math.random() * 900) + 100);
  kode = { angka: angkaRujukan, waktu: (kode && kode.waktu) || new Date().toISOString() };
  try { localStorage.setItem('tni_kode_bayar', JSON.stringify(kode)); } catch (e) {}
  try {
    if (location.hash !== '#sp-' + angkaRujukan && window.history && history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search + '#sp-' + angkaRujukan);
    }
  } catch (e) {}

  var angka = parseInt(angkaRujukan, 10);
  var rujukan = 'SP-' + angkaRujukan;

  function formatRp(n) { return 'Rp ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  var nominal = hargaDasar + angka;
  var teks = formatRp(nominal);

  // Satu titik pembaruan harga: nominal unik, harga dasar di teks, dan catatan diskon.
  function perbaruiHarga() {
    nominal = hargaDasar + angka;
    teks = formatRp(nominal);
    elN.textContent = teks;
    if (elN2) elN2.textContent = teks;
    ['displayHarga', 'displayHargaStrip', 'displayHargaCatatan'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = formatRp(hargaDasar);
    });
    if (elCatatanDiskon) elCatatanDiskon.hidden = !refAktif;
  }
  perbaruiHarga();
  if (elR) elR.textContent = rujukan;

  // Validasi kode referensi di server; bila sah, seluruh halaman menunjukkan harga diskon.
  if (refParam) {
    fetch(URL_API + '/api/referensi/cek?kode=' + encodeURIComponent(refParam), { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (d && d.ok && d.sah) {
          refAktif = true;
          if (d.kode) refParam = d.kode;
          hargaDasar = HARGA_REF;
          perbaruiHarga();
        } else refParam = '';
      })
      .catch(function () { refParam = ''; });
  }

  // ---------- Kode akses generation ----------
  function sidikKode(isi) {
    var h = 2166136261;
    var teks = String(isi) + '#' + 'siap|psikotes|2026|kode';
    for (var i = 0; i < teks.length; i++) {
      h = h ^ teks.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    var pos = h % 1679616;
    var abjad = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var sidik = '';
    while (pos > 0) { sidik = abjad.charAt(pos % 36) + sidik; pos = Math.floor(pos / 36); }
    while (sidik.length < 4) sidik = '0' + sidik;
    return sidik;
  }

  function kodeUntukNomor(nomor) {
    var isi = ('P' + String(nomor)).toUpperCase().replace(/[^0-9A-Z]/g, '');
    return 'SP' + isi + sidikKode(isi);
  }

  var kodeAkses = '';

  // ---------- Pendaftaran pesanan & klaim "Saya sudah bayar" ----------
  // Pesanan (menunggu_bayar) dicatat server saat pembeli menekan "Tampilkan kode"; nominal
  // unik dihitung server. Setelah bayar, tombol klaim mengecek muatan pembayaran webhook
  // (nominal+jam) langsung — cocok = lunas, belum cocok = dicek otomatis tiap 10 menit
  // sampai ketemu (maksimal 15 menit), verifikasi manual bila lewat.
  var elSudahBayar = document.getElementById('beliSudahBayar');
  var elStatusBayar = document.getElementById('beliStatusBayar');
  var klaimToken = null;
  var statusBayar = 'menunggu_bayar';
  var pesananTerdaftar = false;

  function ambilTokenTersimpan() {
    try {
      var t = JSON.parse(localStorage.getItem('tni_klaim_' + angkaRujukan) || 'null');
      if (t && t.token && Date.now() - (t.waktu || 0) < 40 * 3600e3) return t.token;
    } catch (e) {}
    return null;
  }

  function tampilkanStatus(pesan) {
    if (elStatusBayar) { elStatusBayar.textContent = pesan; elStatusBayar.hidden = false; }
  }

  function tampilkanLunas(status) {
    statusBayar = status;
    if (elSudahBayar) elSudahBayar.hidden = true;
    tampilkanStatus(status === 'lunas'
      ? '✅ Pembayaran terkonfirmasi — kode aksesmu aktif.'
      : '✅ Kode aksesmu aktif. Pembayaranmu sedang diverifikasi otomatis — tidak perlu kirim bukti.');
  }

  // Kartu kode referensi: tampil setelah pembayaran aktif — kodenya dibuat server
  // (satu kode per pembelian, idempoten), link siap kirim ke teman.
  function tampilkanReferensi(kodeRef) {
    if (!kodeRef) return;
    var kotak = document.getElementById('beliReferensi');
    if (!kotak) return;
    var isi = document.getElementById('beliReferensiKode');
    var tautan = document.getElementById('beliReferensiTautan');
    if (isi) isi.textContent = kodeRef;
    if (tautan) tautan.textContent = 'https://siappsikotes.my.id/referensi/' + kodeRef;
    kotak.hidden = false;
  }

  function kirimKlaim(token) {
    fetch(URL_API + '/api/beli/klaim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ rujukan: rujukan, klaim_token: token, kontak: kontakKlaimer() })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) {
        if (d && d.ok && d.status) { tampilkanLunas(d.status); tampilkanReferensi(d.referensi); }
        else tampilkanStatus((d && d.pesan) || 'Klaim belum bisa diproses — coba lagi sebentar.');
      })
      .catch(function () { tampilkanStatus('Koneksi lambat. Kode tetap tersimpan di halaman ini.'); });
  }

  function klaimBayar() {
    lacak('klaim_sudah_bayar');
    var token = klaimToken || ambilTokenTersimpan();
    if (token) { kirimKlaim(token); return; }
    try { kontakKlaimer(); } catch (e) {}   // tanya kontak sekali, sebelum jalur fallback
    // Pesanan belum tercatat (mis. tanda tangan server belum aktif saat kode tampil):
    // daftarkan dulu, lalu klaim dengan token barunya.
    daftarPesanan(function () {
      var t = klaimToken || ambilTokenTersimpan();
      if (t) kirimKlaim(t); else tampilkanStatus('Verifikasi otomatis sedang sibuk — coba tekan lagi sebentar.');
    });
  }

  if (elSudahBayar) elSudahBayar.addEventListener('click', klaimBayar);

  // Kontak opsional klaimer (WA/email) untuk tindak lanjut rekonsiliasi. Ditanya sekali
  // per rujukan dan disimpan di perangkat pembeli; boleh dikosongkan — klaim tetap jalan.
  function kontakKlaimer() {
    var kunci = 'tni_kontak_' + angkaRujukan;
    var t = null;
    try { t = localStorage.getItem(kunci); } catch (e) {}
    if (t) return t;
    try { t = window.prompt('Nomor WA atau email untuk konfirmasi pembayaran (opsional, kosongkan bila tidak ingin):', ''); } catch (e) { t = null; }
    t = t ? String(t).trim().slice(0, 64) : '';
    if (t) { try { localStorage.setItem(kunci, t); } catch (e) {} }
    return t || null;
  }

  // Jalur A (Tripay QRIS dinamis) dipakai bila pemilik sudah memasang kunci; selama belum,
  // QRIS statis di halaman ini yang dipakai — tidak ada langkah tambahan untuk pembeli.
  function mintaQrisDinamis() {
    fetch(URL_API + '/api/tripay/transaksi', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ rujukan: rujukan })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok || !(d.qr_image || d.qr_url)) return;
        var img = document.querySelector('#qris img');
        if (img && d.qr_image) img.src = d.qr_image;
        tampilkanStatus('QR dinamis aktif untuk ' + rujukan + ' — bayar Rp ' + String(nominal).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ', kode terbuka otomatis begitu lunas.');
      }).catch(function () {});
  }

  function daftarPesanan(selesai) {
    if (pesananTerdaftar) { if (selesai) selesai(); return; }
    pesananTerdaftar = true;
    var utm = getUtmParams();
    fetch(URL_API + '/api/beli/kode', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ rujukan: rujukan, ref: refParam, utm_source: utm.utm_source, utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok) { if (selesai) selesai(); return; }
        // Nominal final selalu dari server (bisa sudah kena diskon referensi).
        if (d.nominal && d.nominal !== nominal) {
          hargaDasar = d.diskon ? HARGA_REF : HARGA_DASAR;
          if (d.diskon) refAktif = true;
          angka = d.nominal - hargaDasar;
          perbaruiHarga();
        }
        klaimToken = d.klaim_token || klaimToken;
        if (klaimToken) { try { localStorage.setItem('tni_klaim_' + angkaRujukan, JSON.stringify({ token: klaimToken, waktu: Date.now() })); } catch (e) {} }
        if (d.status === 'lunas' || d.status === 'menunggu_verifikasi') { tampilkanLunas(d.status); tampilkanReferensi(d.referensi); }
        if (d.tripay_aktif && statusBayar === 'menunggu_bayar') mintaQrisDinamis();
        if (selesai) selesai(d);
      })
      .catch(function () { if (selesai) selesai(); });
  }

  // Polling status: checkout Tripay (jalur A) atau pencocokan webhook (klaim yang belum
  // ketemu muatannya) menandai lunas saat tab masih terbuka, tanpa gerakan apa pun dari pembeli.
  function mulaiPolling() {
    var sisa = 225; // 225 x 8 detik ≈ 30 menit
    var id = setInterval(function () {
      if (statusBayar === 'lunas' || sisa-- <= 0) { clearInterval(id); return; }
      if (document.hidden) return;
      fetch(URL_API + '/api/beli/status?rujukan=' + encodeURIComponent(rujukan), { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          // menunggu_verifikasi tampil begitu klaim diterima, tapi polling lanjut sampai
          // benar-benar lunas (muatan webhook ketemu) — janji "maksimal 15 menit" tereksekusi.
          if (d && d.ok && d.status && d.status !== 'menunggu_bayar' && d.status !== 'tidak_ada') {
            tampilkanLunas(d.status); tampilkanReferensi(d.referensi);
            if (d.status === 'lunas') clearInterval(id);
          }
        }).catch(function () {});
    }, 8000);
  }

  function prosesAmbilKode() {
    kodeAkses = kodeUntukNomor(rujukan);
    lacak('tampilkan_kode');
    elKode.textContent = kodeAkses;
    elKode.hidden = false;
    elAmbil.hidden = true;
    if (elBuka) elBuka.setAttribute('href', '../?kode=' + kodeAkses + '#sp-' + angkaRujukan);
    if (elAksiKode) elAksiKode.hidden = false;
    if (elSudahBayar) elSudahBayar.hidden = false;
    daftarPesanan();
    mulaiPolling();
  }

  if (elAmbil && elKode) {
    elAmbil.addEventListener('click', function () {
      prosesAmbilKode();
    });
  }

  // ---------- Copy buttons ----------
  function buatSalin(getText, trackEvent, buttonEl) {
    if (!buttonEl) return;
    buttonEl.addEventListener('click', function () {
      var asli = buttonEl.textContent;
      var selesai = function (pesan) {
        buttonEl.textContent = pesan;
        setTimeout(function () { buttonEl.textContent = asli; }, 1800);
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(getText()).then(function () { lacak(trackEvent); selesai('Tersalin'); },
            function () { selesai('Tekan lama kodenya'); });
        } else {
          selesai('Tekan lama kodenya');
        }
      } catch (e) { selesai('Tekan lama kodenya'); }
    });
  }

  buatSalin(function () { return teks; }, 'salin_nominal', elS);
  buatSalin(function () { return rujukan; }, 'salin_rujukan', elSalinRujukan);
  buatSalin(function () { return kodeAkses; }, 'salin_kode', elSalinKode);
  buatSalin(function () {
    var isi = document.getElementById('beliReferensiKode');
    return 'https://siappsikotes.my.id/referensi/' + ((isi && isi.textContent) || '');
  }, 'salin_referensi', document.getElementById('beliSalinReferensi'));

  // ---------- WhatsApp & Email links ----------
  var pesanBukti = 'Halo, saya sudah membayar akses SiapPsikotes.\n\nKode rujukan: ' + rujukan +
    '\nNominal dibayar: ' + teks + '\n\nBukti pembayaran saya lampirkan di chat ini. Mohon catat ' +
    'pembayarannya; kode akses sudah saya ambil sendiri di halaman beli, dan saya butuh bantuan ' +
    'bila kode itu ditolak. Terima kasih.';

  Array.prototype.forEach.call(document.querySelectorAll('a[href="../"]'), function (a) {
    a.setAttribute('href', '../#sp-' + angkaRujukan);
  });

  if (elB) {
    elB.setAttribute('href', 'https://wa.me/6281387906930?text=' + encodeURIComponent(pesanBukti));
    elB.addEventListener('click', function () { lacak('klik_bukti_wa'); });
  }
  if (elBS) {
    elBS.setAttribute('href', 'mailto:rasyidahmad180@gmail.com?subject=' +
      encodeURIComponent('Bukti pembayaran ' + rujukan) + '&body=' + encodeURIComponent(pesanBukti));
    elBS.addEventListener('click', function () { lacak('klik_bukti_email'); });
  }
  if (elBuka) {
    elBuka.addEventListener('click', function () { lacak('buka_aplikasi'); });
  }

  // ---------- Prefetch halaman aplikasi ----------
  var preloadLink = document.getElementById('preloadApp');
  var prefetched = false;
  function doPrefetch() {
    if (prefetched || !preloadLink) return;
    prefetched = true;
    preloadLink.rel = 'prefetch';
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = '../';
    document.head.appendChild(link);
  }
  Array.prototype.forEach.call(document.querySelectorAll('a[href="../"]'), function (a) {
    a.addEventListener('mouseenter', doPrefetch, { once: true, passive: true });
    a.addEventListener('touchstart', doPrefetch, { once: true, passive: true });
  });

  // ---------- Highlight QRIS box when CTA clicked ----------
  if (elCTA) {
    elCTA.addEventListener('click', function() {
      lacak('klik_cta_bayar');
      if (qrisBox) {
        qrisBox.style.boxShadow = '0 0 20px var(--gold)';
        setTimeout(function() { qrisBox.style.boxShadow = '0 18px 38px rgba(0,0,0,.42)'; }, 2000);
      }
    });
  }

  // ---------- rAF QRIS visibility check ----------
  var qrisTerlacak = false;
  (function ensureQris() {
    var img = document.querySelector('#qris img');
    if (!img) return;
    var raf = function() {
      if (img.complete && img.naturalWidth > 0) {
        // lightweight client-side check: ensure nominal & rujukan present
        if (elN && elR && elN.textContent && elR.textContent) {
          if (!qrisTerlacak) { qrisTerlacak = true; lacak('qris_tampil'); }
        }
        return;
      }
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  })();

  // ---------- Initial tracking ----------
  lacak('kunjungan_beli');

})();