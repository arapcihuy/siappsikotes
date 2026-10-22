import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message));
page.on('dialog', d => d.accept());
await page.goto('http://127.0.0.1:8901/simulasi-tryout/', { waitUntil: 'load' });
// tanpa kode: tombol penuh harus mengarah ke /beli/ (upsell)
await page.click('#btnPenuh');
await page.waitForURL('**/beli/**', { timeout: 8000 }).catch(() => {});
console.log('URL setelah klik penuh tanpa kode:', page.url().slice(0, 110));
// tidak boleh ada panel soal
console.log('panel soal tersembunyi:', await page.locator('#panel-ujian').isHidden());
// dengan kode sah
await page.goto('http://127.0.0.1:8901/simulasi-tryout/', { waitUntil: 'load' });
await page.evaluate(() => localStorage.setItem('tni_kode_akses', 'SPPSP123FQPH'));
await page.reload({ waitUntil: 'load' });
await page.click('#btnPenuh');
await page.waitForSelector('.soal-teks', { timeout: 20000 });
console.log('judul sesi:', await page.locator('#panelJudul').textContent());
const total = await page.locator('.peta-jawab button').count();
console.log('jumlah kartu soal di peta:', total, total === 120 ? 'OK' : 'GAGAL');
console.log('timer awal:', await page.locator('.timer').textContent());
console.log('ERROR JS:', errs.length ? errs.join(' | ') : 'nihil');
await browser.close();
