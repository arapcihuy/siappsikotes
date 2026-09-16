
function fKey(d) {
return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function fHariIni() { return fKey(new Date()); }
function fTambahHari(n) {
var d = new Date();
d.setDate(d.getDate() + n);
return fKey(d);
}
function fSelisihHari(a) {   // selisih hari dari tanggal a sampai hari ini
var d1 = new Date(a + 'T00:00:00'), d2 = new Date(fHariIni() + 'T00:00:00');
return Math.round((d2 - d1) / 86400000);
}
window.temaAktif = function() { return localStorage.getItem('tni_tema') || 'gelap'; };
window.fontAktif = function() { return parseInt(localStorage.getItem('tni_font') || '100', 10) || 100; };
function terapkanTema() {
document.documentElement.setAttribute('data-tema', temaAktif());
var z = fontAktif() / 100;
document.body.style.zoom = z === 1 ? '' : String(z);
var meta = document.querySelector('meta[name="theme-color"]');
if (meta) meta.setAttribute('content', temaAktif() === 'terang' ? '#f2f2f7' : '#05050a');
}
window.setTema = function(t) {
localStorage.setItem('tni_tema', t);
terapkanTema();
render();
};
window.toggleTema = function() {
setTema(temaAktif() === 'terang' ? 'gelap' : 'terang');
};
window.setFont = function(delta) {
var v = Math.min(130, Math.max(90, fontAktif() + delta));
localStorage.setItem('tni_font', String(v));
terapkanTema();
render();
};
window.tombolTampilan = function() {
var gelap = temaAktif() === 'gelap';
var f = fontAktif();
return '<div class="tampilan-bar">' +
'<button class="btn btn-ghost btn-sm" onclick="toggleTema()" aria-label="Ganti tema terang atau gelap" title="Tema">' +
ic(gelap ? 'sun' : 'moon', 15) + ' ' + (gelap ? 'Terang' : 'Gelap') + '</button>' +
'<button class="btn btn-ghost btn-sm" onclick="setFont(-10)" aria-label="Perkecil huruf" title="Perkecil huruf">A-</button>' +
'<span class="font-pill" aria-live="polite">' + f + '%</span>' +
'<button class="btn btn-ghost btn-sm" onclick="setFont(10)" aria-label="Perbesar huruf" title="Perbesar huruf">A+</button>' +
'</div>';
};
var INTERVAL_ULANG = [1, 3, 7, 14, 30];   // hari
function bankSalah() {
try { return JSON.parse(localStorage.getItem('tni_wrong') || '{}') || {}; } catch (e) { return {}; }
}
function simpanBankSalah(o) {
try { localStorage.setItem('tni_wrong', JSON.stringify(o)); } catch (e) {}
}
window.catatSoalSalah = function(id, benar) {
if (!id) return;
var b = bankSalah();
var it = b[id] || { s: 0, b: 0, tahap: 0, j: null, t: null };
if (!benar) {
it.s++;
it.tahap = 0;
it.j = fTambahHari(1);
it.t = fHariIni();
} else {
if (!it.s) { delete b[id]; simpanBankSalah(b); return; }
it.b++;
it.tahap = (it.tahap || 0) + 1;
if (it.tahap >= INTERVAL_ULANG.length) { delete b[id]; simpanBankSalah(b); return; }
it.j = fTambahHari(INTERVAL_ULANG[it.tahap]);
}
b[id] = it;
simpanBankSalah(b);
};
window.daftarUlang = function() {
var b = bankSalah();
var hari = fHariIni();
var out = [];
Object.keys(b).forEach(function(id) {
var it = b[id];
if (it && it.j && it.j <= hari) out.push({ id: id, salah: it.s || 0, tahap: it.tahap || 0 });
});
return out.sort(function(a, z) { return z.salah - a.salah; });
};
window.jumlahUlang = function() { return daftarUlang().length; };
window.drillUlang = function() {
var daftar = daftarUlang();
if (!daftar.length) return;
if (!katSiapSemua()) {
S.ulangCoba = (S.ulangCoba || 0) + 1;
if (S.ulangCoba > 2) { S.page = 'gagal'; render(); return; }
S.page = 'memuat';
S.pesanMemuat = 'Menyiapkan soal yang harus diulang...';
render();
pastikanSemua().then(function() { drillUlang(); });
return;
}
S.ulangCoba = 0;
var semua = getAllSoal();
var peta = {};
semua.forEach(function(s) { peta[s.id] = s; });
var qs = [];
daftar.forEach(function(d) { if (peta[d.id]) qs.push(peta[d.id]); });
if (!qs.length) return;
S.cat = 'ulang';
S.mode = 'drill';
S.isSimulasi = false;
S.iqSpec = null;
S.idx = 0;
S.answers = {};
S.flagged = {};
S.timed = false;
S.questions = qs.slice(0, 40);
S.page = 'soal';
render();
};
window.bersihkanBankSalah = function() {
if (!confirm('Hapus semua catatan soal salah? Riwayat progres lain tidak terpengaruh.')) return;
simpanBankSalah({});
render();
};
window.hapusSatuSoalSalah = function(id) {
var b = bankSalah();
delete b[id];
simpanBankSalah(b);
render();
};
window.panelHariIni = function() {
var jml = jumlahUlang();
if (jml > 0 && !katSiapSemua()) pastikanSemua();
var h = harian();
var targetSoal = 40;
var persen = Math.min(100, Math.round((h.soal / targetSoal) * 100));
var daftar = daftarUlang().slice(0, 5);
var contoh = '';
if (daftar.length) {
var peta = {};
getAllSoal().forEach(function(s) { peta[s.id] = s; });
contoh = '<div class="ulang-mini">' + daftar.map(function(d) {
var q = peta[d.id];
if (!q) return '';
return '<div class="ulang-mini-item">' + escapeHtml(String(q.pertanyaan).slice(0, 70)) +
(String(q.pertanyaan).length > 70 ? '…' : '') + '</div>';
}).join('') + '</div>';
}
return '<div class="card hari-ini">' +
'<div class="hari-head">' + ic('target', 16) + ' <strong>Hari ini</strong>' +
'<span class="hari-tgl">' + fHariIni() + '</span></div>' +
'<div class="hari-grid">' +
'<div class="hari-box"><div class="hari-num">' + h.soal + '</div><div class="hari-lbl">soal dikerjakan</div></div>' +
'<div class="hari-box"><div class="hari-num">' + h.tryout + '</div><div class="hari-lbl">sesi selesai</div></div>' +
'<div class="hari-box ' + (jml > 0 ? 'perlu' : '') + '"><div class="hari-num">' + jml + '</div><div class="hari-lbl">perlu diulang</div></div>' +
'</div>' +
'<div class="hari-track"><div class="hari-bar" style="width:' + persen + '%"></div></div>' +
'<div class="hari-sub">Target harian: ' + targetSoal + ' soal (' + persen + '% tercapai). ' +
'Soal salah otomatis dijadwalkan ulang 1-3-7-14-30 hari.</div>' +
contoh +
(jml > 0
? '<button class="btn btn-primary btn-lg" style="width:100%;margin-top:10px" onclick="drillUlang()">' +
ic('refresh', 16) + ' Ulangi ' + Math.min(jml, 40) + ' soal yang jatuh tempo</button>'
: '<div class="hari-aman">' + ic('check-circle', 14) + ' Tidak ada soal yang jatuh tempo hari ini.</div>') +
'</div>';
};
function harian() {
var kosong = { tgl: fHariIni(), soal: 0, tryout: 0 };
try {
var o = JSON.parse(localStorage.getItem('tni_harian') || 'null');
if (!o || o.tgl !== fHariIni()) return kosong;
return { tgl: o.tgl, soal: o.soal || 0, tryout: o.tryout || 0 };
} catch (e) { return kosong; }
}
window.tambahHarian = function(kunci, n) {
var h = harian();
h[kunci] = (h[kunci] || 0) + (n || 1);
try { localStorage.setItem('tni_harian', JSON.stringify(h)); } catch (e) {}
};
window.harianInfo = harian;
window.catatWaktuSoal = function(idx, detik) {
if (!S.dur) S.dur = {};
S.dur[idx] = detik;
};
window.rekapHasil = function(res) {
var n = S.questions.length;
var perKat = {};
for (var i = 0; i < n; i++) {
var q = S.questions[i];
var kat = q.kategori || 'Umum';
if (!perKat[kat]) perKat[kat] = { total: 0, benar: 0 };
perKat[kat].total++;
if (S.answers[i] === q.jawaban) perKat[kat].benar++;
}
var dur = S.dur || {};
var totalDetik = 0, hitung = 0, lambat = [];
Object.keys(dur).forEach(function(k) {
var d = dur[k];
if (d > 0) { totalDetik += d; hitung++; }
if (d >= 120) lambat.push(S.questions[k] ? S.questions[k].id : k);
});
res.perKat = perKat;
res.detikPerSoal = hitung ? Math.round(totalDetik / hitung) : 0;
res.soalLambat = lambat.length;
for (var j = 0; j < n; j++) {
if (S.answers[j] !== undefined && S.answers[j] !== S.questions[j].jawaban) {
catatSoalSalah(S.questions[j].id, false);
}
}
tambahHarian('tryout', 1);
return res;
};
window.panelHasilKategori = function(res) {
var pk = res.perKat || {};
var keys = Object.keys(pk);
if (!keys.length) return '';
var urut = keys.map(function(k) {
var v = pk[k];
return { nama: k, persen: Math.round((v.benar / v.total) * 100), benar: v.benar, total: v.total };
}).sort(function(a, b) { return a.persen - b.persen; });
var terlemah = urut[0];
var saran = terlemah.persen < 70
? 'Fokus berikutnya: <strong>' + escapeHtml(terlemah.nama) + '</strong> (' + terlemah.persen +
'%) — kerjakan mode Belajar kategori itu, lalu ulangi soal yang salah besok.'
: 'Semua kategori ≥ 70%. Pertahankan dengan 1 simulasi 60 soal setiap 2 hari.';
var baris = urut.map(function(u) {
var warna = u.persen >= 80 ? 'pass' : (u.persen >= 70 ? 'warn' : 'fail');
return '<div class="kat-row">' +
'<div class="kat-row-top"><span>' + escapeHtml(u.nama) + '</span><span>' + u.persen + '% · ' + u.benar + '/' + u.total + '</span></div>' +
'<div class="prog-track"><div class="prog-bar ' + warna + '" style="width:' + u.persen + '%"></div></div>' +
'</div>';
}).join('');
return '<div class="card" style="margin-top:16px">' +
'<div class="hari-head">' + ic('chart', 16) + ' <strong>Rincian per kategori</strong></div>' +
baris +
'<div class="hari-sub" style="margin-top:10px">' + saran + '</div>' +
'</div>';
};
window.panelKecepatan = function(res) {
if (!res.detikPerSoal) return '';
var target = 60;
var status = res.detikPerSoal <= target
? '<span class="ok-text">' + ic('check', 13) + ' sudah di bawah target ' + target + ' detik/soal</span>'
: '<span class="warn-text">' + ic('alert', 13) + ' masih di atas target ' + target + ' detik/soal</span>';
return '<div class="card" style="margin-top:16px">' +
'<div class="hari-head">' + ic('clock', 16) + ' <strong>Kecepatan</strong></div>' +
'<div class="hari-grid">' +
'<div class="hari-box"><div class="hari-num">' + res.detikPerSoal + '</div><div class="hari-lbl">detik / soal</div></div>' +
'<div class="hari-box"><div class="hari-num">' + (res.soalLambat || 0) + '</div><div class="hari-lbl">soal &gt; 2 menit</div></div>' +
'<div class="hari-box"><div class="hari-num">' + target + '</div><div class="hari-lbl">target detik</div></div>' +
'</div>' +
'<div class="hari-sub">' + status + '. Soal yang lama dikerjakan biasanya soal yang belum paham konsep — buka pembahasannya di Bank Soal.</div>' +
'</div>';
};
window.simpanSesiAktif = function() {
if (S.page !== 'soal' || !S.questions.length) return;
try {
var data = {
cat: S.cat, mode: S.mode, idx: S.idx, answers: S.answers, flagged: S.flagged,
timeLeft: S.timeLeft, totalTime: S.totalTime, timed: S.timed,
ids: S.questions.map(function(q) { return q.id; }),
simpanAt: Date.now()
};
localStorage.setItem('tni_sesi_aktif', JSON.stringify(data));
} catch (e) {}
};
window.buangSesiAktif = function() { try { localStorage.removeItem('tni_sesi_aktif'); } catch (e) {} };
window.infoSesiAktif = function() {
try {
var d = JSON.parse(localStorage.getItem('tni_sesi_aktif') || 'null');
if (!d || !d.ids || !d.ids.length) return null;
if (d.idx >= d.ids.length - 1) return null;
return d;
} catch (e) { return null; }
};
window.lanjutSesi = function() {
var d = infoSesiAktif();
if (!d) return;
if (!katSiapSemua()) {
S.lanjutCoba = (S.lanjutCoba || 0) + 1;
if (S.lanjutCoba > 2) { S.page = 'gagal'; render(); return; }
S.page = 'memuat';
S.pesanMemuat = 'Melanjutkan sesi — menyiapkan soal...';
render();
pastikanSemua().then(function() { lanjutSesi(); });
return;
}
S.lanjutCoba = 0;
var peta = {};
getAllSoal().forEach(function(s) { peta[s.id] = s; });
var qs = [];
d.ids.forEach(function(id) { if (peta[id]) qs.push(peta[id]); });
if (!qs.length) { buangSesiAktif(); return; }
S.cat = d.cat; S.mode = d.mode; S.questions = qs;
S.idx = Math.min(d.idx, qs.length - 1);
S.answers = d.answers || {};
S.flagged = d.flagged || {};
S.timed = !!d.timed;
S.totalTime = d.totalTime || 0;
S.timeLeft = d.timeLeft || 0;
S.dur = {};
S.page = 'soal';
render();
};
window.panelLanjutSesi = function() {
var d = infoSesiAktif();
if (!d) return '';
var mode = d.mode === 'tryout' ? 'Tryout' : 'Belajar';
var sisa = d.timed && d.timeLeft ? ' · sisa ' + fmtDur(d.timeLeft) : '';
return '<div class="card lanjut-sesi">' +
'<div>' + ic('clock', 15) + ' Ada sesi <strong>' + mode + '</strong> yang belum selesai — ' +
'soal ' + (d.idx + 1) + ' dari ' + d.ids.length + sisa + '</div>' +
'<div style="display:flex;gap:8px;margin-top:10px">' +
'<button class="btn btn-primary btn-sm" style="flex:1" onclick="lanjutSesi()">Lanjutkan</button>' +
'<button class="btn btn-ghost btn-sm" onclick="buangSesiAktif();render()">Buang</button>' +
'</div></div>';
};
window.jalurInfo = function() {
var mulai = localStorage.getItem('tni_jalur_mulai');
if (!mulai) return null;
var hari = fSelisihHari(mulai) + 1;
if (hari < 1) hari = 1;
var pekan = Math.min(4, Math.ceil(hari / 7));
var materi = {
1: 'Pekan 1 — Fondasi: TWK + Verbal + Bahasa Inggris (materi hafalan)',
2: 'Pekan 2 — Hitung: Numerik + Matematika (kecepatan berhitung)',
3: 'Pekan 3 — Logika: Penalaran + Tes Gambar + Kraepelin',
4: 'Pekan 4 — Simulasi: 60 soal bertimer tiap hari + review soal salah'
};
return { mulai: mulai, hari: hari, pekan: pekan, materi: materi[pekan], selesai: hari > 28 };
};
window.mulaiJalur = function() {
localStorage.setItem('tni_jalur_mulai', fHariIni());
render();
};
window.ulangJalur = function() {
if (!confirm('Mulai ulang jalur belajar 28 hari dari hari ini?')) return;
localStorage.setItem('tni_jalur_mulai', fHariIni());
render();
};
window.panelJalur = function() {
var j = jalurInfo();
if (!j) {
return '<div class="card jalur-card">' +
'<div class="hari-head">' + ic('flag', 16) + ' <strong>Jalur Belajar 28 Hari</strong></div>' +
'<div class="hari-sub">Belum aktif. Kalau dinyalakan, aplikasi menyusun urutan materi 4 pekan ' +
'dan mengingatkan target harian (40 soal + ulangi soal salah).</div>' +
'<button class="btn btn-secondary btn-sm" style="margin-top:10px" onclick="mulaiJalur()">Nyalakan jalur belajar</button>' +
'</div>';
}
var persen = Math.min(100, Math.round((j.hari / 28) * 100));
return '<div class="card jalur-card">' +
'<div class="hari-head">' + ic('flag', 16) + ' <strong>Jalur Belajar 28 Hari</strong>' +
'<span class="hari-tgl">hari ' + Math.min(j.hari, 28) + ' / 28</span></div>' +
'<div class="hari-track"><div class="hari-bar" style="width:' + persen + '%"></div></div>' +
'<div class="hari-sub" style="margin-top:8px">' + j.materi + '</div>' +
(j.selesai ? '<div class="hari-aman">' + ic('check-circle', 14) + ' Jadwal 28 hari sudah lewat — mulai ulang kalau mau mengulang materi.</div>' : '') +
'<button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="ulangJalur()">Mulai ulang dari hari 1</button>' +
'</div>';
};
var KUNCI_SINKRON = ['tni_prog', 'tni_wrong', 'tni_scores', 'tni_to_total', 'tni_harian',
'tni_iq_log', 'tni_iq_meta', 'tni_iq_nb', 'tni_iq_sesi', 'tni_jalur_mulai', 'tni_psi_progress',
'tni_soal_riwayat',
'tni_kode_akses', 'tni_pembelian', 'tni_laporan_bayar'];
window.kodeSinkron = function() {
var paket = { v: 1, dibuat: new Date().toISOString(), data: {} };
KUNCI_SINKRON.forEach(function(k) {
var v = localStorage.getItem(k);
if (v !== null) paket.data[k] = v;
});
var json = JSON.stringify(paket);
return btoa(unescape(encodeURIComponent(json)));
};
window.salinKode = function() {
var kode = kodeSinkron();
var ta = document.getElementById('kodeSinkron');
if (ta) ta.value = kode;
var ok = false;
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(kode).then(function() {}, function() {});
ok = true;
}
if (ta) { ta.focus(); ta.select(); }
var st = document.getElementById('statusSinkron');
if (st) st.textContent = ok ? 'Kode disalin. Tempel di perangkat lain.' : 'Tekan lama teks di bawah lalu Salin.';
};
window.pakaiKodeSinkron = function() {
var ta = document.getElementById('kodeSinkron');
var st = document.getElementById('statusSinkron');
var txt = (ta && ta.value || '').trim();
if (!txt) { if (st) st.textContent = 'Tempel kode sinkron dulu.'; return; }
try {
var paket = JSON.parse(decodeURIComponent(escape(atob(txt))));
if (!paket || paket.v !== 1 || typeof paket.data !== 'object') throw new Error('format');
var n = 0;
Object.keys(paket.data).forEach(function(k) {
if (KUNCI_SINKRON.indexOf(k) === -1) return;
var v = paket.data[k];
if (typeof v !== 'string' || v.length > 500000) return;
localStorage.setItem(k, v);
n++;
});
if (st) st.textContent = n + ' bagian data dipulihkan. Memuat ulang...';
setTimeout(function() { location.reload(); }, 900);
} catch (e) {
if (st) st.textContent = 'Kode tidak bisa dibaca. Pastikan tersalin utuh.';
}
};
window.panelSinkron = function() {
return '<div class="card" style="margin-top:16px">' +
'<div class="hari-head">' + ic('refresh', 16) + ' <strong>Sinkron antar perangkat</strong></div>' +
'<div class="hari-sub">Progres disimpan di perangkat ini saja. Untuk pindah HP tanpa kehilangan data: ' +
'salin kode di HP lama, lalu tempel di HP baru. Kode memuat progres, soal salah, nilai, log IQ, dan jalur belajar.</div>' +
'<textarea id="kodeSinkron" class="kode-box" spellcheck="false" placeholder="Tempel kode sinkron di sini (atau tekan Buat kode lalu salin)"></textarea>' +
'<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
'<button class="btn btn-secondary btn-sm" style="flex:1" onclick="salinKode()">Buat + salin kode</button>' +
'<button class="btn btn-primary btn-sm" style="flex:1" onclick="pakaiKodeSinkron()">Pakai kode ini</button>' +
'</div>' +
'<div id="statusSinkron" class="hari-sub" style="margin-top:8px" aria-live="polite"></div>' +
'</div>';
};
window.eksporSoalSalah = function() {
var b = bankSalah();
var ids = Object.keys(b);
if (!ids.length) { alert('Belum ada soal salah yang tercatat.'); return; }
if (!katSiapSemua()) {
alert('Soal sedang disiapkan, coba lagi sebentar lagi.');
pastikanSemua().then(function() {});
return;
}
var peta = {};
getAllSoal().forEach(function(s) { peta[s.id] = s; });
var html = [];
html.push('<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">');
html.push('<title>Daftar Soal Salah — SiapPsikotes</title>');
html.push('<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.6;max-width:820px;margin:24px auto;padding:0 16px;color:#111}');
html.push('h1{font-size:20px}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ddd;padding-bottom:4px}');
html.push('.pg{background:#f6f6f8;padding:10px;border-radius:8px;white-space:pre-line}');
html.push('.opsi{margin:6px 0}.kunci{color:#0a7a2f;font-weight:700}.salah{color:#c0392b}');
html.push('@media print{.noprint{display:none}}</style></head><body>');
html.push('<h1>Daftar Soal Salah — SiapPsikotes</h1>');
html.push('<p>Dicetak: ' + new Date().toLocaleString('id-ID') + ' · ' + ids.length + ' soal</p>');
html.push('<p class="noprint"><button onclick="window.print()">Cetak / Simpan PDF</button></p>');
ids.sort(function(a, c) { return (b[c].s || 0) - (b[a].s || 0); });
ids.forEach(function(id, i) {
var q = peta[id];
if (!q) return;
html.push('<h2>' + (i + 1) + '. ' + escapeHtml(String(q.kategori || '')) + ' — salah ' + (b[id].s || 0) + 'x</h2>');
html.push('<div>' + escapeHtml(String(q.pertanyaan)) + '</div>');
(q.pilihan || []).forEach(function(p, j) {
var tanda = j === q.jawaban ? ' class="kunci"' : '';
html.push('<div class="opsi"><span' + tanda + '>' + String.fromCharCode(65 + j) + '. ' + escapeHtml(String(p)) + '</span></div>');
});
html.push('<div class="pg"><strong>Pembahasan</strong>\n' + escapeHtml(String(q.pembahasan || '')) + '</div>');
});
html.push('</body></html>');
var blob = new Blob([html.join('\n')], { type: 'text/html;charset=utf-8' });
var a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'soal-salah-siappsikotes-' + fHariIni() + '.html';
document.body.appendChild(a);
a.click();
setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
};
window.panelBankSalah = function() {
if (!katSiapSemua()) pastikanSemua();
var daftar = daftarUlang();
var semua = Object.keys(bankSalah()).length;
var peta = {};
getAllSoal().forEach(function(s) { peta[s.id] = s; });
var isi = daftar.slice(0, 12).map(function(d) {
var q = peta[d.id];
if (!q) return '';
return '<div class="ulang-row">' +
'<div class="ulang-teks">' + escapeHtml(String(q.pertanyaan).slice(0, 80)) + '…</div>' +
'<div class="ulang-aksi"><span class="pill-salah">salah ' + d.salah + 'x</span>' +
'<button class="btn btn-ghost btn-sm" onclick="hapusSatuSoalSalah(\'' + d.id + '\')" aria-label="Hapus catatan soal ini">hapus</button></div>' +
'</div>';
}).join('');
return '<div class="card" style="margin-top:16px">' +
'<div class="hari-head">' + ic('target', 16) + ' <strong>Bank Soal Salah</strong>' +
'<span class="hari-tgl">' + semua + ' tercatat · ' + daftar.length + ' jatuh tempo</span></div>' +
'<div class="hari-sub">Soal yang pernah salah otomatis muncul lagi setelah 1 hari, lalu 3, 7, 14, 30 hari. ' +
'Kalau sudah benar 5 kali berturut-turut, catatannya lulus dan hilang sendiri.</div>' +
(isi || '<div class="hari-aman">' + ic('check-circle', 14) + ' Belum ada soal yang jatuh tempo.</div>') +
'<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
(daftar.length ? '<button class="btn btn-primary btn-sm" style="flex:1" onclick="drillUlang()">Ulangi sekarang</button>' : '') +
'<button class="btn btn-secondary btn-sm" style="flex:1" onclick="eksporSoalSalah()">Ekspor (HTML/PDF)</button>' +
(semua ? '<button class="btn btn-ghost btn-sm" onclick="bersihkanBankSalah()">Bersihkan</button>' : '') +
'</div></div>';
};
window.bukaKraepelinSim = function() {
navTo('psikologi');
setTimeout(function() {
try { if (typeof startPsiTest === 'function') startPsiTest('kraepelin'); } catch (e) {}
}, 250);
};
function pasangA11y() {
document.querySelectorAll('.option').forEach(function(el, i) {
var teks = (el.querySelector('.option-text') || el).textContent.trim().slice(0, 120);
el.setAttribute('role', 'button');
el.setAttribute('tabindex', '0');
el.setAttribute('aria-label', 'Pilihan ' + String.fromCharCode(65 + i) + ': ' + teks);
if (!el.dataset.a11yKey) {
el.dataset.a11yKey = '1';
el.addEventListener('keydown', function(ev) {
if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); el.click(); }
});
}
});
var main = document.getElementById('main');
if (main && !main.hasAttribute('aria-live')) main.setAttribute('aria-live', 'polite');
}
terapkanTema();
var _renderSebelumFitur = window.render;
window.render = function() {
if (_renderSebelumFitur) _renderSebelumFitur.apply(this, arguments);
try { sisipPanel(); } catch (e) {  }
};
window.buildKu = function() {
var s = document.querySelector('script[src*="fitur.js"]');
if (!s) return 'v21';
var m = String(s.getAttribute('src') || '').match(/[?&]v=([^&]+)/);
return m ? m[1] : 'v21';
};
function sisipPanel() {
var m = document.getElementById('main');
if (!m) return;
var bt = document.getElementById('buildTag');
if (bt) bt.textContent = bt.textContent.replace(/Build \S+/, 'Build ' + buildKu());
var bar = document.querySelector('.topbar-right');
if (bar && !document.getElementById('btnTampilan')) {
var wrap = document.createElement('div');
wrap.id = 'btnTampilan';
wrap.innerHTML = tombolTampilan();
bar.appendChild(wrap);
}
if (S.page === 'home') {
var kotak = m.querySelector('.grid-3');
if (kotak && !m.querySelector('.hari-ini')) {
var wadah = document.createElement('div');
wadah.innerHTML = panelLanjutSesi() + panelHariIni() + panelJalur();
kotak.insertAdjacentElement('afterend', wadah);
}
}
if (S.page === 'hasil') {
var aksi = m.querySelector('.result-wrap');
if (aksi && !m.querySelector('.panel-kategori-hasil')) {
var box = document.createElement('div');
box.className = 'panel-kategori-hasil';
box.innerHTML = panelHasilKategori(S.lastResult || {}) + panelKecepatan(S.lastResult || {});
aksi.appendChild(box);
}
}
if (S.page === 'prog') {
var akhir = m.querySelector('.prog-detail') || m.firstChild;
if (!m.querySelector('.panel-bank-salah')) {
var b2 = document.createElement('div');
b2.className = 'panel-bank-salah';
b2.innerHTML = panelBankSalah() + panelSinkron() + panelHariIni() + panelJalur();
m.appendChild(b2);
}
}
pasangA11y();
}
setInterval(function() {
if (S.page === 'soal') simpanSesiAktif();
}, 8000);
window.addEventListener('beforeunload', function() { if (S.page === 'soal') simpanSesiAktif(); });
document.addEventListener('visibilitychange', function() {
if (document.visibilityState === 'hidden' && S.page === 'soal') simpanSesiAktif();
});
document.addEventListener('DOMContentLoaded', function() {
terapkanTema();
try { render(); } catch (e) {}
});
