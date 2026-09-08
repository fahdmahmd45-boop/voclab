from pathlib import Path

p = Path('index.html')
s = p.read_text()

def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'missing block: {label}')
    s = s.replace(old, new, 1)

replace_once(
    "try{arr=JSON.parse(t)}catch(e){try{arr=Function('return '+t)()}catch(e2){arr=null}}",
    "try{arr=JSON.parse(t)}catch(e){arr=null}",
    'dynamic Function fallback'
)

replace_once(
    "function aiErrorMessage(e){\n  if(e&&e.code==='OPENAI_API_KEY_MISSING')return 'AI is ready in the site, but the server still needs the OpenAI API key.';\n  return (e&&e.error)||'Could not generate vocabulary. Try again.';\n}",
    "function aiErrorMessage(e){\n  if(e&&e.code==='OPENAI_API_KEY_MISSING')return 'AI is ready in the site, but the server still needs the OpenAI API key.';\n  if(e&&(e.code==='AUTH_REQUIRED'||e.code==='AUTH_INVALID'))return 'Sign in to use AI.';\n  return (e&&e.error)||'Could not generate vocabulary. Try again.';\n}",
    'AI auth message'
)

replace_once(
    "function esc(s){return s.replace(/'/g,\"\\\\'\")}\n",
    "function htmlText(s){return String(s??'').replace(/[&<>\\\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;',\"'\":'&#39;'}[ch]))}\nfunction esc(s){return String(s??'').replace(/\\\\/g,'\\\\\\\\').replace(/'/g,\"\\\\'\").replace(/\\r/g,'\\\\r').replace(/\\n/g,'\\\\n').replace(/</g,'\\\\x3C').replace(/>/g,'\\\\x3E').replace(/&/g,'\\\\x26').replace(/\\\"/g,'&quot;')}\n",
    'safe escaping helpers'
)

old_hi = """function hiWord(ex,word){ // bold the word inside the example
  const base=word.replace(/^\\(in\\)\\s*/,'');
  const re=new RegExp('\\\\b('+base.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'\\\\w*)','i');
  return re.test(ex)?ex.replace(re,'<b>$1</b>'):ex;
}
function blankWord(ex,word){ // hide the word in the example
  const base=word.replace(/^\\(in\\)\\s*/,'');
  const re=new RegExp('\\\\b('+base.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'\\\\w*)','i');
  return re.test(ex)?ex.replace(re,'<b>______</b>'):ex;
}
"""
new_hi = """function hiWord(ex,word){ // bold the word inside the example, while escaping untrusted text
  ex=String(ex??'');word=String(word??'');
  const base=word.replace(/^\\(in\\)\\s*/,'');
  const re=new RegExp('\\\\b('+base.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'\\\\w*)','i');
  const m=ex.match(re);
  if(!m)return htmlText(ex);
  const i=m.index||0;
  return htmlText(ex.slice(0,i))+'<b>'+htmlText(m[0])+'</b>'+htmlText(ex.slice(i+m[0].length));
}
function blankWord(ex,word){ // hide the word in the example, while escaping untrusted text
  ex=String(ex??'');word=String(word??'');
  const base=word.replace(/^\\(in\\)\\s*/,'');
  const re=new RegExp('\\\\b('+base.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')+'\\\\w*)','i');
  const m=ex.match(re);
  if(!m)return htmlText(ex);
  const i=m.index||0;
  return htmlText(ex.slice(0,i))+'<b>______</b>'+htmlText(ex.slice(i+m[0].length));
}
"""
replace_once(old_hi, new_hi, 'safe example rendering')

replacements = [
    ('<span class="w">${w[1]}</span>', '<span class="w">${htmlText(w[1])}</span>'),
    ('${w[0]!==\'MY\'?`<span class="t" style="border:1px solid var(--amber,#D0AF7A);border-radius:8px;padding:1px 7px">${deckName(w[0])}</span>`:\'\'}', '${w[0]!==\'MY\'?`<span class="t" style="border:1px solid var(--amber,#D0AF7A);border-radius:8px;padding:1px 7px">${htmlText(deckName(w[0]))}</span>`:\'\'}'),
    ('<span class="t">${TY[w[2]]||w[2]}</span>', '<span class="t">${htmlText(TY[w[2]]||w[2])}</span>'),
    ('<span class="m">${w[3]}</span>', '<span class="m">${htmlText(w[3])}</span>'),
    ('<span class="u">${unitLabel(w[0])}</span>', '<span class="u">${htmlText(unitLabel(w[0]))}</span>'),
    ('<div class="word">${w[1]}</div>', '<div class="word">${htmlText(w[1])}</div>'),
    ('<div class="type">${TY[w[2]]||w[2]} · ${unitLabel(w[0])}</div>', '<div class="type">${htmlText(TY[w[2]]||w[2])} · ${htmlText(unitLabel(w[0]))}</div>'),
    ('<div class="type">${w[1]}</div>', '<div class="type">${htmlText(w[1])}</div>'),
    ('<div class="ans">${w[3]}</div>', '<div class="ans">${htmlText(w[3])}</div>'),
    ('<div class="word">${w[1]} <button class="spk"', '<div class="word">${htmlText(w[1])} <button class="spk"'),
    ('<div class="type">${TY[w[2]]||w[2]}</div>', '<div class="type">${htmlText(TY[w[2]]||w[2])}</div>'),
    ('${opts.map(o=>`<button class="opt" data-r="${o[3]===w[3]?1:0}" onclick="pickOpt(this)">${o[3]}</button>`).join(\'\')}', '${opts.map(o=>`<button class="opt" data-r="${o[3]===w[3]?1:0}" onclick="pickOpt(this)">${htmlText(o[3])}</button>`).join(\'\')}'),
    ('<div class="m">${w[3]}</div>', '<div class="m">${htmlText(w[3])}</div>'),
    ('<div class="type">${TY[w[2]]||w[2]} · type the English word</div>', '<div class="type">${htmlText(TY[w[2]]||w[2])} · type the English word</div>'),
    ("feed.innerHTML='✗ Correct answer: <span style=\"font-family:var(--en)\">'+w[1]+'</span>';", "feed.innerHTML='✗ Correct answer: <span style=\"font-family:var(--en)\">'+htmlText(w[1])+'</span>';"),
    ('<span class="lvl ${c.cls}">${c.badge}</span><div class="ht">${c.t}</div><div class="hsub">${c.sub}</div>', '<span class="lvl ${c.cls}">${htmlText(c.badge)}</span><div class="ht">${htmlText(c.t)}</div><div class="hsub">${htmlText(c.sub)}</div>'),
    ('<span style="font-weight:700">${filterLabel()}</span>', '<span style="font-weight:700">${htmlText(filterLabel())}</span>'),
]

for i, (old, new) in enumerate(replacements, 1):
    if old not in s:
        raise SystemExit(f'missing rendering replacement {i}: {old[:100]}')
    s = s.replace(old, new)

if "Function('return '+t)" in s:
    raise SystemExit('unsafe Function fallback remains')

p.write_text(s)
