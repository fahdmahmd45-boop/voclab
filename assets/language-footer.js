(() => {
  'use strict';

  if (window.__VOC_INSTAGRAM_FOOTER_V1__) return;
  window.__VOC_INSTAGRAM_FOOTER_V1__ = true;

  const INSTAGRAM_URL = 'https://www.instagram.com/voclab_sa/';
  const ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle></svg>';

  function injectStyles(){
    if (document.getElementById('vocInstagramFooterStyles')) return;
    const style = document.createElement('style');
    style.id = 'vocInstagramFooterStyles';
    style.textContent = `
      .voc-instagram-header{
        width:38px;
        min-width:38px;
        height:36px;
        padding:0!important;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        color:var(--tx);
        text-decoration:none;
      }
      .voc-instagram-header:hover{border-color:var(--amber);color:var(--amber)}
      .voc-instagram-header:active{transform:scale(.97)}
      .voc-footer{
        width:100%;
        border-top:1px solid var(--line);
        padding:27px 16px calc(27px + env(safe-area-inset-bottom));
        text-align:center;
        color:var(--mut);
        background:var(--bg);
      }
      .voc-footer-inner{
        width:100%;
        max-width:860px;
        margin:0 auto;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:8px;
      }
      .voc-footer-mark{
        width:27px;
        height:27px;
        border:1px solid color-mix(in srgb,var(--amber) 55%,var(--line));
        border-radius:9px;
        display:grid;
        place-items:center;
        font-family:var(--en);
        font-size:17px;
        font-weight:600;
        color:var(--amber);
        background:var(--card);
      }
      .voc-footer-brand{font-family:var(--en);font-size:16px;font-weight:600;color:var(--tx)}
      .voc-footer-copy{font-size:11.5px;line-height:1.55}
      @media(max-width:640px){.voc-instagram-header{width:34px;min-width:34px;height:34px}}
      @media(max-width:430px){.voc-footer{padding-top:24px}.voc-instagram-header{width:32px;min-width:32px}}
    `;
    document.head.appendChild(style);
  }

  function createInstagramHeader(){
    const buttons = document.querySelector('.hbtns');
    if (!buttons) return;

    document.getElementById('vocLangBtn')?.remove();
    if (document.getElementById('vocInstagramHeader')) return;

    const link = document.createElement('a');
    link.id = 'vocInstagramHeader';
    link.className = 'iconbtn voc-instagram-header';
    link.href = INSTAGRAM_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = 'Instagram @voclab_sa';
    link.setAttribute('aria-label', 'Open voclab Instagram @voclab_sa');
    link.innerHTML = ICON_INSTAGRAM;

    const theme = document.getElementById('btnTheme');
    if (theme) buttons.insertBefore(link, theme);
    else buttons.appendChild(link);
  }

  function createFooter(){
    let footer = document.getElementById('vocFooter');
    if (!footer) {
      footer = document.createElement('footer');
      footer.id = 'vocFooter';
      footer.className = 'voc-footer';
      document.body.appendChild(footer);
    }

    footer.innerHTML = '<div class="voc-footer-inner"><div class="voc-footer-mark" aria-hidden="true">V</div><div class="voc-footer-brand">voclab</div><div class="voc-footer-copy">© 2026 voclab. All rights reserved.</div></div>';
  }

  function start(){
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    injectStyles();
    createInstagramHeader();
    createFooter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
