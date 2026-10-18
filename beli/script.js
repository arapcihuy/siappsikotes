(function () {
  'use strict';

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
  var URL_PANTAU = 'https://siappsikotes-api.rasyidahmad180.workers.dev/api/pantau';
  var URL_REF_TRACK = 'https://siappsikotes-api.rasyidahmad180.workers.dev/api/referral/track';
  var URL_REF_CONV = 'https://siappsikotes-api.rasyidahmad180.workers.dev/api/referral/konversi';

  // ---------- Helpers ----------
  function getUtmParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || ''
    };
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
        variant: 'B',
        harga_dasar: HARGA_DASAR
      }, extra || {}));
      if (navigator.sendBeacon) {
        navigator.sendBeacon(URL_PANTAU, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(URL_PANTAU, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true, credentials: 'omit' }).catch(function () {});
      }
    } catch (e) { /* jangan biarkan pelacakan menganggu alur pembelian */ }
  }


  // Referral tracking
  var refParam = '';
  var refTracked = false;
  try {
    var refParams = new URLSearchParams(window.location.search);
    refParam = (refParams.get('ref') || '').toUpperCase().trim();
  } catch (e) { refParam = ''; }

  function trackReferralVisit() {
    if (!refParam || !/^SPRF[A-Z0-9]{8}$/.test(refParam) || refTracked) return;
    var utm = getUtmParams();
    var payload = JSON.stringify({
      ref: refParam,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(URL_REF_TRACK, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(URL_REF_TRACK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true, credentials: 'omit' }).catch(function () {});
    }
    refTracked = true;
  }

  function trackReferralConversion() {
    if (!refParam || !/^SPRF[A-Z0-9]{8}$/.test(refParam)) return;
    var utm = getUtmParams();
    var payload = JSON.stringify({
      ref: refParam,
      rujukan: rujukan,
      nominal: nominal,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(URL_REF_CONV, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(URL_REF_CONV, { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true, credentials: 'omit' }).catch(function () {});
    }
  }

  trackReferralVisit();

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

  var nominal = HARGA_DASAR + angka;
  var teks = 'Rp ' + String(nominal).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var rujukan = 'SP-' + angkaRujukan;

  elN.textContent = teks;
  if (elN2) elN2.textContent = teks;
  if (elR) elR.textContent = rujukan;

  // Update display prices (HARGA_DASAR without unique digits)
  var teksHargaDasar = 'Rp ' + String(HARGA_DASAR).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  ['displayHarga', 'displayHargaStrip', 'displayHargaCatatan'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = teksHargaDasar;
  });

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

  function prosesAmbilKode() {
    kodeAkses = kodeUntukNomor(rujukan);
    lacak('tampilkan_kode');
    trackReferralConversion();
    elKode.textContent = kodeAkses;
    elKode.hidden = false;
    elAmbil.hidden = true;
    if (elBuka) elBuka.setAttribute('href', '../?kode=' + kodeAkses + '#sp-' + angkaRujukan);
    if (elAksiKode) elAksiKode.hidden = false;
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