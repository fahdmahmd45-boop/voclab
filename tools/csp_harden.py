from pathlib import Path
import re, json, urllib.request, hashlib, base64
from urllib.parse import urlparse

root = Path('.')
html_path = root/'index.html'
auth_path = root/'auth.js'
vercel_path = root/'vercel.json'
assets = root/'assets'
assets.mkdir(exist_ok=True)

html = html_path.read_text(encoding='utf-8')

# Move executable inline <script> blocks into same-origin files, preserving their original position/order.
pat = re.compile(r'<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>', re.I | re.S)
parts = []
last = 0
count = 0
for m in pat.finditer(html):
    attrs = m.group('attrs') or ''
    if re.search(r'\bsrc\s*=', attrs, re.I):
        continue
    typem = re.search(r'\btype\s*=\s*["\']([^"\']+)["\']', attrs, re.I)
    typ = (typem.group(1).lower().strip() if typem else '')
    if typ and typ not in ('text/javascript','application/javascript','module'):
        raise SystemExit(f'Unsupported inline script type left in HTML: {typ}')
    count += 1
    out = assets/f'inline-script-{count}.js'
    out.write_text(m.group('body').strip()+'\n', encoding='utf-8')
    new_attrs = attrs.strip()
    replacement = f'<script{(" "+new_attrs) if new_attrs else ""} src="/assets/inline-script-{count}.js"></script>'
    parts.append(html[last:m.start()])
    parts.append(replacement)
    last = m.end()
parts.append(html[last:])
if count:
    html = ''.join(parts)
    html_path.write_text(html, encoding='utf-8')

# Block javascript: URLs entirely.
if re.search(r'javascript\s*:', html, re.I):
    raise SystemExit('javascript: URL found; refusing strict CSP rollout')

# Pin Supabase JS CDN and add SRI.
auth = auth_path.read_text(encoding='utf-8')
version = '2.115.0'
cdn = f'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@{version}/dist/umd/supabase.min.js'
try:
    data = urllib.request.urlopen(cdn, timeout=30).read()
    sri = 'sha384-' + base64.b64encode(hashlib.sha384(data).digest()).decode()
except Exception as e:
    raise SystemExit(f'Could not compute Supabase SRI: {e}')
auth = re.sub(r"script\.src\s*=\s*'https://cdn\.jsdelivr\.net/npm/@supabase/supabase-js@[^']+/dist/umd/supabase\.min\.js';",
              f"script.src = '{cdn}';", auth)
if "script.integrity =" in auth:
    auth = re.sub(r"script\.integrity\s*=\s*'[^']+';", f"script.integrity = '{sri}';", auth)
else:
    auth = auth.replace("script.crossOrigin = 'anonymous';", "script.crossOrigin = 'anonymous';\n      script.integrity = '"+sri+"';")
auth_path.write_text(auth, encoding='utf-8')

# Build narrowly-scoped CSP around resources the app actually uses.
def origins(pattern, text):
    out=set()
    for u in re.findall(pattern, text, re.I):
        try:
            p=urlparse(u)
            if p.scheme in ('http','https') and p.netloc:
                out.add(f'{p.scheme}://{p.netloc}')
        except Exception:
            pass
    return out

script_origins = origins(r'<script[^>]+src=["\'](https://[^"\']+)', html)
script_origins.add('https://cdn.jsdelivr.net')
style_origins = origins(r'<link[^>]+href=["\'](https://[^"\']+)', html)
style_origins.add('https://fonts.googleapis.com')
img_origins = origins(r'<img[^>]+src=["\'](https://[^"\']+)', html)

supabase_http = 'https://hknecvleujjdyoqtwaar.supabase.co'
supabase_ws = 'wss://hknecvleujjdyoqtwaar.supabase.co'

def q(xs): return ' '.join(sorted(xs))
csp = '; '.join([
    "default-src 'self'",
    "script-src 'self' " + q(script_origins),
    "script-src-elem 'self' " + q(script_origins),
    "script-src-attr 'unsafe-inline'",
    "connect-src 'self' %s %s" % (supabase_http, supabase_ws),
    "img-src 'self' data: blob:" + ((' '+q(img_origins)) if img_origins else ''),
    "style-src 'self' 'unsafe-inline' " + q(style_origins),
    "font-src 'self' data: https://fonts.gstatic.com",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests"
])

cfg = json.loads(vercel_path.read_text(encoding='utf-8'))
for rule in cfg.get('headers', []):
    hs = rule.setdefault('headers', [])
    hs[:] = [h for h in hs if h.get('key','').lower() != 'content-security-policy']
    hs.append({'key':'Content-Security-Policy','value':csp})
vercel_path.write_text(json.dumps(cfg, indent=2)+'\n', encoding='utf-8')

# Static safety checks.
final_html = html_path.read_text(encoding='utf-8')
inline_exec = []
for m in pat.finditer(final_html):
    attrs = m.group('attrs') or ''
    if not re.search(r'\bsrc\s*=', attrs, re.I):
        inline_exec.append(m.group(0)[:80])
if inline_exec:
    raise SystemExit(f'{len(inline_exec)} inline executable script blocks remain')

for p in [auth_path, root/'api/ai.js', *sorted(assets.glob('inline-script-*.js'))]:
    s = p.read_text(encoding='utf-8')
    if re.search(r'\beval\s*\(', s) or re.search(r'\bFunction\s*\(', s):
        raise SystemExit(f'Dynamic code execution found in {p}')

print(f'Externalized {count} inline script block(s).')
print('Pinned Supabase JS', version, 'with SRI.')
print('CSP:', csp)
