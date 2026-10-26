// Set Soal Batch 2 — gerbang kategori konten berbayar kedua.
//
// Kategori ini TIDAK terdaftar dalam data/soal-index.js. Ia hanya muncul
// setelah GET /api/batch2/status?kode=... membalas { batch2: true } untuk
// kode yang disimpan di localStorage "tni_batch2". Tanpa status itu:
// tidak ada kartu kategori, tidak ada konten yang dimuat. Kode diminta
// lewat input di halaman depan bila belum ada; pemeriksaan selalu di
// sisi server, bukan di peramban.
(function () {
  'use strict';

  var KUNCI_SIMPAN = 'tni_batch2';
  var URL_API = 'https://siappsikotes.my.id';
  var NAMA_KATEGORI = 'Set Soal Batch 2';

  function versiAset() {
    var tanda = document.querySelector('script[src*="data/soal-index"]');
    var cocok = tanda ? String(tanda.getAttribute('src') || '').match(/[?&]v=([^&]+)/) : null;
    return cocok ? cocok[1] : 'v';
  }

  function bacaKode() {
    try { return localStorage.getItem(KUNCI_SIMPAN) || ''; } catch (e) { return ''; }
  }

  function simpan(kode) {
    try { localStorage.setItem(KUNCI_SIMPAN, kode); } catch (e) {}
  }

  function buangKode() {
    try { localStorage.removeItem(KUNCI_SIMPAN); } catch (e) {}
  }

  function cekStatus(kode) {
    return fetch(URL_API + '/api/batch2/status?kode=' + encodeURIComponent(kode), { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  window.batch2Aktif = function () {
    return !!(window.DATA_SOAL_INDEX && window.DATA_SOAL_INDEX.batch2);
  };

  function daftarkanKategori() {
    if (!window.DATA_SOAL_INDEX) return;
    var jumlah = (window.SOAL_PART.batch2 && window.SOAL_PART.batch2.soal)
      ? window.SOAL_PART.batch2.soal.length : 0;
    window.DATA_SOAL_INDEX.batch2 = { nama: NAMA_KATEGORI, jumlah: jumlah };
  }

  // Konten baru diunduh setelah status bilang boleh — dan namanya data/soal-batch2.js,
  // persis pola sirup data-loader (data/soal-<kategori>.js), jadi startCat('batch2')
  // otomatis memakainya.
  function muatKonten(kembali) {
    if (window.SOAL_PART.batch2) { daftarkanKategori(); return kembali(true); }
    var s = document.createElement('script');
    s.src = 'data/soal-batch2.js?v=' + versiAset();
    s.onload = function () {
      if (window.SOAL_PART.batch2) { daftarkanKategori(); kembali(true); }
      else kembali(false);
    };
    s.onerror = function () { kembali(false); };
    document.head.appendChild(s);
  }

  // Kartu gerbang di halaman depan: hilang sendiri setelah kategori aktif.
  window.batch2GerbangHtml = function () {
    if (window.batch2Aktif()) return '';
    return '<div class="tips-box">' +
      '<div class="tips-title">' + ic('shield', 16) + ' Set Soal Batch 2</div>' +
      '<div class="tips-sub" style="color:var(--text2);font-size:12px">Sudah membeli Set Soal Batch 2? Tempel kode akses di sini untuk membuka 120 soal varian baru.</div>' +
      '<div style="display:flex;gap:8px;margin-top:10px">' +
      '<input id="batch2Kode" style="flex:1;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:var(--text);font-size:13px" placeholder="Tempel kode akses ..." aria-label="Kode akses Set Soal Batch 2">' +
      '<button class="btn btn-primary btn-sm" onclick="batch2CekKode()">Buka</button>' +
      '</div>' +
      '<div id="batch2Status" style="margin-top:8px;font-size:11px;color:var(--text3)"></div>' +
      '</div>';
  };

  window.batch2CekKode = function () {
    var el = document.getElementById('batch2Kode');
    var st = document.getElementById('batch2Status');
    var kode = String((el && el.value) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (kode.length < 8 || kode.slice(0, 2) !== 'SP') {
      if (st) st.textContent = 'Kode tidak sah — bentuknya SP... panjang 8 huruf/angka. Kode akses diperiksa server sebelum konten dibuka.';
      return;
    }
    if (st) st.textContent = 'Memeriksa kode...';
    cekStatus(kode).then(function (res) {
      if (res && res.batch2) {
        simpan(kode);
        muatKonten(function (siap) {
          if (siap) {
            if (st) st.textContent = '' + NAMA_KATEGORI + ' sudah terbuka — kategorinya sekarang tampil di daftar.';
            if (typeof window.render === 'function') window.render();
          } else if (st) {
            st.textContent = 'Kode sah, tetapi kontennya belum bisa dimuat. Coba muat ulang halaman.';
          }
        });
      } else {
        buangKode();
        if (st) st.textContent = (res && res.pesan) ? res.pesan : 'Kode ini belum membuka Set Soal Batch 2. Selesaikan pembelian lewat /beli/ lalu coba lagi.';
      }
    });
  };

  function boot() {
    var kode = bacaKode();
    if (!kode) return;
    cekStatus(kode).then(function (res) {
      if (res && res.batch2) muatKonten(function () {
        if (typeof window.render === 'function') window.render();
      });
      else if (res) buangKode(); // server secara jelas menolak; koneksi gagal biarkan kode tersimpan
    });
  }

  window.batch2Boot = boot;

  // --- Tanam kartu gerbang pada halaman depan (tanpa render ulang penuh) ---
  // Halaman depan di-render ulang berkali-kali oleh aplikasi; kartu kategori
  // dan gerbang kode TIDAK mungkin masuk lewat renderHome karena kategori ini
  // di luar daftar resmi. Jadi: pasang ulang kartu gerbang setiap kali
  // halaman depan selesai digambar, selama batch2 belum aktif.
  function tanamKartu() {
    var tag = document.getElementById('buildTag');
    if (!tag || window.batch2Aktif() || bacaKode()) return;
    if (document.getElementById('batch2Kode')) return; // tertanam pada render ulang ini
    var kartu = document.createElement('div');
    kartu.innerHTML = window.batch2GerbangHtml();
    tag.parentNode.insertBefore(kartu.firstChild, tag);
  }
  window.batch2Tanam = tanamKartu;
  if (typeof window.render === 'function') {
    var render_asli = window.render;
    window.render = function () {
      var hasil_render = render_asli.apply(this, arguments);
      setTimeout(tanamKartu, 0);
      return hasil_render;
    };
  }
  tanamKartu();
})();
