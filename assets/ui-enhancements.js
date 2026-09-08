(() => {
  'use strict';

  const VERSION = '__VOC_UI_ENHANCEMENTS_V2__';
  if (window[VERSION]) return;
  window[VERSION] = true;

  const state = {
    lang: 'en',
    navStack: [],
    ignoreNextTabRecord: false,
    applyingLanguage: false
  };

  const originalText = new WeakMap();
  const originalPlaceholder = new WeakMap();
  const ICON_GLOBE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path></svg>';
  const ICON_BACK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>';
  const ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle></svg>';

  const AR = new Map(Object.entries({
    'English vocabulary trainer': 'مدرب مفردات اللغة الإنجليزية',
    'words mastered': 'كلمة متقنة',
    'Home': 'الرئيسية',
    'AI Search': 'بحث بالذكاء الاصطناعي',
    'Browse': 'تصفح',
    'Flashcards': 'البطاقات',
    'Quiz': 'الاختبار',
    'Spelling': 'الإملاء',
    'Add Word': 'إضافة كلمة',
    'Filters': 'الفلاتر',
    'Apply': 'تطبيق',
    'All decks': 'كل المجموعات',
    'Oxford 3000 (A1–B2)': 'أكسفورد 3000 (A1–B2)',
    'Added Words': 'الكلمات المضافة',
    'Custom decks': 'المجموعات المخصصة',
    'All units': 'كل الوحدات',
    'All words': 'كل الكلمات',
    'Not mastered': 'غير متقنة',
    'Mastered': 'متقنة',
    'Decks': 'المجموعات',
    'Hidden decks': 'المجموعات المخفية',
    'Edit': 'تعديل',
    'Done': 'تم',
    'Create a custom category': 'إنشاء مجموعة مخصصة',
    'Choose a deck to begin.': 'اختر مجموعة للبدء.',
    'Words today:': 'كلمات اليوم:',
    'Review range': 'مراجعة نطاق',
    'Tap to reveal': 'اضغط لإظهار الإجابة',
    'Tap to flip': 'اضغط لقلب البطاقة',
    'Hard': 'صعب',
    'Medium': 'متوسط',
    'Easy': 'سهل',
    'Listen': 'استماع',
    'New round': 'جولة جديدة',
    'Try again': 'حاول مرة أخرى',
    'Next': 'التالي',
    'Check': 'تحقق',
    'Search': 'بحث',
    'Add': 'إضافة',
    'Delete': 'حذف',
    'Restore': 'استعادة',
    'Known': 'متقنة',
    'Unknown': 'غير متقنة',
    'Score:': 'النتيجة:',
    'Need at least 4 words in this filter.': 'تحتاج إلى 4 كلمات على الأقل في هذا الاختيار.',
    'No words due for review right now — great job! Check back later, or pick another deck.': 'لا توجد كلمات مستحقة للمراجعة الآن — ممتاز! ارجع لاحقًا أو اختر مجموعة أخرى.',
    'Good morning': 'صباح الخير',
    'Good afternoon': 'مساء الخير',
    'Good evening': 'مساء الخير',
    'Daily practice': 'تدريب يومي',
    'Sign in': 'تسجيل الدخول',
    'Sign out': 'تسجيل الخروج',
    'Your learning account': 'حسابك التعليمي',
    'Your account': 'حسابك',
    'Email': 'البريد الإلكتروني',
    'Plan': 'الخطة',
    'Verified': 'موثّق',
    'Enter your code': 'أدخل رمز التحقق',
    'Verification code': 'رمز التحقق',
    'Verify & continue': 'تحقق وتابع',
    'Resend code': 'إعادة إرسال الرمز',
    'Use a different email': 'استخدم بريدًا آخر',
    'Upgrade coming soon': 'الترقية قريبًا',
    'Close': 'إغلاق',
    'Change name': 'تغيير الاسم',
    'Exit': 'خروج',
    'Back': 'رجوع',
    'noun': 'اسم',
    'verb': 'فعل',
    'adjective': 'صفة',
    'adverb': 'حال',
    'phrase': 'عبارة',
    'conjunction': 'أداة ربط',
    'preposition': 'حرف جر',
    'pronoun': 'ضمير',
    'determiner': 'محدد',
    'number': 'عدد',
    'exclamation': 'تعجب',
    'modal verb': 'فعل مساعد',
    'article': 'أداة'
  }));

  const PLACEHOLDERS_AR = new Map(Object.entries({
    'Search a word...': 'ابحث عن كلمة...',
    'Search a word': 'ابحث عن كلمة',
    'From': 'من',
    'To': 'إلى',
    'Word': 'الكلمة',
    'Arabic meaning': 'المعنى بالعربي',
    'Meaning in Arabic': 'المعنى بالعربي',
    'Example sentence': 'مثال في جملة',
    'Deck name': 'اسم المجموعة',
    'Your name': 'اسمك',
    'Email address': 'البريد الإلكتروني'
  }));

  function injectStyles() {
    if (document.getElementById('vocUiEnhancementStyles')) return;
    const style = document.createElement('style');
    style.id = 'vocUiEnhancementStyles';
    style.textContent = `
      .voc-lang-btn{width:38px;min-width:38px;height:36px;padding:0!important;justify-content:center;gap:3px;white-space:nowrap}
      .voc-lang-btn .voc-lang-code{font-size:10px;font-weight:700;letter-spacing:.05em;line-height:1}
      .voc-session-back-wrap{display:none;width:100%;max-width:560px;margin:-7px auto 12px;position:sticky;top:72px;z-index:24;pointer-events:none}
      .voc-session-back{pointer-events:auto;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:color-mix(in srgb,var(--hd) 94%,transparent);backdrop-filter:blur(10px);color:var(--tx);border-radius:10px;padding:8px 11px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:var(--shadow);transition:border-color .15s,transform .1s,background-color .3s,color .3s}
      .voc-session-back:hover{border-color:var(--amber)}
      .voc-session-back:active{transform:scale(.96)}
      .voc-session-back svg{flex:none}
      .voc-footer{width:100%;border-top:1px solid var(--line);padding:28px 16px calc(28px + env(safe-area-inset-bottom));text-align:center;color:var(--mut);background:var(--bg)}
      .voc-footer-inner{width:100%;max-width:860px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:9px}
      .voc-footer-mark{width:27px;height:27px;border:1px solid color-mix(in srgb,var(--amber) 55%,var(--line));border-radius:9px;display:grid;place-items:center;font-family:var(--en);font-size:17px;font-weight:600;color:var(--amber);background:var(--card)}
      .voc-footer-brand{font-family:var(--en);font-size:16px;font-weight:600;color:var(--tx);letter-spacing:.2px}
      .voc-instagram-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:8px 13px;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--tx);text-decoration:none;font-size:13px;font-weight:600;transition:border-color .15s,transform .1s}
      .voc-instagram-btn:hover{border-color:var(--amber)}
      .voc-instagram-btn:active{transform:scale(.97)}
      .voc-footer-copy{font-size:11.5px;line-height:1.55}
      html[dir="rtl"] body{font-family:var(--ar),var(--ui)}
      html[dir="rtl"] .hwrap,html[dir="rtl"] .tabs,html[dir="rtl"] .hgrid,html[dir="rtl"] .fcbtns,html[dir="rtl"] .dsearch{direction:ltr}
      html[dir="rtl"] .voc-session-back svg{transform:rotate(180deg)}
      html[dir="rtl"] .word,html[dir="rtl"] .dword,html[dir="rtl"] .dphon,html[dir="rtl"] .ex,html[dir="rtl"] .fex,html[dir="rtl"] .qex,html[dir="rtl"] .bex,html[dir="rtl"] .dex{direction:ltr}
      html[dir="rtl"] .fcard .word,html[dir="rtl"] .qword .word,html[dir="rtl"] .dword{text-align:center}
      html[dir="rtl"] input.search,html[dir="rtl"] .tin{direction:ltr;text-align:left}
      @media(max-width:640px){
        .voc-session-back-wrap{top:66px;margin-top:-8px}
        .voc-lang-btn{width:36px;min-width:36px;height:34px}
      }
      @media(max-width:430px){
        .voc-footer{padding-top:24px}
        .voc-session-back{padding:8px 10px}
      }
    `;
    document.head.appendChild(style);
  }

  function createLanguageButton() {
    const buttons = document.querySelector('.hbtns');
    if (!buttons) return;
    let btn = document.getElementById('vocLangBtn');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'vocLangBtn';
      btn.className = 'iconbtn voc-lang-btn';
      btn.innerHTML = `${ICON_GLOBE}<span class="voc-lang-code">AR</span>`;
      const theme = document.getElementById('btnTheme');
      if (theme) buttons.insertBefore(btn, theme);
      else buttons.appendChild(btn);
    }
    if (btn.dataset.vocBound !== '1') {
      btn.dataset.vocBound = '1';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setLanguage(state.lang === 'en' ? 'ar' : 'en');
      });
    }
    updateLanguageButton();
  }

  function createBackControl() {
    const main = document.querySelector('main');
    const tabs = main?.querySelector('.tabs');
    if (!main || !tabs || document.getElementById('vocSessionBackWrap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'vocSessionBackWrap';
    wrap.className = 'voc-session-back-wrap';
    wrap.innerHTML = `<button type="button" id="vocSessionBack" class="voc-session-back" aria-label="Back">${ICON_BACK}<span>Back</span></button>`;
    tabs.insertAdjacentElement('afterend', wrap);
    wrap.querySelector('#vocSessionBack').addEventListener('click', goBackOnePanel);
  }

  function createFooter() {
    if (document.getElementById('vocFooter')) return;
    const footer = document.createElement('footer');
    footer.id = 'vocFooter';
    footer.className = 'voc-footer';
    const year = 2026;
    footer.innerHTML = `
      <div class="voc-footer-inner">
        <div class="voc-footer-mark" aria-hidden="true">V</div>
        <div class="voc-footer-brand">voclab</div>
        <a class="voc-instagram-btn" href="https://www.instagram.com/voclab_sa/" target="_blank" rel="noopener noreferrer" aria-label="voclab on Instagram">${ICON_INSTAGRAM}<span class="voc-instagram-user">@voclab_sa</span></a>
        <div class="voc-footer-copy" data-year="${year}">© ${year} voclab. All rights reserved.</div>
      </div>`;
    document.body.appendChild(footer);
  }

  function getCurrentPanel() {
    return document.querySelector('.tab.on[data-p]')?.dataset.p || 'home';
  }

  function bindNavigationHistory() {
    state.navStack.length = 0;
    document.addEventListener('click', (event) => {
      const tab = event.target.closest?.('.tab[data-p]');
      if (!tab) return;
      const current = getCurrentPanel();
      const next = tab.dataset.p;
      if (state.ignoreNextTabRecord) {
        state.ignoreNextTabRecord = false;
      } else if (current && next && current !== next) {
        if (state.navStack[state.navStack.length - 1] !== current) state.navStack.push(current);
        if (state.navStack.length > 20) state.navStack.shift();
      }
      setTimeout(() => {
        syncBackControl();
        if (state.lang === 'ar') applyLanguageToDom(document.body);
      }, 0);
    }, true);
    syncBackControl();
  }

  function goBackOnePanel() {
    const current = getCurrentPanel();
    let target = state.navStack.pop();
    while (target === current) target = state.navStack.pop();
    if (!target || !document.querySelector(`.tab[data-p="${target}"]`)) target = 'home';
    const tab = document.querySelector(`.tab[data-p="${target}"]`) || document.querySelector('.tab[data-p="home"]');
    if (!tab) return;
    state.ignoreNextTabRecord = true;
    tab.click();
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { window.scrollTo(0, 0); }
  }

  function syncBackControl() {
    const wrap = document.getElementById('vocSessionBackWrap');
    if (!wrap) return;
    const active = getCurrentPanel();
    wrap.style.display = (active === 'cards' || active === 'mcq') ? 'block' : 'none';
    const button = document.getElementById('vocSessionBack');
    if (button) {
      const label = button.querySelector('span');
      if (label) label.textContent = state.lang === 'ar' ? 'رجوع' : 'Back';
      const title = state.lang === 'ar' ? 'الرجوع للصفحة السابقة' : 'Back to previous page';
      button.title = title;
      button.setAttribute('aria-label', title);
    }
  }

  function translateString(value) {
    const raw = String(value ?? '');
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    let out = AR.get(trimmed) || '';
    let match;

    if (!out && (match = trimmed.match(/^([😣🙂😄])\s*(Hard|Medium|Easy)$/))) {
      out = `${match[1]} ${AR.get(match[2])}`;
    }
    if (!out && (match = trimmed.match(/^Hello,\s*(.+)$/))) out = `مرحبًا، ${match[1]}`;
    if (!out && (match = trimmed.match(/^(Good morning|Good afternoon|Good evening)\s*·\s*Daily practice$/))) out = `${AR.get(match[1])} · تدريب يومي`;
    if (!out && (match = trimmed.match(/^(\d+)\s+of\s+(\d+)\s+words mastered$/))) out = `${match[1]} من ${match[2]} كلمة متقنة`;
    if (!out && (match = trimmed.match(/^Round complete\s*—\s*(\d+)\s+words reviewed\.$/))) out = `اكتملت الجولة — تمت مراجعة ${match[1]} كلمة.`;
    if (!out && (match = trimmed.match(/^Word\s+(\d+)\s+of\s+(\d+)(.*)$/))) out = `الكلمة ${match[1]} من ${match[2]}${match[3] || ''}`;
    if (!out && (match = trimmed.match(/^Resend in\s+(\d+)s$/))) out = `إعادة الإرسال خلال ${match[1]} ث`;
    if (!out && (match = trimmed.match(/^(.+)\s+—\s+Restore$/))) out = `${match[1]} — استعادة`;
    if (!out && (match = trimmed.match(/^(\d+)\s+words$/))) out = `${match[1]} كلمة`;
    if (!out && trimmed.includes('Hard = soon again') && trimmed.includes('Medium = a few days') && trimmed.includes('Easy = about a week')) {
      out = trimmed
        .replace(/^Word\s+(\d+)\s+of\s+(\d+)/, 'الكلمة $1 من $2')
        .replace('Hard = soon again', 'صعب = قريبًا')
        .replace('Medium = a few days', 'متوسط = بعد بضعة أيام')
        .replace('Easy = about a week', 'سهل = بعد نحو أسبوع');
    }

    if (!out) return raw;
    const startIndex = raw.indexOf(trimmed);
    return raw.slice(0, startIndex) + out + raw.slice(startIndex + trimmed.length);
  }

  function shouldSkipTextNode(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    if (parent.closest('script,style,noscript,svg')) return true;
    if (parent.closest('.word,.dword,.dphon,.dar,.m,.ex,.fex,.qex,.bex,.dex,.dpos li,.hquote,.ht,.hsub,.voc-instagram-user,.voc-footer-brand,.voc-footer-mark,.nbrand,.voc-auth-brand')) return true;
    return false;
  }

  function applyTextNode(node) {
    if (shouldSkipTextNode(node)) return;
    if (!originalText.has(node)) originalText.set(node, node.nodeValue);
    const english = originalText.get(node);
    node.nodeValue = state.lang === 'ar' ? translateString(english) : english;
  }

  function applyTextTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      applyTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root !== document.body) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) applyTextNode(node);
  }

  function applyPlaceholders(root) {
    const scope = root?.querySelectorAll ? root : document;
    const fields = [];
    if (root?.matches?.('input[placeholder],textarea[placeholder]')) fields.push(root);
    fields.push(...scope.querySelectorAll('input[placeholder],textarea[placeholder]'));
    fields.forEach((field) => {
      if (!originalPlaceholder.has(field)) originalPlaceholder.set(field, field.getAttribute('placeholder') || '');
      const english = originalPlaceholder.get(field);
      field.setAttribute('placeholder', state.lang === 'ar' ? (PLACEHOLDERS_AR.get(english) || english) : english);
    });
  }

  function updateLanguageButton() {
    const button = document.getElementById('vocLangBtn');
    if (!button) return;
    const code = button.querySelector('.voc-lang-code');
    if (code) code.textContent = state.lang === 'ar' ? 'EN' : 'AR';
    const title = state.lang === 'ar' ? 'Switch site language to English' : 'Switch site language to Arabic';
    button.title = title;
    button.setAttribute('aria-label', title);
  }

  function updateExplicitUi() {
    updateLanguageButton();
    syncBackControl();
    const copy = document.querySelector('.voc-footer-copy');
    if (copy) {
      const year = copy.dataset.year || '2026';
      copy.textContent = state.lang === 'ar' ? `© ${year} voclab. جميع الحقوق محفوظة.` : `© ${year} voclab. All rights reserved.`;
    }
    const instagram = document.querySelector('.voc-instagram-btn');
    if (instagram) instagram.setAttribute('aria-label', state.lang === 'ar' ? 'voclab على إنستغرام' : 'voclab on Instagram');
  }

  function applyLanguageToDom(root = document.body) {
    if (state.applyingLanguage || !root) return;
    state.applyingLanguage = true;
    try {
      applyTextTree(root);
      applyPlaceholders(root);
      updateExplicitUi();
    } finally {
      state.applyingLanguage = false;
    }
  }

  function setLanguage(lang) {
    state.lang = lang === 'ar' ? 'ar' : 'en';
    document.documentElement.lang = state.lang;
    document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
    document.body.classList.toggle('voc-ar', state.lang === 'ar');
    applyLanguageToDom(document.body);
  }

  function observeDynamicUi() {
    const observer = new MutationObserver((mutations) => {
      if (state.applyingLanguage) return;
      let needsBackSync = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') needsBackSync = true;
        if (state.lang !== 'ar') continue;
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) applyLanguageToDom(node);
        });
      }
      if (needsBackSync) syncBackControl();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    injectStyles();
    createLanguageButton();
    createBackControl();
    createFooter();
    bindNavigationHistory();
    observeDynamicUi();
    setLanguage('en');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
