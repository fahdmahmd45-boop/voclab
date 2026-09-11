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
      note.innerHTML = '<strong>Pro AI</strong><span>300 credits / month · Word search 1 credit · File analysis 5 credits</span>';
    } else {
      note.innerHTML = '<strong>Free AI</strong><span>30 credits / month · Word search 1 credit · File analysis 5 credits</span>';
    }
    return note;
  }

  function enhanceAccount() {
    const body = document.getElementById('vocAuthBody');
    if (!body) return;

    const planBadge = body.querySelector('.voc-auth-plan');
    if (!planBadge) return;
    const plan = String(planBadge.textContent || '').trim().toLowerCase() === 'pro' ? 'pro' : 'free';

    if (!body.querySelector('[data-voc-subscription-note="1"]')) {
      const account = body.querySelector('.voc-auth-account');
      const proCard = body.querySelector('.voc-auth-pro-card');
      const note = createPlanNote(plan);
      if (proCard) proCard.before(note);
      else if (account) account.after(note);
    }

    const card = body.querySelector('.voc-auth-pro-card');
    if (!card || card.dataset.vocSubscriptionReady === '1') return;
    card.dataset.vocSubscriptionReady = '1';

    const price = card.querySelector('.voc-auth-price');
    if (price) price.textContent = '15 SAR / month';

    const description = card.querySelector('p');
    if (description) {
      description.textContent = '300 AI credits each month. Annual plan: 100 SAR. To activate Pro, contact us on Instagram and send your VocLab account email.';
    }

    const oldButton = card.querySelector('.voc-auth-primary');
    if (oldButton) {
      const link = document.createElement('a');
      link.className = `${oldButton.className} voc-subscribe-instagram`;
      link.href = INSTAGRAM_URL;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Contact @voclab_sa';
      oldButton.replaceWith(link);
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
