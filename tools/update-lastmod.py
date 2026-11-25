"""Rewrite <lastmod> in sitemap.xml / sitemap-growth.xml from git history.

A page's lastmod = date of the last commit touching its file; files with
uncommitted changes get today's date. Run before committing a deploy:
    python tools/update-lastmod.py
"""
import io, re, subprocess, datetime, os

TODAY = datetime.date.today().isoformat()

def dirty_files():
    out = subprocess.run(['git', 'status', '--porcelain'], capture_output=True, text=True).stdout
    return {line[3:].strip().strip('"') for line in out.splitlines()}

DIRTY = dirty_files()

def path_for(url):
    p = url.replace('https://balivillas.ai/', '')
    if p == '' or p.endswith('/'):
        p += 'index.html'
    return p

def git_date(path):
    if path in DIRTY:
        return TODAY
    out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', path],
                         capture_output=True, text=True).stdout.strip()
    return out or TODAY

for sm in ('sitemap.xml', 'sitemap-growth.xml'):
    if not os.path.exists(sm):
        continue
    s = io.open(sm, encoding='utf-8', newline='').read()
    def fix(m):
        url, lastmod = m.group(1), m.group(2)
        p = path_for(url)
        d = git_date(p) if os.path.exists(p) else lastmod
        return m.group(0).replace('<lastmod>' + lastmod, '<lastmod>' + d)
    s2 = re.sub(r'<loc>([^<]+)</loc>\s*<lastmod>([^<]+)</lastmod>',
                lambda m: fix(m), s)
    if s2 != s:
        io.open(sm, 'w', encoding='utf-8', newline='').write(s2)
        print(sm, 'updated')
    else:
        print(sm, 'unchanged')
