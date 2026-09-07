(() => {
  'use strict';

  const SUPABASE_URL = 'https://hknecvleujjdyoqtwaar.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_9GOPoqC3kpfLVcvQoSXXFQ_gXcGK6om';
  const STATE_PREFIX = 'engl01_';
  const BOUND_USER_KEY = 'voclab_bound_user';
  const GUEST_BACKUP_KEY = 'voclab_guest_backup';
  const AUTH_RELOAD_KEY = 'voclab_auth_reload';
  const SYNC_INTERVAL_MS = 2500;

  let client = null;
  let session = null;
  let plan = 'free';
  let syncTimer = null;
  let lastSnapshot = '';
  let syncAvailable = true;
  let pendingPhone = '';
  let resendTimer = null;
  let resendSeconds = 0;

  const iconUser = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>';
  const iconClose = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"></path></svg>';

  function injectStyles() {
    if (document.getElementById('vocAuthStyles')) return;
    const style = document.createElement('style');
    style.id = 'vocAuthStyles';
    style.textContent = `
      .voc-auth-btn{min-width:76px;justify-content:center}
      .voc-auth-badge{font-size:9px;letter-spacing:.09em;text-transform:uppercase;border:1px solid color-mix(in srgb,var(--amber) 45%,var(--line));color:var(--amber);padding:2px 5px;border-radius:999px;font-weight:700}
      .voc-auth-overlay{position:fixed;inset:0;z-index:120;background:rgba(5,6,8,.64);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;pointer-events:none;transition:opacity .2s ease}
      .voc-auth-overlay.open{opacity:1;pointer-events:auto}
      .voc-auth-card{width:min(430px,100%);background:var(--hd);border:1px solid var(--line);border-radius:22px;box-shadow:0 26px 70px rgba(0,0,0,.28);padding:24px;transform:translateY(8px) scale(.985);transition:transform .2s ease}
      .voc-auth-overlay.open .voc-auth-card{transform:none}
      .voc-auth-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:22px}
      .voc-auth-brand{font-family:var(--en);font-size:25px;font-weight:600;letter-spacing:.2px}
      .voc-auth-brand span{color:var(--amber)}
      .voc-auth-kicker{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);font-weight:600;margin-top:5px}
      .voc-auth-close{width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--mut);display:grid;place-items:center;cursor:pointer}
      .voc-auth-close:hover{color:var(--tx);border-color:var(--amber)}
      .voc-auth-title{font-family:var(--en);font-size:30px;line-height:1.1;font-weight:600;margin-bottom:8px}
      .voc-auth-sub{font-size:13px;color:var(--mut);line-height:1.6;margin-bottom:20px}
      .voc-auth-label{display:block;font-size:11px;font-weight:600;color:var(--mut);letter-spacing:.08em;text-transform:uppercase;margin:0 0 7px}
      .voc-auth-phone-wrap{display:grid;grid-template-columns:auto 1fr;border:1px solid var(--line);border-radius:12px;background:var(--card);overflow:hidden;transition:border-color .15s}
      .voc-auth-phone-wrap:focus-within{border-color:var(--amber)}
      .voc-auth-country{padding:12px 13px;border-right:1px solid var(--line);font-size:13px;color:var(--mut);display:flex;align-items:center;gap:6px;white-space:nowrap}
      .voc-auth-input{width:100%;border:0!important;background:transparent!important;color:var(--tx)!important;font-family:var(--ui)!important;font-size:16px!important;padding:12px 13px!important;outline:0!important;border-radius:0!important}
      .voc-auth-input::placeholder{color:color-mix(in srgb,var(--mut) 72%,transparent)}
      .voc-auth-otp{letter-spacing:.35em;text-align:center;font-size:23px!important;font-weight:600}
      .voc-auth-primary,.voc-auth-secondary,.voc-auth-danger{width:100%;border-radius:11px;padding:12px 14px;font-size:14px;font-weight:600;cursor:pointer;transition:filter .15s,transform .1s,border-color .15s;margin-top:12px}
      .voc-auth-primary{border:0;background:var(--amber);color:var(--onacc)}
      .voc-auth-primary:hover{filter:brightness(1.06)}
      .voc-auth-primary:active,.voc-auth-secondary:active,.voc-auth-danger:active{transform:scale(.985)}
      .voc-auth-primary:disabled{opacity:.48;cursor:not-allowed;filter:none}
      .voc-auth-secondary{border:1px solid var(--line);background:var(--card);color:var(--tx)}
      .voc-auth-secondary:hover{border-color:var(--amber)}
      .voc-auth-danger{border:1px solid color-mix(in srgb,var(--bad) 42%,var(--line));background:transparent;color:var(--bad)}
      .voc-auth-error{display:none;margin-top:12px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--bad) 38%,var(--line));background:color-mix(in srgb,var(--bad) 8%,transparent);color:var(--bad);border-radius:10px;font-size:12.5px;line-height:1.45}
      .voc-auth-error.show{display:block}
      .voc-auth-note{font-size:11.5px;line-height:1.55;color:var(--mut);margin-top:12px}
      .voc-auth-link{border:0;background:none;color:var(--amber);font:inherit;cursor:pointer;padding:0}
      .voc-auth-account{display:grid;gap:10px}
      .voc-auth-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 14px;background:var(--card);border:1px solid var(--line);border-radius:12px}
      .voc-auth-row small{display:block;color:var(--mut);font-size:10px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}
      .voc-auth-row strong{font-size:13.5px;font-weight:600}
      .voc-auth-plan{display:inline-flex;align-items:center;gap:6px;color:var(--amber);font-size:11px;letter-spacing:.09em;text-transform:uppercase;font-weight:700}
      .voc-auth-pro-card{margin-top:14px;padding:17px;border:1px solid color-mix(in srgb,var(--amber) 38%,var(--line));border-radius:14px;background:linear-gradient(145deg,color-mix(in srgb,var(--amber) 8%,var(--card)),var(--card))}
      .voc-auth-pro-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:6px}
      .voc-auth-pro-top strong{font-family:var(--en);font-size:21px}
      .voc-auth-price{font-size:13px;color:var(--amber);font-weight:700;white-space:nowrap}
      .voc-auth-pro-card p{font-size:12px;color:var(--mut);line-height:1.55}
      .voc-auth-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--mut)}
      .voc-auth-dot{width:6px;height:6px;border-radius:50%;background:var(--ok)}
      @media(max-width:540px){.voc-auth-btn .voc-auth-label-text{display:none}.voc-auth-btn{min-width:0;padding:8px 10px}.voc-auth-card{padding:20px;border-radius:18px}.voc-auth-title{font-size:27px}}
    `;
    document.head.appendChild(style);
  }

  function createShell() {
    injectStyles();
    const headerButtons = document.querySelector('.hbtns');
    if (headerButtons && !document.getElementById('vocAuthBtn')) {
      const btn = document.createElement('button');
      btn.id = 'vocAuthBtn';
      btn.type = 'button';
      btn.className = 'iconbtn voc-auth-btn';
      btn.innerHTML = `${iconUser}<span class="voc-auth-label-text">Sign in</span>`;
      btn.addEventListener('click', openModal);
      headerButtons.prepend(btn);
    }

    if (!document.getElementById('vocAuthOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'vocAuthOverlay';
      overlay.className = 'voc-auth-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.innerHTML = `<div class="voc-auth-card" role="dialog" aria-modal="true" aria-labelledby="vocAuthDialogTitle"><div class="voc-auth-head"><div><div class="voc-auth-brand">voclab<span>.</span></div><div class="voc-auth-kicker">Your learning account</div></div><button class="voc-auth-close" id="vocAuthClose" type="button" aria-label="Close">${iconClose}</button></div><div id="vocAuthBody"></div></div>`;
      overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
      document.body.appendChild(overlay);
      overlay.querySelector('#vocAuthClose').addEventListener('click', closeModal);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }
    renderAuthBody();
  }

  function openModal() {
    const overlay = document.getElementById('vocAuthOverlay');
    if (!overlay) return;
    renderAuthBody();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      const input = overlay.querySelector('input');
      if (input) input.focus();
    }, 80);
  }

  function closeModal() {
    const overlay = document.getElementById('vocAuthOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function setError(message) {
    const el = document.getElementById('vocAuthError');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('show', Boolean(message));
  }

  function friendlyError(error) {
    const raw = String(error?.message || error || 'Something went wrong. Please try again.');
    const lower = raw.toLowerCase();
    if (lower.includes('phone provider') || lower.includes('sms provider') || lower.includes('unsupported phone')) return `Phone/SMS setup error: ${raw}`;
    if (lower.includes('rate limit') || lower.includes('too many')) return 'Too many attempts. Please wait a little before requesting another code.';
    if (lower.includes('token') || lower.includes('otp') || lower.includes('invalid')) return 'That verification code is incorrect or expired. Please request a new code.';
    if (lower.includes('captcha')) return 'Verification protection is required before another code can be sent.';
    return raw;
  }

  function normalizeSaudiPhone(raw) {
    let value = String(raw || '').trim().replace(/[\s()-]/g, '');
    if (!value) return '';
    if (value.startsWith('00966')) value = '+966' + value.slice(5);
    else if (value.startsWith('966')) value = '+' + value;
    else if (value.startsWith('05')) value = '+966' + value.slice(1);
    else if (value.startsWith('5') && /^5\d{8}$/.test(value)) value = '+966' + value;
    if (!/^\+9665\d{8}$/.test(value)) return '';
    return value;
  }

  function maskPhone(phone) {
    const p = String(phone || '');
    if (p.startsWith('+966') && p.length >= 12) return `05${p.slice(5, 7)} ••• •${p.slice(-2)}`;
    if (p.length > 6) return `${p.slice(0, 4)}••••${p.slice(-2)}`;
    return p || 'Phone account';
  }

  function renderAuthBody() {
    const body = document.getElementById('vocAuthBody');
    if (!body) return;

    if (session?.user) {
      body.innerHTML = `
        <div class="voc-auth-title" id="vocAuthDialogTitle">Your account</div>
        <div class="voc-auth-sub">Your VocLab progress can follow you across devices once cloud sync is enabled for the project.</div>
        <div class="voc-auth-account">
          <div class="voc-auth-row"><div><small>Phone</small><strong>${escapeHtml(maskPhone(session.user.phone))}</strong></div><span class="voc-auth-status"><i class="voc-auth-dot"></i> Verified</span></div>
          <div class="voc-auth-row"><div><small>Plan</small><strong>${plan === 'pro' ? 'VocLab Pro' : 'VocLab Free'}</strong></div><span class="voc-auth-plan">${plan === 'pro' ? 'PRO' : 'FREE'}</span></div>
        </div>
        ${plan === 'pro' ? '' : `<div class="voc-auth-pro-card"><div class="voc-auth-pro-top"><strong>VocLab Pro</strong><span class="voc-auth-price">19 SAR / month</span></div><p>Higher AI limits and expanded file tools. Payments will be connected after the payment account is approved.</p><button type="button" class="voc-auth-primary" disabled>Upgrade coming soon</button></div>`}
        <button type="button" class="voc-auth-danger" id="vocAuthSignOut">Sign out</button>
        <div class="voc-auth-error" id="vocAuthError"></div>
      `;
      body.querySelector('#vocAuthSignOut').addEventListener('click', signOut);
      return;
    }

    if (pendingPhone) {
      body.innerHTML = `
        <div class="voc-auth-title" id="vocAuthDialogTitle">Enter your code</div>
        <div class="voc-auth-sub">We sent a 6-digit verification code to <strong>${escapeHtml(maskPhone(pendingPhone))}</strong>.</div>
        <label class="voc-auth-label" for="vocOtp">Verification code</label>
        <input class="voc-auth-input voc-auth-otp" id="vocOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" aria-label="Verification code">
        <button type="button" class="voc-auth-primary" id="vocVerifyBtn">Verify & continue</button>
        <button type="button" class="voc-auth-secondary" id="vocResendBtn">${resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend code'}</button>
        <button type="button" class="voc-auth-link" id="vocChangePhone" style="margin-top:14px">Use a different number</button>
        <div class="voc-auth-error" id="vocAuthError"></div>
      `;
      const otp = body.querySelector('#vocOtp');
      otp.addEventListener('input', () => { otp.value = otp.value.replace(/\D/g, '').slice(0, 6); if (otp.value.length === 6) verifyOtp(); });
      otp.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyOtp(); });
      body.querySelector('#vocVerifyBtn').addEventListener('click', verifyOtp);
      const resend = body.querySelector('#vocResendBtn');
      resend.disabled = resendSeconds > 0;
      resend.addEventListener('click', () => sendOtp(pendingPhone, true));
      body.querySelector('#vocChangePhone').addEventListener('click', () => { pendingPhone = ''; stopResendTimer(); renderAuthBody(); });
      return;
    }

    body.innerHTML = `
      <div class="voc-auth-title" id="vocAuthDialogTitle">Continue with phone</div>
      <div class="voc-auth-sub">No password. We’ll send a one-time code to your Saudi mobile number.</div>
      <label class="voc-auth-label" for="vocPhone">Mobile number</label>
      <div class="voc-auth-phone-wrap"><div class="voc-auth-country"><span>🇸🇦</span><span>+966</span></div><input class="voc-auth-input" id="vocPhone" inputmode="tel" autocomplete="tel" placeholder="05 1234 5678" aria-label="Saudi mobile number"></div>
      <button type="button" class="voc-auth-primary" id="vocSendBtn">Send verification code</button>
      <div class="voc-auth-error" id="vocAuthError"></div>
      <div class="voc-auth-note">By continuing, you confirm this number belongs to you. Standard SMS charges from your carrier may apply.</div>
    `;
    const phone = body.querySelector('#vocPhone');
    phone.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendOtp(phone.value); });
    body.querySelector('#vocSendBtn').addEventListener('click', () => sendOtp(phone.value));
  }

  async function sendOtp(rawPhone, isResend = false) {
    if (!client) return;
    const phone = normalizeSaudiPhone(rawPhone);
    if (!phone) {
      setError('Enter a valid Saudi mobile number, for example 05XXXXXXXX.');
      return;
    }
    const btn = document.getElementById(isResend ? 'vocResendBtn' : 'vocSendBtn');
    if (btn) { btn.disabled = true; btn.textContent = isResend ? 'Sending…' : 'Sending code…'; }
    setError('');
    const { error } = await client.auth.signInWithOtp({ phone });
    if (error) {
      setError(friendlyError(error));
      if (btn) { btn.disabled = false; btn.textContent = isResend ? 'Resend code' : 'Send verification code'; }
      return;
    }
    pendingPhone = phone;
    startResendTimer();
    renderAuthBody();
    setTimeout(() => document.getElementById('vocOtp')?.focus(), 60);
  }

  async function verifyOtp() {
    if (!client || !pendingPhone) return;
    const input = document.getElementById('vocOtp');
    const token = String(input?.value || '').replace(/\D/g, '').slice(0, 6);
    if (token.length !== 6) {
      setError('Enter the 6-digit verification code.');
      return;
    }
    const btn = document.getElementById('vocVerifyBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Verifying…'; }
    setError('');
    const { data, error } = await client.auth.verifyOtp({ phone: pendingPhone, token, type: 'sms' });
    if (error) {
      setError(friendlyError(error));
      if (btn) { btn.disabled = false; btn.textContent = 'Verify & continue'; }
      return;
    }
    pendingPhone = '';
    stopResendTimer();
    session = data.session || null;
    await handleSession(session, true);
    renderAuthBody();
  }

  function startResendTimer() {
    stopResendTimer();
    resendSeconds = 60;
    resendTimer = setInterval(() => {
      resendSeconds -= 1;
      if (resendSeconds <= 0) stopResendTimer();
      if (!session?.user && pendingPhone && document.getElementById('vocAuthOverlay')?.classList.contains('open')) renderAuthBody();
    }, 1000);
  }

  function stopResendTimer() {
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = null;
    resendSeconds = 0;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch]));
  }

  function snapshotState() {
    const out = {};
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STATE_PREFIX)) keys.push(key);
      }
      keys.sort();
      for (const key of keys) out[key] = localStorage.getItem(key);
    } catch {}
    return out;
  }

  function snapshotString() {
    try { return JSON.stringify(snapshotState()); } catch { return '{}'; }
  }

  function applyRemoteState(state) {
    if (!state || typeof state !== 'object') return false;
    let changed = false;
    try {
      const current = snapshotState();
      const remoteKeys = Object.keys(state).filter((k) => k.startsWith(STATE_PREFIX));
      const allKeys = new Set([...Object.keys(current), ...remoteKeys]);
      for (const key of allKeys) {
        if (!key.startsWith(STATE_PREFIX)) continue;
        if (Object.prototype.hasOwnProperty.call(state, key)) {
          const next = state[key] == null ? '' : String(state[key]);
          if (localStorage.getItem(key) !== next) { localStorage.setItem(key, next); changed = true; }
        } else if (localStorage.getItem(key) !== null) {
          localStorage.removeItem(key);
          changed = true;
        }
      }
    } catch {}
    return changed;
  }

  async function loadPlan(userId) {
    plan = 'free';
    if (!client || !userId) return;
    try {
      const { data, error } = await client.from('profiles').select('plan').eq('id', userId).maybeSingle();
      if (!error && (data?.plan === 'pro' || data?.plan === 'free')) plan = data.plan;
    } catch {}
  }

  async function initializeCloudState(userId) {
    if (!client || !userId || !syncAvailable) return false;
    try {
      const { data, error } = await client.from('user_state').select('state,updated_at').eq('user_id', userId).maybeSingle();
      if (error) {
        if (String(error.code || '').startsWith('PGRST') || /user_state|schema cache|relation/i.test(String(error.message || ''))) syncAvailable = false;
        return false;
      }

      const local = snapshotState();
      const localJson = JSON.stringify(local);
      const bound = localStorage.getItem(BOUND_USER_KEY) || '';

      if (!data) {
        const { error: upsertError } = await client.from('user_state').upsert({ user_id: userId, state: local, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
        if (upsertError) return false;
        localStorage.setItem(BOUND_USER_KEY, userId);
        lastSnapshot = localJson;
        return false;
      }

      const remote = data.state && typeof data.state === 'object' ? data.state : {};
      const remoteJson = JSON.stringify(remote);
      if (bound !== userId && localJson !== '{}' && localJson !== remoteJson) {
        try { localStorage.setItem(GUEST_BACKUP_KEY, localJson); } catch {}
      }
      const changed = applyRemoteState(remote);
      localStorage.setItem(BOUND_USER_KEY, userId);
      lastSnapshot = snapshotString();
      return changed;
    } catch {
      return false;
    }
  }

  async function syncState(force = false) {
    if (!client || !session?.user?.id || !syncAvailable) return;
    const json = snapshotString();
    if (!force && json === lastSnapshot) return;
    let state;
    try { state = JSON.parse(json); } catch { return; }
    const { error } = await client.from('user_state').upsert({ user_id: session.user.id, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (!error) {
      lastSnapshot = json;
      try { localStorage.setItem(BOUND_USER_KEY, session.user.id); } catch {}
    } else if (String(error.code || '').startsWith('PGRST') || /user_state|schema cache|relation/i.test(String(error.message || ''))) {
      syncAvailable = false;
    }
  }

  function startSyncLoop() {
    if (syncTimer) clearInterval(syncTimer);
    if (!session?.user) return;
    lastSnapshot = snapshotString();
    syncTimer = setInterval(() => { syncState(false); }, SYNC_INTERVAL_MS);
  }

  function stopSyncLoop() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
  }

  async function handleSession(nextSession, justSignedIn = false) {
    session = nextSession || null;
    if (!session?.user) {
      plan = 'free';
      stopSyncLoop();
      updateAccountButton();
      renderAuthBody();
      return;
    }

    await loadPlan(session.user.id);
    const changed = await initializeCloudState(session.user.id);
    updateAccountButton();
    renderAuthBody();
    startSyncLoop();

    if (changed) {
      const alreadyReloaded = sessionStorage.getItem(AUTH_RELOAD_KEY) === session.user.id;
      if (!alreadyReloaded) {
        sessionStorage.setItem(AUTH_RELOAD_KEY, session.user.id);
        location.reload();
        return;
      }
    }
    if (justSignedIn) sessionStorage.removeItem(AUTH_RELOAD_KEY);
  }

  function updateAccountButton() {
    const btn = document.getElementById('vocAuthBtn');
    if (!btn) return;
    if (!session?.user) {
      btn.innerHTML = `${iconUser}<span class="voc-auth-label-text">Sign in</span>`;
      btn.setAttribute('aria-label', 'Sign in');
      return;
    }
    btn.innerHTML = `${iconUser}<span class="voc-auth-label-text">Account</span><span class="voc-auth-badge">${plan === 'pro' ? 'PRO' : 'FREE'}</span>`;
    btn.setAttribute('aria-label', 'Open account');
  }

  async function signOut() {
    if (!client) return;
    const userId = session?.user?.id || '';
    const btn = document.getElementById('vocAuthSignOut');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing out…'; }
    await syncState(true);
    await client.auth.signOut();
    stopSyncLoop();
    try {
      if (userId && localStorage.getItem(BOUND_USER_KEY) === userId) {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(STATE_PREFIX)) keys.push(key);
        }
        keys.forEach((key) => localStorage.removeItem(key));
      }
      localStorage.removeItem(BOUND_USER_KEY);
      sessionStorage.removeItem(AUTH_RELOAD_KEY);
    } catch {}
    session = null;
    plan = 'free';
    closeModal();
    location.reload();
  }

  function patchAiFetch() {
    if (window.__voclabAuthFetchPatched) return;
    window.__voclabAuthFetchPatched = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      try {
        const url = typeof input === 'string' ? new URL(input, location.href) : new URL(input.url, location.href);
        if (url.origin === location.origin && url.pathname === '/api/ai' && session?.access_token) {
          const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined) || {});
          if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${session.access_token}`);
          init = { ...init, headers };
        }
      } catch {}
      return nativeFetch(input, init);
    };
  }

  function loadSupabaseLibrary() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-voclab-supabase]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.voclabSupabase = '1';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load account service.'));
      document.head.appendChild(script);
    });
  }

  async function boot() {
    createShell();
    try {
      await loadSupabaseLibrary();
      if (!window.supabase?.createClient) throw new Error('Account service did not load.');
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      patchAiFetch();
      const { data } = await client.auth.getSession();
      await handleSession(data?.session || null, false);
      client.auth.onAuthStateChange((event, nextSession) => {
        if (event === 'TOKEN_REFRESHED') {
          session = nextSession || session;
          return;
        }
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') handleSession(nextSession || null, event === 'SIGNED_IN');
        if (event === 'SIGNED_OUT') handleSession(null, false);
      });
      window.addEventListener('beforeunload', () => { if (session?.user && syncAvailable) syncState(false); });
    } catch (error) {
      console.error('VocLab auth setup error:', error);
      const btn = document.getElementById('vocAuthBtn');
      if (btn) btn.title = 'Account service is temporarily unavailable';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
