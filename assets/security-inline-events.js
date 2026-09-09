(() => {
  'use strict';

  function bindDrawerApply(){
    const button = document.querySelector('#drawer button[onclick="closeDrawer()"]');
    if (!button || button.dataset.vocBoundCloseDrawer === '1') return;
    button.dataset.vocBoundCloseDrawer = '1';
    button.removeAttribute('onclick');
    button.addEventListener('click', () => {
      if (typeof window.closeDrawer === 'function') window.closeDrawer();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindDrawerApply, { once:true });
  } else {
    bindDrawerApply();
  }
})();
