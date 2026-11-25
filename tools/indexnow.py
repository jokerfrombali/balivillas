"""Ping IndexNow (Bing & friends) about changed pages.

Usage:
    python tools/indexnow.py                # URLs from HTML files changed in the last commit
    python tools/indexnow.py URL [URL ...]  # explicit URLs

The key file <key>.txt sits in the site root and is deployed with the assets.
"""
import glob, json, os, subprocess, sys, urllib.request

HOST = 'balivillas.ai'
key_files = [f for f in glob.glob('*.txt') if len(os.path.basename(f)) == 36]
KEY = os.path.basename(key_files[0])[:-4] if key_files else None
assert KEY, 'IndexNow key file (<32-hex>.txt) not found in site root'

def changed_urls():
    out = subprocess.run(['git', 'diff', '--name-only', 'HEAD~1', 'HEAD'],
                         capture_output=True, text=True).stdout
    urls = []
    for f in out.splitlines():
        f = f.replace(chr(92), '/')
        if not f.endswith('.html') or f.startswith(('saved/', 'worker/')):
            continue
        u = 'https://' + HOST + '/' + f
        u = u.replace('/index.html', '/')
        urls.append(u)
    return urls

urls = sys.argv[1:] or changed_urls()
if not urls:
    print('nothing to submit'); sys.exit(0)

body = json.dumps({'host': HOST, 'key': KEY,
                   'keyLocation': 'https://' + HOST + '/' + KEY + '.txt',
                   'urlList': urls[:10000]}).encode()
req = urllib.request.Request('https://api.indexnow.org/indexnow', data=body,
                             headers={'Content-Type': 'application/json; charset=utf-8'})
with urllib.request.urlopen(req) as r:
    print('IndexNow:', r.status, len(urls), 'urls')
