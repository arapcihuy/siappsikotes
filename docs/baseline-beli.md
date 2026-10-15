# Baseline /beli/ — Consolidated Report

**Run date:** 2026-10-15
**Target:** https://siappsikotes.my.id/beli/
**Viewport:** 1280x800
**Run count:** 3
**Source metrics:** docs/baseline-beli.metrics.json
**Funnel map:** docs/baseline-beli-funnel.md

## Summary — hard numbers

| Metric | Value |
|---|---|
| Wall load time | 982 – 1 375 ms |
| Navigation total load | 125.7 – 317.8 ms |
| First Contentful Paint | 284 – 388 ms |
| Total requests | 14 |
| Total transfer | 27 879 bytes |
| Render-blocking requests | 0 |
| Run variance | ~33% wall-load spread from network jitter; deterministic request count / transfer |

*Notes:* 3 metric runs (2 fresh + prior). Zero render-blocking. Deterministic 14 requests / 27 879 bytes across all runs.

### Screenshots
Key captures are stored under `docs/baseline-beli-screens/`:
- `20261015-130334-01-first-paint.png` — first paint
- `20261015-130335-02-loading-state.png` — loading state
- `20261015-130336-03-final-qris-rp39000.png` — final QRIS + Rp 39.000
- `20261015-130239-02-loading-state.png`
- `20261015-130240-03-final-qris-rp39000.png`

## QRIS funnel

Mapped from /beli/ landing to QRIS code visible.

| Step | Action | Clicks | Scrolls |
|---|---|---|---|
| 1 | Landing page load, above-fold | 0 | 0 |
| 2 | Scroll to QRIS | 0 | ~3 × 300px |

**Total user steps:** 2  
**Clicks to QRIS:** 0  
**Scroll gestures:** 3

**Terminal selectors**
- QRIS code: `.qris-kotak img`
- Base amount selector: `#displayHarga` → Rp 39.000
- Amount at terminal step: `#beliNominal2` → Rp 39.305
- Base amount visible with QRIS: false

**Dead ends / observations**
- CTA scroll broken (`href=#bayar` does not scroll on live)
- CTA amount mismatch (live shows static Rp 39.000, not unique suffix)

## Baseline

This section defines the exact baseline for future comparison. Do not change these numbers without a new capture.

- Wall load: 982 – 1 375 ms
- FCP: 284 – 388 ms
- Requests: 14
- Transfer: 27 879 bytes
- Render-blocking: 0
- Funnel steps: 2 steps, 0 clicks, ~3 scrolls
- QRIS selector: `.qris-kotak img`
- Amount selector terminal: `#beliNominal2` (Rp 39.305)

Any improvement must move wall load below the lower bound, keep render-blocking at 0, and make base amount Rp 39.000 visible in same viewport as QRIS.
