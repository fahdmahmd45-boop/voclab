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

  panel.innerHTML =
    '<div class="home" style="max-width:700px">' +
    '<div class="eyebrow">Import & Learn</div><h2 class="hgreet">Your file. Your vocabulary.</h2>' +
    '<p style="color:var(--mut);margin:8px 0 18px">Choose what to study first. AI identifies target vocabulary, not random words from explanations and questions.</p>' +
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
    '<p id="vocImportStatus" role="status" aria-live="polite" style="font-size:13px;color:var(--mut);margin-top:12px"></p>' +
    '</div><div id="vocImportResults"></div></div>';
  const get = id => document.getElementById(id);
  const intents = get('vocImportIntents');
  const status = get('vocImportStatus');
  const result = get('vocImportResults');
  const analyze = get('vocImportAnalyze');
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
  get('vocImportFile').addEventListener('change', () => {entries=[];selected.clear();result.innerHTML='';status.textContent='Choose an action and start analysis when ready.';});
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
    status.textContent='Analyzing document structure and selecting study vocabulary…';
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
      status.textContent = 'Analysis finished: ' + entries.length + ' intended vocabulary items found.' +
        (responseData.file_processing?.sampled ? ' Only selected portions of this long file could be analyzed.' : '') +
        ' Review your selection before saving.';
      showResults(responseData.file_processing);
    } catch(err) {
      status.textContent = err.name === 'AbortError' ? 'Analysis timed out. Try a shorter file.' : String(err.message || err);
    } finally { working = false; analyze.disabled = false; }
  });
})();