from pathlib import Path

p = Path('api/ai.js')
s = p.read_text()
old = """    quotaResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/consume_voclab_ai_quota`, {\n      method: 'POST',\n      headers: commonHeaders,\n      body: '{}'\n    });"""
new = """    quotaResponse = await fetch(`${SUPABASE_URL}/functions/v1/consume-ai-quota`, {\n      method: 'POST',\n      headers: commonHeaders,\n      body: '{}'\n    });"""
if old not in s:
    raise SystemExit('quota RPC block not found')
s = s.replace(old, new, 1)
p.write_text(s)

vp = Path('vercel.json')
v = vp.read_text()
needle = '        { "key": "Strict-Transport-Security", "value": "max-age=31536000" }'
replacement = '        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },\n        { "key": "Content-Security-Policy", "value": "default-src \'self\'; script-src \'self\' https://cdn.jsdelivr.net; connect-src \'self\' https://hknecvleujjdyoqtwaar.supabase.co; img-src \'self\' data: blob:; style-src \'self\' \'unsafe-inline\'; font-src \'self\' data:; object-src \'none\'; base-uri \'self\'; frame-ancestors \'none\'; form-action \'self\'; upgrade-insecure-requests" }'
if needle not in v:
    raise SystemExit('HSTS header not found')
v = v.replace(needle, replacement, 1)
vp.write_text(v)
