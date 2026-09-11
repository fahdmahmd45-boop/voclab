(() => {
  'use strict';

  const MODES = new Set(['cards', 'mcq', 'type']);
  const PANEL_IDS = {
    cards: 'p-cards',
    mcq: 'p-mcq',
    type: 'p-type'
  };
  const STARTERS = {
    cards: () => startCards(),
    mcq: () => startMcq(),
    type: () => startType()
  };
  const QUIZ_LANGUAGE_KEY = 'engl01_quiz_answer_language';

  function getQuizLanguage(){
    try { return localStorage.getItem(QUIZ_LANGUAGE_KEY) === 'en' ? 'en' : 'ar'; }
    catch (e) { return 'ar'; }
  }

  function setQuizLanguage(mode){
    const next = mode === 'en' ? 'en' : 'ar';
    try { localStorage.setItem(QUIZ_LANGUAGE_KEY, next); } catch (e) {}
    return next;
  }

  function quizAnswer(item, mode = getQuizLanguage()){
    if (!Array.isArray(item)) return '';
    return mode === 'en' ? String(item[6] || '').trim() : String(item[3] || '').trim();
  }

  function quizLanguageControl(){
    const mode = getQuizLanguage();
    return `<div class="voc-quiz-language" role="group" aria-label="Quiz answer language">
      <span>Answers</span>
      <div class="voc-quiz-language-tabs">
        <button type="button" data-voc-quiz-mode="ar" class="${mode === 'ar' ? 'on' : ''}" aria-pressed="${mode === 'ar'}">Arabic meaning</button>
        <button type="button" data-voc-quiz-mode="en" class="${mode === 'en' ? 'on' : ''}" aria-pressed="${mode === 'en'}">English definition</button>
      </div>
    </div>`;
  }

  function bindQuizLanguageControl(root){
    if (!root) return;
    root.querySelectorAll('[data-voc-quiz-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.vocQuizMode === 'en' ? 'en' : 'ar';
        if (next === getQuizLanguage()) return;
        setQuizLanguage(next);
        qI = 0;
        qScore = 0;
        qLock = false;
        startMcq();
      });
    });
  }

  function englishQuizDeck(items){
    const seen = new Set();
    const usable = [];
    for (const item of items) {
      const definition = quizAnswer(item, 'en');
      if (!definition) continue;
      const key = definition.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      usable.push(item);
    }
    return shuffle(usable);
  }

  startMcq = function(){
    const panel = document.getElementById('p-mcq');
    if (!panel) return;
    if (!picked && fSrc.value === 'all') {
      panel.innerHTML = quizLanguageControl() + guardHTML();
      bindQuizLanguageControl(panel);
      return;
    }
    const mode = getQuizLanguage();
    qDeck = mode === 'en' ? englishQuizDeck(pool()) : shuffle(pool());
    qI = 0;
    qScore = 0;
    renderMcq();
  };

  renderMcq = function(){
    const el = document.getElementById('p-mcq');
    if (!el) return;
    const mode = getQuizLanguage();

    if (qDeck.length < 4) {
      const message = mode === 'en'
        ? 'English definitions are available for AI-added words. Add at least 4 words with English definitions to use this quiz mode.'
        : 'Need at least 4 words in this filter.';
      el.innerHTML = levelStatHTML() + quizLanguageControl() + `<div class="empty">${message}</div>`;
      bindQuizLanguageControl(el);
      return;
    }

    if (qI >= qDeck.length) {
      el.innerHTML = levelStatHTML() + quizLanguageControl() + `<div class="done"><div class="big">${DONE_ICO}</div><p>Score: <b>${qScore}</b> / ${qDeck.length}</p><p class="praise">${praise()}</p><button class="next" style="max-width:250px;margin:16px auto 0;display:block" onclick="startMcq()">Try again</button></div>`;
      bindQuizLanguageControl(el);
      return;
    }

    qLock = false;
    const word = qDeck[qI];
    let wrong;

    if (mode === 'en') {
      const correct = quizAnswer(word, 'en').toLowerCase();
      const seen = new Set([correct]);
      wrong = [];
      for (const candidate of shuffle(qDeck.filter((item) => item !== word))) {
        const definition = quizAnswer(candidate, 'en');
        if (!definition) continue;
        const key = definition.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        wrong.push(candidate);
        if (wrong.length === 3) break;
      }
      if (wrong.length < 3) {
        el.innerHTML = levelStatHTML() + quizLanguageControl() + '<div class="empty">Need at least 4 different English definitions in this deck.</div>';
        bindQuizLanguageControl(el);
        return;
      }
    } else {
      wrong = shuffle(qDeck.filter((item) => item[3] !== word[3])).slice(0, 3);
    }

    const opts = shuffle([word, ...wrong]);
    const englishClass = mode === 'en' ? ' voc-quiz-english' : '';
    el.innerHTML = levelStatHTML() + `<div class="qwrap">
      ${quizLanguageControl()}
      <div class="qword">
        <div class="word">${htmlText(word[1])} <button class="spk" onclick="speak('${esc(word[1])}')">${SPK}</button></div>
        <div class="type">${htmlText(TY[word[2]] || word[2])}</div>
        ${word[4] ? `<div class="qex">${blankWord(word[4], word[1])}</div>` : ''}
      </div>
      ${opts.map((option) => {
        const isRight = mode === 'en' ? option === word : option[3] === word[3];
        return `<button class="opt${englishClass}" data-r="${isRight ? 1 : 0}" onclick="pickOpt(this)">${htmlText(quizAnswer(option, mode))}</button>`;
      }).join('')}
      <div class="score">Question ${qI + 1} / ${qDeck.length} · Correct: ${qScore}</div>
    </div>`;
    bindQuizLanguageControl(el);
  };

  function scrollTopSafe(){
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch (e) { window.scrollTo(0, 0); }
  }

  function backToDeckPicker(mode){
    if (!MODES.has(mode)) return;

    // Leave the current in-memory session only. Learned/review progress already
    // saved by the app remains untouched.
    picked = false;
    fSrc.value = 'all';
    rebuildUnits();
    fUnit.value = 'all';

    if (mode === 'cards') {
      fcDeck = [];
      fcI = 0;
      fcFlip = false;
    } else if (mode === 'mcq') {
      qDeck = [];
      qI = 0;
      qScore = 0;
      qLock = false;
    } else if (mode === 'type') {
      tDeck = [];
      tI = 0;
      tScore = 0;
    }

    STARTERS[mode]();
    scrollTopSafe();
  }

  function addBackButton(mode){
    if (!MODES.has(mode)) return;
    if (!picked && fSrc.value === 'all') return;

    const panel = document.getElementById(PANEL_IDS[mode]);
    if (!panel || panel.querySelector('.voc-deck-back')) return;

    const wrap = document.createElement('div');
    wrap.className = 'voc-deck-back-wrap';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'voc-deck-back';
    button.setAttribute('aria-label', 'Back to deck selection');
    button.title = 'Back to deck selection';
    button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg><span>Choose another deck</span>';
    button.addEventListener('click', () => backToDeckPicker(mode));

    wrap.appendChild(button);
    panel.prepend(wrap);
  }

  // Keep deck selection inside the learning mode the user is already in.
  // The current app already does this for Quiz; extend the same behavior to
  // Flashcards and Spelling without changing deck data or review logic.
  const originalPickCat = pickCat;
  pickCat = function(id){
    const mode = curTab;
    if (mode !== 'cards' && mode !== 'type') {
      return originalPickCat(id);
    }

    picked = true;
    listVisible = 0;
    if (id === 'L' || id === 'R') {
      fSrc.value = id;
      rebuildUnits();
      fUnit.value = 'all';
    } else if (id === 'MY') {
      fSrc.value = 'M';
      rebuildUnits();
      fUnit.value = 'all';
    } else if (id[0] === 'C') {
      fSrc.value = 'C';
      rebuildUnits();
      fUnit.value = id;
    } else {
      fSrc.value = 'O';
      rebuildUnits();
      fUnit.value = id;
    }

    STARTERS[mode]();
    scrollTopSafe();
  };

  const originalRenderCard = renderCard;
  renderCard = function(){
    originalRenderCard();
    addBackButton('cards');
  };

  const originalRenderMcq = renderMcq;
  renderMcq = function(){
    originalRenderMcq();
    addBackButton('mcq');
  };

  const originalRenderType = renderType;
  renderType = function(){
    originalRenderType();
    addBackButton('type');
  };

  const style = document.createElement('style');
  style.textContent = `
    .voc-deck-back-wrap{
      position:sticky;
      top:72px;
      z-index:21;
      width:100%;
      display:flex;
      justify-content:flex-start;
      margin:0 0 12px;
      pointer-events:none;
    }
    .voc-deck-back{
      pointer-events:auto;
      display:inline-flex;
      align-items:center;
      gap:7px;
      border:1px solid var(--line);
      background:color-mix(in srgb,var(--hd) 94%,transparent);
      color:var(--tx);
      border-radius:10px;
      padding:8px 11px;
      font:500 12px var(--ui);
      cursor:pointer;
      backdrop-filter:blur(10px);
      -webkit-backdrop-filter:blur(10px);
    }
    .voc-deck-back:hover{border-color:var(--amber)}
    .voc-deck-back:active{transform:scale(.98)}
    .voc-quiz-language{
      width:100%;
      max-width:560px;
      margin:0 auto 14px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      padding:9px 10px 9px 12px;
      border:1px solid var(--line);
      border-radius:12px;
      background:var(--card);
    }
    .voc-quiz-language>span{
      color:var(--mut);
      font-size:11px;
      font-weight:600;
      letter-spacing:.08em;
      text-transform:uppercase;
      white-space:nowrap;
    }
    .voc-quiz-language-tabs{
      display:flex;
      gap:3px;
      padding:3px;
      border:1px solid var(--line);
      border-radius:9px;
      background:var(--card2);
    }
    .voc-quiz-language-tabs button{
      border:0;
      border-radius:7px;
      padding:7px 10px;
      background:transparent;
      color:var(--mut);
      font:600 11.5px var(--ui);
      cursor:pointer;
      white-space:nowrap;
    }
    .voc-quiz-language-tabs button.on{
      background:var(--amber);
      color:var(--onacc);
    }
    .opt.voc-quiz-english{
      direction:ltr;
      text-align:left;
      font-family:var(--ui);
      font-size:14px;
      line-height:1.5;
    }
    @media(max-width:540px){
      .voc-deck-back-wrap{top:68px}
      .voc-deck-back{padding:8px 9px}
      .voc-deck-back span{display:none}
      .voc-quiz-language{align-items:stretch;flex-direction:column;gap:7px}
      .voc-quiz-language-tabs{width:100%}
      .voc-quiz-language-tabs button{flex:1;padding:8px 7px}
    }
  `;
  document.head.appendChild(style);
})();
