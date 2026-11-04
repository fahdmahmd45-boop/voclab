(() => {
  'use strict';
  const root=document.getElementById('vocImportResults');
  if(!root)return;
  function compact(label){
    const check=label.querySelector(':scope > input[type="checkbox"]');
    const old=label.querySelector(':scope > div');
    if(!check||!old)return;
    const word=old.querySelector(':scope > strong');
    const type=old.querySelector(':scope > span');
    const audio=[...old.querySelectorAll(':scope > .voc-import-audio')];
    if(!word||!type||!audio[0])return;
    const card=document.createElement('div');card.className='voc-review-word';
    const content=document.createElement('div');content.className='voc-review-content';
    const header=document.createElement('div');header.className='voc-review-head';
    const name=document.createElement('div');name.className='voc-review-name';
    word.removeAttribute('style');type.removeAttribute('style');
    name.append(word,type);
    const voice=document.createElement('div');voice.className='voc-review-word-audio';
    voice.append(audio[0]);header.append(name,voice);content.append(header);
    while(old.firstChild)content.append(old.firstChild);
    let details=content.querySelector(':scope > details');
    if(audio[1]){
      if(!details){
        details=document.createElement('details');
        const summary=document.createElement('summary');
        summary.textContent='Example pronunciation';
        details.append(summary);content.append(details);
      }
      details.append(audio[1]);
    }
    if(details){
      details.classList.add('voc-review-more');
      const summary=details.querySelector('summary');
      if(summary)summary.textContent='Example pronunciation & source';
    }
    card.append(check,content);
    label.replaceWith(card);
  }
  const update=()=>root.querySelectorAll('#vocImportRows > label').forEach(compact);
  new MutationObserver(update).observe(root,{subtree:true,childList:true});
  update();
})();