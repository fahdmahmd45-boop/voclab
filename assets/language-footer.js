(() => {
  'use strict';

  if (window.__VOC_INSTAGRAM_FOOTER_V1__) return;
  window.__VOC_INSTAGRAM_FOOTER_V1__ = true;

  const INSTAGRAM_URL = 'https://www.instagram.com/voclab_sa/';
  const TURNSTILE_CONFIG_ENDPOINT = '/api/public-config';
  const SUPABASE_AUTH_HOST = 'hknecvleujjdyoqtwaar.supabase.co';
  const ICON_INSTAGRAM = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"></circle></svg>';

  let turnstileSiteKey = '';
  let turnstileToken = '';
  let turnstileWidgetId = null;
  let turnstileConfigPromise = null;
  let turnstileScriptPromise = null;

  function setAuthProtectionError(message){
    const error = document.getElementById('vocAuthError');
    if (!error) return;
    error.textContent = message || '';
    error.classList.toggle('show', Boolean(message));
  }

  function setInitialOtpButtonReady(ready){
    const send = document.getElementById('vocSendBtn');
    if (send) send.disabled = !ready;
  }

  function clearTurnstileWidget(){
    turnstileToken = '';
    if (turnstileWidgetId !== null && window.turnstile?.remove) {
      try { window.turnstile.remove(turnstileWidgetId); } catch {}
    }
    turnstileWidgetId = null;
  }

  function loadTurnstileConfig(){
    if (turnstileSiteKey) return Promise.resolve(turnstileSiteKey);
    if (turnstileConfigPromise) return turnstileConfigPromise;

    const fetcher = window.fetch.bind(window);
    turnstileConfigPromise = fetcher(TURNSTILE_CONFIG_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    }).then(async (response) => {
      if (!response.ok) throw new Error('Turnstile configuration unavailable');
      const data = await response.json();
      const key = String(data?.turnstileSiteKey || '').trim();
      if (!key) throw new Error('Turnstile site key missing');
      turnstileSiteKey = key;
      return key;
    }).catch((error) => {
      turnstileConfigPromise = null;
      throw error;
    });
    return turnstileConfigPromise;
  }

  function loadTurnstileScript(){
    if (window.turnstile?.render) return Promise.resolve();
    if (turnstileScriptPromise) return turnstileScriptPromise;

    turnstileScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-voclab-turnstile]');
      if (existing) {
        if (window.turnstile?.render) return resolve();
        existing.addEventListener('load', () => resolve(), { once:true });
        existing.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once:true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.voclabTurnstile = '1';
      script.addEventListener('load', () => resolve(), { once:true });
      script.addEventListener('error', () => reject(new Error('Turnstile failed to load')), { once:true });
      document.head.appendChild(script);
    }).catch((error) => {
      turnstileScriptPromise = null;
      throw error;
    });

    return turnstileScriptPromise;
  }

  async function mountTurnstile(){
    const overlay = document.getElementById('vocAuthOverlay');
    const body = document.getElementById('vocAuthBody');
    if (!overlay?.classList.contains('open') || !body) return;

    const actionButton = body.querySelector('#vocSendBtn, #vocResendBtn');
    if (!actionButton) return;

    let holder = body.querySelector('#vocTurnstileGuard');
    if (!holder) {
      holder = document.createElement('div');
      holder.id = 'vocTurnstileGuard';
      holder.className = 'voc-turnstile-wrap';
      holder.setAttribute('aria-label', 'Security verification');
      actionButton.parentNode.insertBefore(holder, actionButton);
    }

    if (actionButton.id === 'vocSendBtn') setInitialOtpButtonReady(false);
    if (holder.dataset.mounted === '1') return;

    try {
      const [siteKey] = await Promise.all([loadTurnstileConfig(), loadTurnstileScript()]);
      if (!holder.isConnected || !document.getElementById('vocAuthOverlay')?.classList.contains('open')) return;

      clearTurnstileWidget();
      holder.dataset.mounted = '1';
      turnstileWidgetId = window.turnstile.render(holder, {
        sitekey: siteKey,
        theme: 'auto',
        callback(token){
          turnstileToken = String(token || '');
          setAuthProtectionError('');
          setInitialOtpButtonReady(Boolean(turnstileToken));
        },
        'expired-callback'(){
          turnstileToken = '';
          setInitialOtpButtonReady(false);
        },
        'error-callback'(){
          turnstileToken = '';
          setInitialOtpButtonReady(false);
          setAuthProtectionError('Verification protection could not start. Please try again.');
        }
      });
    } catch (error) {
      holder.dataset.mounted = '';
      turnstileToken = '';
      setInitialOtpButtonReady(false);
      setAuthProtectionError('Verification protection is temporarily unavailable. Please try again.');
      console.error('VocLab Turnstile setup error:', error?.message || error);
    }
  }

  function installOtpFetchGuard(){
    if (window.__VOC_TURNSTILE_FETCH_GUARD__) return;
    window.__VOC_TURNSTILE_FETCH_GUARD__ = true;

    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      let url;
      try {
        url = typeof input === 'string' || input instanceof URL
          ? new URL(input, location.href)
          : new URL(input.url, location.href);
      } catch {
        return nativeFetch(input, init);
      }

      const method = String(init.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
      const isOtpRequest = url.hostname === SUPABASE_AUTH_HOST && url.pathname === '/auth/v1/otp' && method === 'POST';
      if (!isOtpRequest) return nativeFetch(input, init);

      const token = String(turnstileToken || '').trim();
      if (!token) {
        setAuthProtectionError('Complete the verification check before requesting a code.');
        setTimeout(mountTurnstile, 0);
        return new Response(JSON.stringify({
          error: 'captcha_verification_required',
          error_description: 'Captcha verification required',
          msg: 'Captcha verification required'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let bodyText = init.body;
      if (bodyText == null && typeof input === 'object' && input?.body && typeof input.body === 'string') {
        bodyText = input.body;
      }

      let payload;
      try {
        payload = JSON.parse(String(bodyText || '{}'));
      } catch {
        return nativeFetch(input, init);
      }

      payload.gotrue_meta_security = { captcha_token: token };
      turnstileToken = '';
      setInitialOtpButtonReady(false);

      const headers = new Headers(init.headers || (typeof input === 'object' ? input.headers : undefined) || {});
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

      // Supabase Auth validates the Turnstile token server-side before it sends the OTP.
      const response = await nativeFetch(input, {
        ...init,
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      try {
        if (turnstileWidgetId !== null && window.turnstile?.reset) window.turnstile.reset(turnstileWidgetId);
      } catch {}
      return response;
    };
  }

  function watchAuthForTurnstile(){
    function attach(){
      const overlay = document.getElementById('vocAuthOverlay');
      if (!overlay || overlay.dataset.vocTurnstileObserved === '1') return false;
      overlay.dataset.vocTurnstileObserved = '1';

      const observer = new MutationObserver(() => {
        if (overlay.classList.contains('open')) setTimeout(mountTurnstile, 0);
        else clearTurnstileWidget();
      });
      observer.observe(overlay, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });

      overlay.addEventListener('click', (event) => {
        const action = event.target.closest?.('#vocSendBtn, #vocResendBtn');
        if (!action || turnstileToken) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setAuthProtectionError('Complete the verification check before requesting a code.');
        setTimeout(mountTurnstile, 0);
      }, true);
      return true;
    }

    if (attach()) return;
    const rootObserver = new MutationObserver(() => {
      if (attach()) rootObserver.disconnect();
    });
    rootObserver.observe(document.body, { childList:true, subtree:true });
  }

  function loadSecurityInlineEvents(){
    if (document.getElementById('vocSecurityInlineEvents')) return;
    const script = document.createElement('script');
    script.id = 'vocSecurityInlineEvents';
    script.src = '/assets/security-inline-events.js';
    script.async = false;
    document.head.appendChild(script);
  }

  function loadAppRedesign(){
    if (document.getElementById('vocAppRedesignStyles')) return;
    const link = document.createElement('link');
    link.id = 'vocAppRedesignStyles';
    link.rel = 'stylesheet';
    link.href = '/assets/app-redesign.css';
    document.head.appendChild(link);
  }

  function loadAiTabsPolish(){
    if (document.getElementById('vocAiTabsPolishStyles')) return;
    const link = document.createElement('link');
    link.id = 'vocAiTabsPolishStyles';
    link.rel = 'stylesheet';
    link.href = '/assets/ai-tabs-polish.css';
    document.head.appendChild(link);
  }

  function loadOriginalWidthTabsFix(){
    if (document.getElementById('vocOriginalWidthTabsFix')) return;
    const link = document.createElement('link');
    link.id = 'vocOriginalWidthTabsFix';
    link.rel = 'stylesheet';
    link.href = '/assets/original-width-tabs-fix.css';
    document.head.appendChild(link);
  }

  function loadCompactMobileTabs(){
    if (document.getElementById('vocCompactMobileTabs')) return;
    const link = document.createElement('link');
    link.id = 'vocCompactMobileTabs';
    link.rel = 'stylesheet';
    link.href = '/assets/mobile-tabs-compact.css';
    document.head.appendChild(link);
  }

  function loadHomeUxRedesign(){
    if (!document.getElementById('vocHomeUxRedesignStyles')) {
      const link = document.createElement('link');
      link.id = 'vocHomeUxRedesignStyles';
      link.rel = 'stylesheet';
      link.href = '/assets/home-ux-redesign.css';
      document.head.appendChild(link);
    }
    if (!document.getElementById('vocHomeUxRedesignScript')) {
      const script = document.createElement('script');
      script.id = 'vocHomeUxRedesignScript';
      script.src = '/assets/home-ux-redesign.js';
      script.async = false;
      document.head.appendChild(script);
    }
  }

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
      .voc-turnstile-wrap{min-height:65px;margin-top:12px;display:flex;justify-content:center;align-items:center}
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
    installOtpFetchGuard();
    watchAuthForTurnstile();
    loadSecurityInlineEvents();
    loadAppRedesign();
    loadAiTabsPolish();
    loadOriginalWidthTabsFix();
    loadCompactMobileTabs();
    loadHomeUxRedesign();
    injectStyles();
    createInstagramHeader();
    createFooter();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
