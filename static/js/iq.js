
var IQS = {
tab: 'latihan',  // 'latihan' | 'cara' | 'log'
nb: null         // state dual n-back
};
var IQ_PANDUAN = {
angka:    { judul: 'Deret Angka',          kode: 'LN',  cara: 'Cari pola bilangannya (ditambah atau dikali berapa tiap langkah), lalu tentukan angka berikutnya.' },
huruf:    { judul: 'Deret Huruf',          kode: 'LN',  cara: 'Ubah huruf jadi angka (A=1, B=2, dst), cari lompatannya, lalu tentukan huruf berikutnya.' },
matriks:  { judul: 'Matriks Gambar',       kode: 'MR',  cara: 'Periksa baris DAN kolom: jumlah bentuk, arah putaran, atau isi gambarnya. Pilih gambar yang melengkapi kotak bertanda tanya.' },
rotasi:   { judul: 'Putar vs Cermin',      kode: 'R3D', cara: 'Bayangkan bentuk di kiri diputar sesuai sudut yang diminta. Gambar cermin (dibalik) mirip, tapi BUKAN hasil putaran.' },
verbal:   { judul: 'Soal Cerita & Hitung', kode: 'VR',  cara: 'Aritmetika/verbal sehari-hari: umur, perbandingan, pecahan bertingkat, sudut jarum jam, kecepatan.' },
campuran: { judul: 'Campuran Semua Jenis', kode: 'MIX', cara: 'Soal semua jenis diacak — melatih ketahanan & kecepatan seperti tes asli.' }
};
function loadIqLog() {
try { return JSON.parse(localStorage.getItem('tni_iq_log') || '[]'); } catch (e) { return []; }
}
function saveIqLog(a) { localStorage.setItem('tni_iq_log', JSON.stringify(a.slice(-60))); }
function loadIqMeta() {
try {
var m = JSON.parse(localStorage.getItem('tni_iq_meta') || '{}');
if (!m.baseline) m.baseline = (typeof IQ_REF !== 'undefined' ? IQ_REF.baseline : 100);
if (!m.target) m.target = (typeof IQ_REF !== 'undefined' ? IQ_REF.target : 110);
return m;
} catch (e) { return { baseline: 100, target: 110 }; }
}
function saveIqMeta(m) { localStorage.setItem('tni_iq_meta', JSON.stringify(m)); }
function loadIqNb() {
try { return JSON.parse(localStorage.getItem('tni_iq_nb') || '{}'); } catch (e) { return {}; }
}
function saveIqNb(o) { localStorage.setItem('tni_iq_nb', JSON.stringify(o)); }
function loadIqSesi() {
try { return JSON.parse(localStorage.getItem('tni_iq_sesi') || '[]'); } catch (e) { return []; }
}
function saveIqSesi(a) { localStorage.setItem('tni_iq_sesi', JSON.stringify(a.slice(-30))); }
function iqTerakhir() {
var log = loadIqLog();
if (!log.length) return null;
return log[log.length - 1];
}
function iqAkurasiDomain(key) {
var prog = loadProgress();
if (key === 'campuran') {
var tot = 0, ben = 0;
Object.keys(prog).forEach(function (k) {
if (k.indexOf('IQ — ') === 0 && prog[k]) { tot += prog[k].total || 0; ben += prog[k].benar || 0; }
});
return tot ? (Math.round((ben / tot) * 100) + '% akurasi (' + ben + '/' + tot + ' soal)') : 'belum dilatih';
}
var nama = '';
(typeof IQ_REF !== 'undefined' ? IQ_REF.domain : []).forEach(function (d) { if (d.key === key) nama = d.nama; });
var p = nama ? prog['IQ — ' + nama] : null;
return (p && p.total) ? (Math.round((p.benar / p.total) * 100) + '% akurasi (' + p.benar + '/' + p.total + ' soal)') : 'belum dilatih';
}
function iqKartuDomain(key) {
var d = null;
(typeof IQ_REF !== 'undefined' ? IQ_REF.domain : []).forEach(function (x) { if (x.key === key) d = x; });
var pd = IQ_PANDUAN[key];
if (!pd) return '';
var akurasi = iqAkurasiDomain(key);
return '<div class="iq-dom" onclick="startIQDrill(\'' + key + '\')">' +
'<div class="iq-dom-top"><span class="iq-kode">' + pd.kode + '</span><span class="iq-dom-nama">' + escapeHtml(pd.judul) + '</span></div>' +
'<div class="iq-dom-desc">' + escapeHtml(pd.cara) + '</div>' +
'<div class="iq-dom-foot">' + ic('chart', 13) + ' ' + escapeHtml(akurasi) + '</div>' +
'<div class="iq-dom-foot" style="margin-top:4px;color:var(--blue2)">' + ic('zap', 13) + ' Ketuk untuk mulai 10 soal</div>' +
'</div>';
}
function renderIQ() {
// Generator IQ (data/soal-iq.js) dimuat saat halaman ini dibuka.
// Tanpa penjagaan ini halaman tampil kosong pada kunjungan pertama.
if (typeof window.IQ_GEN === 'undefined') {
if (window.pastikanIQ) {
window.pastikanIQ().then(function (ok) {
if (ok) render();
else {
var m = document.getElementById('main');
if (m) m.innerHTML = '<div class="empty"><div class="empty-icon">' + icon('alert', 40) + '</div><p>Soal IQ gagal dimuat. Periksa sambungan lalu muat ulang halaman.</p></div>';
}
});
}
return '<div class="empty"><div class="empty-icon">' + icon('refresh', 40) + '</div><p>Menyiapkan bank soal IQ...</p></div>';
}
var meta = loadIqMeta();
var log = loadIqLog();
var last = iqTerakhir();
var nilai = last ? Number(last.skor) : meta.baseline;
var pct = 0;
if (meta.target > meta.baseline) {
pct = Math.max(0, Math.min(100, Math.round(((nilai - meta.baseline) / (meta.target - meta.baseline)) * 100)));
}
var nb = loadIqNb();
var head = '<div style="font-size:24px;font-weight:800;color:var(--white);margin-bottom:4px;letter-spacing:-0.4px">' +
ic('brain', 20) + ' IQ Lab — Latihan Potensi Kognitif <span style="font-size:11px;font-weight:600;color:var(--text3);vertical-align:middle">build v18</span></div>' +
'<div style="font-size:13px;color:var(--text2);margin-bottom:14px">Latihan penalaran bergaya tes IQ (matriks gambar, deret angka &amp; huruf, putar vs cermin, soal cerita). ' +
'Semua soal dibuat otomatis di HP kamu — tanpa akun, bisa offline.</div>';
var tabDef = [['latihan', 'Latihan'], ['cara', 'Cara Pakai'], ['log', 'Log Skor']];
var tabBar = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">' +
tabDef.map(function (t) {
return '<button class="btn ' + (IQS.tab === t[0] ? 'btn-primary' : 'btn-secondary') + ' btn-sm" onclick="iqTab(\'' + t[0] + '\')">' + t[1] + '</button>';
}).join('') + '</div>';
var tracker = '<div class="iq-tracker">' +
'<div class="iq-track-head">' +
'<div><div class="iq-track-label">Skor IQ terakhir</div><div class="iq-track-num">' + nilai + '</div></div>' +
'<div style="text-align:right"><div class="iq-track-label">Target</div><div class="iq-track-target">' + meta.target + '</div></div>' +
'</div>' +
'<div class="prog-track" style="margin:10px 0 6px"><div class="prog-bar" style="width:' + pct + '%"></div></div>' +
'<div style="font-size:12px;color:var(--text2)">Baseline ' + meta.baseline + ' → sekarang ' + nilai + ' → target ' + meta.target +
' · progres ' + pct + '%' + (last ? ' · retest terakhir ' + escapeHtml(last.tgl) : ' · belum ada retest tercatat') + '</div>' +
'<div style="font-size:11px;color:var(--text3);margin-top:6px">Angka di sini = skor dari alat ukur tervalidasi (ICAR, Mensa, TIKI, dll) yang kamu catat di tab <strong>Log Skor</strong> — bukan skor drill.</div>' +
'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
'<button class="btn btn-secondary btn-sm" onclick="iqSetBaseline()">' + ic('target', 15) + ' Set Baseline</button>' +
'<button class="btn btn-secondary btn-sm" onclick="iqSetTarget()">' + ic('flag', 15) + ' Set Target</button>' +
'<button class="btn btn-primary btn-sm" onclick="iqTab(\'log\')">' + ic('plus', 15) + ' Catat Hasil Retest</button>' +
'</div>' +
'</div>';
var langkah = '<div class="tips-box" style="margin:16px 0 6px">' +
'<div class="tips-title">' + ic('bulb', 16) + ' Cara pakai IQ Lab (3 langkah)</div>' +
'<ul>' +
'<li><strong>1. Latihan:</strong> ketuk salah satu jenis soal di bawah (10 soal, ada pembahasan tiap soal). Ulangi sampai akurasi ≥ 80%.</li>' +
'<li><strong>2. Simulasi:</strong> kerjakan 25 soal campuran dalam 20 menit untuk melatih kecepatan &amp; stamina.</li>' +
'<li><strong>3. Ukur:</strong> angka IQ resmi hanya keluar dari alat ukur tervalidasi — catat hasilnya di tab <strong>Log Skor</strong>.</li>' +
'</ul>' +
'<div style="font-size:12px;color:var(--text2);margin-top:8px">Latihan menaikkan <em>kemampuan mengerjakan tes</em> (familiaritas, kecepatan, ketelitian). Skor IQ itu sendiri diukur sekali-dua kali, bukan tiap hari.</div>' +
'</div>';
var urut = ['angka', 'huruf', 'matriks', 'rotasi', 'verbal', 'campuran'];
var domCards = urut.map(iqKartuDomain).join('');
var drill = '<div class="section-title">' + ic('brain', 16) + ' Drill per Jenis Soal (10 soal / set · ada pembahasan)</div>' +
'<div class="iq-grid">' + domCards + '</div>' +
'<div style="display:flex;gap:10px;margin:14px 0 22px;flex-wrap:wrap">' +
'<button class="btn btn-danger btn-lg" style="flex:1;min-width:220px" onclick="startIQSimulasi()">' + ic('target', 17) + ' Simulasi IQ — 25 Soal · 20 Menit</button>' +
'<button class="btn btn-secondary btn-lg" style="flex:1;min-width:200px" onclick="startIQDrill(\'campuran\')">' + ic('layers', 17) + ' Drill Campuran 10 Soal</button>' +
'</div>';
var n = nb.n || 2;
var nback = '<div class="section-title">' + ic('zap', 16) + ' Dual N-Back — Latihan Memori Kerja</div>' +
'<div class="iq-nb-box">' +
'<div style="font-size:12px;color:var(--text2);margin-bottom:10px">' +
'Ada 9 kotak. Satu kotak menyala bergantian. <strong>Cara main:</strong> tekan <strong>COCOK</strong> HANYA kalau posisi yang menyala sekarang ' +
'sama dengan posisi <strong>N langkah sebelumnya</strong>. Kalau beda, jangan tekan apa-apa. N=2 artinya bandingkan dengan 2 langkah sebelumnya.</div>' +
'<div class="iq-nb-top">' +
'<span style="font-size:12px;color:var(--text2)">Level N (makin besar makin sulit):</span>' +
[2, 3, 4].map(function (v) {
return '<button class="btn ' + (v === n ? 'btn-primary' : 'btn-secondary') + ' btn-sm" onclick="iqNbSetN(' + v + ')">N=' + v + '</button>';
}).join('') +
'<span style="font-size:12px;color:var(--text2);margin-left:auto">Rekor akurasi: ' +
(nb.best ? nb.best + '% (N=' + (nb.bestN || '-') + ')' : '-') + '</span>' +
'</div>' +
'<div id="nbArea" class="iq-nb-area">' + iqNbIdleHtml() + '</div>' +
'<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">' +
'<button class="btn btn-primary" id="nbMatchBtn" onclick="iqNbMatch()" disabled style="flex:2">' + ic('check', 16) + ' COCOK</button>' +
'<button class="btn btn-secondary" id="nbStartBtn" onclick="iqNbToggle()" style="flex:1">' + ic('zap', 16) + ' Mulai</button>' +
'</div>' +
'<div style="font-size:11px;color:var(--text3);margin-top:8px">Satu sesi = 30 percobaan. Target: akurasi ≥ 80% di N=3, baru naik ke N=4.</div>' +
'</div>';
var cara = iqPanduanHtml();
var logHtml = iqRenderLog(log, meta);
var isi;
if (IQS.tab === 'log') isi = logHtml;
else if (IQS.tab === 'cara') isi = cara;
else isi = langkah + tracker + drill + nback + iqTipsBox();
return head + tabBar + isi;
}
window.renderIQ = renderIQ;
function iqPanduanHtml() {
var jenis = ['angka', 'huruf', 'matriks', 'rotasi', 'verbal', 'campuran'].map(function (k) {
var pd = IQ_PANDUAN[k];
return '<div style="padding:12px 0;border-bottom:1px solid var(--border)">' +
'<div class="iq-dom-top"><span class="iq-kode">' + pd.kode + '</span><span class="iq-dom-nama">' + escapeHtml(pd.judul) + '</span></div>' +
'<div class="iq-dom-desc" style="margin-bottom:0">' + escapeHtml(pd.cara) + '</div>' +
'<div class="iq-dom-foot" style="margin-top:6px">Akurasimu: ' + escapeHtml(iqAkurasiDomain(k)) + '</div>' +
'</div>';
}).join('');
var links = (typeof IQ_REF !== 'undefined' ? IQ_REF.links : []).map(function (l) {
return '<a class="iq-link" href="' + l.url + '" target="_blank" rel="noopener noreferrer">' +
'<div class="iq-link-nama">' + escapeHtml(l.nama) + '</div>' +
'<div class="iq-link-ukur">' + escapeHtml(l.ukur) + '</div>' +
'<div class="iq-link-dasar">' + ic('check-circle', 12) + ' ' + escapeHtml(l.dasar) + '</div>' +
'<div class="iq-link-url">' + escapeHtml(l.url) + '</div>' +
'</a>';
}).join('');
return '<div class="section-title">' + ic('book', 16) + ' Arti Angka di IQ Lab</div>' +
'<div class="tips-box" style="margin-bottom:18px">' +
'<div class="tips-title">' + ic('bulb', 16) + ' Tiga angka yang berbeda, jangan tertukar</div>' +
'<ul>' +
'<li><strong>Akurasi drill (%)</strong> — persentase jawaban benar saat kamu latihan di sini. Ini alat ukur <em>kemajuan latihan</em>, bukan IQ.</li>' +
'<li><strong>Rekor N-Back (%)</strong> — akurasi tertinggi kamu di latihan memori kerja.</li>' +
'<li><strong>Skor IQ (angka seperti 100/110)</strong> — hanya boleh diisi dari tes tervalidasi (daftar di bawah), dicatat di tab <strong>Log Skor</strong>.</li>' +
'</ul>' +
'<div style="font-size:12px;color:var(--text2);margin-top:8px">Aturan praktis: kejar akurasi ≥ 80% di setiap jenis soal dulu. Setelah itu baru naik kecepatan dan jumlah soal.</div>' +
'</div>' +
'<div class="section-title">' + ic('list', 16) + ' Kode Jenis Soal</div>' +
'<div class="card" style="padding:6px 16px;margin-bottom:20px">' + jenis + '</div>' +
'<div class="section-title">' + ic('globe', 16) + ' Ambil Skor IQ Resmi di Alat Ukur Tervalidasi</div>' +
'<div style="font-size:12px;color:var(--text2);margin-bottom:12px">Drill di halaman ini untuk latihan. Untuk mendapat <strong>angka IQ</strong>, pakai alat berikut — semuanya punya norma &amp; dasar ilmiah, bukan kuis asal. Hasilnya catat di tab <strong>Log Skor</strong>.</div>' +
'<div class="iq-links">' + links + '</div>' +
'<div class="section-title">' + ic('zap', 16) + ' Cara Main Dual N-Back (rinci)</div>' +
'<div class="tips-box" style="margin-bottom:18px">' +
'<div class="tips-title">' + ic('bulb', 16) + ' Langkah demi langkah</div>' +
'<ul>' +
'<li>Pilih level <strong>N</strong> dulu. Mulai dari N=2 kalau baru pertama kali.</li>' +
'<li>Tekan <strong>Mulai</strong>, lalu perhatikan kotak mana yang menyala.</li>' +
'<li>Tekan <strong>COCOK</strong> bila posisi kotak sekarang sama dengan posisi N langkah sebelumnya. Bila tidak sama, biarkan saja.</li>' +
'<li>Jangan menebak-nebak: lebih baik tidak menekan daripada salah tekan. Salah tekan (<em>salah-tekan</em>) menurunkan akurasi.</li>' +
'<li>Satu sesi 30 percobaan. Ulangi 3-5 sesi per hari — latihan ini paling efektif kalau rutin &amp; singkat.</li>' +
'</ul>' +
'</div>' +
'<div class="section-title">' + ic('shield', 16) + ' Catatan Privasi</div>' +
'<div class="tips-box" style="margin-bottom:18px">' +
'<div style="font-size:12px;color:var(--text2)">' +
'Semua soal dibuat di HP kamu sendiri. Hasil latihan dan catatan skor disimpan di penyimpanan lokal browser (localStorage) — tidak dikirim ke server mana pun. ' +
'Kalau ganti HP / bersihkan data browser, pakai <strong>Progress → Export Backup</strong> supaya riwayat tidak hilang.' +
'</div>' +
'</div>';
}
function iqTipsBox() {
return '<div class="tips-box" style="margin-top:6px">' +
'<div class="tips-title">' + ic('bulb', 16) + ' Aturan Pengerjaan yang Paling Menaikkan Skor</div>' +
'<ul>' +
'<li><strong>Jawab semua soal.</strong> Tes seleksi umumnya tanpa penalti salah — kosong = kehilangan poin pasti.</li>' +
'<li><strong>Time-boxing:</strong> soal &gt; 90 detik dilewati, kembali di akhir. Kecepatan (speed of processing) adalah komponen yang paling bisa dilatih.</li>' +
'<li><strong>Matriks gambar:</strong> cek aturan dari dua arah (baris DAN kolom): jumlah elemen, arah putar, isi bentuk.</li>' +
'<li><strong>Putar vs cermin:</strong> hitung arah putaran panji/tiang, jangan hanya menilai kemiripan bentuk.</li>' +
'<li><strong>Deret angka:</strong> hitung selisih antar suku dulu; kalau selisihnya naik, itu pola beda-naik.</li>' +
'<li><strong>Faktor non-latihan:</strong> tidur 7-8 jam, aerobik 30 menit 3-5x/minggu, kreatin 5 g/hari (ada bukti RCT untuk performa kognitif saat lelah).</li>' +
'<li><strong>Latihan bertimer</strong> minimal 2x seminggu supaya stamina tes ikut terlatih.</li>' +
'</ul>' +
'</div>';
}
function iqRenderLog(log, meta) {
var rows = log.slice().reverse().map(function (e, i) {
return '<div class="iq-log-row">' +
'<div class="iq-log-skor">' + Number(e.skor) + '</div>' +
'<div style="flex:1;min-width:0">' +
'<div style="font-size:13px;color:var(--white);font-weight:600">' + escapeHtml(e.tes) + '</div>' +
'<div style="font-size:11px;color:var(--text3)">' + escapeHtml(e.tgl) + (e.catatan ? ' · ' + escapeHtml(e.catatan) : '') + '</div>' +
'</div>' +
'<button class="btn btn-ghost btn-sm" onclick="iqDelLog(' + (log.length - 1 - i) + ')">' + ic('trash', 14) + '</button>' +
'</div>';
}).join('');
var max = 1;
log.forEach(function (e) { max = Math.max(max, Number(e.skor) || 0); });
var chart = log.length < 2 ? '' :
'<div class="iq-chart">' + log.slice(-12).map(function (e) {
var h = Math.max(6, Math.round((Number(e.skor) / (max || 1)) * 90));
return '<div class="iq-bar-wrap" title="' + escapeHtml(e.tgl) + ' — ' + Number(e.skor) + '">' +
'<div class="iq-bar" style="height:' + h + 'px"></div>' +
'<div class="iq-bar-lbl">' + Number(e.skor) + '</div></div>';
}).join('') + '</div>';
var opsi = (typeof IQ_REF !== 'undefined' ? IQ_REF.links : []).map(function (l) {
return '<option value="' + escapeHtml(l.nama) + '">' + escapeHtml(l.nama) + '</option>';
}).join('') + '<option value="Lainnya">Lainnya</option>';
var terakhir = log.length ? log[log.length - 1] : null;
var selisih = terakhir ? (Number(terakhir.skor) - meta.baseline) : 0;
var ringkas = terakhir
? '<div class="tips-box" style="margin-bottom:14px"><div class="tips-title">' + ic('chart', 15) + ' Ringkasan</div>' +
'<ul><li>Skor terakhir: <strong>' + Number(terakhir.skor) + '</strong> (' + escapeHtml(terakhir.tes) + ', ' + escapeHtml(terakhir.tgl) + ')</li>' +
'<li>Dibanding baseline ' + meta.baseline + ': <strong>' + (selisih >= 0 ? '+' : '') + selisih + ' poin</strong> · sisa ' + Math.max(0, meta.target - Number(terakhir.skor)) + ' poin ke target ' + meta.target + '</li>' +
'<li>Total retest tercatat: <strong>' + log.length + 'x</strong></li></ul></div>'
: '';
return '<div style="font-size:20px;font-weight:800;color:var(--white);margin-bottom:6px">' + ic('trend', 18) + ' Log Skor &amp; Retest</div>' +
'<div style="font-size:12px;color:var(--text2);margin-bottom:14px">Catat hasil tiap retest di sini. Yang boleh diisi hanya hasil alat ukur tervalidasi: ICAR (16 item), Mensa Norway, CogniFit, TIKI, atau tes resmi dari lembaga psikologi. ' +
'Skor drill di halaman Latihan <strong>tidak</strong> masuk ke sini.</div>' +
ringkas +
'<div class="iq-form">' +
'<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Isi 4 kolom berikut lalu tekan Simpan:</div>' +
'<div class="iq-form-row">' +
'<input type="date" id="iqTgl" class="iq-input" title="Tanggal retest" value="' + new Date().toISOString().slice(0, 10) + '">' +
'<input type="number" id="iqSkor" class="iq-input" placeholder="Skor IQ (40-160)" min="40" max="160" title="Skor IQ">' +
'</div>' +
'<div class="iq-form-row">' +
'<select id="iqTes" class="iq-input" title="Alat ukur">' + opsi + '</select>' +
'<input type="text" id="iqCatatan" class="iq-input" placeholder="Catatan, mis. N=3 tembus" maxlength="60">' +
'</div>' +
'<button class="btn btn-primary btn-lg" style="width:100%" onclick="iqAddLog()">' + ic('plus', 16) + ' Simpan Hasil</button>' +
'</div>' +
chart +
(rows ? '<div style="margin-top:14px">' + rows + '</div>' : '<div class="empty"><div class="empty-icon">' + icon('list', 40) + '</div><p>Belum ada hasil tercatat.</p></div>') +
'<div style="display:flex;gap:8px;margin-top:18px;flex-wrap:wrap">' +
'<button class="btn btn-secondary btn-sm" onclick="iqTab(\'latihan\')">' + ic('arrow-left', 15) + ' Kembali ke Latihan</button>' +
'<button class="btn btn-danger btn-sm" onclick="iqClearLog()">' + ic('trash', 15) + ' Hapus Semua Log</button>' +
'</div>';
}
window.iqTab = function (t) {
IQS.tab = t;
S.page = 'iq';
S.mode = null;
render();
};
window.iqSetBaseline = function () {
var v = prompt('Skor baseline kamu (hasil tes tervalidasi, mis. 100):', loadIqMeta().baseline);
if (v === null) return;
var n = parseInt(v, 10);
if (isNaN(n) || n < 40 || n > 160) { alert('Masukkan angka 40-160.'); return; }
var m = loadIqMeta(); m.baseline = n; saveIqMeta(m); render();
};
window.iqSetTarget = function () {
var v = prompt('Target skor IQ:', loadIqMeta().target);
if (v === null) return;
var n = parseInt(v, 10);
if (isNaN(n) || n < 40 || n > 160) { alert('Masukkan angka 40-160.'); return; }
var m = loadIqMeta(); m.target = n; saveIqMeta(m); render();
};
window.iqAddLog = function () {
var tgl = (document.getElementById('iqTgl') || {}).value || '';
var tes = (document.getElementById('iqTes') || {}).value || 'Lainnya';
var cat = (document.getElementById('iqCatatan') || {}).value || '';
var skor = parseInt((document.getElementById('iqSkor') || {}).value, 10);
if (isNaN(skor) || skor < 40 || skor > 160) { alert('Skor harus angka 40-160.'); return; }
var log = loadIqLog();
log.push({ tgl: tgl, tes: tes, skor: skor, catatan: cat.slice(0, 60) });
saveIqLog(log);
render();
};
window.iqDelLog = function (i) {
var log = loadIqLog();
if (i < 0 || i >= log.length) return;
log.splice(i, 1);
saveIqLog(log);
render();
};
window.iqClearLog = function () {
if (!confirm('Hapus semua catatan skor retest?')) return;
localStorage.removeItem('tni_iq_log');
render();
};
function iqMulai(items, timerDetik) {
S.cat = 'iq';
S.mode = 'iq';
S.isSimulasi = !!(timerDetik > 0);
S.questions = items;
S.idx = 0;
S.answers = {};
S.flagged = {};
S.timed = !!(timerDetik > 0);
S.totalTime = S.timed ? timerDetik : 0;
S.timeLeft = S.totalTime;
if (S.timer) { clearInterval(S.timer); S.timer = null; }
S.page = 'soal';
render();
}
window.startIQDrill = function (domain) {
if (typeof IQ_GEN === 'undefined') { alert('Data soal IQ belum dimuat. Muat ulang halaman.'); return; }
S.iqSpec = { domain: domain, jumlah: 10, detik: 0 };
var items = IQ_GEN.buat(domain, S.iqSpec.jumlah);
if (!items.length) { alert('Gagal membuat soal, coba lagi.'); return; }
iqMulai(items, S.iqSpec.detik);
};
window.startIQSimulasi = function () {
if (typeof IQ_GEN === 'undefined') { alert('Data soal IQ belum dimuat. Muat ulang halaman.'); return; }
S.iqSpec = { domain: 'campuran', jumlah: 25, detik: 1200 }; // 20 menit
var items = IQ_GEN.buat('campuran', S.iqSpec.jumlah);
if (!items.length) { alert('Gagal membuat soal, coba lagi.'); return; }
iqMulai(items, S.iqSpec.detik);
};
function iqNbIdleHtml() {
var cells = '';
for (var i = 0; i < 9; i++) cells += '<div class="nb-cell" id="nbC' + i + '"></div>';
return '<div class="nb-grid">' + cells + '</div>' +
'<div class="nb-status" id="nbStatus">Siap. Pilih level N lalu tekan Mulai.</div>';
}
window.iqNbSetN = function (v) {
if (IQS.nb && IQS.nb.running) return;
IQS.nb = { n: v, running: false };
render();
};
window.iqNbToggle = function () {
if (IQS.nb && IQS.nb.running) { iqNbStop('Dihentikan.'); return; }
iqNbStart();
};
function iqNbStart() {
var st = IQS.nb || {};
var n = st.n || 2;
var st2 = {
n: n, running: true, trial: 0, seq: [], hits: 0, miss: 0, fa: 0, cr: 0,
awaiting: false, token: (st.token || 0) + 1, maxTrial: 30
};
IQS.nb = st2;
var btn = document.getElementById('nbStartBtn');
if (btn) btn.innerHTML = ic('x', 16) + ' Stop';
var mb = document.getElementById('nbMatchBtn');
if (mb) mb.disabled = false;
iqNbTrial();
}
window.iqNbStart = iqNbStart;
function iqNbTrial() {
var st = IQS.nb;
if (!st || !st.running) return;
var tok = st.token;
if (st.trial >= st.maxTrial) { iqNbStop('Selesai.'); return; }
var pos = Math.floor(Math.random() * 9);
st.seq.push(pos);
st.trial++;
st.awaiting = true;
st.answered = false;
for (var i = 0; i < 9; i++) {
var c = document.getElementById('nbC' + i);
if (c) c.className = 'nb-cell' + (i === pos ? ' on' : '');
}
var isMatch = st.trial > st.n && st.seq[st.trial - 1 - st.n] === pos;
setTimeout(function () {
if (!IQS.nb || IQS.nb.token !== tok || !IQS.nb.running) return;
for (var j = 0; j < 9; j++) {
var cc = document.getElementById('nbC' + j);
if (cc) cc.className = 'nb-cell';
}
if (isMatch && !st.answered) st.miss++;
if (!isMatch && st.answered) st.fa++;
if (isMatch && st.answered) st.hits++;
if (!isMatch && !st.answered) st.cr++;
st.awaiting = false;
iqNbStatus();
setTimeout(function () {
if (!IQS.nb || IQS.nb.token !== tok || !IQS.nb.running) return;
iqNbTrial();
}, 900);
}, 1500);
}
function iqNbStatus() {
var st = IQS.nb;
if (!st) return;
var el = document.getElementById('nbStatus');
if (!el) return;
var resp = st.hits + st.fa;
var benar = st.hits + st.cr;
var total = st.hits + st.miss + st.fa + st.cr;
var acc = total ? Math.round((benar / total) * 100) : 100;
el.innerHTML = 'Percobaan ' + st.trial + '/' + st.maxTrial + ' · jawaban benar ' + benar + '/' + total +
' · akurasi <strong>' + acc + '%</strong> · salah-tekan ' + st.fa + ' · kelewatan ' + st.miss;
}
window.iqNbMatch = function () {
var st = IQS.nb;
if (!st || !st.running || !st.awaiting || st.answered) return;
st.answered = true;
var mb = document.getElementById('nbMatchBtn');
if (mb) { mb.classList.add('flash'); setTimeout(function () { mb.classList.remove('flash'); }, 200); }
};
function iqNbStop(msg) {
var st = IQS.nb || {};
st.running = false;
st.token = (st.token || 0) + 1;
for (var i = 0; i < 9; i++) {
var c = document.getElementById('nbC' + i);
if (c) c.className = 'nb-cell';
}
var total = st.hits + st.miss + st.fa + st.cr;
var acc = total ? Math.round(((st.hits + st.cr) / total) * 100) : 0;
var nb = loadIqNb();
if (total >= 5 && acc > (nb.best || 0)) { nb.best = acc; nb.bestN = st.n; saveIqNb(nb); }
var el = document.getElementById('nbStatus');
if (el) el.innerHTML = escapeHtml(msg) + ' Percobaan ' + (st.trial || 0) + ' · akurasi sesi ini <strong>' + acc + '%</strong>' +
(total ? ' (benar ' + (st.hits + st.cr) + '/' + total + ')' : '') + '. Rekor: ' + (loadIqNb().best ? loadIqNb().best + '%' : 'belum ada (minimal 5 percobaan)');
var btn = document.getElementById('nbStartBtn');
if (btn) btn.innerHTML = ic('zap', 16) + ' Mulai';
var mb = document.getElementById('nbMatchBtn');
if (mb) mb.disabled = true;
IQS.nb = { n: st.n || 2, running: false, token: st.token };
}
window.iqNbStop = iqNbStop;
