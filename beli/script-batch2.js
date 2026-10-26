// Set Soal Batch 2 — halaman harga khusus pemilik kode akses penuh.
// Alur: tempel kode -> POST /api/batch2/cek (token HMAC 15 mnt) -> pesanan via
// POST /api/beli/kode { skus: 'batch2', batch2_token } -> QRIS / klaim seperti /beli/.
// TIDAK ADA angka harga di berkas ini maupun di HTML: nominal selalu datang dari server.
(function () {
  'use strict';

  var URL_API = 'https://siappsikotes.my.id';
  var URL_PANTAU = URL_API + '/api/pantau';

  function getUtmParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || 'wa',
      utm_medium: params.get('utm_medium') || 'retensi',
      utm_campaign: params.get('utm_campaign') || 'retensi30_w4'
    };
  }

  function lacak(evt) {
    try {
      var utm = getUtmParams();
      var payload = JSON.stringify({
        jenis: evt, rujukan: rujukan,
        utm_source: utm.utm_source, utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign
      });
      if (navigator.sendBeacon) navigator.sendBeacon(URL_PANTAU, new Blob([payload], { type: 'text/plain' }));
      else fetch(URL_PANTAU, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true, credentials: 'omit' }).catch(function () {});
    } catch (e) { /* jangan ganggu alur pembelian */ }
  }

  function formatRp(n) { return 'Rp ' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function salin(teks, tombol) {
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(teks);
      else {
        var t = document.createElement('textarea'); t.value = teks; document.body.appendChild(t);
        t.select(); document.execCommand('copy'); t.remove();
      }
    } catch (e) {}
    var asli = tombol.textContent;
    tombol.textContent = 'tersalin';
    setTimeout(function () { tombol.textContent = asli; }, 1400);
  }

  // ---------- Sidik kode: HARUS sama dengan server (sidikKode) dan beli/script.js ----------
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
  function hashRujukan(alamat) { // sidik dari isinya, dipakai ulang agar kode tak berulang
    return sidikKode('B' + String(alamat));
  }

  // ---------- Rujukan: 3 angka unik, hindari rujukan yang sudah tersimpan ----------
  var angkaRujukan = '';
  var tersimpan = null;
  try { tersimpan = JSON.parse(localStorage.getItem('tni_kode_bayar') || 'null'); } catch (e) {}
  var terpakai = [];
  try {
    for (var k = 0, n = localStorage.length; k < n; k++) {
      var nmk = localStorage.key(k);
      if (nmk && nmk.indexOf('tni_klaim_') === 0) terpakai.push(nmk.replace('tni_klaim_', '') + '');
    }
  } catch (e) {}
  if (tersimpan && tersimpan.angka) terpakai.push(String(tersimpan.angka));
  do { angkaRujukan = String(Math.floor(Math.random() * 900) + 100); } while (terpakai.indexOf(angkaRujukan) !== -1);
  var rujukan = 'SP-' + angkaRujukan;

  var hargaDasar = null;      // dari server (nominal_dasar) — bukan angka di berkas ini
  var batch2Token = null;
  var klaimToken = null;
  var lunas = false;
  var pesananTerdaftar = false;

  var elKode = document.getElementById('kode');
  var elNominal = document.getElementById('nominal');
  var elRujukan = document.getElementById('rujukan');
  var pesanPeriksa = document.getElementById('pesanPeriksa');
  var pesananPesan = document.getElementById('pesananPesan');
  var statusBayar = document.getElementById('statusBayar');

  elRujukan.textContent = rujukan;
  try {
    if (window.history && history.replaceState && location.hash !== '#sp-' + angkaRujukan) {
      history.replaceState(null, '', location.pathname + location.search + '#sp-' + angkaRujukan);
    }
  } catch (e) {}

  lacak('batch2_kunjungan');

  function tulisPesan(el, teks, jenis) {
    el.textContent = teks;
    el.className = jenis === 'hoki' ? 'pesan hoki' : (jenis === 'salah' ? 'pesan salah' : 'pesan');
    el.hidden = false;
  }

  document.getElementById('periksa').addEventListener('click', function () {
    var kodeBersih = String(elKode.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (kodeBersih.length < 8) { tulisPesan(pesanPeriksa, 'Kode belum lengkap — tempel kodenya utuh, contoh SPXXXXXXXXXXXX.', 'salah'); return; }
    fetch(URL_API + '/api/batch2/cek', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ kode: kodeBersih })
    }).then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }).catch(function () { return { status: r.status, d: null }; }); })
      .then(function (x) {
        var d = x.d || {};
        if (x.status === 404) { tulisPesan(pesanPeriksa, d.pesan || 'kode tidak dikenal', 'salah'); return; }
        if (x.status === 403) { tulisPesan(pesanPeriksa, d.pesan || 'kode belum lunas', 'salah'); return; }
        if (x.status !== 200 || !d.ok) { tulisPesan(pesanPeriksa, d.pesan || 'pemeriksaan gagal — coba lagi sebentar', 'salah'); return; }
        tulisPesan(pesanPeriksa, 'Kode sah (' + (d.kode_akhir || '') + ' mi akhiran). Harga khususnya terbuka di bawah.', 'hoki');
        batch2Token = d.token;
        hargaDasar = Number(d.nominal_dasar) || 0;
        var angka = parseInt(angkaRujukan, 10);
        elNominal.textContent = formatRp(hargaDasar + angka);
        document.getElementById('langkah2').hidden = false;
        lacak('batch2_cek_ok');
      })
      .catch(function () { tulisPesan(pesanPeriksa, 'Koneksi lambat — coba lagi sebentar.', 'salah'); });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.salin'), function (t) {
    t.addEventListener('click', function () {
      if (t.dataset.salin === 'rujukan') { salin(rujukan, t); lacak('salin_rujukan'); }
      else { salin(elNominal.textContent, t); lacak('salin_nominal'); }
    });
  });

  function tulisStatus(teks) {
    statusBayar.textContent = teks;
    statusBayar.className = 'pesan hoki';
    statusBayar.hidden = false;
  }

  function tampilkanLunas(status) {
    lunas = true;
    document.getElementById('sudahBayar').hidden = true;
    tulisStatus(status === 'lunas'
      ? 'Pembayaran terkonfirmasi — kode di atas aktif sekarang.'
      : 'Kode di atas aktif. Pembayaran sedang diverifikasi otomatis — tidak perlu kirim bukti.');
  }

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

  function kirimKlaim() {
    fetch(URL_API + '/api/beli/klaim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ rujukan: rujukan, klaim_token: klaimToken, kontak: kontakKlaimer() })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (d) { if (d && d.ok && d.status) tampilkanLunas(d.status); else tulisStatus((d && d.pesan) || 'Klaim belum bisa diproses — coba lagi sebentar.'); })
      .catch(function () { tulisStatus('Koneksi lambat. Kode tetap tersimpan di halaman ini.'); });
  }

  document.getElementById('sudahBayar').addEventListener('click', function () {
    lacak('klaim_sudah_bayar');
    if (klaimToken) { kirimKlaim(); return; }
    daftarPesanan(function () { if (klaimToken) kirimKlaim(); else tulisStatus('Verifikasi otomatis sedang sibuk — tekan lagi sebentar.'); });
  });

  function mintaQrisDinamis() {
    fetch(URL_API + '/api/tripay/transaksi', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ rujukan: rujukan })
    }).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.ok || !(d.qr_image || d.qr_url)) return;
        document.getElementById('qrisImg').src = d.qr_image || d.qr_url;
      }).catch(function () {});
  }

  function daftarPesanan(selesai) {
    if (pesananTerdaftar) { if (selesai) selesai(); return; }
    pesananTerdaftar = true;
    var utm = getUtmParams();
    fetch(URL_API + '/api/beli/kode', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'omit',
      body: JSON.stringify({ rujukan: rujukan, skus: 'batch2', batch2_token: batch2Token,
                             utm_source: utm.utm_source, utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }).catch(function () { return { ok: r.ok, d: null }; }); })
      .then(function (x) {
        var d = x.d || {};
        if (!d.ok) { tulisPesan(pesananPesan, d.pesan || 'Pesanan belum bisa dicatat — coba lagi sebentar.', 'salah'); pesananTerdaftar = false; if (selesai) selesai(); return; }
        // Nominal final selalu dari server.
        if (d.nominal) elNominal.textContent = formatRp(d.nominal);
        klaimToken = d.klaim_token || null;
        if (klaimToken) { try { localStorage.setItem('tni_klaim_' + angkaRujukan, JSON.stringify({ token: klaimToken, waktu: Date.now() })); } catch (e) {} }
        document.getElementById('bayar').hidden = false;
        document.getElementById('kode').textContent = d.kode || '';
        lacak('tampilkan_kode');
        if (d.tripay_aktif) { mintaQrisDinamis(); } else { lacak('qris_tampil'); }
        mulaiPolling();
        if (selesai) selesai(d);
      })
      .catch(function () { pesananTerdaftar = false; tulisPesan(pesananPesan, 'Koneksi lambat — coba lagi sebentar.', 'salah'); if (selesai) selesai(); });
  }

  document.getElementById('tampilkanKode').addEventListener('click', function () {
    lacak('klik_cta_bayar');
    daftarPesanan();
  });

  function mulaiPolling() {
    var sisa = 225; // 225 x 8 detik ≈ 30 menit
    var id = setInterval(function () {
      if (lunas || sisa-- <= 0) { clearInterval(id); return; }
      if (document.hidden) return;
      fetch(URL_API + '/api/beli/status?rujukan=' + encodeURIComponent(rujukan), { credentials: 'omit' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.ok && (d.status === 'lunas' || d.status === 'menunggu_verifikasi')) { tampilkanLunas(d.status); clearInterval(id); } })
        .catch(function () {});
    }, 8000);
  }

})();
