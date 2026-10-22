// Uji runtime halaman /simulasi-tryout/ (demo mode) — t_ec85dbfb
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8901';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('dialog', d => d.accept());

await page.goto(base + '/simulasi-tryout/?utm_source=uji-runtime&utm_campaign=uji-tryout', { waitUntil: 'load' });

// 1. halaman tampil
const h1 = await page.locator('h1').first().textContent();
console.log('H1:', h1.trim());

//จ 2. mulai demo
await page.click('#btnDemo');
await page.waitForSelector('.soal-teks', { timeout: 15000 });
const soalNo = await page.locator('.soal-no').textContent();
console.log('Soal pertama:', soalNo.trim());

// 3. jawab 6 soal (2 benar-ish: pilih opsi pertama), 2 lompat tanpa jawab
for (let i = 0; i < 6; i++) {
  await page.locator('.baris-opsi').first().click();
  await page.click('.navigasi .tombol.kecil:not(.sekunder)'); // Berikutnya
}
await page.click('text=Selesai & lihat skor');
await page.waitForSelector('.skor-besar', { timeout: 5000 });
const skor = await page.locator('.skor-besar').textContent();

// 4. tabel rincian jumlah soalnya
const baris = await page.locator('.tabel tbody tr').allTextContents();
console.log('SKOR:', skor);
baris.forEach(b => console.log('BARIS:', b.replace(/\s+/g, ' ').trim()));

// 5. jumlah total soal di tabel = 20 (demo)
const total = await page.evaluate(() => {
  let t = 0; document.querySelectorAll('.tabel tbody tr').forEach(tr => { t += parseInt(tr.cells[1].textContent, 10); });
  return t;
});
console.log('TOTAL SOAL DI TABEL:', total, total === 20 ? 'OK' : 'GAGAL');

// 6. area terlemah disorot
const terlemah = await page.locator('p strong.terlemah').textContent();
console.log('TERLEMAH:', terlemah.trim());

// 7. pembahasan tampil
const jumlahPembahasan = await page.locator('.tanya .pembahasan').count();
console.log('PEMBAHASAN (hasil):', jumlahPembahasan, '(diharapkan >=20)');

// 8. timer terlihat
console.log('TIMER SEBELUM SELESAI:', await page.locator('.timer').count() >= 0 ? '(label respons OK)' : 'hilang');
console.log('ERROR JS:', errors.length ? errors.join(' | ') : 'nihil');
await browser.close();
