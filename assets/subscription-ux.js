(() => {
  'use strict';

  if (window.__VOC_SUBSCRIPTION_UX_V1__) return;
  window.__VOC_SUBSCRIPTION_UX_V1__ = true;

  const INSTAGRAM_URL = 'https://www.instagram.com/voclab_sa/';

  function injectStyles() {
    if (document.getElementById('vocSubscriptionUxStyles')) return;
    const style = document.createElement('style');
    style.id = 'vocSubscriptionUxStyles';
    style.textContent = `
      .voc-ai-plan-note{
        margin-top:14px;
        padding:13px 14px;
        border:1px solid var(--line);
        border-radius:12px;
        background:var(--card);
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
      }
      .voc-ai-plan-note strong{
        font-size:12px;
        font-weight:700;
        color:var(--tx);
        white-space:nowrap;
      }
      .voc-ai-plan-note span{
        font-size:11.5px;
        line-height:1.5;
        color:var(--mut);
        text-align:right;
      }
      .voc-subscribe-instagram{
        display:block;
        text-align:center;
        text-decoration:none;
      }
      .voc-topup-plans{margin-top:10px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
      .voc-topup-plans strong{font-size:12px;color:var(--tx)}
      .voc-topup-plans p{font-size:11px;color:var(--mut);margin:5px 0 10px;line-height:1.6}
      .voc-topup-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .voc-topup-pack{padding:10px;border-radius:9px;border:1px solid var(--line);background:var(--card2);display:grid;gap:3px}
      .voc-topup-pack b{font-size:12px;color:var(--tx)}
      .voc-topup-pack span{font-size:11px;color:var(--mut)}
      @media(max-width:480px){
        .voc-ai-plan-note{display:block}
        .voc-ai-plan-note span{display:block;text-align:left;margin-top:5px}
      }
    `;
    document.head.appendChild(style);
  }

  function createPlanNote(plan) {
    const note = document.createElement('div');
    note.className = 'voc-ai-plan-note';
    note.dataset.vocSubscriptionNote = '1';
    if (plan === 'pro') {
      note.innerHTML = '<strong>Pro Lifetime</strong><span>300 AI Credits / month · your existing lifetime plan is preserved</span>';
    } else if (plan === 'pro_monthly') {
      note.innerHTML = '<strong>Pro Monthly</strong><span>750 AI Credits / month · activation is pending billing launch</span>';
    } else {
      note.innerHTML = '<strong>Free AI</strong><span>30 AI Credits / month · each new AI Search uses 1 credit</span>';
    }
    return note;
  }

  function enhanceAccount() {
    const body = document.getElementById('vocAuthBody');
    if (!body) return;

    const planBadge = body.querySelector('.voc-auth-plan');
    if (!planBadge) return;
    const planLabel = String(planBadge.textContent || '').trim().toLowerCase();
    const plan = planLabel === 'pro lifetime' ? 'pro' : planLabel === 'pro monthly' ? 'pro_monthly' : 'free';

    if (!body.querySelector('[data-voc-subscription-note="1"]')) {
      const account = body.querySelector('.voc-auth-account');
      const proCard = body.querySelector('.voc-auth-pro-card');
      const note = createPlanNote(plan);
      if (proCard) proCard.before(note);
      else if (account) account.after(note);
    }

    const card = body.querySelector('.voc-auth-pro-card');
    if (!body.querySelector('[data-voc-topups="1"]')) {
      const packages = document.createElement('div');
      packages.className = 'voc-topup-plans';
      packages.dataset.vocTopups = '1';
      packages.innerHTML = '<strong>Extra AI Credits · planned</strong><p>Optional credit packs after billing launches. Purchases are not enabled yet.</p><div class="voc-topup-grid"><div class="voc-topup-pack"><b>10 SAR</b><span>350 Credits</span></div><div class="voc-topup-pack"><b>20 SAR</b><span>800 Credits</span></div></div>';
      const note = body.querySelector('[data-voc-subscription-note="1"]');
      if (card) card.after(packages);
      else if (note) note.after(packages);
    }
    if (!card || card.dataset.vocSubscriptionReady === '1') return;
    card.dataset.vocSubscriptionReady = '1';

    const price = card.querySelector('.voc-auth-price');
    if (price) price.textContent = '15 SAR / month';

    const description = card.querySelector('p');
    if (description) {
      description.textContent = 'Planned: 750 AI Credits per month. Payment and monthly renewal are not active yet. Your current plan will not change automatically.';
    }

    const oldButton = card.querySelector('.voc-auth-primary');
    if (oldButton) {
      oldButton.disabled = true;
      oldButton.textContent = 'Subscriptions coming soon';
    }
  }

  function start() {
    injectStyles();
    enhanceAccount();
    const observer = new MutationObserver(enhanceAccount);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
