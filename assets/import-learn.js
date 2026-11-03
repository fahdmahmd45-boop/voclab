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
  let lastIntent = 'explain';
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
    '<label for="vocImportFocus" style="display:block;font-weight:600;margin:17px 0 8px">3 · Which words should AI select?</label>' +
    '<select id="vocImportFocus" class="myin" style="width:100%">' +
    '<option value="auto">Auto-detect the intended vocabulary</option>' +
    '<option value="listed">Only vocabulary lists and defined terms</option>' +
    '<option value="questions">Only vocabulary targeted by questions</option></select>' +
    '<p style="color:var(--mut);font-size:12px;margin:10px 0 14px">AI analysis costs 5 credits per request. No charge just to choose a file. Results are reviewed before saving or starting a quiz.</p>' +
    '<button class="next" id="vocImportAnalyze" type="button">Analyze vocabulary · 5 credits</button>' +
    '<div id="vocImportProgress" hidden class="voc-import-progress" role="group" aria-label="File analysis progress">' +
    '<div class="voc-import-progress-head"><strong id="vocImportProgressPhase">Preparing your file…</strong><span id="vocImportProgressPercent">0%</span></div>' +
    '<div class="voc-import-progress-track" role="progressbar" aria-label="Estimated preparation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="vocImportProgressBar"><span id="vocImportProgressFill"></span></div>' +
    '<div class="voc-import-progress-foot"><span id="vocImportProgressTime">00:00 elapsed</span><span id="vocImportProgressHint">Estimated progress · actual processing time varies</span></div>' +
    '</div>' +
    '<p id="vocImportStatus" role="status" aria-live="polite" style="font-size:13px;color:var(--mut);margin-top:12px"></p>' +
    '</div><div id="vocImportResults"></div></div>';
  const get = id => document.getElementById(id);
  const intents = get('vocImportIntents');
  const status = get('vocImportStatus');
  const result = get('vocImportResults');
  const analyze = get('vocImportAnalyze');
  const progress = get('vocImportProgress');
  const css = document.createElement('style');
  css.id = 'vocImportProgressStyles';
  css.textContent = `
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
    input.checked = i === 0;
    const content = document.createElement('span');
    content.innerHTML = '<strong style="display:block;font-size:13px">' + html(item[1]) + '</strong><small style="color:var(--mut)">' + html(item[2]) + '</small>';
    label.append(input, content);
    intents.appendChild(label);
  });
  function intent() {
    return document.querySelector('input[name="vocImportIntent"]:checked')?.value || 'explain';
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
      '<button class="kbtn" id="vocImportQuiz" type="button" style="flex:1">Create Quiz</button></div>' +
      '<p id="vocImportSaveStatus" role="status" style="font-size:12px;color:var(--mut);margin-top:10px">The selected words are not saved yet.</p>';
    result.replaceChildren(review);
    const list = get('vocImportRows');
    entries.forEach((w, i) => {
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
    get('vocImportSave').onclick = save;
    get('vocImportQuiz').onclick = () => {
      if (!save()) return;
      fSrc.value = 'C';
      picked = true;
      rebuildUnits();
      fUnit.value = savedDeckId;
      document.querySelector('.tab[data-p="mcq"]')?.click();
    };
  }
  get('vocImportFile').addEventListener('change', () => {
    if (working) return;
    entries=[];selected.clear();result.innerHTML='';
    progress.hidden = true;
    status.textContent='Choose what to study, then analyze your file.';
  });
  analyze.addEventListener('click', async () => {
    if (working) return;
    const file = get('vocImportFile').files[0];
    if (!file) { status.textContent='Choose your PDF, DOCX or TXT file first.'; return; }
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) { status.textContent='Supported types: PDF, DOCX, TXT.'; return; }
    if (file.size > 2500000) { status.textContent='Maximum file size is 2.5 MB.'; return; }
    const chosenIntent = intent();
    const chosenFocus = get('vocImportFocus').value;
    working = true;
    analyze.disabled = true;
    lastIntent = chosenIntent;
    lastFile = file.name;
    savedDeckId = '';
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
          body:JSON.stringify({mode:'file',intent:chosenIntent,focus:chosenFocus,filename:file.name,fileData:dataUrl}),
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
    } catch(err) {
      endProgress(false);
      status.textContent = err.name === 'AbortError' ? 'Analysis timed out. Try a shorter file.' : String(err.message || err);
    } finally { working = false; analyze.disabled = false; }
  });
})();