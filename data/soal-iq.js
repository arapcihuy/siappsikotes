// ============================================================
// IQ LAB — ITEM BANK & GENERATOR (data/soal-iq.js)
// Basis item terstandar internasional (ICAR / Raven-style):
//   MR  = Matrix Reasoning
//   LN  = Letter & Number Series
//   VR  = Verbal Reasoning / Aritmetika
//   R3D = 3D Rotation (disimulasikan rotasi figural)
// Semua item digenerate lokal di browser. Tanpa jaringan, tanpa akun.
// Format item sama dengan SOAL_DATABASE: {id, pertanyaan, pilihan,
// jawaban, pembahasan, kategori} + opsional {svg, pilihanSvg}.
//
// CATATAN VARIASI (perbaikan sesudah keluhan "soal drill hanya diulang"):
//   - versi lama: 8 pola deret angka, 3 pola deret huruf, 4 aturan matriks,
//     6 soal cerita. Dalam satu set 10 soal, 100% set memuat pola kembar
//     (deret huruf bisa 8 soal berpola sama!) dan 69% soal matriks pernah
//     keluar di sesi lain.
//   - versi ini: 20 pola angka, 11 pola huruf, 8 aturan matriks figural,
//     4 bentuk dasar rotasi, 14 soal cerita. Setiap pola hanya dipakai
//     sekali per set, dan soal yang pernah keluar diturunkan prioritasnya
//     memakai riwayat di mesin-soal.js.
// ============================================================

// ---- REFERENSI ALAT UKUR TERVALIDASI (untuk skor & norma) ----
var IQ_REF = {
  target: 110,
  baseline: 100,
  links: [
    {
      nama: 'ICAR — International Cognitive Ability Resource',
      url: 'https://icar-project.org/sampletest/sampletest2013.php',
      ukur: 'Matrix reasoning, deret angka & huruf, verbal, rotasi 3D (16 item)',
      dasar: 'Public-domain, divalidasi lewat publikasi peer-review, dipakai riset psikometri'
    },
    {
      nama: 'Mensa Norway — tes ter-norma (Raven-style)',
      url: 'https://test.mensa.no/',
      ukur: 'Penalaran figural/abstrak, 35 item, 25 menit',
      dasar: 'Norma populasi, keluaran estimasi IQ skala SD15'
    },
    {
      nama: 'Cambridge Brain Sciences',
      url: 'https://www.cambridgebrainsciences.com/',
      ukur: '12 task: memori, penalaran, atensi, kecepatan',
      dasar: 'Baterai riset kognitif, banyak publikasi ilmiah'
    },
    {
      nama: 'BrainHQ (Posit Science)',
      url: 'https://www.brainhq.com/',
      ukur: 'Speed of processing, memori, atensi',
      dasar: 'Diuji lewat RCT besar (ACTIVE trial) — basis bukti terkuat di kelas brain training'
    },
    {
      nama: 'CogniFit — IQbe',
      url: 'https://www.cognifit.com/us/id/iq-test-iqbe',
      ukur: 'IQ nonverbal culture-fair, laporan per-domain',
      dasar: 'Penilaian digital ternorma, minim bias budaya'
    },
    {
      nama: 'TIKI — Tes Intelegensi Kolektif Indonesia',
      url: 'https://www.talentlytica.com/alat-ukur/tes-intelegensi-kolektif-indonesia',
      ukur: 'Intelegensi umum dengan norma Indonesia',
      dasar: 'Dikembangkan bersama Fakultas Psikologi Unpad & Vrije Universiteit Amsterdam'
    }
  ],
  domain: [
    { key: 'angka',    nama: 'Deret Angka',         kode: 'LN',  desc: 'Pola aritmetika, geometri, selang-seling, beda naik, kombinatorial' },
    { key: 'huruf',    nama: 'Deret Huruf',         kode: 'LN',  desc: 'Pola alfabetik dengan lompatan tetap / berubah' },
    { key: 'matriks',  nama: 'Matriks Figural',     kode: 'MR',  desc: 'Aturan baris-kolom: jumlah elemen, rotasi, isi bentuk' },
    { key: 'rotasi',   nama: 'Rotasi Figural',      kode: 'R3D', desc: 'Hasil putaran vs cermin (distraktor mirror)' },
    { key: 'verbal',   nama: 'Verbal & Aritmetika', kode: 'VR',  desc: 'Pecahan bertingkat, umur, perbandingan, sudut jam, kecepatan' },
    { key: 'campuran', nama: 'Campuran Semua Jenis', kode: 'MIX', desc: 'Acak semua jenis soal — melatih ketahanan & kecepatan seperti tes asli' }
  ]
};

// ============================================================
// SVG HELPER — gambar figural (inline SVG, aman & offline)
// inner() = isi gambar (tanpa <svg>), cell() = dibungkus <svg>
// ============================================================
var IQ_SVG = (function () {
  function wrap(inner, size) {
    size = size || 64;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
  }
  var POS9 = [
    [16, 16], [32, 16], [48, 16],
    [16, 32], [32, 32], [48, 32],
    [16, 48], [32, 48], [48, 48]
  ];
  function innerDots(n) {
    var s = '';
    for (var i = 0; i < Math.min(n, 9); i++) {
      s += '<circle cx="' + POS9[i][0] + '" cy="' + POS9[i][1] + '" r="5.5" fill="currentColor"/>';
    }
    return s;
  }
  function innerLines(n) {
    var s = '';
    for (var i = 0; i < Math.min(n, 9); i++) {
      var y = 12 + i * 6;
      s += '<line x1="12" y1="' + y + '" x2="52" y2="' + y + '"/>';
    }
    return s;
  }
  function innerPolygon(sides, filled) {
    var cx = 32, cy = 32, r = 20, pts = [];
    for (var i = 0; i < sides; i++) {
      var ang = (Math.PI * 2 * i / sides) - Math.PI / 2;
      pts.push((cx + r * Math.cos(ang)).toFixed(1) + ',' + (cy + r * Math.sin(ang)).toFixed(1));
    }
    return '<polygon points="' + pts.join(' ') + '"' + (filled ? ' fill="currentColor"' : '') + '/>';
  }
  // Bentuk ASIMETRIS (panji pada tiang) — memang tidak simetris, jadi hasil
  // CERMIN selalu berbeda dari hasil PUTARAN. Ini inti latihan rotasi vs cermin.
  var ASYM = '14,6 50,42 14,30 14,58';
  function innerAsym(deg, mirror) {
    var t = 'rotate(' + (deg || 0) + ' 32 32)';
    if (mirror) t = 'translate(64,0) scale(-1,1) ' + t;
    return '<polygon points="' + ASYM + '" transform="' + t + '"/>';
  }
  // Bentuk asimetris kedua: huruf L (kaki panjang + kaki pendek)
  var BENTUK_L = '18,10 26,10 26,42 50,42 50,50 18,50';
  // Bentuk asimetris ketiga: kunci (batang + dua gigi)
  var BENTUK_KUNCI = '20,26 20,18 32,18 32,26 44,26 44,32 32,32 32,54 20,54';
  // Bentuk asimetris keempat: segitiga bertangkai
  var BENTUK_SEGITIGA = '32,8 50,40 32,40 32,56 14,24 32,24';
  // Bentuk asimetris tambahan (palangnya tidak sama panjang kiri-kanan)
  var BENTUK_T = '14,10 44,10 44,16 34,16 34,54 28,54 28,16 14,16';
  var BENTUK_F = '16,10 44,10 44,16 22,16 22,28 38,28 38,34 22,34 22,54 16,54';
  var BENTUK_BENDERA = '18,8 18,56 56,32';           // segitiga siku pada tiang
  var BENTUK_PANAH = '10,32 30,12 30,24 54,24 54,40 30,40 30,52';
  var BENTUK = [ASYM, BENTUK_L, BENTUK_KUNCI, BENTUK_SEGITIGA, BENTUK_T, BENTUK_F, BENTUK_BENDERA, BENTUK_PANAH];
  function innerBentuk(idx, deg, mirror) {
    var t = 'rotate(' + (deg || 0) + ' 32 32)';
    if (mirror) t = 'translate(64,0) scale(-1,1) ' + t;
    return '<polygon points="' + BENTUK[idx % BENTUK.length] + '" transform="' + t + '"/>';
  }
  function innerGlyphs(n) {
    var g = ['<circle cx="32" cy="14" r="7"/>', '<polygon points="32,22 40,36 24,36"/>', '<rect x="24" y="42" width="16" height="16" rx="3"/>'];
    var s = '';
    for (var i = 0; i < Math.min(n, 3); i++) s += g[i];
    return s;
  }
  // state -> isi gambar, sesuai aturan
  function inner(state, rule) {
    if (rule === 'titik')  return innerDots(state);
    if (rule === 'garis')  return innerLines(state);
    if (rule === 'rotasi') return innerAsym(state, false);
    if (rule === 'bentuk') return innerPolygon(state.sides, state.filled);
    if (rule === 'glyph')  return innerGlyphs(state);
    if (rule === 'putarBentuk') return innerBentuk(state.bIdx || 0, state.deg || 0, false);
    if (rule === 'kombinasi') return innerKombinasi(state);
    return '';
  }
  // Aturan kombinasi: setiap ciri muncul mengikuti syarat baris/kolom yang tetap.
  // Tiga skema dipakai bergantian supaya soalnya tidak terasa sama.
  function innerKombinasi(state) {
    var s = '';
    var b = state.b, c = state.c, sk = state.skema || 1;
    if (sk === 2) {
      if ((b + c) % 2 === 1) s += '<circle cx="18" cy="18" r="6" fill="currentColor"/>';
      if (b === c) s += '<rect x="38" y="38" width="13" height="13" rx="2" fill="currentColor"/>';
      if (b === 0 || c === 2) s += '<line x1="12" y1="46" x2="52" y2="46"/>';
      return s;
    }
    if (sk === 3) {
      if (b <= c) s += '<circle cx="18" cy="18" r="6" fill="currentColor"/>';
      if (b >= c) s += '<rect x="38" y="38" width="13" height="13" rx="2" fill="currentColor"/>';
      if (b * c > 0 && (b * c) % 2 === 0) s += '<line x1="12" y1="46" x2="52" y2="46"/>';
      return s;
    }
    if (b === 0 || c === 0) {
      s += '<circle cx="18" cy="18" r="6" fill="currentColor"/>';
    }
    if (b === 2 || c === 2) {
      s += '<rect x="38" y="38" width="13" height="13" rx="2" fill="currentColor"/>';
    }
    if ((b + c) % 2 === 0) {
      s += '<line x1="12" y1="46" x2="52" y2="46"/>';
    }
    return s;
  }
  function cell(state, rule, size) { return wrap(inner(state, rule), size || 60); }

  // Grid 3x3 soal matriks: 8 sel terisi, sel terakhir bertanda "?"
  function grid(cellsArr, missingIdx) {
    var s = '';
    for (var i = 0; i < 9; i++) {
      var r = Math.floor(i / 3), c = i % 3;
      var x = c * 70 + 6, y = r * 70 + 6;
      s += '<rect x="' + x + '" y="' + y + '" width="66" height="66" rx="8" fill="rgba(255,255,255,0.04)" stroke="currentColor" stroke-width="1" opacity="0.45"/>';
      if (i === missingIdx) {
        s += '<text x="' + (x + 33) + '" y="' + (y + 46) + '" font-size="32" text-anchor="middle" fill="currentColor" stroke="none">?</text>';
      } else {
        s += '<g transform="translate(' + (x + 1) + ',' + (y + 1) + ') scale(1.0)">' + cellsArr[i] + '</g>';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 216 216" width="300" height="300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + s + '</svg>';
  }
  return { wrap: wrap, inner: inner, cell: cell, grid: grid, POS9: POS9, BENTUK: BENTUK, innerBentuk: innerBentuk };
})();

// ============================================================
// GENERATOR ITEM
// ============================================================
var IQ_GEN = (function () {
  var ABJAD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  // Batas pola yang sama di dalam SATU set. Deret huruf hanya punya 11 pola,
  // jadi paling banyak 2 soal per pola; angka/verbal lebih longgar.
  var BATAS_POLA = { angka: 2, huruf: 2, verbal: 2, matriks: 2, rotasi: 3 };

  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffle(a) {
    var x = a.slice();
    for (var i = x.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = x[i]; x[i] = x[j]; x[j] = t; }
    return x;
  }
  function rataDua(x) { return Math.round(x * 10) / 10; }

  // Susun 4 opsi unik yang memuat jawaban benar.
  function susunOpsi(correct, kandidat, extraFn) {
    var c = String(correct);
    var out = [c];
    var cNum = Number(c);
    var benarPositif = !isNaN(cNum) && c.trim() !== '' && cNum > 0;
    function coba(v) {
      if (v === null || v === undefined) return;
      var s = String(v);
      if (s.length === 0 || s === c) return;
      if (out.indexOf(s) !== -1) return;
      if (benarPositif && !isNaN(Number(s)) && Number(s) <= 0) return;
      if (out.length < 4) out.push(s);
    }
    (kandidat || []).forEach(coba);
    var n = Number(c);
    for (var bump = 1; out.length < 4 && bump <= 40; bump++) {
      if (!isNaN(n) && c.trim() !== '') {
        var cand = (bump % 2 === 1) ? n - Math.ceil(bump / 2) : n + Math.ceil(bump / 2);
        coba(cand);
      } else if (extraFn) {
        coba(extraFn(bump));
      }
    }
    var opsi = shuffle(out);
    return { pilihan: opsi, jawaban: opsi.indexOf(c) };
  }

  function buatItem(tipe, pertanyaan, correct, kandidat, pembahasan, extra, extraFn) {
    var o = susunOpsi(correct, kandidat, extraFn);
    var it = {
      id: 'iq-' + tipe + '-' + Math.random().toString(36).slice(2, 9),
      pertanyaan: pertanyaan,
      pilihan: o.pilihan,
      jawaban: o.jawaban,
      pembahasan: pembahasan,
      kategori: extra && extra.kategori ? extra.kategori : 'IQ',
      _tipe: tipe,
      _pola: (extra && extra._pola) ? extra._pola : tipe,
      _correct: String(correct)
    };
    if (extra) for (var k in extra) it[k] = extra[k];
    return it;
  }
  function bersih(list, benar) {
    var out = [];
    list.forEach(function (v) {
      if (v === null || v === undefined) return;
      if (!isNaN(Number(v)) && Number(v) <= 0) return;
      if (String(v) === String(benar)) return;
      if (out.indexOf(v) === -1) out.push(v);
    });
    return out;
  }

  // ---------- PENJAGA AMBIGUITAS ----------
  // Menghitung ULANG seluruh pola yang mungkin cocok dengan deret yang tampil.
  // Kalau ada pola lain yang menghasilkan jawaban BERBEDA, soal itu punya dua
  // jawaban benar -> harus dibuang (ini kesalahan yang paling menyesatkan).
  function kandidatAngka(t) {
    if (!t || t.length !== 5) return [];
    var t0 = t[0], t1 = t[1], t2 = t[2], t3 = t[3], t4 = t[4];
    var d = [t1 - t0, t2 - t1, t3 - t2, t4 - t3];
    var out = [];
    function add(v) { if (typeof v === 'number' && isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9) out.push(Math.round(v)); }
    if (d[0] === d[1] && d[1] === d[2] && d[2] === d[3]) add(t4 + d[0]);
    if (t0 !== 0 && t1 % t0 === 0 && t2 % t1 === 0 && t3 % t2 === 0 && t4 % t3 === 0) {
      var r = t1 / t0;
      if (r === t2 / t1 && r === t3 / t2 && r === t4 / t3) add(t4 * r);
    }
    if (t1 !== 0 && t0 % t1 === 0 && t1 % t2 === 0 && t2 % t3 === 0 && t3 % t4 === 0) {
      var rb = t0 / t1;
      if (rb === t1 / t2 && rb === t2 / t3 && rb === t3 / t4) add(t4 / rb);
    }
    if (d[0] === d[2] && d[1] === d[3]) add(t4 + d[0]);
    if (d[1] - d[0] === d[2] - d[1] && d[2] - d[1] === d[3] - d[2]) add(t4 + d[3] + (d[3] - d[2]));
    if (t0 + t1 === t2 && t1 + t2 === t3 && t2 + t3 === t4) add(t4 + t3);
    var cf = t0 + t1 - t2;
    if (t3 === t1 + t2 - cf && t4 === t2 + t3 - cf) add(t4 + t3 - cf);
    if (d[1] === 2 * d[0] && d[2] === 2 * d[1] && d[3] === 2 * d[2]) add(t4 + 2 * d[3]);
    for (var m = 2; m <= 4; m++) {
      var c = t1 - t0 * m;
      if (t2 === t1 * m + c && t3 === t2 * m + c && t4 === t3 * m + c) add(t4 * m + c);
    }
    if (t1 === t0 * 2 && t3 === t2 * 2 && t2 === t1 + (t2 - t1) && t4 === t3 + (t2 - t1)) add(t4 * 2);
    var dd = t1 - t0;
    { const dd = t1 - t0; if (t2 === t1 * 2 && t3 === t2 + dd && t4 === t3 * 2) add(t4 + dd); }
    if (t1 === t0 * 2 && t3 === t2 * 2 && (t2 - t1) === (t4 - t3)) add(t4 * 2);   // x2 lalu +d berulang
    if (d[0] === 1 && d[1] === 2 && d[2] === 2 && d[3] === 4) add(t4 + 2);        // deret prima + c
    var d2a = d[1] - d[0];
    if (d2a === d[2] - d[1] && d2a === d[3] - d[2]) add(t4 + d[3] + d2a);
    var d3a = (d[2] - d[1]) - d2a;
    if (d3a === ((d[3] - d[2]) - (d[2] - d[1])) && d3a !== 0) {
      var sl4 = d[3] + d3a, sl5 = sl4 + d3a;
      add(t4 + sl4);
    }
    if (t2 - t0 === t4 - t2) add(t3 + (t2 - t0));
    var z = t3 - t0;
    if (t4 - t1 === z) add(t2 + z);
    return out;
  }

  function kandidatHuruf(p) {
    if (!p || p.length !== 5) return [];
    var d = [p[1] - p[0], p[2] - p[1], p[3] - p[2], p[4] - p[3]];
    var out = [];
    function add(v) { if (typeof v === 'number' && v >= 1 && v <= 26) out.push(v); }
    if (d[0] === d[1] && d[1] === d[2] && d[2] === d[3]) add(p[4] + d[0]);
    if (d[0] === d[2] && d[1] === d[3]) add(p[4] + d[0]);
    if (d[1] - d[0] === d[2] - d[1] && d[2] - d[1] === d[3] - d[2]) add(p[4] + d[3] + (d[3] - d[2]));
    if (d[0] === d[1] && d[2] === 1 && d[3] === d[0]) add(p[4] + d[0]);
    if (p[0] === 1 && p[1] === 26 && p[2] === 2 && p[3] === 25) add(24);
    if (d[0] === d[2] && d[1] === d[3] && d[0] > 0 && d[1] < 0) add(p[4] + d[0]);
    if (d[0] === 1 && d[1] === 1 && d[2] === -1 && d[3] === -1) add(p[4] - 1);
    if (p[2] - p[0] === p[4] - p[2]) add(p[3] + (p[2] - p[0]));
    if (d[1] - d[0] === 2 && d[2] - d[1] === 2 && d[3] - d[2] === 2) add(p[4] + d[3] + 2);
    return out;
  }

  // true = deret ini punya lebih dari satu jawaban yang masuk akal
  function ambiguAngka(t, n) {
    var k = kandidatAngka(t), lain = {};
    k.forEach(function (v) { if (v !== n && v > 0) lain[v] = 1; });
    return Object.keys(lain).length > 0;
  }
  function ambiguHuruf(p, pos) {
    var k = kandidatHuruf(p), lain = {};
    k.forEach(function (v) { if (v !== pos) lain[v] = 1; });
    return Object.keys(lain).length > 0;
  }

  // ---------- LN: DERET ANGKA (20 pola) ----------
  function deretAngka(attempt) {
    attempt = attempt || 0;
    var t = [], n = 0, aturan = '', kandidat = [], pola = '';
    var r = ri(1, 20);
    if (r === 1) {                       // aritmetika tetap
      pola = 'aritmetika';
      var d = pick([3, 4, 5, 6, 7, 8, 9, 11, -3, -4, -5, -6]);
      var a = d > 0 ? ri(2, 15) : ri(Math.abs(d) * 5 + 2, Math.abs(d) * 5 + 25);
      for (var i = 0; i < 5; i++) t.push(a + i * d);
      n = a + 5 * d;
      aturan = 'Deret aritmetika: setiap suku bertambah ' + d + '. ' + t[4] + ' ' + (d > 0 ? '+' : '-') + ' ' + Math.abs(d) + ' = ' + n + '.';
      kandidat = [n + d, n - d, n + 1, n - 1, n + 2 * d];
    } else if (r === 2) {                // geometri
      pola = 'geometri';
      var rr = pick([2, 3]), a2 = ri(1, 4);
      for (var j = 0; j < 5; j++) t.push(a2 * Math.pow(rr, j));
      n = a2 * Math.pow(rr, 5);
      aturan = 'Deret geometri: setiap suku dikali ' + rr + '. ' + t[4] + ' x ' + rr + ' = ' + n + '.';
      kandidat = [n + rr, n - rr, n / rr, n + t[4], t[4] + rr];
    } else if (r === 3) {                // dua pola bergantian
      pola = 'bergantian-2';
      var p = ri(3, 9), q = ri(11, 19);
      if (Math.random() < 0.4) q = -q;
      var cur = ri(2 * Math.abs(q) + 15, 2 * Math.abs(q) + 45);
      t.push(cur);
      for (var k2 = 0; k2 < 4; k2++) { cur += (k2 % 2 === 0) ? p : q; t.push(cur); }
      n = cur + p;
      aturan = 'Dua pola bergantian: +' + p + ' lalu ' + (q > 0 ? '+' : '') + q + '. Suku ke-6 lanjut pola +' + p + ': ' + t[4] + ' + ' + p + ' = ' + n + '.';
      kandidat = [cur + q, n + 1, n - 1, n + p, t[4] + q];
    } else if (r === 4) {                // selisih naik tetap
      pola = 'beda-naik';
      var d4 = ri(2, 7), inc = ri(1, 4);
      t.push(ri(1, 9));
      for (var k4 = 0; k4 < 4; k4++) t.push(t[t.length - 1] + d4 + k4 * inc);
      n = t[4] + d4 + 4 * inc;
      aturan = 'Selisih antar suku naik ' + inc + ' tiap langkah (' + d4 + ', ' + (d4 + inc) + ', ' + (d4 + 2 * inc) + ', ' + (d4 + 3 * inc) + '). Selisih berikutnya ' + (d4 + 4 * inc) + ': ' + t[4] + ' + ' + (d4 + 4 * inc) + ' = ' + n + '.';
      kandidat = [n + inc, n - inc, n + d4, t[4] + d4 + 3 * inc, n + 1];
    } else if (r === 5) {                // kali lalu tambah
      pola = 'kali-tambah';
      var m = pick([2, 3]), c5 = ri(1, 6), a5 = ri(1, 5);
      t.push(a5);
      for (var k5 = 0; k5 < 4; k5++) t.push(t[t.length - 1] * m + c5);
      n = t[4] * m + c5;
      aturan = 'Pola x' + m + ' lalu +' + c5 + '. ' + t[4] + ' x ' + m + ' + ' + c5 + ' = ' + n + '.';
      kandidat = [n + c5, n - c5, t[4] * m, n + m, n - m];
    } else if (r === 6) {                // kuadrat + c
      pola = 'kuadrat';
      var c6 = ri(1, 9);
      for (var k6 = 2; k6 <= 6; k6++) t.push(k6 * k6 + c6);
      n = 49 + c6;
      aturan = 'Bilangan kuadrat + ' + c6 + ' (selisih naik 2: ' + (t[1] - t[0]) + ', ' + (t[2] - t[1]) + ', ' + (t[3] - t[2]) + ', ' + (t[4] - t[3]) + '). Berikutnya 49 + ' + c6 + ' = ' + n + '.';
      kandidat = [n + 2, n - 2, n + 1, t[4] + (t[4] - t[3]), n - 1];
    } else if (r === 7) {                // fibonacci
      pola = 'fibonacci';
      var f1 = ri(1, 6), f2 = ri(2, 7);
      t = [f1, f2];
      for (var k7 = 0; k7 < 3; k7++) t.push(t[t.length - 1] + t[t.length - 2]);
      n = t[4] + t[3];
      aturan = 'Tiap suku = jumlah dua suku sebelumnya. ' + t[3] + ' + ' + t[4] + ' = ' + n + '.';
      kandidat = [t[4] + t[2], n + 1, n - 1, t[4] * 2, n + 2];
    } else if (r === 8) {                // 2^k + c
      pola = 'pangkat-dua';
      var c8 = ri(0, 5);
      t = [2, 4, 8, 16, 32].map(function (v) { return v + c8; });
      n = 64 + c8;
      aturan = 'Deret 2^n + ' + c8 + ' (selisih mengganda tiap langkah). Berikutnya 64 + ' + c8 + ' = ' + n + '.';
      kandidat = [n + 1, n - 1, n + 2, n * 2, 32 + c8];
    } else if (r === 9) {                // pangkat tiga + c
      pola = 'pangkat-tiga';
      var c9 = ri(0, 6);
      t = [1, 8, 27, 64, 125].map(function (v) { return v + c9; });
      n = 216 + c9;
      aturan = 'Bilangan pangkat tiga + ' + c9 + ' (1, 8, 27, 64, 125). Berikutnya 6^3 = 216, lalu + ' + c9 + ' = ' + n + '.';
      kandidat = [n + 1, n - 1, n + 3, 125 + c9, n * 2];
    } else if (r === 10) {               // selisih mengganda
      pola = 'selisih-ganda';
      var d10 = ri(1, 5), a10 = ri(1, 8), s10 = d10, cur10 = a10;
      t.push(cur10);
      for (var k10 = 0; k10 < 4; k10++) { cur10 += s10; t.push(cur10); s10 *= 2; }
      n = cur10 + s10;
      aturan = 'Selisih mengganda: ' + d10 + ', ' + (d10 * 2) + ', ' + (d10 * 4) + ', ' + (d10 * 8) + '. Selisih berikutnya ' + s10 + ': ' + t[4] + ' + ' + s10 + ' = ' + n + '.';
      kandidat = [n + d10, n - d10, t[4] + s10 / 2, n + 1, n - 1];
    } else if (r === 11) {               // prima + c
      pola = 'prima';
      var c11 = ri(0, 7);
      t = [2, 3, 5, 7, 11].map(function (v) { return v + c11; });
      n = 13 + c11;
      aturan = 'Deret bilangan prima + ' + c11 + ' (2, 3, 5, 7, 11). Prima berikutnya 13, jadi 13 + ' + c11 + ' = ' + n + '.';
      kandidat = [n + 1, n - 1, n + 2, 11 + c11, n - 2];
    } else if (r === 12) {               // kali lalu kurang
      pola = 'kali-kurang';
      var m12 = pick([2, 3]), c12 = ri(1, 6), a12 = ri(6, 20);
      t.push(a12);
      for (var k12 = 0; k12 < 4; k12++) t.push(t[t.length - 1] * m12 - c12);
      n = t[4] * m12 - c12;
      aturan = 'Pola x' + m12 + ' lalu -' + c12 + '. ' + t[4] + ' x ' + m12 + ' - ' + c12 + ' = ' + n + '.';
      kandidat = [n + c12, n - c12, t[4] * m12, n + m12, n - m12];
    } else if (r === 13) {               // selang-seling x2 dan +d
      pola = 'selang-kali-tambah';
      var a13 = ri(2, 6), d13 = ri(2, 7), cur13 = a13;
      t.push(cur13);
      for (var k13 = 0; k13 < 4; k13++) { cur13 = (k13 % 2 === 0) ? cur13 * 2 : cur13 + d13; t.push(cur13); }
      n = cur13 * 2;
      aturan = 'Pola berselang-seling: x2, lalu +' + d13 + ', x2, +' + d13 + ', dan seterusnya. Suku ke-6 berarti x2 lagi: ' + t[4] + ' x 2 = ' + n + '.';
      kandidat = [n + d13, n - d13, cur13 + d13, n + 1, n - 2];
    } else if (r === 14) {               // fibonacci dikurangi c
      pola = 'fib-minus';
      var c14 = ri(1, 4), g1 = ri(3, 7), g2 = ri(4, 9);
      t = [g1, g2];
      for (var k14 = 0; k14 < 3; k14++) t.push(t[t.length - 1] + t[t.length - 2] - c14);
      n = t[4] + t[3] - c14;
      aturan = 'Tiap suku = jumlah dua suku sebelumnya dikurangi ' + c14 + '. ' + t[3] + ' + ' + t[4] + ' - ' + c14 + ' = ' + n + '.';
      kandidat = [t[4] + t[3], n + c14, n + 1, n - 1, n + 2];
    } else if (r === 15) {               // deret menurun (bagi tetap)
      pola = 'bagi-tetap';
      var rr15 = pick([2, 3]), a15 = ri(1, 5);
      t = [a15 * Math.pow(rr15, 5), a15 * Math.pow(rr15, 4), a15 * Math.pow(rr15, 3), a15 * Math.pow(rr15, 2), a15 * rr15];
      n = a15;
      aturan = 'Deret menurun: setiap suku dibagi ' + rr15 + '. ' + t[4] + ' / ' + rr15 + ' = ' + n + '.';
      kandidat = [n * rr15, n + rr15, n - 1, n + 1, n * 2];
    } else if (r === 16) {               // campuran tambah lalu kali
      pola = 'tambah-kali';
      var d16 = ri(2, 6), a16 = ri(1, 5);
      t.push(a16);
      for (var k16 = 0; k16 < 4; k16++) { t.push((k16 % 2 === 0) ? t[t.length - 1] + d16 : t[t.length - 1] * 2); }
      n = t[4] + d16;
      aturan = 'Pola berselang-seling: +' + d16 + ' lalu x2. ' + t[4] + ' + ' + d16 + ' = ' + n + '.';
      kandidat = [t[4] * 2, n + d16, n - d16, n + 1, n - 2];
    } else if (r === 17) {               // selisih menurun
      pola = 'beda-turun';
      var d17 = ri(6, 12), inc17 = ri(1, 3), a17 = ri(2, 8);
      t.push(a17);
      for (var k17 = 0; k17 < 4; k17++) { t.push(t[t.length - 1] + (d17 - k17 * inc17)); }
      n = t[4] + (d17 - 4 * inc17);
      aturan = 'Selisih antar suku menurun ' + inc17 + ' tiap langkah (' + d17 + ', ' + (d17 - inc17) + ', ' + (d17 - 2 * inc17) + ', ' + (d17 - 3 * inc17) + '). Selisih berikutnya ' + (d17 - 4 * inc17) + ': ' + t[4] + ' + ' + (d17 - 4 * inc17) + ' = ' + n + '.';
      kandidat = [n + inc17, n - inc17, n + d17, t[4] + (d17 - 3 * inc17), n + 1];
    } else if (r === 18) {               // tiga pola bergantian
      pola = 'bergantian-3';
      var p18 = ri(2, 6), q18 = ri(7, 12), z18 = ri(1, 4);
      var c18 = ri(30, 60);
      t = [c18, c18 + p18, c18 + p18 + q18, c18 + z18, c18 + p18 + z18];
      n = c18 + p18 + q18 + z18;
      aturan = 'Pola tiga langkah yang berulang: +' + p18 + ', +' + q18 + ', +' + z18 + '. Suku ke-4 sampai ke-6 mengulang pola itu: ' + t[3] + ', ' + t[4] + '. Suku ke-6 = suku ke-3 + ' + z18 + ' = ' + t[2] + ' + ' + z18 + ' = ' + n + '.';
      kandidat = [t[2] + z18, t[0] + z18, n + p18, n - z18, n + 1];
    } else if (r === 19) {               // bilangan triangular (k(k+1)/2)
      pola = 'triangular';
      var c19 = ri(0, 6);
      t = [1, 3, 6, 10, 15].map(function (v) { return v + c19; });
      n = 21 + c19;
      aturan = 'Bilangan triangular (1, 3, 6, 10, 15 = jumlah 1, 1+2, 1+2+3, ...) + ' + c19 + '. Berikutnya 21 + ' + c19 + ' = ' + n + '.';
      kandidat = [n + 1, n - 1, n + 2, 15 + c19, n + 3];
    } else {                             // dua deret berselang
      pola = 'dua-deret';
      var a20 = ri(2, 8), b20 = ri(12, 25), d20 = ri(2, 6);
      t = [a20, b20, a20 + d20, b20 + d20, a20 + 2 * d20];
      n = b20 + 2 * d20;
      aturan = 'Dua deret berselang-seling: deret ganjil (' + t[0] + ', ' + t[2] + ', ' + t[4] + ') dan deret genap (' + t[1] + ', ' + t[3] + '), keduanya naik ' + d20 + '. Suku ke-6 milik deret genap: ' + t[3] + ' + ' + d20 + ' = ' + n + '.';
      kandidat = [a20 + 3 * d20, n + d20, n - d20, t[3] + 1, n + 1];
    }
    // Penjaga: buang deret yang punya lebih dari satu jawaban masuk akal.
    if (ambiguAngka(t, n)) {
      if (attempt < 15) return deretAngka(attempt + 1);
    }
    return buatItem('angka',
      'Lanjutkan deret berikut:  ' + t.join(',  ') + ',  ?',
      n, bersih(kandidat, n), aturan, { kategori: 'IQ — Deret Angka', _pola: pola });
  }

  // ---------- LN: DERET HURUF (11 pola) ----------
  function deretHuruf(attempt) {
    attempt = attempt || 0;
    var pos = [], nx = 0, aturan = '', kandidat = [], pola = '', tampil = [];
    var r = ri(1, 11);
    if (r === 1) {                        // lompat tetap maju
      pola = 'huruf-lompat-tetap';
      var s = pick([2, 3, 4, 5]);
      var st = ri(1, 26 - 5 * s);
      for (var i = 0; i < 5; i++) pos.push(st + i * s);
      nx = st + 5 * s;
      aturan = 'Lompatan tetap ' + s + ' huruf (A=1, B=2, ...). Posisi ke-6 = ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[nx], ABJAD[nx - 3], ABJAD[nx - 1 - s]];
    } else if (r === 2) {                 // lompat tetap mundur
      pola = 'huruf-lompat-mundur';
      var s2 = pick([2, 3, 4]);
      var st2 = ri(5 * s2, 26);
      for (var i2 = 0; i2 < 5; i2++) pos.push(st2 - i2 * s2);
      nx = st2 - 5 * s2;
      aturan = 'Lompatan mundur ' + s2 + ' huruf tiap suku. Posisi ke-6 = ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[nx - 2] || 'A', ABJAD[nx] || 'A', ABJAD[Math.min(25, nx + s2 - 1)]];
    } else if (r === 3) {                 // dua lompat bergantian
      pola = 'huruf-bergantian';
      var s1 = ri(2, 3), s3 = ri(4, 6);
      var cur = ri(1, 26 - (3 * s1 + 2 * s3));
      pos.push(cur);
      for (var k = 0; k < 4; k++) { cur += (k % 2 === 0) ? s1 : s3; pos.push(cur); }
      nx = cur + s1;
      aturan = 'Pola bergantian +' + s1 + ' lalu +' + s3 + '. Suku ke-6 lanjut +' + s1 + ' -> posisi ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[cur + s3 - 1], ABJAD[nx], ABJAD[nx - 2]];
    } else if (r === 4) {                 // lompatan naik
      pola = 'huruf-lompat-naik';
      var base = ri(1, 3), maks = 26 - (5 * base + 10);
      var c4 = ri(1, Math.max(1, maks));
      pos.push(c4);
      for (var k4 = 0; k4 < 4; k4++) { c4 += base + k4; pos.push(c4); }
      nx = c4 + base + 4;
      aturan = 'Lompatan naik (' + base + ', ' + (base + 1) + ', ' + (base + 2) + ', ' + (base + 3) + '). Lompatan berikutnya ' + (base + 4) + ' -> posisi ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[nx], ABJAD[nx - 3], ABJAD[c4 + base + 2]];
    } else if (r === 5) {                 // berselang lompat besar + 1
      pola = 'huruf-lompat-selang';
      var sb = ri(2, 4);
      var c5 = ri(1, 26 - (2 * sb + 3));
      pos = [c5, c5 + sb, c5 + sb + 1, c5 + 2 * sb + 1, c5 + 2 * sb + 2];
      nx = c5 + 3 * sb + 2;
      aturan = 'Pola berulang: +' + sb + ' lalu +1. Suku ke-6 = posisi ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[c5 + 2 * sb + 1], ABJAD[nx], ABJAD[nx - 2]];
    } else if (r === 6) {                 // cermin abjad A,Z,B,Y,...
      pola = 'huruf-cermin';
      pos = [1, 26, 2, 25, 3];
      nx = 24;
      aturan = 'Pola cermin abjad: satu huruf dari depan (A, B, C) bergantian dengan satu dari belakang (Z, Y). Sesudah C (posisi 3) kembali ke belakang: posisi 24 = X.';
      kandidat = ['Y', 'Z', 'W'];
    } else if (r === 7) {                 // lompat +a lalu -b
      pola = 'huruf-maju-mundur';
      var sa = ri(4, 6), sb7 = ri(1, 2);
      var c7 = ri(1, 26 - (2 * sa + 2));
      pos = [c7, c7 + sa, c7 + sa - sb7, c7 + 2 * sa - sb7, c7 + 2 * sa - 2 * sb7];
      nx = c7 + 3 * sa - 2 * sb7;
      aturan = 'Pola berulang: +' + sa + ' lalu -' + sb7 + '. Suku ke-6 = posisi ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[nx - 1 - sb7], ABJAD[nx], ABJAD[nx - 2]];
    } else if (r === 8) {                 // naik lalu turun (palindrom)
      pola = 'huruf-naik-turun';
      var c8 = ri(3, 20);
      pos = [c8, c8 + 1, c8 + 2, c8 + 1, c8];
      nx = c8 - 1;
      aturan = 'Huruf naik dua langkah lalu turun lagi. Sesudah ' + ABJAD[c8 - 1] + ' (posisi ' + c8 + '), berikutnya posisi ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[c8 + 1], ABJAD[nx], ABJAD[c8]];
    } else if (r === 9) {                 // dua deret berselang
      pola = 'huruf-dua-deret';
      var ca = ri(1, 10), cb = ca + ri(4, 8), dd = ri(1, 3);
      pos = [ca, cb, ca + dd, cb + dd, ca + 2 * dd];
      nx = cb + 2 * dd;
      aturan = 'Dua deret berselang: deret ganjil (' + ABJAD[ca - 1] + ', ' + ABJAD[ca + dd - 1] + ', ' + ABJAD[ca + 2 * dd - 1] + ') dan deret genap (' + ABJAD[cb - 1] + ', ' + ABJAD[cb + dd - 1] + '), keduanya naik ' + dd + '. Suku ke-6 = ' + ABJAD[cb + dd - 1] + ' + ' + dd + ' = posisi ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[ca + 3 * dd - 1], ABJAD[nx], ABJAD[nx - 2]];
    } else if (r === 10) {                // lompat tetap dengan penyisipan vokal
      pola = 'huruf-sisip-vokal';
      var sv = pick([2, 3]);
      var cv = ri(1, 26 - (2 * sv + 2));
      pos = [cv, cv + sv, cv + 2 * sv, cv + 2 * sv + 1, cv + 2 * sv + 1 + sv];
      nx = cv + 2 * sv + 1 + 2 * sv;
      aturan = 'Dua lompatan +' + sv + ', lalu satu langkah +1, lalu kembali +' + sv + ' dua kali. Suku ke-6 = posisi ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[nx - sv - 1], ABJAD[nx], ABJAD[nx - 2]];
    } else {                              // lompatan naik dengan basis lebih besar
      pola = 'huruf-lompat-naik-2';
      var base2 = ri(2, 3), maks2 = 26 - (5 * base2 + 20);
      var c10 = ri(1, Math.max(1, maks2));
      pos.push(c10);
      for (var k10 = 0; k10 < 4; k10++) { c10 += base2 + k10 * 2; pos.push(c10); }
      nx = c10 + base2 + 8;
      aturan = 'Lompatan naik berjarak 2 (' + base2 + ', ' + (base2 + 2) + ', ' + (base2 + 4) + ', ' + (base2 + 6) + '). Lompatan berikutnya ' + (base2 + 8) + ' -> posisi ' + nx + ' = ' + ABJAD[nx - 1] + '.';
      kandidat = [ABJAD[nx], ABJAD[nx - 3], ABJAD[c10 + base2 + 6]];
    }
    // Penjaga: kunci harus huruf A-Z yang sah, tidak boleh ada pola lain
    // yang memberi jawaban berbeda, dan pembahasannya harus konsisten.
    var posisiSah = (nx >= 1 && nx <= 26);
    var kunciSah = posisiSah && pos.every(function (v) { return v >= 1 && v <= 26; });
    if (!kunciSah || ambiguHuruf(pos, nx)) {
      if (attempt < 15) return deretHuruf(attempt + 1);
      return deretAngka();
    }
    var benar = ABJAD[nx - 1];
    tampil = pos.map(function (v) { return ABJAD[v - 1]; });
    return buatItem('huruf',
      'Lanjutkan deret huruf berikut:  ' + tampil.join(', ') + ',  ?',
      benar, kandidat, aturan, { kategori: 'IQ — Deret Huruf', _pola: pola },
      function (bump) {
        var idx = ABJAD.indexOf(benar);
        var alt = idx + (bump % 2 === 1 ? -Math.ceil(bump / 2) : Math.ceil(bump / 2));
        return (alt >= 0 && alt < 26) ? ABJAD[alt] : null;
      });
  }

  // ---------- MR: MATRIKS FIGURAL (8 aturan) ----------
  function matriks(attempt) {
    attempt = attempt || 0;
    var rule = pick(['titik', 'garis', 'rotasi', 'bentuk', 'kombinasi', 'sisiJumlah', 'bentukPutar', 'cerminKolom', 'kaliJumlah', 'bentukBaris']);
    var P = {};
    var inner2 = IQ_SVG.inner;
    // aturan yang gambarnya dirakit khusus (bukan sekadar inner(state, rule))
    var gambarCustom = (rule === 'cerminKolom' || rule === 'kaliJumlah');
    function state(r, c) {
      if (rule === 'titik' || rule === 'garis') return r + c + 1 + P.off;
      if (rule === 'rotasi') return { bIdx: P.bIdx, deg: (P.start + 45 * (r + c)) % 360 };
      if (rule === 'bentuk') return { sides: c + P.sisi0, filled: r >= P.isiBaris, rot: 0 };
      if (rule === 'kombinasi') return { b: r, c: c, skema: P.skema };
      if (rule === 'sisiJumlah') return { sides: r + c + 3, filled: (r + c) % 2 === 1, rot: 0 };
      if (rule === 'bentukPutar') return { bIdx: P.bIdx, deg: (P.start + (r - c) * 45 + 360) % 360 };
      if (rule === 'kaliJumlah') return r * c + 1 + P.off;
      if (rule === 'bentukBaris') return { sides: r + P.sisi0, filled: c >= P.isiKolom, rot: 0 };
      return r + c + 1 + P.off;   // cerminKolom memakai gambar yang sama
    }
    function gambar(r, c) {
      if (rule === 'cerminKolom') {
        // Kolom 3 = cermin kolom 1; kolom 2 = cermin kolom 2 (diri sendiri)
        if (c === 2) return '<g transform="translate(64,0) scale(-1,1)">' + inner2(state(r, 0), P.ruleDasar) + '</g>';
        return inner2(state(r, c), P.ruleDasar);
      }
      if (rule === 'kaliJumlah') {
        var jml = state(r, c);
        // jumlah elemen dibatasi 9 supaya gambar tetap rapi
        return inner2(Math.min(jml, 9), P.ruleGambar);
      }
      if (rule === 'rotasi') {
        var st = state(r, c);
        return IQ_SVG.innerBentuk(st.bIdx, st.deg, false);
      }
      return inner2(state(r, c), rule);
    }
    if (rule === 'cerminKolom') {
      P.ruleDasar = pick(['titik', 'garis', 'glyph']);
      P.off = ri(0, 2);
    }
    if (rule === 'titik' || rule === 'garis') P.off = ri(0, 5);
    if (rule === 'rotasi') { P.start = pick([0, 45, 90, 135, 180]); P.bIdx = ri(0, IQ_SVG.BENTUK.length - 1); }
    if (rule === 'bentuk') { P.sisi0 = pick([3, 4, 5]); P.isiBaris = pick([1, 2]); }
    if (rule === 'bentukPutar') { P.bIdx = ri(0, IQ_SVG.BENTUK.length - 1); P.start = pick([0, 45, 90, 135]); }
    if (rule === 'kombinasi') P.skema = pick([1, 2, 3]);
    if (rule === 'kaliJumlah') { P.ruleGambar = pick(['titik', 'garis']); P.off = ri(0, 2); }
    if (rule === 'bentukBaris') { P.sisi0 = pick([3, 4, 5]); P.isiKolom = pick([1, 2]); }

    var benar = state(2, 2);
    var cells = [];
    for (var i = 0; i < 9; i++) cells.push(gambar(Math.floor(i / 3), i % 3));
    var gridSvg = IQ_SVG.grid(cells, 8);

    function svgDari(stateVal) {
      if (rule === 'cerminKolom') return IQ_SVG.wrap(gambar(2, 2), 60);
      if (rule === 'kaliJumlah') return IQ_SVG.wrap(inner2(Math.min(stateVal, 9), P.ruleGambar), 60);
      if (rule === 'rotasi') return IQ_SVG.wrap(IQ_SVG.innerBentuk(stateVal.bIdx, stateVal.deg, false), 60);
      return IQ_SVG.cell(stateVal, rule);
    }
    var benarSvg = svgDari(benar);
    var opsiSvg = [benarSvg];
    // kandidat pengecoh untuk aturan gambar-custom harus dari sel LAIN di grid
    var kandidatState = (rule === 'cerminKolom')
      ? [gambar(2, 0), gambar(1, 2), gambar(0, 0), gambar(1, 0), gambar(2, 1)]
      : (rule === 'kaliJumlah')
      ? [1 + P.off, 2 + P.off, 4 + P.off, 6 + P.off, 8 + P.off]
      : [state(0, 0), state(1, 1), state(2, 0), state(0, 2), state(2, 1), state(1, 2)];
    for (var k = 0; k < kandidatState.length && opsiSvg.length < 4; k++) {
      var sv = (rule === 'cerminKolom')
        ? IQ_SVG.wrap('<g transform="translate(64,0) scale(-1,1)">' + kandidatState[k] + '</g>', 60)
        : svgDari(kandidatState[k]);
      if (opsiSvg.indexOf(sv) === -1) opsiSvg.push(sv);
    }
    var step = 1;
    while (opsiSvg.length < 4 && step <= 24) {
      var alt;
      if (rule === 'bentuk' || rule === 'bentukBaris') alt = { sides: 3 + (step % 6), filled: step % 2 === 0, rot: 0 };
      else if (rule === 'rotasi') alt = { bIdx: P.bIdx, deg: (P.start + 45 * step) % 360 };
      else if (rule === 'kombinasi') alt = { b: step % 3, c: (step + 1) % 3, skema: P.skema };
      else if (rule === 'sisiJumlah') alt = { sides: 3 + (step % 6), filled: step % 2 === 0, rot: 0 };
      else if (rule === 'bentukPutar') alt = { bIdx: P.bIdx, deg: (P.start + 45 * step) % 360 };
      else if (rule === 'cerminKolom') alt = IQ_SVG.wrap('<g transform="translate(64,0) scale(-1,1)">' + inner2(step % 4, P.ruleDasar) + '</g>', 60);
      else if (rule === 'kaliJumlah') alt = Math.min(1 + step, 9);
      else alt = benar + step;
      var altSvg = (rule === 'cerminKolom') ? alt : svgDari(alt);
      if (opsiSvg.indexOf(altSvg) === -1) opsiSvg.push(altSvg);
      step++;
    }
    if (opsiSvg.length !== 4 || new Set(opsiSvg).size !== 4) {
      if (attempt < 8) return matriks(attempt + 1);
      return rotasi();
    }
    var acak = shuffle(opsiSvg);
    var teksAturan = {
      titik:  'Jumlah titik di setiap sel = baris + kolom + 1' + (P.off ? ' + ' + P.off : '') + '. Jadi sel kanan-bawah harus berisi ' + (benar) + ' titik.',
      garis:  'Jumlah garis di setiap sel = baris + kolom + 1' + (P.off ? ' + ' + P.off : '') + '. Jadi sel kanan-bawah harus berisi ' + (benar) + ' garis.',
      rotasi: 'Bentuk berputar 45 derajat setiap satu langkah ke kanan dan satu langkah ke bawah, mulai dari ' + P.start + ' derajat. Sel kanan-bawah = putaran ' + benar.deg + ' derajat (setara arah ' + P.start + ' derajat).',
      bentuk: 'Jumlah sisi naik per kolom (mulai ' + P.sisi0 + ' sisi) dan baris ke-' + P.isiBaris + ' dan sesudahnya berisi bentuk penuh. Sel kanan-bawah = bangun ' + benar.sides + ' sisi terisi.',
      kombinasi: (P.skema === 2)
        ? 'Ciri muncul mengikuti syarat tetap: lingkaran hanya bila nomor baris + nomor kolom GANJIL, kotak hanya pada sel diagonal (baris = kolom), dan garis hanya bila sel itu ada di baris paling atas atau kolom paling kanan. Periksa KETIGA syarat pada sel kanan-bawah.'
        : (P.skema === 3)
        ? 'Ciri muncul mengikuti syarat tetap: lingkaran bila nomor baris <= nomor kolom, kotak bila nomor baris >= nomor kolom, dan garis bila hasil kali baris x kolom genap (keduanya bukan 0). Periksa KETIGA syarat pada sel kanan-bawah.'
        : 'Tiap ciri muncul pada syarat sendiri: lingkaran bila barisnya paling atas atau kolomnya paling kiri, kotak bila barisnya paling bawah atau kolomnya paling kanan, dan garis bila nomor baris + kolom bernilai genap. Periksa sel kanan-bawah terhadap KETIGA syarat itu.',
      sisiJumlah: 'Jumlah sisi = baris + kolom + 3, dan bentuk terisi penuh bila (baris + kolom) ganjil. Sel kanan-bawah = bangun ' + benar.sides + ' sisi' + (benar.filled ? ' terisi penuh' : ' kosong') + '.',
      bentukPutar: 'Bentuk yang sama diputar: tiap turun satu baris +45 derajat, tiap maju satu kolom -45 derajat (berlawanan). Sel kanan-bawah = putaran ' + benar.deg + ' derajat.',
      kaliJumlah: 'Jumlah ' + (P.ruleGambar === 'garis' ? 'garis' : 'titik') + ' di setiap sel = (nomor baris - 1) x (nomor kolom - 1) + 1' +
        (P.off ? ' + ' + P.off : '') + '. Sel kanan-bawah (baris 3, kolom 3) = 2 x 2 + 1' + (P.off ? ' + ' + P.off : '') + ' = ' + benar + '.',
      bentukBaris: 'Jumlah sisi mengikuti nomor baris (mulai ' + P.sisi0 + ' sisi di baris 1), dan bentuk terisi penuh bila kolomnya ke-' + P.isiKolom + ' atau sesudahnya. Sel kanan-bawah = bangun ' + benar.sides + ' sisi ' + (benar.filled ? 'terisi' : 'kosong') + '.',
      cerminKolom: 'Kolom ketiga adalah CERMIN dari kolom pertama (dibalik kiri-kanan), sedangkan kolom kedua tetap. Sel kanan-bawah = cermin dari sel paling kiri di baris yang sama.'
    }[rule];

    return {
      id: 'iq-matriks-' + Math.random().toString(36).slice(2, 9),
      pertanyaan: 'Perhatikan matriks figural. Gambar mana yang tepat mengisi sel bertanda tanya?',
      pilihan: ['A', 'B', 'C', 'D'],
      pilihanSvg: acak,
      jawaban: acak.indexOf(benarSvg),
      pembahasan: teksAturan + ' Periksa aturan itu pada baris DAN kolom sebelum memilih.',
      kategori: 'IQ — Matriks Figural',
      svg: gridSvg,
      _tipe: 'matriks',
      _pola: 'matriks-' + rule,
      _correct: 'svg'
    };
  }

  // ---------- R3D: ROTASI FIGURAL ----------
  function rotasi() {
    var sudut = pick([45, 90, 135, 180, 225, 270, 315]);
    var bIdx = ri(0, IQ_SVG.BENTUK.length - 1);
    // orientasi awal bentuk ikut diacak supaya kombinasi soal jauh lebih banyak
    var dasar = pick([0, 90, 180, 270]);
    function gambar(s, cermin) {
      return IQ_SVG.wrap(IQ_SVG.innerBentuk(bIdx, (((s + dasar) % 360) + 360) % 360, !!cermin), 60);
    }
    var svgBase = gambar(0, false);
    var benarSvg = gambar(sudut, false);
    var opsi = [benarSvg];
    var cerminSvg = gambar(sudut, true);
    if (cerminSvg !== benarSvg && opsi.indexOf(cerminSvg) === -1) opsi.push(cerminSvg);
    var selisih = shuffle([45, 90, 135, 180, -45, -90, -135]);
    for (var k = 0; k < selisih.length && opsi.length < 4; k++) {
      var s2 = gambar(sudut + selisih[k], false);
      if (opsi.indexOf(s2) === -1) opsi.push(s2);
    }
    if (opsi.length !== 4 || new Set(opsi).size !== 4) return deretAngka();
    var acak = shuffle(opsi);
    return {
      id: 'iq-rotasi-' + Math.random().toString(36).slice(2, 9),
      pertanyaan: 'Perhatikan bentuk di kiri, lalu pilih gambar hasil MEMUTAR bentuk itu ' + sudut +
        ' derajat searah jarum jam. Hati-hati: gambar cermin (dibalik) kelihatan mirip, tapi itu bukan hasil putaran.',
      pilihan: ['A', 'B', 'C', 'D'],
      pilihanSvg: acak,
      jawaban: acak.indexOf(benarSvg),
      pembahasan: 'Putar bentuk ' + sudut + ' derajat searah jarum jam: tiap sisi panjang dan tonjolan pada bentuk ikut berpindah ' + sudut + ' derajat. ' +
        'Pada pilihan cermin, sisi kanan dan kiri bertukar tempat sehingga bukan hasil putaran. ' +
        'Jadi hitung arah putarannya, jangan hanya menilai kemiripan bentuk.',
      kategori: 'IQ — Rotasi Figural',
      svg: svgBase,
      _tipe: 'rotasi',
      _pola: 'rotasi-bentuk' + bIdx,
      _correct: 'svg'
    };
  }

  // ---------- VR: VERBAL & ARITMETIKA (14 pola) ----------
  function verbal() {
    var t = ri(1, 14), pertanyaan = '', benar = 0, kandidat = [], bahas = '', pola = '';
    if (t === 1) {
      pola = 'pecahan-bertingkat';
      var a = pick([2, 3, 4, 5]), b = pick([2, 3, 4, 5]), c = pick([2, 3, 4, 5]), kk = ri(3, 12);
      var N = a * b * c * kk;
      benar = kk;
      pertanyaan = 'Berapa hasil dari 1/' + a + ' dari 1/' + b + ' dari 1/' + c + ' dari ' + N + '?';
      bahas = 'Kerjakan bertahap dari belakang: ' + N + ' / ' + c + ' = ' + (N / c) + '; lalu / ' + b + ' = ' + (N / (b * c)) + '; lalu / ' + a + ' = ' + (N / (a * b * c)) + ' = ' + kk + '.';
      kandidat = [kk + 1, kk - 1, kk * 2, kk + 3];
    } else if (t === 2) {
      pola = 'umur';
      var A = ri(4, 14) * 2, tambah = ri(3, 15);
      benar = A / 2 + tambah;
      pertanyaan = 'Rafi berumur ' + A + ' tahun dan adiknya berumur setengah dari umur Rafi. Ketika Rafi berumur ' + (A + tambah) + ' tahun, berapa umur adiknya?';
      bahas = 'Umur adik sekarang ' + (A / 2) + ' tahun. Selisih umur tetap, jadi saat Rafi naik ' + tambah + ' tahun, adik juga naik ' + tambah + ' tahun: ' + (A / 2) + ' + ' + tambah + ' = ' + benar + '.';
      kandidat = [benar + tambah, (A + tambah) / 2, benar - 1, A / 2];
    } else if (t === 3) {
      pola = 'perbandingan';
      var b1 = pick([2, 3, 4]), b2 = b1 + pick([1, 2, 3]), unit = ri(4, 15);
      benar = b2 * unit;
      pertanyaan = 'Perbandingan jumlah A : B = ' + b1 + ' : ' + b2 + '. Jika seluruhnya ada ' + ((b1 + b2) * unit) + ' unit, berapa jumlah B?';
      bahas = 'Total bagian = ' + b1 + ' + ' + b2 + ' = ' + (b1 + b2) + '. Satu bagian = ' + ((b1 + b2) * unit) + ' / ' + (b1 + b2) + ' = ' + unit + '. Maka B = ' + b2 + ' x ' + unit + ' = ' + benar + '.';
      kandidat = [b1 * unit, benar + unit, benar - unit, (b1 + b2) * unit - benar];
    } else if (t === 4) {
      pola = 'silogisme';
      var nama = shuffle(['Adi', 'Bima', 'Candra', 'Dedi', 'Eka']).slice(0, 3);
      benar = nama[0] + ' lebih tinggi dari ' + nama[2];
      pertanyaan = 'Diketahui: ' + nama[0] + ' lebih tinggi dari ' + nama[1] + ', dan ' + nama[1] + ' lebih tinggi dari ' + nama[2] + '. Pernyataan yang PASTI benar adalah...';
      bahas = 'Relasi bersifat transitif: ' + nama[0] + ' > ' + nama[1] + ' > ' + nama[2] + '. Maka yang pasti benar hanya ' + nama[0] + ' lebih tinggi dari ' + nama[2] + '.';
      kandidat = [nama[2] + ' lebih tinggi dari ' + nama[0], nama[1] + ' lebih tinggi dari ' + nama[0], nama[0] + ' sama tinggi dengan ' + nama[2]];
    } else if (t === 5) {
      pola = 'sudut-jam';
      var jam = ri(1, 12), menit = pick([10, 15, 20, 25, 30, 40, 45, 50]);
      var sudut = Math.abs(30 * jam - 5.5 * menit);
      if (sudut === 0) return verbal();
      benar = sudut > 180 ? 360 - sudut : sudut;
      pertanyaan = 'Berapa besar sudut TERKECIL antara jarum jam dan jarum menit pada pukul ' + jam + '.' + (menit < 10 ? '0' + menit : menit) + '?';
      bahas = 'Rumus: |30 x jam - 5,5 x menit| = |30 x ' + jam + ' - 5,5 x ' + menit + '| = ' + Math.abs(30 * jam - 5.5 * menit).toFixed(1) + ' derajat' + (sudut > 180 ? '. Karena lebih dari 180, sudut terkecil = 360 - ' + sudut.toFixed(1) + ' = ' + benar + ' derajat.' : '.');
      kandidat = [benar + 15, benar - 15, 360 - benar, benar + 30];
    } else if (t === 6) {
      pola = 'jarak-kecepatan';
      var kec = pick([40, 50, 60, 70, 80, 90]), jamT = pick([1.5, 2, 2.5, 3, 4]);
      benar = rataDua(kec * jamT);
      pertanyaan = 'Kendaraan melaju dengan kecepatan tetap ' + kec + ' km/jam selama ' + jamT + ' jam. Berapa jarak yang ditempuh (km)?';
      bahas = 'Jarak = kecepatan x waktu = ' + kec + ' x ' + jamT + ' = ' + benar + ' km.';
      kandidat = [benar + kec, benar - kec, kec + jamT, rataDua(benar / 2)];
    } else if (t === 7) {
      pola = 'diskon-persen';
      var harga = ri(4, 40) * 5000, pot = pick([10, 15, 20, 25, 30]);
      benar = harga - (harga * pot / 100);
      pertanyaan = 'Sebuah tas berharga Rp' + harga.toLocaleString('id-ID') + ' mendapat diskon ' + pot + '%. Berapa harga yang harus dibayar?';
      bahas = 'Diskon = ' + pot + '% x ' + harga.toLocaleString('id-ID') + ' = Rp' + (harga * pot / 100).toLocaleString('id-ID') + '. Harga bayar = ' + harga.toLocaleString('id-ID') + ' - ' + (harga * pot / 100).toLocaleString('id-ID') + ' = Rp' + benar.toLocaleString('id-ID') + '.';
      kandidat = ['Rp' + (harga * pot / 100).toLocaleString('id-ID'), 'Rp' + (harga + harga * pot / 100).toLocaleString('id-ID'), 'Rp' + (benar - 5000).toLocaleString('id-ID'), 'Rp' + (benar + 5000).toLocaleString('id-ID')];
      benar = 'Rp' + benar.toLocaleString('id-ID');
    } else if (t === 8) {
      pola = 'rata-rata';
      var d1 = ri(60, 90), d2 = ri(60, 90), d3 = ri(60, 90), d4 = d1 + d2 + d3;
      benar = d4 / 3;
      benar = (Number.isInteger(benar)) ? benar : rataDua(benar);
      pertanyaan = 'Nilai empat ulangan: ' + d1 + ', ' + d2 + ', ' + d3 + ', dan ' + benar + '. Berapa rata-rata nilai keempat ulangan itu?';
      bahas = 'Total = ' + d1 + ' + ' + d2 + ' + ' + d3 + ' + ' + benar + ' = ' + (d1 + d2 + d3 + Number(benar)) + '. Rata-rata = total / 4 = ' + ((d1 + d2 + d3 + Number(benar)) / 4) + '.';
      kandidat = [d1, d2, d3];
    } else if (t === 9) {
      pola = 'kerja-bersama';
      var h1 = pick([4, 6, 8, 12]), h2 = pick([6, 12, 24]);
      if (h1 === h2) h2 = h2 + 4;
      benar = rataDua((h1 * h2) / (h1 + h2));
      pertanyaan = 'A dapat menyelesaikan pekerjaan dalam ' + h1 + ' hari, B dapat menyelesaikannya dalam ' + h2 + ' hari. Jika keduanya bekerja bersama, berapa hari pekerjaan itu selesai?';
      bahas = 'Laju A = 1/' + h1 + ' pekerjaan per hari, laju B = 1/' + h2 + '. Gabungan = 1/' + h1 + ' + 1/' + h2 + ' = ' + rataDua(1 / h1 + 1 / h2) + ' pekerjaan per hari. Waktu = 1 / ' + rataDua(1 / h1 + 1 / h2) + ' = ' + benar + ' hari.';
      kandidat = [h1 + h2, rataDua((h1 + h2) / 2), rataDua(benar + 1), rataDua(benar - 1)];
    } else if (t === 10) {
      pola = 'campuran-cair';
      var liter1 = ri(2, 5), pekat1 = pick([20, 40, 60]), liter2 = ri(2, 5), pekat2 = pekat1 === 20 ? 60 : 20;
      var totalPekat = liter1 * pekat1 + liter2 * pekat2, totalLiter = liter1 + liter2;
      benar = rataDua(totalPekat / totalLiter);
      pertanyaan = 'Dua larutan dicampur: ' + liter1 + ' liter berkadar ' + pekat1 + '% dan ' + liter2 + ' liter berkadar ' + pekat2 + '%. Berapa persen kadar campurannya?';
      bahas = 'Zat murni = (' + liter1 + ' x ' + pekat1 + '%) + (' + liter2 + ' x ' + pekat2 + '%) = ' + totalPekat + ' satuan. Total volume = ' + totalLiter + ' liter. Kadar campuran = ' + totalPekat + ' / ' + totalLiter + ' = ' + benar + '%.';
      kandidat = [rataDua((pekat1 + pekat2) / 2), pekat1, pekat2, rataDua(benar + 5)];
    } else if (t === 11) {
      pola = 'deret-aritmetika';
      var nmax = ri(8, 20);
      benar = (nmax * (nmax + 1)) / 2;
      pertanyaan = 'Berapa jumlah 1 + 2 + 3 + ... + ' + nmax + '?';
      bahas = 'Rumus jumlah deret aritmetika: n(n+1)/2 = ' + nmax + ' x ' + (nmax + 1) + ' / 2 = ' + benar + '.';
      kandidat = [benar + nmax, benar - nmax, nmax * nmax, benar + 1];
    } else if (t === 12) {
      pola = 'menyusul';
      var cepat = ri(6, 12) * 10, lambat = cepat - pick([10, 20, 30]);
      var jeda = pick([1, 2]), selisih = cepat - lambat;
      benar = rataDua((lambat * jeda) / selisih);
      pertanyaan = 'Sebuah mobil berjalan ' + lambat + ' km/jam. Satu jam kemudian mobil lain menyusul dengan kecepatan ' + cepat + ' km/jam. Berapa jam lagi mobil kedua menyusul mobil pertama?';
      bahas = 'Selisih kecepatan = ' + cepat + ' - ' + lambat + ' = ' + selisih + ' km/jam, sehingga tiap jam jaraknya berkurang ' + selisih + ' km. Jarak awal = ' + lambat + ' x ' + jeda + ' km. Waktu menyusul = ' + (lambat * jeda) + ' / ' + selisih + ' = ' + benar + ' jam.';
      kandidat = [rataDua(lambat / selisih), rataDua(benar + 1), rataDua(benar * 2), rataDua(selisih / lambat)];
    } else if (t === 13) {
      pola = 'berbalik-nilai';
      var pekerja = pick([6, 8, 10, 12]), hariK = pick([12, 15, 18, 24]);
      var totalKerja = pekerja * hariK;
      var pekerja2 = pick([pekerja + 2, pekerja + 4, pekerja * 2]);
      benar = rataDua(totalKerja / pekerja2);
      pertanyaan = 'Sebuah proyek selesai dalam ' + hariK + ' hari oleh ' + pekerja + ' pekerja. Jika dikerjakan ' + pekerja2 + ' pekerja, berapa hari proyek itu selesai?';
      bahas = 'Total pekerjaan = ' + pekerja + ' x ' + hariK + ' = ' + totalKerja + ' hari-orang. Dengan ' + pekerja2 + ' pekerja: ' + totalKerja + ' / ' + pekerja2 + ' = ' + benar + ' hari.';
      kandidat = [hariK, pekerja2, rataDua(benar + 2), rataDua(benar - 2)];
    } else {
      pola = 'rasio-tiga-bagian';
      var a3 = ri(2, 4), b3 = a3 + ri(1, 2), c3 = b3 + ri(1, 2), unit3 = ri(3, 9);
      benar = c3 * unit3;
      pertanyaan = 'Perbandingan A : B : C = ' + a3 + ' : ' + b3 + ' : ' + c3 + '. Jika jumlah seluruhnya ' + ((a3 + b3 + c3) * unit3) + ', berapa nilai C?';
      bahas = 'Jumlah bagian = ' + a3 + ' + ' + b3 + ' + ' + c3 + ' = ' + (a3 + b3 + c3) + '. Satu bagian = ' + ((a3 + b3 + c3) * unit3) + ' / ' + (a3 + b3 + c3) + ' = ' + unit3 + '. Maka C = ' + c3 + ' x ' + unit3 + ' = ' + benar + '.';
      kandidat = [a3 * unit3, b3 * unit3, benar + unit3, benar - unit3];
    }
    return buatItem('verbal', pertanyaan, benar, bersih(kandidat, benar), bahas, { kategori: 'IQ — Verbal & Aritmetika', _pola: pola });
  }

  var PEMBUAT = { angka: deretAngka, huruf: deretHuruf, matriks: matriks, rotasi: rotasi, verbal: verbal };
  var URUT = ['angka', 'huruf', 'matriks', 'rotasi', 'verbal'];

  function buatSatu(domain) {
    if (domain === 'campuran') return PEMBUAT[pick(URUT)]();
    var f = PEMBUAT[domain] || deretAngka;
    return f();
  }

  function sig(it) {
    return it.pertanyaan + '|' + it.pilihan.join(',') + '|' + it.jawaban + '|' +
      (it.svg ? it.svg.length : '') + '|' + (it.pilihanSvg ? it.pilihanSvg[it.jawaban] : '');
  }

  function sudahPernah(it) {
    try {
      if (typeof window === 'undefined' || typeof window.riwayatSoal !== 'function') return false;
      var k = (typeof window.kunciSoal === 'function') ? window.kunciSoal({ _sig: sig(it) }) : null;
      if (!k) return false;
      return !!window.riwayatSoal()[k];
    } catch (e) { return false; }
  }

  function benarSah(it) {
    if (!it || !it.pilihan || it.pilihan.length !== 4) return false;
    if (!(it.jawaban >= 0 && it.jawaban < 4)) return false;
    if (!it.pembahasan || String(it.pembahasan).length < 40) return false;
    return true;
  }

  /**
   * Buat n soal untuk satu domain.
   * Aturan pemilihan:
   *  1. pola yang sama dibatasi (BATAS_POLA) di dalam satu set;
   *  2. soal yang BELUM pernah dikerjakan selalu didahulukan;
   *  3. sisa tempat diisi soal yang sudah pernah muncul (anti macet kalau
   *     kandidat habis), dengan urutan tetap acak.
   */
  function buat(domain, n) {
    n = n || 10;
    var batas = BATAS_POLA[domain] || 2;
    var kandidat = [], guard = 0;
    while (kandidat.length < n * 4 && guard < n * 40) {
      guard++;
      var it = null;
      try { it = buatSatu(domain); } catch (e) { it = null; }
      if (!benarSah(it)) continue;
      var s = sig(it);
      var kembarKandidat = false;
      for (var i = 0; i < kandidat.length; i++) if (kandidat[i]._sig === s) { kembarKandidat = true; break; }
      if (kembarKandidat) continue;
      it._sig = s;
      kandidat.push(it);
    }
    // 1) buang kelebihan pola di dalam set
    var dipakaiPola = {}, terpilih = [], sisa = [];
    shuffle(kandidat).forEach(function (it) {
      var p = it._pola || it._tipe;
      dipakaiPola[p] = dipakaiPola[p] || 0;
      if (dipakaiPola[p] < batas) { dipakaiPola[p]++; terpilih.push(it); }
      else sisa.push(it);
    });
    // 2) prioritaskan yang belum pernah dikerjakan
    var belum = terpilih.filter(function (it) { return !sudahPernah(it); });
    var pernah = terpilih.filter(sudahPernah);
    var hasil = shuffle(belum).concat(shuffle(pernah));
    // 3) cukupkan jumlahnya
    if (hasil.length < n) hasil = hasil.concat(shuffle(sisa));
    return hasil.slice(0, n);
  }

  return {
    buat: buat, buatSatu: buatSatu,
    deretAngka: deretAngka, deretHuruf: deretHuruf, matriks: matriks, rotasi: rotasi, verbal: verbal
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IQ_GEN: IQ_GEN, IQ_REF: IQ_REF, IQ_SVG: IQ_SVG };
}
