// Verifikasi mandiri kunci soal IQ Lab (jalur kedua: dihitung dari TEKS soal).
const fs = require('fs'), vm = require('vm');
const store = {};
const ctx = { console, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } }, Date, Math, JSON, Object, Array, String, Number, Set };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('static/js/mesin-soal.js', 'utf8'), ctx);
vm.runInContext(fs.readFileSync('data/soal-iq.js', 'utf8'), ctx);
const G = ctx.IQ_GEN;
const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function angkaDari(q) {
  const m = String(q).match(/Lanjutkan deret berikut:\s*([\d,\s-]+)\s*,/);
  if (!m) return null;
  return m[1].split(',').map(s => Number(s.trim())).filter(v => !isNaN(v));
}
function kandidatAngka(t) {
  const [t0, t1, t2, t3, t4] = t;
  const d = [t1 - t0, t2 - t1, t3 - t2, t4 - t3];
  const out = [];
  const add = v => { if (Number.isFinite(v) && Math.abs(v - Math.round(v)) < 1e-9) out.push(Math.round(v)); };
  if (d.every(x => x === d[0])) add(t4 + d[0]);
  if (t0 && t1 % t0 === 0 && t2 % t1 === 0 && t3 % t2 === 0 && t4 % t3 === 0) { const r = t1 / t0; if (r === t2 / t1 && r === t3 / t2 && r === t4 / t3) add(t4 * r); }
  if (t1 && t0 % t1 === 0 && t1 % t2 === 0 && t2 % t3 === 0 && t3 % t4 === 0) { const r = t0 / t1; if (r === t1 / t2 && r === t2 / t3 && r === t3 / t4) add(t4 / r); }
  if (d[0] === d[2] && d[1] === d[3]) add(t4 + d[0]);
  if (d[1] - d[0] === d[2] - d[1] && d[2] - d[1] === d[3] - d[2]) add(t4 + d[3] + (d[3] - d[2]));
  if (t0 + t1 === t2 && t1 + t2 === t3 && t2 + t3 === t4) add(t4 + t3);
  { const c = t0 + t1 - t2; if (t3 === t1 + t2 - c && t4 === t2 + t3 - c) add(t4 + t3 - c); }
  if (d[1] === 2 * d[0] && d[2] === 2 * d[1] && d[3] === 2 * d[2]) add(t4 + 2 * d[3]);
  for (let m = 2; m <= 4; m++) { const c = t1 - t0 * m; if (t2 === t1 * m + c && t3 === t2 * m + c && t4 === t3 * m + c) add(t4 * m + c); }
  { const dd = t1 - t0; if (t2 === t1 * 2 && t3 === t2 + dd && t4 === t3 * 2) add(t4 + dd); }
  { const d2a = d[1] - d[0]; if (d2a === d[2] - d[1] && d2a === d[3] - d[2]) add(t4 + d[3] + d2a); }
  { const d2a = d[1] - d[0], d3a = (d[2] - d[1]) - d2a; if (d3a !== 0 && d3a === ((d[3] - d[2]) - (d[2] - d[1]))) add(t4 + (d[3] + d3a)); }
  if (t2 - t0 === t4 - t2) add(t3 + (t2 - t0));
  { const z = t3 - t0; if (t4 - t1 === z) add(t2 + z); }
  return out;
}
function hurufDari(q) {
  const m = String(q).match(/Lanjutkan deret huruf berikut:\s*([A-Z,\s]+)\s*,/);
  if (!m) return null;
  return m[1].split(',').map(s => s.trim()).filter(Boolean);
}
function kandidatHuruf(h) {
  const p = h.map(x => AB.indexOf(x) + 1);
  const d = [p[1] - p[0], p[2] - p[1], p[3] - p[2], p[4] - p[3]];
  const out = [];
  const add = v => { if (v >= 1 && v <= 26) out.push(v); };
  if (d.every(x => x === d[0])) add(p[4] + d[0]);
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

let nCocok = 0, nTakLengkap = 0, nSalah = 0, nGanda = 0;
const contoh = [];
const N = 4000;
for (let i = 0; i < N; i++) {
  const domain = ['angka', 'huruf'][i % 2];
  const it = G.buatSatu(domain);
  if (!it) { nSalah++; contoh.push({ domain, jenis: 'soal kosong' }); continue; }
  if (domain === 'angka') {
    const t = angkaDari(it.pertanyaan), k = kandidatAngka(t || []);
    const nyata = Number(it._correct);
    if (!t || t.length !== 5) { nSalah++; contoh.push({ domain, it, k, nyata, jenis: 'deret bukan 5 suku (' + (t ? t.length : 0) + ')' }); continue; }
    if (!k.length) { nTakLengkap++; if (contoh.length < 12) contoh.push({ domain, it, k, nyata, jenis: 'tak terverifikasi' }); continue; }
    const lain = [...new Set(k)].filter(v => v !== nyata && v > 0);
    if (k.indexOf(nyata) === -1) { nSalah++; contoh.push({ domain, it, k, nyata }); }
    else if (lain.length) { nGanda++; contoh.push({ domain, it, k, nyata, jenis: 'dua jawaban masuk akal' }); }
    else nCocok++;
  } else {
    const h = hurufDari(it.pertanyaan), k = kandidatHuruf(h || []);
    const nyata = AB.indexOf(it._correct) + 1;
    if (it._correct === undefined || it._correct === 'undefined' || nyata === 0) { nSalah++; contoh.push({ domain, it, k, nyata: 'undefined' }); continue; }
    if (!k.length) { nTakLengkap++; continue; }
    const lain = [...new Set(k)].filter(v => v !== nyata);
    if (k.indexOf(nyata) === -1) { nSalah++; contoh.push({ domain, it, k, nyata }); }
    else if (lain.length) { nGanda++; contoh.push({ domain, it, k, nyata, jenis: 'dua jawaban masuk akal' }); }
    else nCocok++;
  }
}
console.log(`diperiksa ${N} soal | kunci terbukti cocok: ${nCocok} | tak bisa diverifikasi otomatis: ${nTakLengkap} | KUNCI SALAH: ${nSalah} | ambigu (2 jawaban): ${nGanda}`);
contoh.slice(0, 8).forEach(c => {
  console.log('---', c.domain, c.jenis || 'KUNCI SALAH');
  console.log('   q     :', c.it && c.it.pertanyaan);
  console.log('   kunci :', c.nyata, '| hitung ulang:', JSON.stringify(c.k));
  console.log('   bahas :', c.it && String(c.it.pembahasan).slice(0, 150));
});
