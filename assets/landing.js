(()=>{
  'use strict';
  const APP_URL='/index.html';
  const SUN='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  document.title='voclab — English Vocabulary Trainer';
  const robots=document.querySelector('meta[name="robots"]');
  if(robots) robots.setAttribute('content','index,follow');

  document.querySelectorAll('a[href="/"]').forEach(a=>a.setAttribute('href',APP_URL));
  const brand=document.querySelector('a.brand');
  if(brand) brand.setAttribute('href','/');

  const footer=document.querySelector('footer .wrap');
  if(footer) footer.innerHTML='<div class="quote">“Every new word is a small door.”</div>© 2026 voclab · voclab.website · @voclab_sa';

  const btn=document.getElementById('themeBtn');
  if(!btn) return;
  function sync(){
    const light=document.body.classList.contains('light');
    btn.innerHTML=light?MOON:SUN;
    btn.title=light?'Switch to dark mode':'Switch to light mode';
    btn.setAttribute('aria-label',btn.title);
  }
  btn.addEventListener('click',()=>{document.body.classList.toggle('light');sync()});
  sync();
})();
