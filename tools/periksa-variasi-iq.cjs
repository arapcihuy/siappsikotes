const fs = require('fs'), vm = require('vm');
const store = {};
const ctx = { console, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, Date, Math, JSON, Object, Array, String, Number, Set };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('static/js/mesin-soal.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('data/soal-iq.js', 'utf8'), ctx);
const G = ctx.IQ_GEN;

const DOM = ['angka', 'huruf', 'matriks', 'rotasi', 'verbal'];
console.log('=== keragaman pola dalam 1 set 10 soal (memakai label pola generator, 300 sesi) ===');
for (const d of DOM) {
  let unik = 0, dup = 0, maks = 0, sesi = 300, kosong = 0;
  for (let i = 0; i < sesi; i++) {
    const items = G.buat(d, 10);
    if (items.length < 10) kosong++;
    const m = {};
    items.forEach(it => { m[it._pola] = (m[it._pola] || 0) + 1; });
    unik += Object.keys(m).length;
    const t = Math.max(0, ...Object.values(m));
    maks = Math.max(maks, t);
    if (t >= 3) dup++;
  }
  console.log(`${d.padEnd(8)} pola unik/set ${(unik / sesi).toFixed(2)}/10 · set dgn pola keluar 3x atau lebih: ${(dup / sesi * 100).toFixed(0)}% · pola terbanyak dalam 1 set: ${maks} · sesi kurang dari 10 soal: ${kosong}`);
}

console.log('\n=== soal identik terulang antar sesi (30 sesi x 10 soal) ===');
for (const d of DOM) {
  const lihat = new Set();
  let ulang = 0, total = 0;
  for (let s = 0; s < 30; s++) {
    G.buat(d, 10).forEach(it => { total++; if (lihat.has(it._sig)) ulang++; else lihat.add(it._sig); });
  }
  console.log(`${d.padEnd(8)} ${ulang}/${total} (${(ulang / total * 100).toFixed(1)}%) soal persis sama dgn yg pernah keluar`);
}

console.log('\n=== campuran 25 soal: sebaran jenis (200 sesi) ===');
{
  const h = {};
  for (let i = 0; i < 200; i++) G.buat('campuran', 25).forEach(it => { h[it._tipe] = (h[it._tipe] || 0) + 1; });
  const tot = Object.values(h).reduce((a, b) => a + b, 0);
  Object.entries(h).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${k.padEnd(9)} ${(v / tot * 100).toFixed(1)}%`));
}

console.log('\n=== PEMAKAIAN NYATA: 12 sesi drill 10 soal berturut-turut (riwayat aktif) ===');
console.log('    angka = berapa dari 10 soal yang SUDAH PERNAH keluar di sesi sebelumnya');
for (const d of DOM) {
  const store2 = ctx.localStorage;
  store2.removeItem('tni_soal_riwayat');
  const pernah = new Set();
  const baris = [];
  for (let s = 1; s <= 12; s++) {
    const items = G.buat(d, 10);
    let ulang = 0;
    items.forEach(it => {
      const k = ctx.kunciSoal({ _sig: it._sig });
      if (pernah.has(k)) ulang++;
      pernah.add(k);
      ctx.catatHasilSoal({ _sig: it._sig }, Math.random() < 0.75);
    });
    baris.push(ulang);
  }
  console.log(`   ${d.padEnd(8)} ${baris.join(' ')}`);
}
ctx.localStorage.removeItem('tni_soal_riwayat');

console.log('\n=== berapa banyak soal berbeda yang bisa DIBUAT per domain (2000 percobaan) ===');
for (const d of DOM) {
  const s = new Set();
  for (let i = 0; i < 2000; i++) { const it = G.buatSatu(d); if (it && it._sig) s.add(it._sig); }
  console.log(`   ${d.padEnd(8)} ${s.size} soal unik dari 2000 percobaan (${(s.size / 2000 * 100).toFixed(0)}% unik)`);
}
