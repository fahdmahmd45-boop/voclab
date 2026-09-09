(() => {
  'use strict';

  if (window.__VOC_HOME_UX_REDESIGN_V2__) return;
  window.__VOC_HOME_UX_REDESIGN_V2__ = true;

  const INSTAGRAM_URL = 'https://www.instagram.com/voclab_sa/';
  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>',
    cards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    quiz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 9a3.5 3.5 0 1 1 5.7 2.7c-1.3 1-2.2 1.6-2.2 3.3"/><path d="M12 19h.01"/><circle cx="12" cy="12" r="10"/></svg>',
    spelling: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 10h16M4 14h10M4 18h7"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    language: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>'
  };

  function getTabButton(name) {
    return document.querySelector(`.tab[data-p="${name}"]`);
  }

  function openTab(name) {
    const tab = getTabButton(name);
    if (tab) tab.click();
  }

  function currentPage() {
    return document.querySelector('.tab.on')?.dataset.p || 'home';
  }

  function syncBottomNav() {
    const page = currentPage();
    const active = page === 'dict' || page === 'list' ? 'home' : page === 'my' ? 'add' : page;
    document.querySelectorAll('.voc-bottom-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.target === active);
      btn.setAttribute('aria-current', btn.dataset.target === active ? 'page' : 'false');
    });
  }

  function createBottomNav() {
    if (document.getElementById('vocBottomNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'vocBottomNav';
    nav.className = 'voc-bottom-nav';
    nav.setAttribute('aria-label', 'Primary navigation');
    nav.innerHTML = `
      <button class="voc-bottom-item" data-target="home" type="button">${ICONS.home}<span>Home</span></button>
      <button class="voc-bottom-item" data-target="cards" type="button">${ICONS.cards}<span>Flashcards</span></button>
      <button class="voc-bottom-item voc-add-fab" data-target="add" type="button" aria-label="Add word">${ICONS.plus}<span>Add</span></button>
      <button class="voc-bottom-item" data-target="mcq" type="button">${ICONS.quiz}<span>Quiz</span></button>
      <button class="voc-bottom-item" data-target="type" type="button">${ICONS.spelling}<span>Spelling</span></button>`;

    nav.addEventListener('click', (event) => {
      const btn = event.target.closest('.voc-bottom-item');
      if (!btn) return;
      const target = btn.dataset.target;
      if (target === 'add') openTab('my');
      else openTab(target);
      setTimeout(syncBottomNav, 0);
    });
    document.body.appendChild(nav);
    syncBottomNav();
  }

  function subnavMarkup(active) {
    return `
      <div class="voc-home-subnav" data-voc-subnav>
        <button type="button" data-sub="home" class="${active === 'home' ? 'active' : ''}">Overview</button>
        <button type="button" data-sub="list" class="${active === 'list' ? 'active' : ''}">Browse</button>
        <button type="button" data-sub="dict" class="${active === 'dict' ? 'active' : ''}">AI Search</button>
      </div>`;
  }

  function ensureSubnav(panelId, active) {
    const panel = document.getElementById(panelId);
    if (!panel || panel.querySelector('[data-voc-subnav]')) return;
    panel.insertAdjacentHTML('afterbegin', subnavMarkup(active));
    const nav = panel.querySelector('[data-voc-subnav]');
    nav.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-sub]');
      if (!btn) return;
      openTab(btn.dataset.sub);
    });
  }

  function watchHomeSubnavs() {
    const targets = [
      ['p-home', 'home'],
      ['p-list', 'list'],
      ['p-dict', 'dict']
    ];
    targets.forEach(([id, active]) => {
      const panel = document.getElementById(id);
      if (!panel) return;
      ensureSubnav(id, active);
      const observer = new MutationObserver(() => ensureSubnav(id, active));
      observer.observe(panel, { childList: true });
    });
  }

  function moreItem(icon, label, value, extra = '') {
    return `<button type="button" class="voc-more-item" ${extra}>${icon}<span>${label}</span>${value ? `<span class="value">${value}</span>` : ''}</button>`;
  }

  function updateThemeValue() {
    const value = document.querySelector('#vocMoreTheme .value');
    if (value) value.textContent = document.body.classList.contains('light') ? 'Light' : 'Dark';
  }

  function createMoreMenu() {
    const buttons = document.querySelector('.hbtns');
    if (!buttons || document.getElementById('vocMoreBtn')) return;

    const more = document.createElement('button');
    more.id = 'vocMoreBtn';
    more.className = 'iconbtn voc-more-btn';
    more.type = 'button';
    more.title = 'More';
    more.setAttribute('aria-label', 'More options');
    more.setAttribute('aria-expanded', 'false');
    more.textContent = '⋯';

    const menu = document.createElement('div');
    menu.id = 'vocMoreMenu';
    menu.className = 'voc-more-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      ${moreItem(ICONS.filter, 'Filters', '')}
      ${moreItem(ICONS.instagram, 'Instagram', '@voclab_sa')}
      <div class="voc-more-sep"></div>
      ${moreItem(ICONS.theme, 'Theme', document.body.classList.contains('light') ? 'Light' : 'Dark')}
      ${moreItem(ICONS.language, 'Language', 'English', 'aria-disabled="true" title="English is the only active interface language in the current build"')}`;

    const items = menu.querySelectorAll('.voc-more-item');
    items[0].id = 'vocMoreFilters';
    items[1].id = 'vocMoreInstagram';
    items[2].id = 'vocMoreTheme';
    items[3].id = 'vocMoreLanguage';

    function close() {
      menu.classList.remove('open');
      more.setAttribute('aria-expanded', 'false');
    }

    more.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = !menu.classList.contains('open');
      menu.classList.toggle('open', open);
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      updateThemeValue();
    });

    items[0].addEventListener('click', () => {
      close();
      document.getElementById('btnDrawer')?.click();
    });
    items[1].addEventListener('click', () => {
      close();
      window.open(INSTAGRAM_URL, '_blank', 'noopener,noreferrer');
    });
    items[2].addEventListener('click', () => {
      document.getElementById('btnTheme')?.click();
      updateThemeValue();
      close();
    });
    items[3].addEventListener('click', (event) => event.preventDefault());

    document.addEventListener('click', (event) => {
      if (!menu.contains(event.target) && event.target !== more) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    buttons.appendChild(more);
    buttons.appendChild(menu);
  }

  function normalizeAccountButton() {
    const btn = document.getElementById('vocAuthBtn');
    if (!btn) return;
    btn.classList.add('voc-header-account');
    if (!btn.querySelector('.voc-auth-badge')) {
      const badge = document.createElement('span');
      badge.className = 'voc-auth-badge';
      badge.textContent = 'FREE';
      btn.appendChild(badge);
    }
  }

  function watchHeader() {
    const buttons = document.querySelector('.hbtns');
    if (!buttons) return;
    normalizeAccountButton();
    createMoreMenu();
    const observer = new MutationObserver(() => {
      normalizeAccountButton();
      createMoreMenu();
    });
    observer.observe(buttons, { childList: true, subtree: true });
  }

  function bindNavigationSync() {
    document.addEventListener('click', (event) => {
      if (event.target.closest('.tab')) setTimeout(syncBottomNav, 0);
    });
  }

  function start() {
    createBottomNav();
    watchHomeSubnavs();
    watchHeader();
    bindNavigationSync();
    syncBottomNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
