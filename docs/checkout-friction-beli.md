# Friction Points – /beli/

## 1. CTA misbehavior
- **Element**: `<a class="tombol" href="#" id="ctaBayar">Bayar Rp 39.000 dengan QRIS</a>`
- **Issue**: Anchor with `href="#"` does not navigate or focus the QRIS section. Users may click expecting immediate payment prompt. The anchor only logs a tracking event.
- **Impact**: Mild confusion, 2‑step click (then scroll).
- **Fix**: Add `data-scroll-to="#qris"` and JS to smoothly scroll to the QRIS block or replace with `<button>` that triggers QRIS reveal.

## 2. QRIS image usability
- **Element**: `<a href="../static/img/qris-bayar.png?v=1" target="_blank" rel="noopener">` wrapping the QR image.
- **Issue**: The link and its visual cue are subtle; users may not realize they can open full‑size image. Hover effect is not obvious.
- **Impact**: Slight effort to see entire QR code.
- **Fix**: Add a visible overlay icon or text “Buka gambar QRIS”, style pointer.

## 3. Hidden survey banner
- **Element**: `#surveyBanner` is hidden by default and shows if sessionStorage missing. It can push content down.
- **Issue**: If shown, banner occupies vertical space above QRIS, forcing additional scroll.
- **Impact**: Minor extra scroll.
- **Fix**: Ensure banner is at bottom of page or collapsible.

## 4. Payment amount ambiguity
- **Observation**: The displayed price `Rp 39.000` is the base price; actual amount includes a 3‑digit unique identifier appended by JS.
- **Issue**: Users may not notice the appended digits if JavaScript fails, leading to payment mismatch.
- **Impact**: Potential failed transactions.
- **Fix**: Show the full amount (e.g., `Rp 39.001`) in static content or fallback.

## 5. Script dependencies
- **Observation**: Page relies on many external JS files; failure of any could hide QR code or functionality.
- **Impact**: Users on slow connections may not load scripts quickly, delaying QR code visibility.
- **Fix**: Bundle critical scripts, reduce bundle size or defer non‑essential assets.

## Prioritization
1. CTA misbehavior (debug user expectation).
2. Payment amount clarity (critical for success).
3. QRIS image usability.
4. Hidden banner positioning.
5. Script load optimization.

---

**Action plan**: Implement changes and run `tools/peraturan-mutu.py` to ensure tests pass before committing.
