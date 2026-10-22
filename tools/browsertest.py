import sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
web, shot = sys.argv[1], sys.argv[2]
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=web)
H.extensions_map = {'.wasm': 'application/octet-stream'}  # szándékosan rossz MIME, mint egy régi tárhelyen
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 8765), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1280, 'height': 1500})
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:8765/' + (sys.argv[3] if len(sys.argv) > 3 else 'proba/index.html'))
    pg.wait_for_function("document.getElementById('status').textContent.indexOf('swetest')>=0 || /warn|bad/.test(document.getElementById('status').className)", timeout=20000)
    print('STATUS:', pg.inner_text('#status'))
    print('VER:', pg.inner_text('#ver'))
    print(pg.inner_text('#info'))
    pg.screenshot(path=shot, full_page=True)
    print('(api/szamol.php nélkül a képlet-elemzés helyén figyelmeztetés várható)')
    # 1981 DST-próba: Budapest nyári idő
    pg.select_option('#hsys', 'P')
    pg.fill('#ev', '1981'); pg.fill('#ho', '4'); pg.fill('#nap', '18'); pg.fill('#ora', '21'); pg.fill('#perc', '47')
    pg.click('button[type=submit]')
    pg.wait_for_timeout(500)
    print('DST:', [l for l in pg.inner_text('#info').split('\n') if 'UTC' in l])
    print('ERRORS:', errs)
    b.close()
srv.shutdown()
