#!/usr/bin/env python3
"""
Regression check for /beli/ page performance.
Run: python3 tools/check-beli-perf.py
Exits non-zero if performance thresholds exceeded.
"""
import asyncio
import sys
from pathlib import Path

THRESHOLDS = {
    'load_time_sec': 2.0,      # must load under 2s
    'total_kb': 150,           # total transfer under 150 KB
    'qr_visible': True,        # QRIS must be visible without scroll
}

async def check():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Playwright not installed. Run: pip install playwright && playwright install chromium")
        return 1

    html_path = Path(__file__).parent.parent / 'beli' / 'index.html'
    if not html_path.exists():
        print(f"ERROR: {html_path} not found")
        return 1

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        resources = []
        async def on_response(r):
            body = await r.body()
            resources.append({
                'url': r.url,
                'status': r.status,
                'size': len(body) if r.status == 200 else 0,
                'type': r.request.resource_type
            })
        page.on('response', on_response)
        
        start = asyncio.get_event_loop().time()
        await page.goto(f'file://{html_path.absolute()}', wait_until='networkidle')
        load_time = asyncio.get_event_loop().time() - start
        
        qris = await page.locator('#qris').is_visible()
        nominal = await page.locator('#beliNominal').text_content()
        
        total_kb = sum(r['size'] for r in resources) / 1024
        
        # Check for forbidden resources
        forbidden = [r for r in resources if 'challenges.cloudflare.com' in r['url'] or 'turnstile' in r['url'].lower()]
        
        await browser.close()
        
        print(f"=== /beli/ Performance Check ===")
        print(f"Load time:     {load_time:.2f}s  (threshold: {THRESHOLDS['load_time_sec']}s)")
        print(f"Total transfer: {total_kb:.1f} KB  (threshold: {THRESHOLDS['total_kb']} KB)")
        print(f"QRIS visible:  {qris}  (required: True)")
        print(f"Nominal shown: {nominal}")
        print(f"Forbidden requests: {len(forbidden)}  (must be 0)")
        
        if forbidden:
            for r in forbidden:
                print(f"  BLOCKED: {r['url']}")
        
        ok = True
        if load_time > THRESHOLDS['load_time_sec']:
            print(f"FAIL: Load time {load_time:.2f}s exceeds {THRESHOLDS['load_time_sec']}s")
            ok = False
        if total_kb > THRESHOLDS['total_kb']:
            print(f"FAIL: Transfer {total_kb:.1f} KB exceeds {THRESHOLDS['total_kb']} KB")
            ok = False
        if not qris:
            print("FAIL: QRIS not visible")
            ok = False
        if forbidden:
            print("FAIL: Forbidden Cloudflare/Turnstile requests detected")
            ok = False
        
        if ok:
            print("PASS: All thresholds met")
            return 0
        else:
            return 1

if __name__ == '__main__':
    sys.exit(asyncio.run(check()))