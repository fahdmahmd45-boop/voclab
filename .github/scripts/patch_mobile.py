from pathlib import Path

path = Path('index.html')
s = path.read_text(encoding='utf-8')

if 'LIST_PAGE_MOBILE=40' in s:
    print('Mobile rendering fix already present.')
    raise SystemExit(0)

css_old = """  .prog b{font-size:16px}\n}\nbutton,.rchip,.kbtn,.delbtn,.spk,.iconbtn,.addbtn,.next,.opt,.tab{transition:transform .12s ease,filter .12s ease}"""
css_new = """  .prog b{font-size:16px}\n  /* Mobile performance: avoid animating/painting hundreds of rows at once. */\n  .row,.dcard,.myform{animation:none!important}\n  .row{content-visibility:auto;contain-intrinsic-size:86px}\n}\nbutton,.rchip,.kbtn,.delbtn,.spk,.iconbtn,.addbtn,.next,.opt,.tab{transition:transform .12s ease,filter .12s ease}"""
if css_old not in s:
    raise RuntimeError('Could not find mobile CSS insertion point')
s = s.replace(css_old, css_new, 1)

browse_start = s.find('/* ---------- Browse ---------- */')
flash_start = s.find('/* ---------- Flashcards', browse_start)
if browse_start < 0 or flash_start < 0:
    raise RuntimeError('Could not locate Browse section')

browse = r'''/* ---------- Browse ---------- */
// Large Oxford decks (especially A1/B1) used to render every row in one
// innerHTML operation. Mobile browsers can stall while parsing and laying out
// that much DOM. Render a small chunk first, then append more on demand.
const LIST_PAGE_MOBILE=40,LIST_PAGE_DESKTOP=120;
let listVisible=0;
function listPageSize(){return window.matchMedia&&window.matchMedia('(max-width: 540px)').matches?LIST_PAGE_MOBILE:LIST_PAGE_DESKTOP}
function wordRowHTML(w,i,base){
  const id=kid(w),isK=known.has(id);
  const num=base.indexOf(w)+1;
  return `<div class="row ${isK?'known':''}" style="animation-delay:${Math.min(i*12,180)}ms">
    <div class="rtop">
      <span class="idx" style="opacity:.5;font-size:12px;min-width:26px">#${num>0?num:i+1}</span>
      <button class="spk" onclick="speak('${esc(w[1])}')">${SPK}</button>
      <span class="w">${w[1]}</span>
      ${w[0]!=='MY'?`<span class="t" style="border:1px solid var(--amber,#D0AF7A);border-radius:8px;padding:1px 7px">${deckName(w[0])}</span>`:''}
      <span class="t">${TY[w[2]]||w[2]}</span>
      <span class="m">${w[3]}</span>
      <span class="u">${unitLabel(w[0])}</span>
      <button class="kbtn" onclick="toggleKnown('${esc(id)}')">${isK?'✓ Mastered':'Mark'}</button>
      ${w[0]==='MY'?`<button class="delbtn" onclick="delMy('${esc(w[1])}','${w[0]}')">✕</button>`:''}
    </div>
    ${w[4]?`<div class="ex"><button class="spk" onclick="speak('${esc(w[4])}')" title="Speak sentence">${SPK}</button> ${hiWord(w[4],w[1])}</div>`:``}
  </div>`;
}
function renderList(reset=true){
  const p=pool(),el=document.getElementById('p-list');
  if(!picked&&fSrc.value==='all'){listVisible=0;el.innerHTML=guardHTML();return}
  if(!p.length){listVisible=0;el.innerHTML=levelStatHTML()+'<div class="empty">No words match this filter.</div>';return}
  const step=listPageSize();
  if(reset||listVisible<1)listVisible=Math.min(step,p.length);
  else listVisible=Math.min(listVisible,p.length);
  const shown=p.slice(0,listVisible),base=numberingBase();
  const more=p.length-listVisible;
  el.innerHTML=levelStatHTML()+`<div id="wordRows">${shown.map((w,i)=>wordRowHTML(w,i,base)).join('')}</div>`+
    (more>0?`<button class="next" id="loadMoreWords" style="max-width:320px;margin:14px auto 0;display:block" onclick="loadMoreWords()">Load more · ${more} remaining</button>`:'');
}
function loadMoreWords(){
  const p=pool(),rows=document.getElementById('wordRows');
  if(!rows)return renderList(true);
  const from=listVisible,to=Math.min(from+listPageSize(),p.length);
  if(to<=from)return;
  const base=numberingBase();
  rows.insertAdjacentHTML('beforeend',p.slice(from,to).map((w,i)=>wordRowHTML(w,from+i,base)).join(''));
  listVisible=to;
  const btn=document.getElementById('loadMoreWords'),more=p.length-listVisible;
  if(btn){if(more>0)btn.textContent=`Load more · ${more} remaining`;else btn.remove()}
}
function toggleKnown(id){known.has(id)?known.delete(id):known.add(id);saveKnown();updProg();renderList(false)}

'''
s = s[:browse_start] + browse + s[flash_start:]

handlers_old = """fSrc.onchange=()=>{picked=true;rebuildUnits();refresh()};\nfUnit.onchange=()=>{picked=true;refresh()};fKnown.onchange=()=>{picked=true;refresh()};\nfSearch.oninput=()=>{picked=true;if(curTab==='list')renderList()};"""
handlers_new = """fSrc.onchange=()=>{picked=true;listVisible=0;rebuildUnits();refresh()};\nfUnit.onchange=()=>{picked=true;listVisible=0;refresh()};fKnown.onchange=()=>{picked=true;listVisible=0;refresh()};\nfSearch.oninput=()=>{picked=true;listVisible=0;if(curTab==='list')renderList(true)};"""
if handlers_old not in s:
    raise RuntimeError('Could not find filter handlers')
s = s.replace(handlers_old, handlers_new, 1)

pick_old = "function pickCat(id){\n  picked=true;"
pick_new = "function pickCat(id){\n  picked=true;listVisible=0;"
if pick_old not in s:
    raise RuntimeError('Could not find pickCat')
s = s.replace(pick_old, pick_new, 1)

path.write_text(s, encoding='utf-8')
print('Patched index.html successfully.')
