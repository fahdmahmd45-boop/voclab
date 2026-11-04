(() => {
  'use strict';
  const tab = document.querySelector('.tab[data-p="files"]');
  const panel = document.getElementById('p-files');
  if (!tab || !panel) return;
  const html = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const asText = x => String(x || '').trim();
  const options = [
    ['explain', 'Explain Words', 'Meaning, definition, example and pronunciation'],
    ['quiz', 'Create Quiz', 'Create questions from the actual vocabulary'],
    ['deck', 'Add to Deck', 'Save verified words for later practice']
  ];
  let entries = [];
  let selected = new Set();
  let working = false;
  let lastIntent = 'quiz';
  let quizBusy = false;
  let lastQuiz = null;
  let currentQuiz = null;
  const quizLevels = ['A1','A2','B1','B2','C1','C2','Auto'];
  const quizKinds = [
    ['mixed','Mixed Quiz','اختبار متنوع'],
    ['mcq','Multiple Choice','اختيار من متعدد'],
    ['blank','Fill in the Blanks','إكمال الفراغات'],
    ['context','Meaning in Context','المعنى من السياق'],
    ['spelling','Spelling Test','اختبار الإملاء'],
    ['tf','True / False','صح أو خطأ'],
    ['writing','Sentence Writing','تكوين جمل']
  ];
  let lastFile = '';
  let savedDeckId = '';
  let progressTimer = null;
  let progressStartedAt = 0;
  let progressValue = 0;

  panel.innerHTML =
    '<div class="home" style="max-width:700px">' +
    '<div class="eyebrow">Import & Learn</div><h2 class="hgreet">Study what matters.</h2>' +
    '<p style="color:var(--mut);margin:8px 0 18px">Import a document and choose what you want to learn. Review the extracted terms before saving.</p>' +
    '<div class="myform">' +
    '<label for="vocImportFile" style="display:block;font-weight:600;margin-bottom:9px">1 · Upload your file</label>' +
    '<input id="vocImportFile" class="myin" type="file" style="width:100%" accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document">' +
    '<p style="font-size:12px;color:var(--mut);margin:8px 0 16px">PDF, DOCX, TXT · Up to 2.5 MB · Scanned PDF images need selectable text</p>' +
    '<label style="display:block;font-weight:600;margin-bottom:8px">2 · What would you like to do?</label>' +
    '<div id="vocImportIntents" role="radiogroup" aria-label="Choose learning action" style="display:grid;gap:8px"></div>' +

    '<label for="vocImportInstructions" style="display:block;font-weight:600;margin:17px 0 8px">3 · Tell VocLab what you want</label>' +
    '<textarea id="vocImportInstructions" class="myin" rows="4" maxlength="600" style="width:100%;resize:vertical;min-height:98px" placeholder="e.g. Extract only the target words and create a B2 quiz with realistic sentences and useful feedback."></textarea>' +
    '<p style="font-size:11px;color:var(--mut);margin-top:7px">Optional · Write in Arabic or English · Up to 600 characters</p>' +
    '<div class="voc-import-presets" style="display:flex;flex-wrap:wrap;gap:7px;margin:10px 0 6px">' +
    '<button type="button" class="kbtn" data-preset="b2">B2 Quiz</button>' +
    '<button type="button" class="kbtn" data-preset="arabic">Arabic Explanation</button>' +
    '<button type="button" class="kbtn" data-preset="mistakes">Mistake Review</button></div>' +
    '<div id="vocImportQuizSettings" style="margin-top:17px">' +
    '<label style="display:block;font-weight:600;margin-bottom:9px">4 · Choose your English level</label>' +
    '<div id="vocImportLevels" class="voc-import-levels" role="group" aria-label="English level"></div>' +
    '<label style="display:block;font-weight:600;margin:18px 0 9px">5 · Quiz Type · نوع الاختبار</label>' +
    '<div id="vocImportTypes" class="voc-import-types" role="group" aria-label="Quiz type"></div>' +
    '<label for="vocImportCount" style="display:block;font-weight:600;margin:18px 0 8px">6 · Number of questions</label>' +
    '<select id="vocImportCount" class="myin" style="width:100%"><option value="10">10 questions</option><option value="20" selected>20 questions</option><option value="30">30 questions</option><option value="40">40 questions</option></select>' +
    '<label style="display:flex;align-items:center;gap:9px;margin-top:12px;font-size:12px"><input id="vocImportFeedback" type="checkbox" checked> Explain answers & review mistakes</label>' +
    '</div>' +
    '<label for="vocImportFocus" style="display:block;font-weight:600;margin:17px 0 8px">7 · Which words should AI select?</label>' +
    '<select id="vocImportFocus" class="myin" style="width:100%">' +
    '<option value="auto">Auto-detect the intended vocabulary</option>' +
    '<option value="listed">Only vocabulary lists and defined terms</option>' +
    '<option value="questions">Only vocabulary targeted by questions</option></select>' +
    '<div class="voc-import-cost" style="margin:13px 0"><strong>Step 1 · Extract words: 5 AI credits</strong><span>Step 2 · Generate custom quiz: 5 more credits, after you approve the words.</span></div>' +
    '<button class="next" id="vocImportAnalyze" type="button">Analyze vocabulary · 5 credits</button>' +
    '<div id="vocImportProgress" hidden class="voc-import-progress" role="group" aria-label="File analysis progress">' +
    '<div class="voc-import-progress-head"><strong id="vocImportProgressPhase">Preparing your file…</strong><span id="vocImportProgressPercent">0%</span></div>' +
    '<div class="voc-import-progress-track" role="progressbar" aria-label="Estimated preparation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="vocImportProgressBar"><span id="vocImportProgressFill"></span></div>' +
    '<div class="voc-import-progress-foot"><span id="vocImportProgressTime">00:00 elapsed</span><span id="vocImportProgressHint">Estimated progress · actual processing time varies</span></div>' +
    '</div>' +
    '<p id="vocImportStatus" role="status" aria-live="polite" style="font-size:13px;color:var(--mut);margin-top:12px"></p>' +
    '</div><div id="vocImportResults"></div><div id="vocImportSavedQuizzes"></div></div>';
  const get = id => document.getElementById(id);
  // Each step is its own view. Never stack review, quiz and saved sessions.
  const root=panel.querySelector('.home');
  const screens={};
  const nav=document.createElement('nav');
  nav.className='voc-flow-nav';
  nav.setAttribute('aria-label','Import & Learn stages');
  const navButtons={};
  [['setup','Set up'],['review','Review words'],['practice','Practice'],['saved','Saved']].forEach(([id,title],i)=>{
    const b=document.createElement('button');
    b.type='button';b.textContent=(i<3?i+1+' · ':'')+title;b.dataset.stage=id;
    b.onclick=()=>{if(id==='review'&&!entries.length)return;if(id==='practice'&&!currentQuiz&&!practiceOutput.children.length)return;showScreen(id)};
    navButtons[id]=b;nav.appendChild(b);
  });
  root.prepend(nav);
  for(const id of ['setup','review','practice','saved']){
    const section=document.createElement('section');
    section.className='voc-flow-view';section.hidden=true;
    root.appendChild(section);screens[id]=section;
  }
  [...root.children].filter(n=>n.classList?.contains('eyebrow')||n.classList?.contains('hgreet')||n.tagName==='P')
    .forEach(n=>screens.setup.appendChild(n));
  screens.setup.appendChild(root.querySelector('.myform'));
  screens.review.appendChild(get('vocImportResults'));
  screens.saved.appendChild(get('vocImportSavedQuizzes'));
  const back=(caption,callback)=>{
    const b=document.createElement('button');b.type='button';b.className='kbtn voc-flow-back';
    b.textContent=caption;b.onclick=callback;return b;
  };
  screens.review.prepend(back('← Edit file and settings',()=>showScreen('setup')));
  const practiceTitle=document.createElement('div');
  practiceTitle.className='voc-flow-title';
  practiceTitle.innerHTML='<div class="eyebrow">YOUR PRACTICE</div><h2>Study session</h2>';
  screens.practice.appendChild(practiceTitle);
  const practiceStatus=document.createElement('p');
  practiceStatus.id='vocImportPracticeStatus';practiceStatus.setAttribute('role','status');
  practiceStatus.setAttribute('aria-live','polite');
  screens.practice.appendChild(practiceStatus);
  const practiceOutput=document.createElement('div');
  practiceOutput.id='vocImportPracticeOutput';screens.practice.appendChild(practiceOutput);
  screens.practice.appendChild(back('← Back to selected words',()=>showScreen('review')));
  const savedTitle=document.createElement('div');
  savedTitle.className='voc-flow-title';
  savedTitle.innerHTML='<div class="eyebrow">SAVED PRACTICE</div><h2>Your quizzes.</h2><p>Replay without AI credits.</p>';
  screens.saved.prepend(savedTitle);
  screens.saved.appendChild(back('← New import',()=>showScreen('setup')));
  function showScreen(id){
    for(const [key,section] of Object.entries(screens))section.hidden=key!==id;
    for(const [key,button] of Object.entries(navButtons)){
      button.classList.toggle('active',key===id);
      button.setAttribute('aria-current',key===id?'step':'false');
      button.disabled=(key==='review'&&!entries.length)||(key==='practice'&&!currentQuiz&&!practiceOutput.children.length);
    }
    panel.dataset.flowStage=id;
    requestAnimationFrame(()=>{
      const header=document.querySelector('header');
      const offset=header?header.getBoundingClientRect().height+16:16;
      window.scrollTo({top:Math.max(0,root.getBoundingClientRect().top+window.scrollY-offset),behavior:'instant'});
    });
  }
  showScreen('setup');
  const intents = get('vocImportIntents');
  const status = get('vocImportStatus');
  const result = get('vocImportResults');
  const analyze = get('vocImportAnalyze');
  const progress = get('vocImportProgress');
  const css = document.createElement('style');
  css.id = 'vocImportProgressStyles';
  css.textContent = `

    #p-files>.home{display:block!important;margin:0 auto;max-width:800px!important}
    .voc-import-levels{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
    .voc-import-types{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
    .voc-import-choice{cursor:pointer;border:1px solid var(--line);background:var(--card);color:var(--tx);padding:12px 10px;min-height:48px;border-radius:9px;font-size:12px;font-family:inherit;line-height:1.4;text-align:center}
    .voc-import-choice[aria-pressed="true"]{background:color-mix(in srgb,var(--amber) 12%,var(--card));border:2px solid var(--amber);font-weight:700}
    .voc-import-cost{background:var(--card2);padding:13px 14px;border:1px solid var(--line);border-radius:9px;display:grid;gap:4px}
    .voc-import-cost strong{font-size:12px}.voc-import-cost span{font-size:11px;color:var(--mut)}
    .voc-import-quiz{margin-top:22px;padding:20px;background:var(--card);border:1px solid var(--line);border-radius:12px;display:grid;gap:17px}
    .voc-import-quiz h3{font-family:var(--en);font-size:23px;line-height:1.35}
    .voc-import-quiz-top{display:flex;justify-content:space-between;gap:12px;color:var(--mut);font-size:12px}
    .voc-import-responses{display:grid;gap:9px}
    .voc-import-answer{border:1px solid var(--line);background:var(--card2);text-align:left;color:var(--tx);border-radius:8px;padding:13px;min-height:42px;cursor:pointer;font:inherit;font-size:13px}
    .voc-import-answer[aria-pressed="true"]{border:2px solid var(--amber);background:color-mix(in srgb,var(--amber) 12%,var(--card))}
    .voc-import-feedback{font-size:13px;line-height:1.7}.voc-import-feedback:empty{display:none}.voc-import-feedback p{margin-top:6px;color:var(--mut)}
    .voc-import-saved{display:block;width:100%;text-align:left;padding:13px;background:var(--card);border:1px solid var(--line);border-radius:9px;color:var(--tx);cursor:pointer;font-family:inherit;font-size:12px}
    .voc-import-saved:hover{border-color:var(--amber)}
    .voc-import-summary{border-top:1px solid var(--line);padding-top:12px;display:grid;gap:9px}
    @media(max-width:540px){.voc-import-levels{grid-template-columns:repeat(3,minmax(0,1fr))}.voc-import-types{grid-template-columns:1fr 1fr}.voc-import-choice{padding:11px 6px;font-size:11px}.voc-import-quiz{padding:15px}}
    .voc-flow-view[hidden]{display:none!important}
    .voc-flow-view{min-width:0;max-width:790px;margin-inline:auto;padding-bottom:calc(var(--voc-bottom-h,72px) + env(safe-area-inset-bottom) + 62px)}
    .voc-flow-nav{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:20px;padding:4px 0 14px;overflow:auto;scrollbar-width:none}
    .voc-flow-nav button{flex:1 0 auto;min-height:38px;border:0;background:transparent;color:var(--mut);border-radius:7px;padding:8px;font:600 11px var(--ui);cursor:pointer;white-space:nowrap}
    .voc-flow-nav button.active{background:var(--card2);color:var(--tx)}
    .voc-flow-nav button:disabled{opacity:.35;cursor:not-allowed}
    .voc-flow-back{margin:0 0 18px!important}
    .voc-flow-title{margin:8px 0 20px}
    .voc-flow-title h2{font:500 clamp(25px,4vw,35px)/1.2 var(--en);letter-spacing:-.025em;margin:8px 0}
    .voc-flow-title p,#vocImportPracticeStatus{font-size:13px;color:var(--mut)}
    #vocImportResults h3{font-size:22px!important;letter-spacing:-.015em!important;text-transform:none!important;line-height:1.3!important}
    #vocImportRows strong{font-size:18px!important;letter-spacing:0!important;text-transform:none!important}
    #vocImportRows p{line-height:1.5;margin:4px 0!important}
    #vocImportRows details{margin-top:4px!important}
    .voc-review-pagination{display:flex;justify-content:space-between;align-items:center;gap:7px;margin:14px 0}
    .voc-review-pagination span{color:var(--mut);font-size:11px}
    #vocImportRows{max-height:none!important;overflow:visible!important}
    #vocImportRows label{padding:11px!important;border-radius:9px!important}
    @media(min-width:1024px){.voc-flow-view{padding-bottom:20px}}
    @media(max-width:540px){.voc-flow-nav button{font-size:10px;padding:7px 5px}.voc-flow-view .myform{padding:14px!important}}
    .voc-import-progress{margin-top:18px;padding:16px;border:1px solid var(--line);background:var(--card);border-radius:15px}
    .voc-import-progress[hidden]{display:none!important}
    .voc-import-progress-head,.voc-import-progress-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .voc-import-progress-head{font-size:13px;margin-bottom:12px}
    .voc-import-progress-head span{font-family:var(--en);font-size:18px;font-weight:700;color:var(--amber);font-variant-numeric:tabular-nums}
    .voc-import-progress-track{width:100%;height:9px;overflow:hidden;border-radius:999px;background:var(--card2);border:1px solid var(--line)}
    .voc-import-progress-track span{display:block;width:0;height:100%;border-radius:999px;background:var(--amber);transition:width .45s ease-out}
    .voc-import-progress-foot{margin-top:10px;color:var(--mut);font-size:11px}
    .voc-import-progress-foot span:first-child{font-variant-numeric:tabular-nums;white-space:nowrap}
    @media(max-width:430px){.voc-import-progress-foot{font-size:10px;align-items:flex-start}.voc-import-progress-head{font-size:12px}}
    @media(prefers-reduced-motion:reduce){.voc-import-progress-track span{transition:none}}
  `;
  document.head.appendChild(css);
  function renderProgress(value, elapsed) {
    progressValue = Math.max(progressValue, Math.min(100, Math.round(value)));
    const seconds = Math.floor(elapsed / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    get('vocImportProgressPercent').textContent = progressValue + '%';
    get('vocImportProgressFill').style.width = progressValue + '%';
    get('vocImportProgressBar').setAttribute('aria-valuenow', String(progressValue));
    get('vocImportProgressTime').textContent = mm + ':' + ss + ' elapsed';
  }
  function setProgressPhase(message) { get('vocImportProgressPhase').textContent = message; }
  function startProgress() {
    if (progressTimer) clearInterval(progressTimer);
    progress.hidden = false;
    progressStartedAt = Date.now();
    progressValue = 0;
    get('vocImportProgressFill').style.width = '0%';
    renderProgress(0, 0);
    setProgressPhase('Reading your document…');
    get('vocImportProgressHint').textContent = 'Estimated progress · 100% means ready';
    progressTimer = setInterval(() => {
      const elapsed = Date.now() - progressStartedAt;
      // Visual pacing only: the API does not provide actual per-token progress.
      // Never show 100% before a validated response.
      const estimate = 92 * (1 - Math.exp(-elapsed / 19000));
      renderProgress(Math.min(92, estimate), elapsed);
      if (elapsed > 42000) setProgressPhase('Finishing vocabulary analysis…');
      else if (elapsed > 10000) setProgressPhase('Finding the words that matter…');
      else if (elapsed > 2500) setProgressPhase('Understanding document structure…');
    }, 400);
  }
  function endProgress(success) {
    if (progressTimer) clearInterval(progressTimer);
    progressTimer = null;
    if (progress.hidden) return;
    renderProgress(success ? 100 : progressValue, Date.now() - progressStartedAt);
    setProgressPhase(success ? 'Review your words' : 'Analysis stopped');
    get('vocImportProgressHint').textContent = success ? 'Completed' : 'Check the message below';
  }
  options.forEach((item, i) => {
    const label = document.createElement('label');
    label.style.cssText = 'display:flex;gap:11px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:12px;cursor:pointer';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'vocImportIntent';
    input.value = item[0];
    input.checked = item[0] === 'quiz';
    const content = document.createElement('span');
    content.innerHTML = '<strong style="display:block;font-size:13px">' + html(item[1]) + '</strong><small style="color:var(--mut)">' + html(item[2]) + '</small>';
    label.append(input, content);
    intents.appendChild(label);
  });
  function intent() {
    return document.querySelector('input[name="vocImportIntent"]:checked')?.value || 'quiz';
  }
  function selection() { return entries.filter(x => selected.has(x.word.toLowerCase())); }
  function updateCount() {
    const count = get('vocImportSelectedCount');
    if (count) count.textContent = selected.size + ' of ' + entries.length + ' selected';
  }
  function showResults(meta) {
    if (!entries.length) {
      result.innerHTML = '<div class="myform"><p>No clear target vocabulary was identified. Try choosing the vocabulary-list focus, or check that your PDF has selectable text. No unrelated words will be added as a fallback.</p></div>';
      return;
    }
    const info = meta || {};
    const review = document.createElement('div');
    review.className = 'myform';
    review.innerHTML = '<div class="eyebrow">Review before saving</div>' +
      '<h3 style="font-size:21px;margin:8px 0">' + entries.length + ' vocabulary items identified</h3>' +
      '<p style="font-size:12px;color:var(--mut);margin:7px 0 12px">' +
      'Document type: ' + html(String(info.document_type || 'mixed').replace(/_/g, ' ')) +
      (info.sampled ? ' · Long document sampled: review the coverage.' : '') + '</p>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:13px">' +
      '<strong id="vocImportSelectedCount"></strong>' +
      '<span style="display:flex;gap:6px"><button class="kbtn" id="vocImportAll" type="button">Select all</button>' +
      '<button class="kbtn" id="vocImportNone" type="button">Clear</button></span></div>' +
      '<div id="vocImportRows" style="display:grid;gap:9px;max-height:480px;overflow-y:auto;-webkit-overflow-scrolling:touch"></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:17px">' +
      '<button class="next" style="width:auto;margin:0;flex:1" id="vocImportSave" type="button">Add selected to Deck</button>' +
      '<button class="kbtn" id="vocImportQuiz" type="button" style="flex:1">Generate custom Quiz · 5 credits</button></div>' +
      '<div id="vocImportQuizOutput"></div>' +
      '<p id="vocImportSaveStatus" role="status" style="font-size:12px;color:var(--mut);margin-top:10px">The selected words are not saved yet.</p>';
    result.replaceChildren(review);
    const list = get('vocImportRows');
    const pager=document.createElement('div');pager.className='voc-review-pagination';list.after(pager);
    let page=0;const pageSize=5;
    function showPage(){
      list.replaceChildren();
      const start=page*pageSize;
      entries.slice(start,start+pageSize).forEach((w,i)=>{
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);cursor:pointer';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = selected.has(w.word.toLowerCase());
      check.style.marginTop = '5px';
      check.addEventListener('change', () => {
        if (check.checked) selected.add(w.word.toLowerCase());
        else selected.delete(w.word.toLowerCase());
        updateCount();
      });
      const detail = document.createElement('div');
      detail.style.minWidth = '0';
      detail.style.flex = '1';
      detail.innerHTML =
        '<strong style="font-family:var(--en);font-size:19px">' + html(w.word) + '</strong>' +
        '<span style="font-size:11px;color:var(--mut);margin-left:7px">' + html(w.type) + '</span>' +
        '<p style="direction:rtl;text-align:left;font-size:14px;margin:5px 0">' + html(w.arabic) + '</p>' +
        '<p style="font-size:12px;color:var(--mut)">' + html(w.english_definition) + '</p>' +
        (lastIntent === 'explain' ? '<p style="font-size:12px;margin-top:7px"><em>' + html(w.example) + '</em></p>' : '') +
        '<details style="margin-top:7px"><summary style="font-size:11px;color:var(--mut);cursor:pointer">Source evidence & pronunciation</summary>' +
        '<p style="font-size:11px;margin-top:5px">' + html(w.source_excerpt || '') + '</p>' +
        '<p style="font-size:11px;color:var(--mut)">' + html(w.ipa) + '</p></details>';
      row.append(check, detail);
      list.appendChild(row);
      });
      pager.replaceChildren();
      const prev=document.createElement('button');prev.className='kbtn';prev.textContent='← Prev';prev.disabled=page===0;
      prev.onclick=()=>{page--;showPage();};
      const span=document.createElement('span');span.textContent=(start+1)+'–'+Math.min(start+pageSize,entries.length)+' / '+entries.length;
      const next=document.createElement('button');next.className='kbtn';next.textContent='Next →';next.disabled=start+pageSize>=entries.length;
      next.onclick=()=>{page++;showPage();};
      pager.append(prev,span,next);
    }
    showPage();
    get('vocImportAll').onclick = () => { selected = new Set(entries.map(w => w.word.toLowerCase())); list.querySelectorAll('input[type="checkbox"]').forEach(c => {c.checked=true});updateCount(); };
    get('vocImportNone').onclick = () => { selected.clear(); list.querySelectorAll('input[type="checkbox"]').forEach(c => {c.checked=false});updateCount(); };
    updateCount();
    function save() {
      const chosen = selection();
      const message = get('vocImportSaveStatus');
      if (!chosen.length) { message.textContent = 'Select at least one word first.'; return false; }
      if (typeof myWords === 'undefined' || typeof saveMy !== 'function') { message.textContent='The deck is not ready. Reload the page.'; return false; }
      if (!savedDeckId) {
        const title = 'Import · ' + lastFile.replace(/\.[^.]+$/, '').slice(0, 45);
        const existing = myDecks.find(d => d.t === title);
        if (existing) savedDeckId = existing.id;
        else {
          savedDeckId = 'C' + Date.now();
          myDecks.push({id: savedDeckId, t:title, badge:'IM'});
          saveDecks();
        }
      }
      let saved = 0;
      for (const w of chosen) {
        if (myWords.some(x => x[0] === savedDeckId && String(x[1]).toLowerCase() === w.word.toLowerCase())) continue;
        myWords.push([savedDeckId, w.word, w.type, w.arabic || '—', w.example || '', w.ipa || '', w.english_definition || '']);
        saved++;
      }
      if (saved) { saveMy(); updProg(); rebuildUnits(); }
      message.textContent = saved + ' new words saved to ' + myDecks.find(d => d.id === savedDeckId)?.t + '. ' + (chosen.length-saved) + ' already in this deck.';
      return true;
    }
    get('vocImportSave').onclick = ()=>{
      if(!selection().length){get('vocImportSaveStatus').textContent='Select at least one word.';return}
      if(lastIntent==='deck'&&!save())return;
      renderStudy();
    };
    get('vocImportSave').textContent=lastIntent==='deck'?'Save selected to deck':'Study selected words';
    get('vocImportQuiz').onclick = generateQuiz;
    if (lastIntent !== 'quiz') {
      get('vocImportQuiz').textContent = 'Generate Quiz · 5 credits';
    }
  }

  function quizConfig() {
    return {
      level: get('vocImportLevels').querySelector('[aria-pressed="true"]')?.dataset.level || 'B2',
      quizType: get('vocImportTypes').querySelector('[aria-pressed="true"]')?.dataset.kind || 'mixed',
      questionCount: Number(get('vocImportCount').value),
      instructions: get('vocImportInstructions').value.trim().slice(0,600)
    };
  }
  function createChoice(parent, label, attr, value, initial) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'voc-import-choice';
    btn.textContent = label;
    btn.dataset[attr] = value;
    btn.setAttribute('aria-pressed', String(value === initial));
    btn.addEventListener('click', () => {
      parent.querySelectorAll('[aria-pressed]').forEach(el => el.setAttribute('aria-pressed', String(el === btn)));
    });
    parent.appendChild(btn);
    return btn;
  }
  const levels = get('vocImportLevels');
  quizLevels.forEach(l => createChoice(levels, l === 'Auto' ? 'Auto · Match my file' : l, 'level', l, 'B2'));
  const kinds = get('vocImportTypes');
  quizKinds.forEach(k => createChoice(kinds, k[1] + ' · ' + k[2], 'kind', k[0], 'mixed'));
  function switchGoal() {
    const isQuiz = intent() === 'quiz';
    get('vocImportQuizSettings').hidden = !isQuiz;
    get('vocImportQuizSettings').style.display = isQuiz ? '' : 'none';
  }
  intents.addEventListener('change', switchGoal);
  switchGoal();
  document.querySelectorAll('[data-preset]').forEach(button => {
    button.addEventListener('click', () => {
      const preset = button.dataset.preset;
      const target = preset === 'arabic' ? 'explain' : 'quiz';
      const radio = document.querySelector('input[name="vocImportIntent"][value="'+target+'"]');
      if (radio) radio.checked = true;
      switchGoal();
      if (preset === 'b2') {
        levels.querySelector('[data-level="B2"]')?.click();
        kinds.querySelector('[data-kind="mixed"]')?.click();
        get('vocImportInstructions').value = 'Create a useful B2 quiz from the target words in my file, with realistic sentences and clear feedback.';
      } else if (preset === 'arabic') {
        get('vocImportInstructions').value = 'اشرح الكلمات الأساسية بالعربي مع المعنى، والتعريف الإنجليزي، والنطق، والأمثلة.';
      } else {
        get('vocImportInstructions').value = 'اختبرني في كلمات الملف وراجع معي الكلمات التي أخطئ فيها بأسئلة جديدة.';
      }
    });
  });
  function showSavedQuizzes() {
    const area = get('vocImportSavedQuizzes');
    if (!area) return;
    area.replaceChildren();
    let quizzes = [];
    try {const raw = JSON.parse(localStorage.getItem('engl01_import_quizzes') || '[]');quizzes = Array.isArray(raw) ? raw.slice(0,3) : [];} catch {}
    if (!quizzes.length) return;
    const heading = document.createElement('h3');
    heading.textContent = 'Saved practice · No extra AI credits';
    heading.style.cssText='font-size:15px;margin:20px 0 9px';
    const items = document.createElement('div');
    items.style.cssText='display:grid;gap:8px';
    quizzes.forEach(quiz => {
      if (!Array.isArray(quiz.questions) || !quiz.questions.length) return;
      const line = document.createElement('button');
      line.type='button';
      line.className='voc-import-saved';
      line.textContent = (quiz.file || 'Imported vocabulary') + ' · ' +
        (quiz.level || 'B2') + ' · ' + quiz.questions.length + ' questions · Replay';
      line.addEventListener('click', () => renderQuiz(quiz));
      items.appendChild(line);
    });
    area.append(heading,items);
  }
  function saveQuiz(quiz) {
    try {
      const existing = JSON.parse(localStorage.getItem('engl01_import_quizzes') || '[]');
      const all = Array.isArray(existing) ? existing : [];
      all.unshift(quiz);
      localStorage.setItem('engl01_import_quizzes', JSON.stringify(all.slice(0,3)));
      showSavedQuizzes();
    } catch (error) { console.warn('Could not save quiz locally', error); }
  }

  function renderStudy(){
    const words=selection();
    practiceOutput.replaceChildren();
    const heading=document.createElement('h2');heading.textContent=lastIntent==='deck'?'Saved to your deck':'Study your selected words';
    heading.style.cssText='font-size:24px;margin:0 0 12px';practiceOutput.appendChild(heading);
    for(const w of words){
      const card=document.createElement('article');card.className='myform';card.style.marginBottom='10px';
      const term=document.createElement('h3');term.textContent=w.word;term.style.cssText='font-size:23px;font-family:var(--en)';
      const meaning=document.createElement('p');meaning.textContent=w.arabic||'';meaning.dir='rtl';meaning.style.textAlign='left';
      const def=document.createElement('p');def.textContent=w.english_definition||'';
      const ex=document.createElement('p');ex.textContent=w.example||'';ex.style.cssText='font-size:12px;color:var(--mut);margin-top:8px';
      card.append(term,meaning,def,ex);practiceOutput.appendChild(card);
    }
    practiceStatus.textContent=words.length+' words ready';
    currentQuiz=null;showScreen('practice');
  }

  function renderQuiz(quiz) {
    currentQuiz = quiz;
    const target = practiceOutput;
    practiceStatus.textContent='Ready · Replay without spending AI credits.';
    showScreen('practice');
    const questions = quiz.questions;
    const answers = new Array(questions.length).fill('');
    let current = 0, checked = false, correct = 0, misses = [];
    target.replaceChildren();
    const shell = document.createElement('section');
    shell.className = 'voc-import-quiz';
    target.appendChild(shell);
    const btn = (label, action, kind) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = kind || 'kbtn';
      b.textContent = label;
      b.addEventListener('click', action);
      return b;
    };
    function show() {
      shell.replaceChildren();
      if (current >= questions.length) {
        const headline = document.createElement('h3');
        headline.textContent = 'Practice complete';
        const summary = document.createElement('p');
        summary.textContent = correct + ' of ' + questions.length + ' answers matched the expected answer. Writing questions need self-review.';
        shell.append(headline, summary);
        if (misses.length) {
          const list = document.createElement('div');
          list.className = 'voc-import-summary';
          const h = document.createElement('h4');
          h.textContent = 'Words to review';
          list.append(h);
          misses.forEach(i => {
            const item = document.createElement('p');
            item.textContent = questions[i].word + ' · ' + questions[i].explanation;
            list.append(item);
          });
          shell.append(list);
        }
        shell.append(btn('Try quiz again · no AI credits', () => {current=0;checked=false;correct=0;misses=[];answers.fill('');show();}, 'next'));
        shell.append(btn('Back to selected words', () => {target.replaceChildren();showResults({document_type:'mixed'});showScreen('review');}));
        return;
      }
      const q = questions[current];
      const head = document.createElement('div');
      head.className = 'voc-import-quiz-top';
      const a = document.createElement('strong');
      a.textContent = 'Question ' + (current + 1) + ' / ' + questions.length;
      const b = document.createElement('span');
      b.textContent = q.kind.toUpperCase() + ' · ' + quiz.level;
      head.append(a,b);
      const title = document.createElement('h3');
      title.textContent = q.prompt;
      shell.append(head,title);
      const responses = document.createElement('div');
      responses.className = 'voc-import-responses';
      let input;
      if (q.options.length) {
        q.options.forEach(opt => {
          const option = btn(opt, () => {
            if (checked) return;
            answers[current] = opt;
            responses.querySelectorAll('button').forEach(el => el.setAttribute('aria-pressed', String(el===option)));
          }, 'voc-import-answer');
          option.setAttribute('aria-pressed', String(answers[current] === opt));
          responses.appendChild(option);
        });
      } else {
        input = q.kind === 'writing' ? document.createElement('textarea') : document.createElement('input');
        input.className='myin';
        input.style.width='100%';
        input.placeholder = q.kind === 'writing' ? 'Write your own sentence using '+q.word : 'Type your answer';
        input.value = answers[current] || '';
        input.maxLength = 350;
        input.addEventListener('input', () => {answers[current] = input.value});
        responses.appendChild(input);
      }
      shell.appendChild(responses);
      const feedback = document.createElement('div');
      feedback.className = 'voc-import-feedback';
      const next = btn('Check answer', () => {
        const value = String(answers[current] || '').trim();
        if (!value) {feedback.textContent = 'Choose or type an answer first.';return}
        if (!checked) {
          checked = true;
          const normalized = s => String(s).trim().toLowerCase().replace(/[.!?]+$/, '');
          const match = normalized(value) === normalized(q.answer);
          if (match) correct++;
          else if (q.kind !== 'writing') misses.push(current);
          feedback.replaceChildren();
          const resultText = document.createElement('strong');
          resultText.textContent = q.kind === 'writing' ? 'Compare your writing with this example:' : match ? 'Correct ✓' : 'Review this answer';
          const answerText = document.createElement('p');
          answerText.textContent = 'Expected: ' + q.answer;
          const why = document.createElement('p');
          why.textContent = q.explanation;
          feedback.append(resultText,answerText,why);
          if (q.kind === 'writing') {
            const review = btn('Mark for review', () => { if(!misses.includes(current)) misses.push(current); review.disabled=true; review.textContent='Added to review';});
            feedback.append(review);
          }
          next.textContent = current === questions.length-1 ? 'View results' : 'Next question';
          if (input) input.disabled = true;
        } else {
          current++; checked=false; show();
        }
      },'next');
      shell.append(feedback,next);
    }
    show();
    showScreen('practice');
  }
  async function generateQuiz() {
    if (working || quizBusy) return;
    const selectedWords = selection();
    const message = get('vocImportSaveStatus');
    if (!selectedWords.length) {message.textContent='Select at least one word first.';return}
    const config = quizConfig();
    const button = get('vocImportQuiz');
    quizBusy=true;
    button.disabled=true;
    button.textContent='Generating questions…';
    message.textContent='Generating a '+config.level+' quiz · 5 AI credits.';
    practiceOutput.replaceChildren();
    practiceStatus.textContent='Generating '+config.questionCount+' questions at '+config.level+' level…';
    showScreen('practice');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),85000);
      let response;
      try {
        response = await fetch('/api/ai',{method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({mode:'quiz',words:selectedWords.map(w=>({
            word:w.word,arabic:w.arabic,english_definition:w.english_definition,example:w.example
          })),...config}),
          signal:controller.signal});
      } finally {clearTimeout(timeout)}
      const payload = await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(payload.error || 'Could not generate quiz.');
      if(!Array.isArray(payload.questions) || !payload.questions.length) throw new Error('No valid questions were returned.');
      lastQuiz = {id:Date.now(),file:lastFile,level:config.level,type:config.quizType,
        questions:payload.questions,date:new Date().toISOString()};
      saveQuiz(lastQuiz);
      message.textContent = payload.questions.length + ' questions ready · Saved for replay without AI credits.';
      renderQuiz(lastQuiz);
    } catch(error) {
      practiceStatus.textContent=error.name==='AbortError'?'Quiz generation timed out. Try fewer questions.':String(error.message || error);
      message.textContent=practiceStatus.textContent;
    } finally {
      quizBusy=false;
      button.disabled=false;
      button.textContent='Generate custom Quiz · 5 credits';
    }
  }

  showSavedQuizzes();
  get('vocImportFile').addEventListener('change', () => {
    if (working) return;
    entries=[];selected.clear();result.innerHTML='';
    progress.hidden = true;
    status.textContent='Choose what to study, then analyze your file.';
    currentQuiz = null;
  });
  analyze.addEventListener('click', async () => {
    if (working) return;
    const file = get('vocImportFile').files[0];
    if (!file) { status.textContent='Choose your PDF, DOCX or TXT file first.'; return; }
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) { status.textContent='Supported types: PDF, DOCX, TXT.'; return; }
    if (file.size > 2500000) { status.textContent='Maximum file size is 2.5 MB.'; return; }
    const chosenIntent = intent();
    const chosenFocus = get('vocImportFocus').value;
    const chosenInstructions = get('vocImportInstructions').value.trim().slice(0,600);
    working = true;
    analyze.disabled = true;
    lastIntent = chosenIntent;
    lastFile = file.name;
    savedDeckId = '';
    currentQuiz = null;
    entries = [];
    selected.clear();
    result.innerHTML = '';
    status.textContent='Reading your file and identifying the selected terms…';
    startProgress();
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsDataURL(file);
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 85000);
      let response;
      try {
        response = await fetch('/api/ai', {
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({mode:'file',intent:chosenIntent,focus:chosenFocus,instructions:chosenInstructions,filename:file.name,fileData:dataUrl}),
          signal:controller.signal
        });
      } finally { clearTimeout(timeout); }
      const responseData = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseData.error || 'AI could not analyze this file.');
      entries = Array.isArray(responseData.words) ? responseData.words.slice(0,40).filter(w => w && asText(w.word)) : [];
      selected = new Set(entries.map(w => w.word.toLowerCase()));
      endProgress(true);
      status.textContent = 'Analysis finished: ' + entries.length + ' intended vocabulary items found.' +
        (responseData.file_processing?.sampled ? ' Only selected portions of this long file could be analyzed.' : '') +
        ' Review your selection before saving.';
      showResults(responseData.file_processing);
      showScreen('review');
    } catch(err) {
      endProgress(false);
      status.textContent = err.name === 'AbortError' ? 'Analysis timed out. Try a shorter file.' : String(err.message || err);
    } finally { working = false; analyze.disabled = false; }
  });
})();