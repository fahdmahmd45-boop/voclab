(() => {
  'use strict';
  const tab=document.querySelector('.tab[data-p="files"]');
  const panel=document.getElementById('p-files');
  if(!tab||!panel)return;
  let candidates=[],selected=new Set(),busy=false;
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  panel.innerHTML=`<div class="home">
    <div class="eyebrow">Import & Learn</div>
    <h2 class="hgreet">Learn from your files</h2>
    <p style="color:var(--mut);margin:10px 0 20px">Upload once, select vocabulary, then explain, save or quiz. Text extraction is free; AI Search uses your normal credits.</p>
    <div class="myform">
      <label for="vocImportFile" style="display:block;font-weight:600;margin-bottom:8px">Upload PDF, DOCX or TXT</label>
      <input id="vocImportFile" class="myin" style="width:100%" type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document">
      <div style="font-size:12px;color:var(--mut);margin:8px 0 12px">Max 2.5 MB · Scanned PDFs need selectable text · no AI credits to preview</div>
      <button class="next" type="button" id="vocImportRead">Extract words</button>
      <p id="vocImportStatus" role="status" style="font-size:13px;margin-top:12px;color:var(--mut)"></p>
    </div>
    <div id="vocImportPreview"></div>
  </div>`;
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(el=>el.classList.remove('on'));
    document.querySelectorAll('.panel').forEach(el=>el.classList.remove('on'));
    tab.classList.add('on');panel.classList.add('on');
    if(typeof curTab!=='undefined')curTab='files';
    const exit=document.getElementById('btnExit');if(exit)exit.style.display='inline-flex';
  });
  const status=document.getElementById('vocImportStatus');
  const preview=document.getElementById('vocImportPreview');
  const readBtn=document.getElementById('vocImportRead');
  function render() {
    if(!candidates.length){preview.innerHTML='<p class="empty">No vocabulary to preview.</p>';return}
    preview.innerHTML=`<div class="myform">
      <h3>Choose words (${selected.size} selected · ${candidates.length} recognizable)</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin:12px 0">
        <button class="kbtn" id="vocSelectAll" type="button">Select all</button>
        <button class="kbtn" id="vocSelectNone" type="button">Clear</button>
      </div>
      <div id="vocWordChoices" style="max-height:320px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:8px">
       ${candidates.map(w=>`<label style="display:flex;align-items:center;gap:7px;font-size:13px;padding:8px;border:1px solid var(--line);border-radius:8px"><input type="checkbox" data-word="${escape(w.word)}" ${selected.has(w.word)?'checked':''}><span>${escape(w.word)}</span></label>`).join('')}
      </div>
      <p style="font-size:12px;color:var(--mut);margin-top:12px">The preview matches words with VocLab's vocabulary dictionary. Other terms can be searched individually in AI Search.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px">
        <button class="kbtn" id="vocExplain" type="button">Explain first selected</button>
        <button class="kbtn" id="vocSave" type="button">Add to Deck</button>
        <button class="next" style="width:auto;margin:0" id="vocQuiz" type="button">Save & Create Quiz</button>
      </div>
      <p id="vocActionMessage" role="status" style="font-size:13px;margin-top:12px"></p>
    </div>`;
    preview.querySelector('#vocWordChoices').addEventListener('change',e=>{const w=e.target.dataset.word;if(!w)return;if(e.target.checked)selected.add(w);else selected.delete(w);render()});
    preview.querySelector('#vocSelectAll').onclick=()=>{selected=new Set(candidates.map(x=>x.word));render()};
    preview.querySelector('#vocSelectNone').onclick=()=>{selected.clear();render()};
    preview.querySelector('#vocExplain').onclick=()=>{
      const word=[...selected][0];if(!word){alert('Select a word first.');return}
      document.querySelector('.tab[data-p="dict"]').click();
      const input=document.getElementById('dIn');if(input)input.value=word;
      if(typeof aiSearchLookup==='function')aiSearchLookup();
    };
    function save(){
      const list=candidates.filter(x=>selected.has(x.word));
      if(!list.length){preview.querySelector('#vocActionMessage').textContent='Select words first.';return 0}
      let added=0;
      for(const w of list) {
        if(myWords.some(x=>x[0]==='MY'&&x[1].toLowerCase()===w.word))continue;
        myWords.push(['MY',w.source[1],w.source[2],w.source[3],typeof OXEX==='object'?(OXEX[w.source[0]+'|'+w.source[1]]||''):'']);
        added++;
      }
      if(added){saveMy();updProg();rebuildUnits();}
      preview.querySelector('#vocActionMessage').textContent=added+' words saved to Added Words.';
      return list.length;
    }
    preview.querySelector('#vocSave').onclick=save;
    preview.querySelector('#vocQuiz').onclick=()=>{
      if(!save())return;
      fSrc.value='M';picked=true;rebuildUnits();fUnit.value='all';
      document.querySelector('.tab[data-p="mcq"]').click();
    };
  }
  readBtn.addEventListener('click',async()=>{
    if(busy)return;
    const file=document.getElementById('vocImportFile').files[0];
    if(!file){status.textContent='Choose a file first.';return}
    if(file.size>2500000){status.textContent='Maximum size is 2.5 MB.';return}
    busy=true;readBtn.disabled=true;status.textContent='Reading your file…';preview.innerHTML='';
    try {
      const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('File could not be read.'));reader.readAsDataURL(file)});
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
      let response;
      try{response=await fetch('/api/import-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:file.name,fileData:dataUrl}),signal:controller.signal})}
      finally{clearTimeout(timeout)}
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||'File extraction failed.');
      const dictionary=new Map();
      if(typeof OXR!=='undefined')for(const w of OXR){const key=String(w[1]||'').toLowerCase();if(!dictionary.has(key))dictionary.set(key,w)}
      candidates=json.words.filter(w=>dictionary.has(w)).map(w=>({word:w,source:dictionary.get(w)})).slice(0,200);
      selected=new Set(candidates.map(w=>w.word));
      status.textContent=`Found ${json.words.length} unique terms; ${candidates.length} match your VocLab dictionary.`+(json.sampled?' This long file was sampled: not all pages were processed.':'')+(json.words.length===800?' Showing only the first 800 terms.':'');
      render();
    }catch(e){status.textContent=e.name==='AbortError'?'Reading took too long. Try a smaller file.':String(e.message||e)}
    finally{busy=false;readBtn.disabled=false}
  });
})();