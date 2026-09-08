(() => {
  'use strict';

  if (window.__VOC_LANGUAGE_FOOTER_V1__) return;
  window.__VOC_LANGUAGE_FOOTER_V1__ = true;

  let lang = 'en';
  let applying = false;
  const originalText = new WeakMap();
  const originalPlaceholder = new WeakMap();

  const ICON_GLOBE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"></path></svg>';
  const ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle></svg>';

  const AR = new Map(Object.entries({
    'English vocabulary trainer':'مدرب مفردات اللغة الإنجليزية',
    'words mastered':'كلمة متقنة',
    'Home':'الرئيسية',
    'AI Search':'بحث بالذكاء الاصطناعي',
    'Browse':'تصفح',
    'Flashcards':'البطاقات',
    'Quiz':'الاختبار',
    'Spelling':'الإملاء',
    'Add Word':'إضافة كلمة',
    'Filters':'الفلاتر',
    'Apply':'تطبيق',
    'All decks':'كل المجموعات',
    'Oxford 3000 (A1–B2)':'أكسفورد 3000 (A1–B2)',
    'Added Words':'الكلمات المضافة',
    'Custom decks':'المجموعات المخصصة',
    'All units':'كل الوحدات',
    'All words':'كل الكلمات',
    'Not mastered':'غير متقنة',
    'Mastered':'متقنة',
    'Decks':'المجموعات',
    'Hidden decks':'المجموعات المخفية',
    'Edit':'تعديل',
    'Done':'تم',
    'New deck':'مجموعة جديدة',
    'Create a custom category':'إنشاء مجموعة مخصصة',
    'Choose a deck to begin.':'اختر مجموعة للبدء.',
    'Choose another deck':'اختر مجموعة أخرى',
    'Words today:':'كلمات اليوم:',
    'Review range':'مراجعة نطاق',
    'Tap to reveal':'اضغط لإظهار الإجابة',
    'Tap to flip':'اضغط لقلب البطاقة',
    'Hard':'صعب',
    'Medium':'متوسط',
    'Easy':'سهل',
    'Listen':'استماع',
    'New round':'جولة جديدة',
    'Try again':'حاول مرة أخرى',
    'Next':'التالي',
    'Check':'تحقق',
    'Search':'بحث',
    'Add':'إضافة',
    'Delete':'حذف',
    'Restore':'استعادة',
    'Known':'متقنة',
    'Unknown':'غير متقنة',
    'Need at least 4 words in this filter.':'تحتاج إلى 4 كلمات على الأقل في هذا الاختيار.',
    'No words due for review right now — great job! Check back later, or pick another deck.':'لا توجد كلمات مستحقة للمراجعة الآن — ممتاز! ارجع لاحقًا أو اختر مجموعة أخرى.',
    'No words match this filter.':'لا توجد كلمات تطابق هذا الاختيار.',
    'Good morning':'صباح الخير',
    'Good afternoon':'مساء الخير',
    'Good evening':'مساء الخير',
    'Daily practice':'تدريب يومي',
    'Sign in':'تسجيل الدخول',
    'Sign out':'تسجيل الخروج',
    'Your learning account':'حسابك التعليمي',
    'Your account':'حسابك',
    'Email':'البريد الإلكتروني',
    'Plan':'الخطة',
    'Verified':'موثّق',
    'Enter your code':'أدخل رمز التحقق',
    'Verification code':'رمز التحقق',
    'Verify & continue':'تحقق وتابع',
    'Resend code':'إعادة إرسال الرمز',
    'Use a different email':'استخدم بريدًا آخر',
    'Upgrade coming soon':'الترقية قريبًا',
    'Close':'إغلاق',
    'Change name':'تغيير الاسم',
    'Exit':'خروج'
  }));

  const AR_PLACEHOLDER = new Map(Object.entries({
    'Search a word...':'ابحث عن كلمة...',
    'Search a word':'ابحث عن كلمة',
    'From':'من',
    'To':'إلى',
    'Word':'الكلمة',
    'Arabic meaning':'المعنى بالعربي',
    'Meaning in Arabic':'المعنى بالعربي',
    'Example sentence':'مثال في جملة',
    'Deck name':'اسم المجموعة',
    'Your name':'اسمك',
    'Email address':'البريد الإلكتروني'
  }));

  function injectStyles(){
    if (document.getElementById('vocLanguageFooterStyles')) return;
    const style = document.createElement('style');
    style.id = 'vocLanguageFooterStyles';
    style.textContent = `
      .voc-lang-btn{width:38px;min-width:38px;height:36px;padding:0!important;justify-content:center;gap:3px;white-space:nowrap}
      .voc-lang-code{font-size:10px;font-weight:700;letter-spacing:.05em;line-height:1}
      .voc-footer{width:100%;border-top:1px solid var(--line);padding:27px 16px calc(27px + env(safe-area-inset-bottom));text-align:center;color:var(--mut);background:var(--bg)}
      .voc-footer-inner{width:100%;max-width:860px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:8px}
      .voc-footer-mark{width:27px;height:27px;border:1px solid color-mix(in srgb,var(--amber) 55%,var(--line));border-radius:9px;display:grid;place-items:center;font-family:var(--en);font-size:17px;font-weight:600;color:var(--amber);background:var(--card)}
      .voc-footer-brand{font-family:var(--en);font-size:16px;font-weight:600;color:var(--tx)}
      .voc-instagram-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:8px 13px;border:1px solid var(--line);border-radius:11px;background:var(--card);color:var(--tx);text-decoration:none;font-size:13px;font-weight:600;transition:border-color .15s,transform .1s}
      .voc-instagram-btn:hover{border-color:var(--amber)}
      .voc-instagram-btn:active{transform:scale(.97)}
      .voc-footer-copy{font-size:11.5px;line-height:1.55}
      html[dir="rtl"] body{font-family:var(--ar),var(--ui)}
      html[dir="rtl"] .hwrap,html[dir="rtl"] .hbtns,html[dir="rtl"] .tabs,html[dir="rtl"] .hgrid,html[dir="rtl"] .fcbtns{direction:ltr}
      html[dir="rtl"] .word,html[dir="rtl"] .dword,html[dir="rtl"] .dphon,html[dir="rtl"] .ex,html[dir="rtl"] .fex,html[dir="rtl"] .qex,html[dir="rtl"] .bex,html[dir="rtl"] .dex{direction:ltr}
      html[dir="rtl"] .voc-deck-back svg{transform:rotate(180deg)}
      @media(max-width:640px){.voc-lang-btn{width:34px;min-width:34px;height:34px}}
      @media(max-width:430px){.voc-footer{padding-top:24px}.voc-lang-btn{width:32px;min-width:32px}}
    `;
    document.head.appendChild(style);
  }

  function createLanguageButton(){
    const buttons = document.querySelector('.hbtns');
    if (!buttons || document.getElementById('vocLangBtn')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'vocLangBtn';
    btn.className = 'iconbtn voc-lang-btn';
    btn.innerHTML = `${ICON_GLOBE}<span class="voc-lang-code">AR</span>`;
    const theme = document.getElementById('btnTheme');
    if (theme) buttons.insertBefore(btn,theme); else buttons.appendChild(btn);
    btn.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();setLanguage(lang==='en'?'ar':'en')});
    updateLanguageButton();
  }

  function createFooter(){
    if (document.getElementById('vocFooter')) return;
    const footer = document.createElement('footer');
    footer.id = 'vocFooter';
    footer.className = 'voc-footer';
    footer.innerHTML = `<div class="voc-footer-inner"><div class="voc-footer-mark" aria-hidden="true">V</div><div class="voc-footer-brand">voclab</div><a class="voc-instagram-btn" href="https://www.instagram.com/voclab_sa/" target="_blank" rel="noopener noreferrer" aria-label="voclab on Instagram">${ICON_INSTAGRAM}<span>@voclab_sa</span></a><div class="voc-footer-copy">© 2026 voclab. All rights reserved.</div></div>`;
    document.body.appendChild(footer);
  }

  function translateString(value){
    const raw=String(value??'');const trimmed=raw.trim();if(!trimmed)return raw;
    let out=AR.get(trimmed)||'';let match;
    if(!out&&(match=trimmed.match(/^([😣🙂😄])\s*(Hard|Medium|Easy)$/)))out=`${match[1]} ${AR.get(match[2])}`;
    if(!out&&(match=trimmed.match(/^Hello,\s*(.+)$/)))out=`مرحبًا، ${match[1]}`;
    if(!out&&(match=trimmed.match(/^(Good morning|Good afternoon|Good evening)\s*·\s*Daily practice$/)))out=`${AR.get(match[1])} · تدريب يومي`;
    if(!out&&(match=trimmed.match(/^(\d+)\s+of\s+(\d+)\s+words mastered$/)))out=`${match[1]} من ${match[2]} كلمة متقنة`;
    if(!out&&(match=trimmed.match(/^Round complete\s*—\s*(\d+)\s+words reviewed\.$/)))out=`اكتملت الجولة — تمت مراجعة ${match[1]} كلمة.`;
    if(!out&&(match=trimmed.match(/^Word\s+(\d+)\s+of\s+(\d+)(.*)$/)))out=`الكلمة ${match[1]} من ${match[2]}${match[3]||''}`;
    if(!out&&(match=trimmed.match(/^(\d+)\s+words$/)))out=`${match[1]} كلمة`;
    if(!out)return raw;const start=raw.indexOf(trimmed);return raw.slice(0,start)+out+raw.slice(start+trimmed.length);
  }

  function skipText(node){
    const parent=node.parentElement;if(!parent)return true;
    if(parent.closest('script,style,noscript,svg'))return true;
    if(parent.closest('.word,.dword,.dphon,.dar,.m,.ex,.fex,.qex,.bex,.dex,.dpos li,.hquote,.ht,.hsub,.voc-footer-brand,.voc-footer-mark'))return true;
    return false;
  }

  function applyNode(node){if(skipText(node))return;if(!originalText.has(node))originalText.set(node,node.nodeValue);const english=originalText.get(node);node.nodeValue=lang==='ar'?translateString(english):english}
  function applyText(root){if(!root)return;if(root.nodeType===Node.TEXT_NODE){applyNode(root);return}if(root.nodeType!==Node.ELEMENT_NODE&&root!==document.body)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))applyNode(node)}
  function applyPlaceholders(root){const scope=root?.querySelectorAll?root:document;const fields=[];if(root?.matches?.('input[placeholder],textarea[placeholder]'))fields.push(root);fields.push(...scope.querySelectorAll('input[placeholder],textarea[placeholder]'));fields.forEach(field=>{if(!originalPlaceholder.has(field))originalPlaceholder.set(field,field.getAttribute('placeholder')||'');const english=originalPlaceholder.get(field);field.setAttribute('placeholder',lang==='ar'?(AR_PLACEHOLDER.get(english)||english):english)})}
  function updateLanguageButton(){const btn=document.getElementById('vocLangBtn');if(!btn)return;const code=btn.querySelector('.voc-lang-code');if(code)code.textContent=lang==='ar'?'EN':'AR';const title=lang==='ar'?'Switch site language to English':'Switch site language to Arabic';btn.title=title;btn.setAttribute('aria-label',title)}
  function updateExplicitUi(){updateLanguageButton();const copy=document.querySelector('.voc-footer-copy');if(copy)copy.textContent=lang==='ar'?'© 2026 voclab. جميع الحقوق محفوظة.':'© 2026 voclab. All rights reserved.';const insta=document.querySelector('.voc-instagram-btn');if(insta)insta.setAttribute('aria-label',lang==='ar'?'voclab على إنستغرام':'voclab on Instagram');document.querySelectorAll('.voc-deck-back').forEach(btn=>{const label=btn.querySelector('span');if(label)label.textContent=lang==='ar'?'اختر مجموعة أخرى':'Choose another deck';const title=lang==='ar'?'الرجوع لاختيار المجموعة':'Back to deck selection';btn.title=title;btn.setAttribute('aria-label',title)})}
  function applyLanguage(root=document.body){if(applying||!root)return;applying=true;try{applyText(root);applyPlaceholders(root);updateExplicitUi()}finally{applying=false}}
  function setLanguage(next){lang=next==='ar'?'ar':'en';document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';applyLanguage(document.body)}
  function observeDynamicUi(){const observer=new MutationObserver(mutations=>{if(applying||lang!=='ar')return;mutations.forEach(mutation=>mutation.addedNodes.forEach(node=>{if(node.nodeType===Node.ELEMENT_NODE||node.nodeType===Node.TEXT_NODE)applyLanguage(node)}))});observer.observe(document.body,{childList:true,subtree:true})}
  function start(){injectStyles();createLanguageButton();createFooter();observeDynamicUi();setLanguage('en')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
