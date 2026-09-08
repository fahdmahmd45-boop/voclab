(() => {
  'use strict';

  const KEY = 'voclab_ui_language';
  const originalText = new WeakMap();
  const originalPlaceholder = new WeakMap();
  let applying = false;
  let lang = 'en';

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
    'Create a custom category':'إنشاء مجموعة مخصصة',
    'Choose a deck to begin.':'اختر مجموعة للبدء.',
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
    'Score:':'النتيجة:',
    'Need at least 4 words in this filter.':'تحتاج إلى 4 كلمات على الأقل في هذا الاختيار.',
    'No words due for review right now — great job! Check back later, or pick another deck.':'لا توجد كلمات مستحقة للمراجعة الآن — ممتاز! ارجع لاحقًا أو اختر مجموعة أخرى.',
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
    'Back':'رجوع',
    'Exit':'خروج',
    'Theme':'المظهر',
    'Your name':'اسمك',
    'Change name':'تغيير الاسم',
    'noun':'اسم','verb':'فعل','adjective':'صفة','adverb':'حال','phrase':'عبارة','conjunction':'أداة ربط','preposition':'حرف جر','pronoun':'ضمير','determiner':'محدد','number':'عدد','exclamation':'تعجب','modal verb':'فعل مساعد','article':'أداة'
  }));

  const PH = new Map(Object.entries({
    'Search a word...':'ابحث عن كلمة...',
    'Search a word':'ابحث عن كلمة',
    'From':'من','To':'إلى','Word':'الكلمة',
    'Arabic meaning':'المعنى بالعربي',
    'Meaning in Arabic':'المعنى بالعربي',
    'Example sentence':'مثال في جملة',
    'Deck name':'اسم المجموعة',
    'Your name':'اسمك',
    'Email address':'البريد الإلكتروني'
  }));

  function injectStyle(){
    if(document.getElementById('vocLangFixStyles')) return;
    const s=document.createElement('style');
    s.id='vocLangFixStyles';
    s.textContent=`
      html[dir="rtl"] body{font-family:var(--ar),var(--ui)}
      html[dir="rtl"] .tabs,html[dir="rtl"] .hwrap,html[dir="rtl"] .hhead,html[dir="rtl"] .filters,html[dir="rtl"] .dhead{direction:rtl}
      html[dir="rtl"] .word,html[dir="rtl"] .dword,html[dir="rtl"] .dphon,html[dir="rtl"] .ex,html[dir="rtl"] .fex,html[dir="rtl"] .qex,html[dir="rtl"] .bex,html[dir="rtl"] .dex{direction:ltr}
      html[dir="rtl"] .fcard .word,html[dir="rtl"] .qword .word,html[dir="rtl"] .dword{text-align:center}
      html[dir="rtl"] .voc-session-back svg{transform:rotate(180deg)}
      html[dir="rtl"] input.search,html[dir="rtl"] .tin{direction:ltr;text-align:left}
    `;
    document.head.appendChild(s);
  }

  function translate(raw){
    const t=String(raw??'').trim();
    if(!t) return raw;
    let out=AR.get(t);
    let m;
    if(!out && (m=t.match(/^Hello,\s*(.+)$/))) out=`مرحبًا، ${m[1]}`;
    if(!out && (m=t.match(/^(Good morning|Good afternoon|Good evening)\s*·\s*Daily practice$/))) out=`${AR.get(m[1])} · تدريب يومي`;
    if(!out && (m=t.match(/^(\d+)\s+of\s+(\d+)\s+words mastered$/))) out=`${m[1]} من ${m[2]} كلمة متقنة`;
    if(!out && (m=t.match(/^Round complete\s*—\s*(\d+)\s+words reviewed\.$/))) out=`اكتملت الجولة — تمت مراجعة ${m[1]} كلمة.`;
    if(!out && (m=t.match(/^Word\s+(\d+)\s+of\s+(\d+)(.*)$/))) out=`الكلمة ${m[1]} من ${m[2]}${m[3]||''}`;
    if(!out && (m=t.match(/^Resend in\s+(\d+)s$/))) out=`إعادة الإرسال خلال ${m[1]} ث`;
    if(!out && (m=t.match(/^(.+)\s+—\s+Restore$/))) out=`${m[1]} — استعادة`;
    if(!out && (m=t.match(/^(\d+)\s+words$/))) out=`${m[1]} كلمة`;
    if(!out && t.includes('Hard = soon again') && t.includes('Medium = a few days') && t.includes('Easy = about a week')){
      out=t.replace(/^Word\s+(\d+)\s+of\s+(\d+)/,'الكلمة $1 من $2')
        .replace('Hard = soon again','صعب = قريبًا')
        .replace('Medium = a few days','متوسط = بعد بضعة أيام')
        .replace('Easy = about a week','سهل = بعد نحو أسبوع');
    }
    if(!out) return raw;
    const i=String(raw).indexOf(t);
    return String(raw).slice(0,i)+out+String(raw).slice(i+t.length);
  }

  function skip(node){
    const p=node.parentElement;
    if(!p) return true;
    if(p.closest('script,style,noscript,svg')) return true;
    if(p.closest('.word,.dword,.dphon,.dar,.m,.ex,.fex,.qex,.bex,.dex,.dpos li,.hquote,.voc-instagram-user,.voc-footer-brand,.voc-footer-mark,.nbrand,.voc-auth-brand')) return true;
    return false;
  }

  function applyNode(node){
    if(skip(node)) return;
    if(!originalText.has(node)) originalText.set(node,node.nodeValue);
    const en=originalText.get(node);
    node.nodeValue=lang==='ar'?translate(en):en;
  }

  function applyRoot(root=document.body){
    if(applying||!root) return;
    applying=true;
    try{
      if(root.nodeType===Node.TEXT_NODE) applyNode(root);
      else if(root.nodeType===Node.ELEMENT_NODE || root===document.body){
        const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
        let n; while((n=w.nextNode())) applyNode(n);
      }
      const base=root.querySelectorAll?root:document;
      const fields=[];
      if(root.matches?.('input[placeholder],textarea[placeholder]')) fields.push(root);
      fields.push(...base.querySelectorAll('input[placeholder],textarea[placeholder]'));
      fields.forEach(f=>{
        if(!originalPlaceholder.has(f)) originalPlaceholder.set(f,f.getAttribute('placeholder')||'');
        const en=originalPlaceholder.get(f);
        f.setAttribute('placeholder',lang==='ar'?(PH.get(en)||en):en);
      });
      explicit();
    }finally{applying=false;}
  }

  function explicit(){
    const btn=document.getElementById('vocLangBtn');
    if(btn){
      const label=btn.querySelector('.voc-lang-label');
      if(label) label.textContent=lang==='ar'?'EN':'العربية';
      btn.title=lang==='ar'?'Switch site language to English':'Switch site language to Arabic';
      btn.setAttribute('aria-label',btn.title);
    }
    const back=document.querySelector('#vocSessionBack span');
    if(back) back.textContent=lang==='ar'?'رجوع':'Back';
    const copy=document.querySelector('.voc-footer-copy');
    if(copy){const y=copy.dataset.year||new Date().getFullYear();copy.textContent=lang==='ar'?`© ${y} Voclab. جميع الحقوق محفوظة.`:`© ${y} Voclab. All rights reserved.`;}
  }

  function setLanguage(next){
    lang=next==='ar'?'ar':'en';
    try{localStorage.setItem(KEY,lang);}catch(_){ }
    document.documentElement.lang=lang;
    document.documentElement.dir=lang==='ar'?'rtl':'ltr';
    document.body.classList.toggle('voc-ar',lang==='ar');
    applyRoot(document.body);
  }

  function replaceButton(){
    const old=document.getElementById('vocLangBtn');
    if(!old) return false;
    const fresh=old.cloneNode(true);
    old.replaceWith(fresh);
    fresh.addEventListener('click',(e)=>{
      e.preventDefault();e.stopPropagation();
      setLanguage(lang==='ar'?'en':'ar');
    });
    return true;
  }

  function boot(){
    injectStyle();
    let tries=0;
    const ready=()=>{
      tries++;
      if(replaceButton()){
        try{lang=localStorage.getItem(KEY)==='ar'?'ar':'en';}catch(_){lang='en';}
        setLanguage(lang);
        const mo=new MutationObserver(ms=>{
          if(lang!=='ar'||applying) return;
          ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===Node.ELEMENT_NODE||n.nodeType===Node.TEXT_NODE) applyRoot(n);}));
        });
        mo.observe(document.body,{childList:true,subtree:true});
      }else if(tries<40){setTimeout(ready,100);}
    };
    ready();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
