(() => {
  'use strict';

  const STORAGE_KEY = 'engl01_quiz_answer_language';

  function getMode() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar';
    } catch {
      return 'ar';
    }
  }

  function setMode(mode) {
    const next = mode === 'en' ? 'en' : 'ar';
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    return next;
  }

  function answerText(item, mode = getMode()) {
    if (!Array.isArray(item)) return '';
    if (mode === 'en') return String(item[6] || '').trim();
    return String(item[3] || '').trim();
  }

  function buildQuizDeck(items, mode) {
    if (mode !== 'en') return shuffle(items);
    const seen = new Set();
    const usable = [];
    for (const item of items) {
      const definition = answerText(item, 'en');
      if (!definition) continue;
      const key = definition.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      usable.push(item);
    }
    return shuffle(usable);
  }

  function languageControl() {
    const mode = getMode();
    return `
      <div class="voc-quiz-language" role="group" aria-label="Quiz answer language">
        <span>Answers</span>
        <div class="voc-quiz-language-tabs">
          <button type="button" data-voc-quiz-mode="ar" class="${mode === 'ar' ? 'on' : ''}" aria-pressed="${mode === 'ar'}">Arabic meaning</button>
          <button type="button" data-voc-quiz-mode="en" class="${mode === 'en' ? 'on' : ''}" aria-pressed="${mode === 'en'}">English definition</button>
        </div>
      </div>`;
  }

  function bindLanguageControl(root) {
    if (!root) return;
    root.querySelectorAll('[data-voc-quiz-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        const next = button.dataset.vocQuizMode === 'en' ? 'en' : 'ar';
        if (next === getMode()) return;
        setMode(next);
        qI = 0;
        qScore = 0;
        qLock = false;
        startMcq();
      });
    });
  }

  function englishUnavailableHtml() {
    return `${levelStatHTML()}${languageControl()}<div class="empty">English definitions are available for AI-added words. Add at least 4 words with English definitions to use this quiz mode.</div>`;
  }

  startMcq = function () {
    const panel = document.getElementById('p-mcq');
    if (!panel) return;

    if (!picked && fSrc.value === 'all') {
      panel.innerHTML = languageControl() + guardHTML();
      bindLanguageControl(panel);
      return;
    }

    const mode = getMode();
    qDeck = buildQuizDeck(pool(), mode);
    qI = 0;
    qScore = 0;
    renderMcq();
  };

  renderMcq = function () {
    const el = document.getElementById('p-mcq');
    if (!el) return;
    const mode = getMode();

    if (qDeck.length < 4) {
      el.innerHTML = mode === 'en'
        ? englishUnavailableHtml()
        : levelStatHTML() + languageControl() + '<div class="empty">Need at least 4 words in this filter.</div>';
      bindLanguageControl(el);
      return;
    }

    if (qI >= qDeck.length) {
      el.innerHTML = levelStatHTML() + languageControl() + `<div class="done"><div class="big">${DONE_ICO}</div><p>Score: <b>${qScore}</b> / ${qDeck.length}</p><p class="praise">${praise()}</p><button class="next" style="max-width:250px;margin:16px auto 0;display:block" onclick="startMcq()">Try again</button></div>`;
      bindLanguageControl(el);
      return;
    }

    qLock = false;
    const word = qDeck[qI];
    const correct = answerText(word, mode);
    const wrong = [];
    const seen = new Set([correct.toLowerCase()]);
    for (const candidate of shuffle(qDeck.filter((item) => item !== word))) {
      const text = answerText(candidate, mode);
      if (!text) continue;
      const key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      wrong.push(candidate);
      if (wrong.length === 3) break;
    }

    if (wrong.length < 3) {
      el.innerHTML = mode === 'en'
        ? englishUnavailableHtml()
        : levelStatHTML() + languageControl() + '<div class="empty">Need at least 4 different answers in this filter.</div>';
      bindLanguageControl(el);
      return;
    }

    const opts = shuffle([word, ...wrong]);
    const englishClass = mode === 'en' ? ' voc-quiz-english' : '';

    el.innerHTML = levelStatHTML() + `<div class="qwrap">
      ${languageControl()}
      <div class="qword">
        <div class="word">${htmlText(word[1])} <button class="spk" onclick="speak('${esc(word[1])}')">${SPK}</button></div>
        <div class="type">${htmlText(TY[word[2]] || word[2])}</div>
        ${word[4] ? `<div class="qex">${blankWord(word[4], word[1])}</div>` : ''}
      </div>
      ${opts.map((option) => `<button class="opt${englishClass}" data-r="${option === word ? 1 : 0}" onclick="pickOpt(this)">${htmlText(answerText(option, mode))}</button>`).join('')}
      <div class="score">Question ${qI + 1} / ${qDeck.length} · Correct: ${qScore}</div>
    </div>`;

    bindLanguageControl(el);
  };

  const style = document.createElement('style');
  style.id = 'vocQuizLanguageStyles';
  style.textContent = `
    .voc-quiz-language{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      margin:0 0 14px;
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
      .voc-quiz-language{align-items:stretch;flex-direction:column;gap:7px}
      .voc-quiz-language-tabs{width:100%}
      .voc-quiz-language-tabs button{flex:1;padding:8px 7px}
    }
  `;
  document.head.appendChild(style);
})();
