from pathlib import Path
import re

path = Path('index.html')
s = path.read_text(encoding='utf-8')

marker = '// VOC_AI_DETAILS_V2'
if marker in s:
    print('AI vocabulary details patch already present.')
    raise SystemExit(0)

pat = re.compile(
    r"/\* ---------- Add Word ---------- \*/\n// VOC_AI_ADDWORD_V1\nlet aiDraft=.*?\nfunction toggleKnownMy",
    re.S,
)

new = r'''/* ---------- Add Word ---------- */
// VOC_AI_ADDWORD_V1
// VOC_AI_DETAILS_V2
let aiDraft=[],aiNotice='';
const AI_FILE_MIME={
  pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt:'text/plain',csv:'text/csv',json:'application/json',md:'text/markdown'
};
function aiSafe(v){return String(v==null?'':v).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function aiDeckOptions(){return `<option value="MY">Added Words</option>${myDecks.map(d=>`<option value="${d.id}">${aiSafe(d.t)}</option>`).join('')}`}
function aiSetBusy(on,text){
  const b=document.getElementById('aiWordBtn'),f=document.getElementById('aiFileBtn'),m=document.getElementById('aiStatus');
  if(b){b.disabled=on;b.style.opacity=on?'.55':'1'}
  if(f){f.disabled=on;f.style.opacity=on?'.55':'1'}
  if(m&&text)m.textContent=text;
}
function aiErrorMessage(e){
  if(e&&e.code==='OPENAI_API_KEY_MISSING')return 'AI is ready in the site, but the server still needs the OpenAI API key.';
  return (e&&e.error)||'Could not generate vocabulary. Try again.';
}
async function aiPost(body){
  const r=await fetch('/api/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const d=await r.json().catch(()=>({error:'Invalid server response.'}));
  if(!r.ok)throw d;
  return d;
}
async function aiGenerateWord(){
  const inp=document.getElementById('newWordInput'),word=(inp&&inp.value||'').trim();
  if(!word){const m=document.getElementById('aiStatus');if(m)m.textContent='Type an English word or phrase first.';return}
  aiSetBusy(true,'Generating vocabulary entry…');
  try{
    const d=await aiPost({mode:'word',word});
    aiDraft=d.words||[];aiNotice='';renderAiPreview();
  }catch(e){const m=document.getElementById('aiStatus');if(m)m.textContent=aiErrorMessage(e)}
  finally{aiSetBusy(false)}
}
function aiNormalizeFileData(file,data){
  let out=String(data||'');
  if(/^data:;base64,/i.test(out)){
    const ext=(String(file&&file.name||'').split('.').pop()||'').toLowerCase();
    const mime=AI_FILE_MIME[ext]||'application/octet-stream';
    out=out.replace(/^data:;base64,/i,`data:${mime};base64,`);
  }
  return out;
}
function aiReadFile(input){
  const file=input.files&&input.files[0];if(!file)return;
  if(file.size>2500000){const m=document.getElementById('aiStatus');if(m)m.textContent='File is too large. Maximum size is 2.5 MB.';input.value='';return}
  aiSetBusy(true,'Reading and extracting vocabulary…');
  const r=new FileReader();
  r.onload=async()=>{
    try{
      const fileData=aiNormalizeFileData(file,r.result);
      if(!/^data:[^,]*;base64,/i.test(fileData))throw {error:'Could not encode this file. Please choose it again.'};
      const d=await aiPost({mode:'file',filename:file.name,fileData});
      aiDraft=d.words||[];aiNotice='';renderAiPreview();
    }catch(e){const m=document.getElementById('aiStatus');if(m)m.textContent=aiErrorMessage(e)}
    finally{input.value='';aiSetBusy(false)}
  };
  r.onerror=()=>{const m=document.getElementById('aiStatus');if(m)m.textContent='Could not read this file.';input.value='';aiSetBusy(false)};
  r.readAsDataURL(file);
}
function aiRemove(i){aiDraft.splice(i,1);renderAiPreview()}
function renderAiPreview(){
  const el=document.getElementById('aiPreview');if(!el)return;
  const status=document.getElementById('aiStatus');
  if(status)status.textContent=aiNotice||'';
  if(!aiDraft.length){el.innerHTML='';return}
  el.innerHTML=`<div class="myform" style="margin-top:12px">
    <h3>AI preview · ${aiDraft.length} word${aiDraft.length===1?'':'s'}</h3>
    <div class="mygrid" style="margin-bottom:12px">
      <select class="myin full" id="aiDeck">${aiDeckOptions()}</select>
    </div>
    <div style="display:grid;gap:10px;max-height:520px;overflow:auto;padding-right:2px">
      ${aiDraft.map((x,i)=>`<div style="border:1px solid var(--line);border-radius:14px;padding:14px 15px;background:var(--card2)">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="spk" onclick="speak('${esc(String(x.word||''))}')" title="Pronounce word">${SPK}</button>
          <b style="font-family:var(--en);font-size:20px">${aiSafe(x.word)}</b>
          <span class="t">${aiSafe(TY[x.type]||x.type)}</span>
          ${x.ipa?`<span style="font-family:var(--en);font-size:13px;color:var(--mut);letter-spacing:.01em">${aiSafe(x.ipa)}</span>`:''}
          <span style="font-family:var(--ar);direction:rtl;margin-left:auto">${aiSafe(x.arabic)}</span>
          <button class="delbtn" onclick="aiRemove(${i})" aria-label="Remove">✕</button>
        </div>
        ${x.english_definition?`<div style="margin-top:10px;line-height:1.55;font-family:var(--en);font-size:14px"><span style="font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);margin-right:7px">Definition</span>${aiSafe(x.english_definition)}</div>`:''}
        ${x.example?`<div class="ex" style="margin-top:10px;display:flex;align-items:flex-start;gap:7px"><button class="spk" style="flex:0 0 auto" onclick="speak('${esc(String(x.example||''))}')" title="Pronounce example">${SPK}</button><span>${aiSafe(x.example)}</span></div>`:''}
        ${x.example_arabic?`<div style="font-family:var(--ar);direction:rtl;text-align:right;color:var(--mut);font-size:14px;line-height:1.7;margin-top:5px">${aiSafe(x.example_arabic)}</div>`:''}
      </div>`).join('')}
    </div>
    <button class="addbtn" style="width:100%;margin-top:12px" onclick="addAiDraft()">${aiDraft.length===1?'Add word':'Add all '+aiDraft.length+' words'}</button>
  </div>`;
}
function addAiDraft(){
  if(!aiDraft.length)return;
  const sel=document.getElementById('aiDeck'),deck=sel?sel.value:'MY';
  let added=0,skipped=0;
  for(const x of aiDraft){
    const word=String(x.word||'').trim();if(!word)continue;
    if(myWords.some(w=>w[0]===deck&&String(w[1]||'').toLowerCase()===word.toLowerCase())){skipped++;continue}
    myWords.unshift([
      deck,word,String(x.type||'n'),String(x.arabic||'—'),String(x.example||''),
      String(x.ipa||''),String(x.english_definition||''),String(x.example_arabic||'')
    ]);added++;
  }
  aiDraft=[];
  if(added){saveMy();updProg();rebuildUnits()}
  aiNotice=added?`✓ Added ${added} word${added===1?'':'s'}${skipped?` · ${skipped} already existed`:''}`:(skipped?'All of these words already exist.':'No valid words found.');
  renderMy();
}
function renderMy(){
  const el=document.getElementById('p-my');
  el.innerHTML=`<div class="myform">
    <h3>AI vocabulary</h3>
    <div class="mygrid">
      <input class="myin full" id="newWordInput" dir="ltr" autocomplete="off" autocapitalize="off" placeholder="Type an English word or phrase">
      <button class="addbtn" id="aiWordBtn" onclick="aiGenerateWord()">Generate with AI</button>
      <input type="file" id="aiFile" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.json,.md" style="display:none" onchange="aiReadFile(this)">
      <button class="addbtn" id="aiFileBtn" style="background:transparent;border:1px solid var(--amber);color:var(--amber)" onclick="document.getElementById('aiFile').click()">Upload a file and extract vocabulary</button>
      <div class="full" id="aiStatus" style="font-size:13px;color:var(--mut);min-height:20px">${aiSafe(aiNotice)}</div>
    </div>
    <div id="aiPreview"></div>
  </div>
  <details class="myform" style="padding:0;overflow:hidden">
    <summary style="cursor:pointer;padding:16px 18px;font-weight:600">Manual import</summary>
    <div class="mygrid" style="padding:0 18px 18px">
      <select class="myin full" id="mDeck">
        <option value="MY">→ Added Words</option>
        ${myDecks.map(d=>`<option value="${d.id}">→ ${d.t}</option>`).join('')}
      </select>
      <textarea class="myin full" id="mPaste" dir="ltr" rows="4" spellcheck="false" style="resize:vertical;font-family:monospace;font-size:12px" placeholder='["MY","word","noun","المعنى","Example sentence."],'></textarea>
      <button class="addbtn" onclick="pasteImport()">Import pasted words</button>
      <input type="file" id="mFile" accept=".txt,.json,.csv,.js" style="display:none" onchange="fileImport(this)">
      <button class="addbtn" style="background:transparent;border:1px solid var(--amber);color:var(--amber)" onclick="document.getElementById('mFile').click()">Import local text file</button>
      <div class="full" id="mPasteMsg" style="font-size:13px;opacity:.8"></div>
    </div>
  </details>
  <div id="myList"></div>`;
  renderAiPreview();
  const ni=document.getElementById('newWordInput');if(ni)ni.addEventListener('keydown',e=>{if(e.key==='Enter')aiGenerateWord()});
  const list=document.getElementById('myList');
  if(!myWords.length){list.innerHTML='<div class="empty">No added words yet — generate a word or upload a vocabulary file above.</div>';return}
  list.innerHTML=myWords.map(w=>{
    const id=kid(w),isK=known.has(id);
    return `<div class="row ${isK?'known':''}">
      <div class="rtop">
        <button class="spk" onclick="speak('${esc(w[1])}')" title="Pronounce word">${SPK}</button>
        <span class="w">${w[1]}</span>
        ${w[5]?`<span class="t" style="font-family:var(--en);font-weight:400">${aiSafe(w[5])}</span>`:''}
        ${w[0]!=='MY'?`<span class="t" style="border:1px solid var(--amber,#D0AF7A);border-radius:8px;padding:1px 7px">${deckName(w[0])}</span>`:''}
        <span class="t">${TY[w[2]]||w[2]}</span>
        <span class="m">${w[3]}</span>
        <button class="kbtn" style="margin-left:auto" onclick="toggleKnownMy('${esc(id)}')">${isK?'✓ Mastered':'Mark'}</button>
        <button class="delbtn" onclick="delMy('${esc(w[1])}','${w[0]}')">✕</button>
      </div>
      ${w[6]?`<div style="font-family:var(--en);font-size:13px;line-height:1.55;color:var(--mut);margin-top:7px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:.09em;margin-right:7px">Definition</span>${aiSafe(w[6])}</div>`:''}
      ${w[4]?`<div class="ex" style="display:flex;align-items:flex-start;gap:7px"><button class="spk" style="flex:0 0 auto" onclick="speak('${esc(String(w[4]||''))}')" title="Pronounce example">${SPK}</button><span>${hiWord(w[4],w[1])}</span></div>`:''}
      ${w[7]?`<div style="font-family:var(--ar);direction:rtl;text-align:right;font-size:13px;line-height:1.7;color:var(--mut);margin-top:4px">${aiSafe(w[7])}</div>`:''}
    </div>`;
  }).join('');
}
function toggleKnownMy'''

s2, n = pat.subn(new, s, count=1)
if n != 1:
    raise RuntimeError(f'Could not replace AI Add Word section: {n}')

path.write_text(s2, encoding='utf-8')
print('AI vocabulary details patch applied.')
