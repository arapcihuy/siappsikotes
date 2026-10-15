#!/usr/bin/env node
/**
 * scripts/baseline-beli.mjs
 * Playwright baseline measurement harness for https://siappsikotes.my.id/beli/
 * Measures load time, paint timing, network requests and render-blocking resources.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const targetUrl = process.argv[2] || process.env.BASELINE_URL || 'https://siappsikotes.my.id/beli/';
const outPath = resolve(repoRoot, 'docs', 'baseline-beli.metrics.json');

const fmtMs = n => (Number.isFinite(n) ? Math.round(n) : null);

async function main() {
  mkdirSync(resolve(repoRoot, 'docs'), { recursive: true });

  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const start = Date.now();
  await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 });
  const wallLoadMs = Date.now() - start;

  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paints = performance.getEntriesByType('paint');
    const firstPaint = paints.find(p => p.name === 'first-paint');
    const fcp = paints.find(p => p.name === 'first-contentful-paint');
    const resources = performance.getEntriesByType('resource').map(r => ({
      url: r.name,
      initiatorType: r.initiatorType,
      transferSize: r.transferSize || 0,
      duration: r.duration,
    }));
    return {
      navigation: nav ? {
        duration: nav.duration,
        fetchStart: nav.fetchStart,
        loadEventEnd: nav.loadEventEnd,
        domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
        transferSize: nav.transferSize || 0,
      } : null,
      paint: {
        firstPaint: firstPaint ? firstPaint.startTime : null,
        firstContentfulPaint: fcp ? fcp.startTime : null,
      },
      resources,
      renderBlocking: Array.from(document.querySelectorAll('head script[src], head link[rel="stylesheet"]')).length,
    };
  });

  const resources = perf.resources || [];
  let imagesBytes = 0, jsBytes = 0, cssBytes = 0;
  const networkList = [];
  for (const r of resources) {
    const url = r.url || '';
    const size = r.transferSize || 0;
    const ext = url.split('?')[0].split('#')[0].toLowerCase();
    let type = 'other';
    if (/\.(png|jpe?g|webp|avif|gif|svg)$/i.test(ext)) type = 'image';
    else if (/\.(js|mjs)$/i.test(ext)) type = 'script';
    else if (/\.(css)$/i.test(ext)) type = 'stylesheet';
    if (type === 'image') imagesBytes += size;
    else if (type === 'script') jsBytes += size;
    else if (type === 'stylesheet') cssBytes += size;
    networkList.push({
      url,
      resourceType: type,
      bytes: size,
    });
  }
  const totalTransferBytes = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);

  const metrics = {
    timestamp: new Date().toISOString(),
    target: targetUrl,
    wall_load_ms: fmtMs(wallLoadMs),
    navigation_timing: {
      duration_ms: fmtMs(perf.navigation?.duration),
      load_event_end_ms: fmtMs(perf.navigation?.loadEventEnd),
      dom_content_loaded_ms: fmtMs(perf.navigation?.domContentLoadedEventEnd),
    },
    paint_timing: {
      first_paint_ms: fmtMs(perf.paint.firstPaint),
      first_contentful_paint_ms: fmtMs(perf.paint.firstContentfulPaint),
    },
    network: {
      total_requests: resources.length,
      total_transfer_bytes: totalTransferBytes,
      images_bytes: imagesBytes,
      js_bytes: jsBytes,
      css_bytes: cssBytes,
      render_blocking_count: perf.renderBlocking,
      requests: networkList,
    },
  };

  writeFileSync(outPath, JSON.stringify(metrics, null, 2), 'utf8');

  console.log('Baseline metrics for /beli/');
  console.log(`Target: ${targetUrl}`);
  console.log(`Wall load: ${metrics.wall_load_ms} ms`);
  console.log(`Navigation duration: ${metrics.navigation_timing.duration_ms} ms`);
  console.log(`First Paint: ${metrics.paint_timing.first_paint_ms} ms`);
  console.log(`First Contentful Paint: ${metrics.paint_timing.first_contentful_paint_ms} ms`);
  console.log(`Network requests: ${metrics.network.total_requests}`);
  console.log(`Total transfer: ${metrics.network.total_transfer_bytes} bytes`);
  console.log(`  images: ${metrics.network.images_bytes} bytes`);
  console.log(`  js: ${metrics.network.js_bytes} bytes`);
  console.log(`  css: ${metrics.network.css_bytes} bytes`);
  console.log(`Render-blocking in <head>: ${metrics.network.render_blocking_count}`);
  console.log(`Metrics written to: ${outPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('Baseline failed:', err);
  process.exit(1);
});
