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
    @media(max-width:540px){
      .voc-deck-back-wrap{top:68px}
      .voc-deck-back{padding:8px 9px}
      .voc-deck-back span{display:none}
    }
  `;
  document.head.appendChild(style);
})();
