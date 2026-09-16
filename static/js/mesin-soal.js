/* ============================================================
   MESIN SOAL — riwayat pengerjaan & pemilihan soal anti-hafalan
   ------------------------------------------------------------
   Masalah yang dipecahkan: dulu setiap drill mengambil 25 soal
   ACAK dari seluruh bank. Karena bank per kategori hanya 80-200
   soal, pada sesi ke-4..6 sebanyak 60-80% soal sudah pernah keluar
   - siswa lalu menghafal soal, bukan melatih kemampuan.

   Cara kerja berkas ini:
   1. Setiap soal diberi sidik tetap (kunciSoal) dari isi soal -
      bank lama tidak punya field id, jadi sidik dibuat dari teks.
   2. Hasil tiap soal dicatat (catatHasilSoal): benar/salah, kapan.
   3. pilihSoalAdaptif mengurutkan bank berdasarkan prioritas:
      belum pernah > belum bisa > salah & belum tuntas > sudah bisa
      (makin lama tidak dilihat makin cepat kembali).
      Jadi bank 100 soal baru terulang setelah benar-benar habis.
   Semua di localStorage (tanpa server). Ikut tercadang oleh
   Export/Import data dan sinkronisasi Google Drive.
   ============================================================ */
(function () {
  var KUNCI = 'tni_soal_riwayat';
  var VERSI = 1;
  var HARI = 86400000;
  var BATAS_ENTRI = 5000;

  function hash(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(36);
  }

  // Sidik tetap per soal. Isi soal tidak pernah berubah setelah terbit,
  // jadi sidik ini stabil antar sesi (dan ikut tercadang).
  window.kunciSoal = function (q) {
    if (!q) return 'x0';
    if (q._sig) return 's' + hash(String(q._sig));
    var teks = String(q.pertanyaan || q.soal || q.instruksi || '');
    var opsi = Array.isArray(q.pilihan) ? q.pilihan.join('|') : '';
    return 'k' + hash(teks + '|' + opsi + '|' + String(q.kategori || ''));
  };

  function muat() {
    try {
      var d = JSON.parse(localStorage.getItem(KUNCI) || 'null');
      if (d && d.v === VERSI && d.s && typeof d.s === 'object') return d;
    } catch (e) {}
    return { v: VERSI, s: {} };
  }
  function simpan(d) {
    try { localStorage.setItem(KUNCI, JSON.stringify(d)); } catch (e) {}
  }

  window.riwayatSoal = function () { return muat().s; };

  window.ringkasRiwayat = function () {
    var s = muat().s, out = { total: 0, belum: 0, salah: 0, tuntas: 0, soal: 0 };
    Object.keys(s).forEach(function (k) {
      var e = s[k];
      out.total++;
      if (!e.n) out.belum++;
      else if (e.s > 0 && !e.bt) out.salah++;
      else out.tuntas++;
    });
    return out;
  };

  window.hapusRiwayatSoal = function () {
    try { localStorage.removeItem(KUNCI); } catch (e) {}
  };

  // Catat satu hasil pengerjaan. `benar` = jawaban benar pada percobaan pertama
  // soal itu di sesi ini (pemanggil yang menjamin hanya dicatat sekali).
  window.catatHasilSoal = function (q, benar) {
    if (!q) return;
    var d = muat(), k = window.kunciSoal(q), kini = Date.now();
    var e = d.s[k] || { n: 0, b: 0, s: 0, t: 0, tb: 0, bt: 0, lihat: 0 };
    e.n++;
    e.t = kini;
    if (benar) { e.b++; e.tb = kini; e.bt = (e.bt || 0) + 1; }
    else { e.s++; e.bt = 0; }
    d.s[k] = e;
    var kunci = Object.keys(d.s);
    if (kunci.length > BATAS_ENTRI) {
      kunci.sort(function (a, b) { return (d.s[a].t || 0) - (d.s[b].t || 0); });
      for (var i = 0; i < kunci.length - BATAS_ENTRI; i++) delete d.s[kunci[i]];
    }
    simpan(d);
  };

  function bobotSoal(e, kini) {
    if (!e) return 100;                        // belum pernah keluar sama sekali
    if (!e.n) {                                // pernah tampil, belum dikerjakan
      var jedaBaru = (kini - (e.lihat || 0)) / HARI;
      return Math.min(90, 82 + jedaBaru * 2);
    }
    if (e.s > 0 && !e.bt) {                    // pernah salah, belum pernah tuntas
      var jedaSalah = (kini - (e.t || 0)) / HARI;
      return Math.min(96, 90 + jedaSalah * 2);
    }
    if (e.s > 0 && e.bt < 2) {                 // sudah benar sekali, belum kokoh
      var jedaSet = (kini - (e.tb || e.t || 0)) / HARI;
      return Math.min(74, 45 + jedaSet * 5);
    }
    var jedaTuntas = (kini - (e.tb || e.t || 0)) / HARI;   // sudah benar & kokoh
    return Math.min(55, 10 + jedaTuntas * 3);
  }

  /**
   * Pilih n soal dari bank dengan prioritas anti-hafalan.
   * @param {Array} bank  daftar soal
   * @param {Number} n    jumlah yang diminta
   * @param {Object} opt  { acak: true } -> acak murni (dipakai tryout/simulasi)
   */
  window.pilihSoalAdaptif = function (bank, n, opt) {
    opt = opt || {};
    bank = bank || [];
    n = n || bank.length;
    if (!bank.length) return [];
    if (opt.acak) {
      var acak = bank.slice();
      for (var i = acak.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)), t = acak[i]; acak[i] = acak[j]; acak[j] = t;
      }
      return acak.slice(0, n);
    }
    var d = muat(), kini = Date.now();
    var berperingkat = bank.map(function (q) {
      var k = window.kunciSoal(q);
      var e = d.s[k];
      // sedikit keacakan supaya urutan tidak terasa kaku, tapi tidak
      // sampai mengalahkan beda prioritas antar-tingkat
      var kocok = 0.85 + Math.random() * 0.3;
      return { q: q, k: k, bobot: bobotSoal(e, kini) * kocok };
    });
    berperingkat.sort(function (a, b) { return b.bobot - a.bobot; });
    var hasil = berperingkat.slice(0, Math.min(n, berperingkat.length));
    // tandai sudah tampil (belum tentu dijawab)
    var dd = muat();
    hasil.forEach(function (x) {
      var e = dd.s[x.k] || { n: 0, b: 0, s: 0, t: 0, tb: 0, bt: 0, lihat: 0 };
      e.lihat = kini;
      dd.s[x.k] = e;
    });
    simpan(dd);
    return hasil.map(function (x) { return x.q; });
  };

  // Untuk uji/peraga: berapa persen soal pada sesi ke-k yang sudah pernah keluar
  window.peragaPemilihan = function (bank, n, sesi) {
    var asli = localStorage.getItem(KUNCI);
    window.hapusRiwayatSoal();
    var hasil = [];
    for (var s = 1; s <= (sesi || 5); s++) {
      var pernah = 0;
      window.pilihSoalAdaptif(bank, n, {}).forEach(function (q) {
        var e = window.riwayatSoal()[window.kunciSoal(q)];
        if (e && e.n > 0) pernah++;
      });
      hasil.push({ sesi: s, sudahPernah: pernah, dari: Math.min(n, bank.length) });
    }
    if (asli === null) window.hapusRiwayatSoal(); else localStorage.setItem(KUNCI, asli);
    return hasil;
  };
})();
