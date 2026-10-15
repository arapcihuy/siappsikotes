#!/usr/bin/env node
/**
 * Repeatable speed & friction regression check for /beli/
 * Run: node tools/check-beli.mjs
 * Or: npm run check:beli (if script added)
 *
 * Checks:
 * - Page loads within threshold (default 2s, baseline ~0.42s)
 * - QRIS element #qris is visible without excessive scroll (above fold)
 * - Harga Rp 39.000 visible in #beliNominal and #displayHarga
 * - Path from CTA #ctaBayar to payment section #bayar is ≤1 step (direct anchor)
 *
 * Exits 0 on pass, 1 on fail.
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = join(__dirname, '..');
const BELI_HTML = join(REPO_ROOT, 'beli', 'index.html');
const LOAD_THRESHOLD_MS = 2000; // 2s, baseline ~420ms
const MAX_SCROLL_PX_TO_QRIS = 1200; // excessive scroll threshold
const MAX_STEPS_TO_PAYMENT = 1;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const start = Date.now();
  await page.goto(`file://${BELI_HTML}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#qris', { timeout: 5000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  const loadTime = Date.now() - start;

  const qrisVisible = await page.locator('#qris').isVisible().catch(() => false);
  const qrisBox = await page.locator('#qris').boundingBox().catch(() => null);
  const viewportHeight = page.viewportSize()?.height ?? 800;
  const qrisAboveFold = qrisBox ? qrisBox.y < viewportHeight : false;
  const scrollNeeded = qrisBox ? Math.max(0, qrisBox.y) : Infinity;

  const nominalText = (await page.locator('#beliNominal').textContent().catch(() => ''))?.trim() ?? '';
  const displayHargaText = (await page.locator('#displayHarga').textContent().catch(() => ''))?.trim() ?? '';
  const hargaOk = /Rp\s?39\.000/.test(displayHargaText) && /Rp\s?39\./.test(nominalText);

  const ctaHref = await page.locator('#ctaBayar').getAttribute('href').catch(() => '');
  const ctaPointsToBayar = ctaHref === '#bayar';
  const bayarSectionExists = await page.locator('#bayar').count() > 0;
  const qrisExists = await page.locator('#qris').count() > 0;

  // steps: if CTA directly anchors to #bayar and QRIS is on page, steps = 1
  const stepsToPayment = (ctaPointsToBayar && bayarSectionExists && qrisExists) ? 1 : 999;

  const results = {
    loadTimeMs: loadTime,
    qrisVisible,
    qrisAboveFold,
    scrollNeededPx: scrollNeeded,
    nominalText,
    displayHargaText,
    hargaOk,
    ctaPointsToBayar,
    stepsToPayment,
  };

  console.log('=== /beli/ regression check ===');
  console.log(`Load time: ${loadTime}ms (threshold ${LOAD_THRESHOLD_MS}ms)`);
  console.log(`QRIS visible: ${qrisVisible}`);
  console.log(`QRIS above fold: ${qrisAboveFold} (scroll needed ${scrollNeeded}px, max ${MAX_SCROLL_PX_TO_QRIS}px)`);
  console.log(`Harga nominal: "${nominalText}"`);
  console.log(`Harga display: "${displayHargaText}"`);
  console.log(`Harga OK: ${hargaOk}`);
  console.log(`CTA -> #bayar: ${ctaPointsToBayar}`);
  console.log(`Steps to payment: ${stepsToPayment} (max ${MAX_STEPS_TO_PAYMENT})`);

  let ok = true;
  if (loadTime > LOAD_THRESHOLD_MS) {
    console.error(`FAIL: Load time ${loadTime}ms > ${LOAD_THRESHOLD_MS}ms`);
    ok = false;
  }
  if (!qrisVisible) {
    console.error('FAIL: QRIS not visible');
    ok = false;
  }
  if (scrollNeeded > MAX_SCROLL_PX_TO_QRIS) {
    console.error(`FAIL: QRIS requires excessive scroll (${scrollNeeded}px)`);
    ok = false;
  }
  if (!hargaOk) {
    console.error('FAIL: Harga Rp 39.000 not visible in both places');
    ok = false;
  }
  if (stepsToPayment > MAX_STEPS_TO_PAYMENT) {
    console.error(`FAIL: Steps to payment ${stepsToPayment} > ${MAX_STEPS_TO_PAYMENT}`);
    ok = false;
  }

  await browser.close();
  if (ok) {
    console.log('PASS: All thresholds met');
    process.exit(0);
  } else {
    console.error('FAIL: Regression detected');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
