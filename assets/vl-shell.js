/* VOC LAB: independent Search, desktop global entry and five-item mobile navigation.
   Existing tab handlers, account logic, decks, credits and files remain intact. */
(() => {
  'use strict';
  if(window.__VL_SHELL__)return;
  window.__VL_SHELL__=true;
  const DESTINATIONS=[
    {id:'home',label:'Home',subs:[['home','Overview']]},
    {id:'search',label:'Search',subs:[['dict','AI Search']]},
    {id:'library',label:'Library',subs:[['list','Decks'],['my','My words']]},
    {id:'study',label:'Study',subs:[['cards','Flashcards'],['mcq','Quiz'],['type','Spelling']]},
    {id:'create',label:'Create',subs:[['files','Import & Learn']]}
  ];
  const DEST_OF={home:'home',dict:'search',list:'library',my:'library',cards:'study',mcq:'study',type:'study',files:'create'};
  const STUDY=new Set(['cards','mcq','type']);
  const svg=(d)=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
  const ICON={
    home:svg('<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>'),
    search:svg('<circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4.5 4.5"/>'),
    library:svg('<path d="M5 4h4v16H5zM11 4h4v16h-4zM17 5l3 .8-3.6 14.4-3-.8"/>'),
    study:svg('<path d="M3 6c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0zM12 6c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0z"/>'),
    create:svg('<path d="M12 5v14M5 12h14"/>'),
    moon:svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    sun:svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'),
    filter:svg('<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>'),
    instagram:svg('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/>')
  };
  const memory={
    get(k){try{return sessionStorage.getItem('vl_'+k)}catch{return null}},
    set(k,v){try{sessionStorage.setItem('vl_'+k,v)}catch{}}
  };
  const activeTab=()=>document.querySelector('.tab.on')?.dataset.p||'home';
  const openTab=(name)=>document.querySelector('.tab[data-p="'+name+'"]')?.click();
  let nav,subnav,themeBtn,last='';
  function buildNav(){
    nav=document.createElement('nav');
    nav.id='vlNav';nav.className='vl-nav';nav.setAttribute('aria-label','Main navigation');
    nav.innerHTML='<button type="button" class="vl-brand" data-dest="home" aria-label="VOC LAB Home">voclab</button>'+
      '<div class="vl-nav-items">'+DESTINATIONS.map(d=>'<button type="button" class="vl-nav-item" data-dest="'+d.id+'">'+ICON[d.id]+'<span>'+d.label+'</span></button>').join('')+'</div>'+
      '<div class="vl-nav-foot"><button type="button" class="vl-foot-btn" id="vlThemeBtn" aria-label="Toggle theme"></button>'+
      '<button type="button" class="vl-foot-btn" id="vlFiltersBtn">'+ICON.filter+'<span>Filters</span></button>'+
      '<a class="vl-foot-btn" href="https://www.instagram.com/voclab_sa/" target="_blank" rel="noopener noreferrer">'+ICON.instagram+'<span>@voclab_sa</span></a></div>';
    nav.addEventListener('click',event=>{
      const button=event.target.closest('[data-dest]');
      if(!button)return;
      const destination=DESTINATIONS.find(d=>d.id===button.dataset.dest);
      if(!destination)return;
      const remembered=memory.get('sub_'+destination.id);
      const target=destination.subs.some(([p])=>p===remembered)?remembered:destination.subs[0][0];
      if(destination.id==='home'&&typeof window.goHome==='function')window.goHome();
      else openTab(target);
    });
    themeBtn=nav.querySelector('#vlThemeBtn');
    themeBtn.addEventListener('click',()=>window.voclabToggleTheme?.());
    nav.querySelector('#vlFiltersBtn').addEventListener('click',()=>document.getElementById('btnDrawer')?.click());
    document.body.appendChild(nav);
    // The reference mockup uses one uncluttered header; keep account actions,
    // but remove duplicate navigation controls and counter on desktop.
    const exit=document.createElement('button');
    exit.id='vlExitStudy';exit.type='button';exit.className='vl-exit-study';
    exit.textContent='← Exit study';exit.setAttribute('aria-label','Exit study session');
    exit.addEventListener('click',()=>{
      if(typeof window.goHome==='function')window.goHome();
      else {
        try{picked=false}catch{}
        openTab('home');
      }
      sync();
    });
    document.body.appendChild(exit);
    document.body.classList.add('vl-shell');
  }

  function buildGlobalSearch(){
    const header=document.querySelector('header .hwrap');
    if(!header || document.getElementById('vlGlobalSearch'))return;
    const form=document.createElement('form');
    form.id='vlGlobalSearch';
    form.className='vl-global-search';
    form.setAttribute('role','search');
    form.setAttribute('aria-label','Search vocabulary from anywhere');
    const icon=document.createElement('span');
    icon.className='vl-global-search-icon';
    icon.innerHTML=ICON.search;
    const input=document.createElement('input');
    input.type='search';
    input.id='vlGlobalQuery';
    input.name='query';
    input.maxLength=120;
    input.autocomplete='off';
    input.spellcheck=false;
    input.placeholder='Search a word or phrase…';
    input.setAttribute('aria-label','Search a word or phrase');
    const action=document.createElement('button');
    action.type='submit';
    action.textContent='Search';
    action.setAttribute('aria-label','Search vocabulary');
    form.append(icon,input,action);
    const headerActions=header.querySelector('.hbtns');
    if(headerActions)header.insertBefore(form,headerActions);
    else header.appendChild(form);
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const query=input.value.trim();
      openTab('dict');
      // Keep the original AI Search form, results, credits, and auth.
      const existing=document.getElementById('dIn');
      if(existing){
        if(query)existing.value=query;
        existing.focus();
        if(query && typeof window.aiSearchLookup==='function')window.aiSearchLookup();
      }
    });
  }

  function buildSubnav(){
    const main=document.querySelector('main');if(!main)return;
    subnav=document.createElement('nav');subnav.id='vlSubnav';subnav.className='vl-subnav';
    subnav.setAttribute('aria-label','Section navigation');
    subnav.addEventListener('click',event=>{const b=event.target.closest('[data-p]');if(b)openTab(b.dataset.p)});
    main.insertBefore(subnav,main.firstChild);
  }
  function syncTheme(){
    if(!themeBtn)return;
    const dark=(window.voclabGetTheme?.()||(document.body.classList.contains('light')?'light':'dark'))==='dark';
    themeBtn.innerHTML=(dark?ICON.sun:ICON.moon)+'<span>'+(dark?'Light theme':'Dark theme')+'</span>';
    themeBtn.setAttribute('aria-pressed',String(dark));
  }
  function isStudying(){
    // Existing app keeps the selected-deck flag as a top-level lexical binding.
    try{return typeof picked!=='undefined'&&!!picked}catch{return false}
  }
  function sync(){
    const tab=activeTab(),id=DEST_OF[tab]||'home',destination=DESTINATIONS.find(d=>d.id===id);
    memory.set('sub_'+id,tab);
    nav?.querySelectorAll('.vl-nav-item').forEach(button=>{
      const selected=button.dataset.dest===id;
      button.classList.toggle('on',selected);
      if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    if(subnav){
      const key=id+':'+tab;
      if(key!==last){
        last=key;
        subnav.hidden=destination.subs.length<2;
        subnav.innerHTML=destination.subs.map(([p,label])=>'<button type="button" data-p="'+p+'" class="'+(p===tab?'on':'')+'"'+(p===tab?' aria-current="page"':'')+'>'+label+'</button>').join('');
      }
    }
    document.body.classList.toggle('vl-in-session',STUDY.has(tab)&&isStudying());
    document.body.dataset.vlDest=id;
  }
  function start(){
    const tabs=document.querySelector('.tabs');
    if(!tabs||!document.querySelector('main'))return;
    buildNav();buildSubnav();buildGlobalSearch();syncTheme();sync();
    new MutationObserver(sync).observe(tabs,{subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('click',()=>setTimeout(sync,0));
    window.addEventListener('voclab:themechange',syncTheme);
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&document.body.classList.contains('vl-in-session')){
        document.getElementById('vlExitStudy')?.click();
      }
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
