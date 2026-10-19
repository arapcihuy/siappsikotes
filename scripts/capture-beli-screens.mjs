#!/usr/bin/env node
/**
 * capture-beli-screens.mjs
 * Screenshot capture for /beli/ baseline: first paint, loading state, final state.
 * Saves timestamped PNGs into docs/baseline-beli-screens/.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const OUT_DIR = resolve(repoRoot, 'docs', 'baseline-beli-screens');
const targetUrl = 'https://siappsikotes.my.id/beli/';

const ts = () => {
  const d = new Date();
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // (a) first paint: earliest committed frame — right after response commit, before load.
  const t0 = Date.now();
  await page.goto(targetUrl, { waitUntil: 'commit', timeout: 30000 });
  await page.screenshot({ path: resolve(OUT_DIR, `${ts()}-01-first-paint.png`), fullPage: false });
  console.log(`first-paint screenshot taken at ${Date.now() - t0} ms`);

  await page.waitForLoadState('domcontentloaded');
  console.log(`domcontentloaded at ${Date.now() - t0} ms`);

  // (b) loading state: mid-load, right after DOM ready (external CSS/JS may still be pending).
  await page.screenshot({ path: resolve(OUT_DIR, `${ts()}-02-loading-state.png`), fullPage: false });
  console.log('loading-state screenshot taken');

  // (c) final state: network idle + QRIS box + price visible.
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.waitForSelector('.qris-kotak', { timeout: 10000 });
  await page.waitForFunction(() => document.body.innerText.includes('39.000'), null, { timeout: 10000 });
  await page.screenshot({ path: resolve(OUT_DIR, `${ts()}-03-final-qris-rp39000.png`), fullPage: true });
  console.log('final-state screenshot taken');

  await browser.close();
  console.log('OUT_DIR:', OUT_DIR);
}

main();
