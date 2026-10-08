
window.AKSI = {};
window.panelAksiLanjutan = function (konteks) {
var tombol = [];
if (konteks === 'b5') {
tombol.push({ t: 'Kerjakan 5 soal sekarang', f: 'modeLimaMenit()', utama: true, ic: 'clock' });
tombol.push({ t: 'Latih topik terlemah', f: 'latihTerlemah()', utama: false, ic: 'target' });
} else if (konteks === 'hasil') {
tombol.push({ t: 'Ulangi sesi serupa', f: 'ulangiSesiTerakhir()', utama: true, ic: 'refresh' });
tombol.push({ t: 'Latih topik terlemah', f: 'latihTerlemah()', utama: false, ic: 'target' });
tombol.push({ t: 'Kerjakan 5 soal', f: 'modeLimaMenit()', utama: false, ic: 'clock' });
} else {
tombol.push({ t: 'Kerjakan 5 soal sekarang', f: 'modeLimaMenit()', utama: true, ic: 'clock' });
}
var html = tombol.map(function (b) {
return '<button class="btn ' + (b.utama ? 'btn-primary' : 'btn-secondary') + ' btn-sm" onclick="' + b.f + '">' +
ic(b.ic, 14) + ' ' + b.t + '</button>';
}).join(' ');
return '<div class="card aksi-lanjutan">' +
'<div class="hari-head">' + ic('arrow-right', 16) + ' <strong>Lanjut sekarang</strong></div>' +
'<div class="hari-sub">Yang membedakan orang yang lulus bukan satu sesi panjang, tetapi kebiasaan mengulang hampir tiap hari.</div>' +
'<div class="aksi-bar">' + html + '</div>' +
'</div>';
};
window.latihTerlemah = function () {
var topik = (typeof statTopik === 'function') ? statTopik() : [];
if (topik.length && typeof drillTopik === 'function') {
drillTopik(topik[0].topik, 10);
return;
}
if (typeof drillAdaptif === 'function') { drillAdaptif(); return; }
if (typeof drillWrong === 'function') { drillWrong(); return; }
modeLimaMenit();
};
window.ulangiSesiTerakhir = function () {
if (S.jalurSim && typeof mulaiSimulasiJalur === 'function') { mulaiSimulasiJalur(S.jalurSim); return; }
if (S.isFormat && typeof startSimulasiFormat === 'function') { startSimulasiFormat(); return; }
if (S.isSimulasi && typeof startSimulasi60 === 'function') { startSimulasi60(); return; }
if (S.cat && S.cat !== 'all' && typeof startCat === 'function') { startCat(S.cat, S.mode === 'learn' ? 'learn' : 'tryout'); return; }
modeLimaMenit();
};
window.ringkasanHasil = function () {
var baris = [];
var p = (typeof bacaProfil === 'function') ? bacaProfil() : { nama: '' };
var b5 = (typeof b5Terakhir === 'function') ? b5Terakhir() : null;
if (b5 && b5.skor) {
var urut = Object.keys(b5.skor).sort(function (a, b) { return b5.skor[b].persen - b5.skor[a].persen; });
baris.push('Hasil latihan kepribadian (Big Five, Mini-IPIP):');
urut.forEach(function (k) {
baris.push('  ' + FAKTOR_B5[k].nama + ': ' + b5.skor[k].persen + '%');
});
baris.push('  Paling menonjol: ' + FAKTOR_B5[urut[0]].nama + ' · paling rendah: ' + FAKTOR_B5[urut[urut.length - 1]].nama);
}
var skor = (typeof loadScores === 'function') ? loadScores() : [];
if (skor.length) {
var terakhir = skor[skor.length - 1];
baris.push('Latihan tryout: nilai ' + (terakhir.nilai || 0) + ' dari sesi terakhir (' + skor.length + ' sesi tercatat).');
}
var salah = (typeof window.jumlahSalahTersimpan === 'function') ? window.jumlahSalahTersimpan() : 0;
if (salah) baris.push('Soal yang sedang diulang: ' + salah + ' soal.');
if (!baris.length) baris.push('Saya baru mulai latihan psikotes & tes IQ.');
var kepala = p.nama ? ('Hasil latihan saya — ' + p.nama) : 'Hasil latihan saya';
return kepala + '\n' + baris.join('\n') +
'\n\nLatihan psikotes berpembahasan, tanpa akun, bisa offline: https://siappsikotes.my.id/' +
'\n(Latihan, bukan tes resmi — hasil tidak menjamin kelulusan seleksi mana pun.)';
};
window.salinHasil = function () {
var teks = ringkasanHasil();
var beres = function () { alert('Ringkasan hasil disalin. Tempel di chat atau statusmu.'); };
if (navigator.clipboard && navigator.clipboard.writeText) {
navigator.clipboard.writeText(teks).then(beres, function () { cadanganSalin(teks, beres); });
} else {
cadanganSalin(teks, beres);
}
};
function cadanganSalin(teks, beres) {
var t = document.createElement('textarea');
t.value = teks;
t.style.position = 'fixed';
t.style.opacity = '0';
document.body.appendChild(t);
t.select();
try { document.execCommand('copy'); beres(); } catch (e) { alert(teks); }
t.remove();
}
window.unduhKartuHasil = function () {
var W = 1080, H = 1080;
var c = document.createElement('canvas');
c.width = W; c.height = H;
var x = c.getContext('2d');
var g = x.createLinearGradient(0, 0, W, H);
g.addColorStop(0, '#0d1420');
g.addColorStop(1, '#07090d');
x.fillStyle = g;
x.fillRect(0, 0, W, H);
x.fillStyle = '#e6c552';
x.font = 'bold 62px -apple-system, Segoe UI, Roboto, sans-serif';
x.fillText('SiapPsikotes', 72, 128);
x.fillStyle = '#9aa7b4';
x.font = '34px -apple-system, Segoe UI, Roboto, sans-serif';
x.fillText('Latihan psikotes kerja & tes IQ', 72, 182);
var y = 290;
var b5 = (typeof b5Terakhir === 'function') ? b5Terakhir() : null;
if (b5 && b5.skor) {
x.fillStyle = '#e6edf3';
x.font = 'bold 44px -apple-system, Segoe UI, Roboto, sans-serif';
x.fillText('Kepribadian (Big Five)', 72, y);
y += 66;
Object.keys(b5.skor).forEach(function (k) {
var v = b5.skor[k].persen;
x.fillStyle = '#c9cdd3';
x.font = '36px -apple-system, Segoe UI, Roboto, sans-serif';
x.fillText(FAKTOR_B5[k].nama, 72, y);
x.fillStyle = '#28282c';
x.fillRect(520, y - 26, 460, 26);
x.fillStyle = v >= 70 ? '#30d158' : (v >= 40 ? '#e6c552' : '#ff6b5e');
x.fillRect(520, y - 26, Math.max(8, 4.6 * v), 26);
x.fillStyle = '#e6edf3';
x.fillText(v + '%', 1000, y);
y += 74;
});
}
var skor = (typeof loadScores === 'function') ? loadScores() : [];
if (skor.length) {
var t = skor[skor.length - 1];
x.fillStyle = '#e6edf3';
x.font = 'bold 44px -apple-system, Segoe UI, Roboto, sans-serif';
x.fillText('Tryout terakhir: ' + (t.nilai || 0), 72, y + 20);
y += 90;
}
x.fillStyle = '#9aa7b4';
x.font = '30px -apple-system, Segoe UI, Roboto, sans-serif';
x.fillText('Latihan psikotes · tanpa akun · bisa offline', 72, (H - 130));
x.fillStyle = '#6b7783';
x.font = '26px -apple-system, Segoe UI, Roboto, sans-serif';
x.fillText('siappsikotes.my.id', 72, (H - 86));
x.fillText('Latihan, bukan tes resmi · tidak menjamin kelulusan seleksi', 72, (H - 44));
var a = document.createElement('a');
a.href = c.toDataURL('image/png');
a.download = 'hasil-latihan-siappsikotes.png';
document.body.appendChild(a);
a.click();
a.remove();
};
window.panelBagikanHasil = function () {
return '<div class="card">' +
'<div class="hari-head">' + ic('share', 16) + ' <strong>Simpan atau bagikan hasilmu</strong></div>' +
'<div class="hari-sub">Angka di kartu ini milikmu sendiri. Bagikan kalau berguna, misalnya untuk mengajak ' +
'teman yang sedang menyiapkan psikotes ikut berlatih.</div>' +
'<div class="aksi-bar">' +
'<button class="btn btn-secondary btn-sm" onclick="salinHasil()">' + ic('copy', 14) + ' Salin ringkasan</button>' +
'<button class="btn btn-secondary btn-sm" onclick="unduhKartuHasil()">' + ic('download', 14) + ' Unduh gambar hasil</button>' +
'<button class="btn btn-secondary btn-sm" onclick="shareToWhatsApp()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg> WhatsApp</button>' +
'<button class="btn btn-secondary btn-sm" onclick="shareToTelegram()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Telegram</button>' +
'</div>' +
'</div>';
};

window.shareToWhatsApp = function() {
var teks = encodeURIComponent(ringkasanHasil());
window.open('https://api.whatsapp.com/send?text=' + teks, '_blank');
};

window.shareToTelegram = function() {
var teks = encodeURIComponent(ringkasanHasil());
window.open('https://t.me/share/url?url=https://siappsikotes.my.id/&text=' + teks, '_blank');
};
var _renderSebelumFitur13 = window.render;
window.render = function () {
if (_renderSebelumFitur13) _renderSebelumFitur13.apply(this, arguments);
try { sisipPanel13(); } catch (e) {}
};
function sisipPanel13() {
var m = document.getElementById('main');
if (!m) return;
if (S.page === 'b5' && B5 && B5.selesai) {
if (!m.querySelector('.aksi-lanjutan')) {
var t = document.createElement('div');
t.innerHTML = panelAksiLanjutan('b5');
m.appendChild(t.firstElementChild);
}
if (!m.querySelector('[onclick*="salinHasil"]')) {
var t2 = document.createElement('div');
t2.innerHTML = panelBagikanHasil();
m.appendChild(t2.firstElementChild);
}
return;
}
if (S.page === 'hasil') {
if (!m.querySelector('.aksi-lanjutan')) {
var t3 = document.createElement('div');
t3.innerHTML = panelAksiLanjutan('hasil');
m.insertBefore(t3.firstElementChild, m.firstElementChild);
}
if (!m.querySelector('[onclick*="salinHasil"]')) {
var t4 = document.createElement('div');
t4.innerHTML = panelBagikanHasil();
m.appendChild(t4.firstElementChild);
}
}
}
