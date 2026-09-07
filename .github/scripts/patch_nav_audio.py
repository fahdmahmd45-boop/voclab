from pathlib import Path
import re

path = Path('index.html')
s = path.read_text(encoding='utf-8')

MARKER = 'VOC_NAV_AUDIO_FIX_V1'
if MARKER in s:
    print('Navigation/audio fix already present.')
    raise SystemExit(0)

# 1) Home icon + global Exit button styling.
css_anchor = ".tab.on{background:var(--amber);color:var(--onacc);font-weight:600}\n"
css_extra = """.tab.on{background:var(--amber);color:var(--onacc);font-weight:600}\n.home-tab{display:flex;align-items:center;justify-content:center;gap:6px}\n.home-tab svg{flex:none}\n#btnExit{border-color:color-mix(in srgb,var(--bad) 42%,var(--line))}\n#btnExit:hover{border-color:var(--bad)}\n@media(max-width:540px){#btnExit{padding:8px 9px}#btnExit .exit-label{display:none}}\n"""
if css_anchor not in s:
    raise RuntimeError('Could not find tab CSS anchor')
s = s.replace(css_anchor, css_extra, 1)

# 2) Add sticky-header Exit button. Hidden on the level-selection Home screen.
hbtn_anchor = '<div class="hbtns">'
exit_html = '''<div class="hbtns"><button class="iconbtn" id="btnExit" title="Exit to level selection" aria-label="Exit to level selection" style="display:none"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg><span class="exit-label">Exit</span></button>'''
if hbtn_anchor not in s:
    raise RuntimeError('Could not find header buttons')
s = s.replace(hbtn_anchor, exit_html, 1)

# 3) Add a house icon beside Home.
home_old = '<button class="tab on" data-p="home">Home</button>'
home_new = '<button class="tab on home-tab" data-p="home" title="Level selection"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg><span>Home</span></button>'
if home_old not in s:
    raise RuntimeError('Could not find Home tab')
s = s.replace(home_old, home_new, 1)

# 4) Make Web Audio reliable after iOS/Android suspends the AudioContext.
ac_old = "function _ac(){if(!_actx){try{_actx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return null}}if(_actx&&_actx.state==='suspended')_actx.resume();return _actx}"
ac_new = """function _ac(){if(!_actx){try{_actx=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return null}}return _actx}\nfunction _withAudio(fn){\n  const ctx=_ac();if(!ctx)return;\n  if(ctx.state==='suspended'){\n    try{const p=ctx.resume();if(p&&typeof p.then==='function')p.then(()=>fn()).catch(()=>{});else fn()}catch(e){}\n  }else fn();\n}\nfunction unlockSfx(){_withAudio(()=>{})}\ndocument.addEventListener('pointerdown',unlockSfx,{once:true,capture:true});\ndocument.addEventListener('touchstart',unlockSfx,{once:true,capture:true,passive:true});"""
if ac_old not in s:
    raise RuntimeError('Could not find AudioContext helper')
s = s.replace(ac_old, ac_new, 1)

sfx_old = """function sfxFlip(){_note(700,0,.10,.10);_note(1050,.045,.11,.09)}\nfunction sfxCorrect(){_note(523.25,0,.14,.16);_note(659.25,.09,.16,.16);_note(783.99,.18,.30,.17)} // C-E-G major chime\nfunction sfxWrong(){_thud(300,0,.22,.16);_thud(220,.10,.28,.13)}\nfunction sfxClick(){_note(880,0,.06,.09)}"""
sfx_new = """function sfxFlip(){_withAudio(()=>{_note(700,0,.10,.10);_note(1050,.045,.11,.09)})}\nfunction sfxCorrect(){_withAudio(()=>{_note(523.25,0,.14,.19);_note(659.25,.09,.16,.19);_note(783.99,.18,.30,.20)})} // C-E-G major chime\nfunction sfxWrong(){_withAudio(()=>{_thud(300,0,.22,.16);_thud(220,.10,.28,.13)})}\nfunction sfxClick(){_withAudio(()=>{_note(880,0,.06,.09)})}"""
if sfx_old not in s:
    raise RuntimeError('Could not find sound effect functions')
s = s.replace(sfx_old, sfx_new, 1)

# 5) Show Exit on every non-Home tab and wire it back to the level-selection Home.
tabs_old = """/* ---------- tabs & init ---------- */\nlet curTab='home';\ndocument.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{\n  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));\n  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('on'));\n  t.classList.add('on');curTab=t.dataset.p;\n  document.getElementById('p-'+curTab).classList.add('on');\n  refresh();\n});"""
tabs_new = """/* ---------- tabs & init ---------- */\nlet curTab='home';\nconst btnExit=document.getElementById('btnExit');\ndocument.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{\n  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));\n  document.querySelectorAll('.panel').forEach(x=>x.classList.remove('on'));\n  t.classList.add('on');curTab=t.dataset.p;\n  document.getElementById('p-'+curTab).classList.add('on');\n  if(btnExit)btnExit.style.display=curTab==='home'?'none':'inline-flex';\n  refresh();\n});\nif(btnExit)btnExit.onclick=goHome;"""
if tabs_old not in s:
    raise RuntimeError('Could not find tabs init block')
s = s.replace(tabs_old, tabs_new, 1)

go_old = 'function goTab(p){document.querySelector(`.tab[data-p="${p}"]`).click()}'
go_new = '''// VOC_NAV_AUDIO_FIX_V1\nfunction goHome(){\n  picked=false;listVisible=0;\n  try{closeDrawer()}catch(e){}\n  const home=document.querySelector('.tab[data-p="home"]');\n  if(home)home.click();\n  try{window.scrollTo({top:0,behavior:'smooth'})}catch(e){window.scrollTo(0,0)}\n}\nfunction goTab(p){document.querySelector(`.tab[data-p="${p}"]`).click()}'''
if go_old not in s:
    raise RuntimeError('Could not find goTab')
s = s.replace(go_old, go_new, 1)

path.write_text(s, encoding='utf-8')
print('Patched navigation and mobile audio successfully.')
