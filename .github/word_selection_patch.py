from pathlib import Path
import re

path = Path('index.html')
s = path.read_text(encoding='utf-8')

css_marker = ".row.known .kbtn{background:var(--ok);color:#fff;border-color:var(--ok);font-weight:600}\n"
css_add = r'''
.selhead{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 12px}
.selhead>span{font-size:12px;color:var(--mut)}
.selbar{position:sticky;top:76px;z-index:22;background:color-mix(in srgb,var(--hd) 94%,transparent);backdrop-filter:blur(10px);border:1px solid color-mix(in srgb,var(--amber) 38%,var(--line));border-radius:13px;padding:10px 12px;margin:0 0 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;box-shadow:var(--shadow)}
.selcount{font-size:13px;font-weight:600;white-space:nowrap}
.selactions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.selactions select{padding:7px 9px;font-size:12px;min-width:150px}
.selcheck{width:22px;height:22px;display:inline-grid;place-items:center;flex:none;cursor:pointer}
.selcheck input{appearance:none;-webkit-appearance:none;width:18px;height:18px;margin:0;border:1px solid var(--line);border-radius:5px;background:var(--card2);display:grid;place-items:center;cursor:pointer}
.selcheck input:checked{background:var(--amber);border-color:var(--amber)}
.selcheck input:checked:after{content:'✓';color:var(--onacc);font-size:12px;font-weight:800;line-height:1}
.row.selected{border-color:var(--amber);background:color-mix(in srgb,var(--amber) 7%,var(--card))}
@media(max-width:540px){.selbar{top:68px;align-items:stretch}.selactions{width:100%}.selactions select{flex:1;min-width:120px}.selactions .kbtn,.selactions .delbtn{padding:7px 9px}}
'''.lstrip()
if '.selbar{' not in s:
    if css_marker not in s:
        raise SystemExit('CSS marker not found')
    s = s.replace(css_marker, css_marker + css_add, 1)

browse_marker = "const LIST_PAGE_MOBILE=40,LIST_PAGE_DESKTOP=120;\nlet listVisible=0;\n"
helpers = r'''const LIST_PAGE_MOBILE=40,LIST_PAGE_DESKTOP=120;
let listVisible=0;
let selectMode=false,selectedWords=new Set();
function isManagedWord(w){return !!(w&&w[0]&&(w[0]==='MY'||String(w[0])[0]==='C'))}
function selectionKey(w){return String(w[0])+'\u001f'+String(w[1]||'').toLowerCase()}
function selHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function selectionDeckOptions(){
  return `<option value="">Move to…</option><option value="MY">Added Words</option>${myDecks.map(d=>`<option value="${d.id}">${selHtml(d.t)}</option>`).join('')}<option value="__new">＋ New deck…</option>`;
}
function selectionToolbarHTML(p){
  const manageable=p.filter(isManagedWord).length;
  if(!manageable)return'';
  if(!selectMode)return `<div class="selhead"><button class="iconbtn" onclick="toggleSelectMode()">☑ Select words</button><span>Delete words or move them to another deck</span></div>`;
  return `<div class="selbar">
    <div class="selcount">${selectedWords.size} selected</div>
    <div class="selactions">
      <button class="kbtn" onclick="selectAllVisible()">Select all</button>
      ${selectedWords.size?`<button class="kbtn" onclick="clearSelectedWords()">Clear</button>`:''}
      <select id="selMoveDeck" aria-label="Move selected words">${selectionDeckOptions()}</select>
      <button class="kbtn" ${selectedWords.size?'':'disabled'} onclick="moveSelectedWords()">Move</button>
      <button class="delbtn" ${selectedWords.size?'':'disabled'} onclick="deleteSelectedWords()">Delete</button>
      <button class="kbtn" onclick="toggleSelectMode(false)">Done</button>
    </div>
  </div>`;
}
function toggleSelectMode(force){
  selectMode=typeof force==='boolean'?force:!selectMode;
  selectedWords.clear();renderList(true);
}
function toggleWordSelect(key,checked){
  checked?selectedWords.add(key):selectedWords.delete(key);renderList(false);
}
function selectAllVisible(){
  pool().filter(isManagedWord).forEach(w=>selectedWords.add(selectionKey(w)));renderList(false);
}
function clearSelectedWords(){selectedWords.clear();renderList(false)}
function deleteSelectedWords(){
  const chosen=myWords.filter(w=>selectedWords.has(selectionKey(w)));
  if(!chosen.length)return;
  if(!confirm(`Delete ${chosen.length} selected word${chosen.length===1?'':'s'}? This cannot be undone.`))return;
  chosen.forEach(w=>known.delete(kid(w)));
  myWords=myWords.filter(w=>!selectedWords.has(selectionKey(w)));
  selectedWords.clear();selectMode=false;
  saveMy();saveKnown();rebuildUnits();updProg();renderList(true);
}
function moveSelectedWords(){
  const sel=document.getElementById('selMoveDeck');let target=sel&&sel.value;
  if(!target){if(sel)sel.focus();return}
  if(target==='__new'){
    const raw=prompt('New deck name:');if(!raw||!raw.trim())return;
    const name=raw.trim();
    const existing=myDecks.find(d=>d.t.toLowerCase()===name.toLowerCase());
    if(existing)target=existing.id;
    else{
      const badge=name.replace(/[^A-Za-z\u0600-\u06FF0-9]/g,'').slice(0,2).toUpperCase()||'CD';
      target='C'+Date.now();myDecks.push({id:target,t:name,badge});saveDecks();
    }
  }
  const chosen=myWords.filter(w=>selectedWords.has(selectionKey(w)));
  if(!chosen.length)return;
  let moved=0,merged=0;
  for(const w of chosen){
    if(w[0]===target)continue;
    const oldId=kid(w),wasKnown=known.has(oldId);
    const duplicate=myWords.find(x=>x!==w&&x[0]===target&&String(x[1]).toLowerCase()===String(w[1]).toLowerCase());
    known.delete(oldId);
    if(duplicate){
      if(wasKnown)known.add(kid(duplicate));
      myWords=myWords.filter(x=>x!==w);merged++;
    }else{
      w[0]=target;if(wasKnown)known.add(kid(w));moved++;
    }
  }
  selectedWords.clear();selectMode=false;
  saveMy();saveKnown();rebuildUnits();updProg();renderList(true);
  if(!moved&&merged)alert('The selected words already existed in that deck, so duplicates were merged.');
}
'''
if 'let selectMode=false,selectedWords=new Set();' not in s:
    if browse_marker not in s:
        raise SystemExit('Browse marker not found')
    s = s.replace(browse_marker, helpers, 1)

new_word_row = r'''function wordRowHTML(w,i,base){
  const id=kid(w),isK=known.has(id),managed=isManagedWord(w),sk=selectionKey(w),isSel=selectedWords.has(sk);
  const num=base.indexOf(w)+1;
  return `<div class="row ${isK?'known':''}${selectMode&&isSel?' selected':''}" style="animation-delay:${Math.min(i*12,180)}ms">
    <div class="rtop">
      ${selectMode&&managed?`<label class="selcheck" title="Select word"><input type="checkbox" ${isSel?'checked':''} onclick="event.stopPropagation()" onchange="toggleWordSelect('${esc(sk)}',this.checked)"></label>`:''}
      <span class="idx" style="opacity:.5;font-size:12px;min-width:26px">#${num>0?num:i+1}</span>
      <button class="spk" onclick="speak('${esc(w[1])}')">${SPK}</button>
      <span class="w">${w[1]}</span>
      ${w[0]!=='MY'?`<span class="t" style="border:1px solid var(--amber,#D0AF7A);border-radius:8px;padding:1px 7px">${deckName(w[0])}</span>`:''}
      <span class="t">${TY[w[2]]||w[2]}</span>
      <span class="m">${w[3]}</span>
      <span class="u">${unitLabel(w[0])}</span>
      <button class="kbtn" onclick="toggleKnown('${esc(id)}')">${isK?'✓ Mastered':'Mark'}</button>
      ${managed&&!selectMode?`<button class="delbtn" onclick="delMy('${esc(w[1])}','${w[0]}')">✕</button>`:''}
    </div>
    ${w[4]?`<div class="ex"><button class="spk" onclick="speak('${esc(w[4])}')" title="Speak sentence">${SPK}</button> ${hiWord(w[4],w[1])}</div>`:``}
  </div>`;
}'''
s, n = re.subn(r"function wordRowHTML\(w,i,base\)\{.*?\n\}\nfunction renderList", new_word_row + "\nfunction renderList", s, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'wordRowHTML replacement count={n}')

new_render = r'''function renderList(reset=true){
  const p=pool(),el=document.getElementById('p-list');
  if(!picked&&fSrc.value==='all'){listVisible=0;selectMode=false;selectedWords.clear();el.innerHTML=guardHTML();return}
  if(!p.length){listVisible=0;selectMode=false;selectedWords.clear();el.innerHTML=levelStatHTML()+'<div class="empty">No words match this filter.</div>';return}
  const step=listPageSize();
  if(reset||listVisible<1)listVisible=Math.min(step,p.length);
  else listVisible=Math.min(listVisible,p.length);
  const shown=p.slice(0,listVisible),base=numberingBase();
  const more=p.length-listVisible;
  el.innerHTML=levelStatHTML()+selectionToolbarHTML(p)+`<div id="wordRows">${shown.map((w,i)=>wordRowHTML(w,i,base)).join('')}</div>`+
    (more>0?`<button class="next" id="loadMoreWords" style="max-width:320px;margin:14px auto 0;display:block" onclick="loadMoreWords()">Load more · ${more} remaining</button>`:'');
}'''
s, n = re.subn(r"function renderList\(reset=true\)\{.*?\n\}\nfunction loadMoreWords", new_render + "\nfunction loadMoreWords", s, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'renderList replacement count={n}')

path.write_text(s, encoding='utf-8')
