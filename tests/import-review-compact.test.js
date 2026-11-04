'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const script=fs.readFileSync(require('node:path').join(__dirname,'../assets/import-review-compact.js'),'utf8');
test('word audio is inline and example audio is collapsed without changing checkbox',async()=>{
  const dom=new JSDOM('<div id="vocImportResults"><div id="vocImportRows"><label><input type="checkbox" checked><div><strong>resilience</strong><span>n</span><p>Ability to recover</p><details><summary>Source evidence & pronunciation</summary><p>Example</p></details><div class="voc-import-audio"><button>US word</button><button>UK word</button></div><div class="voc-import-audio"><button>US example</button><button>UK example</button></div></div></label></div></div>',{runScripts:'dangerously'});
  const {window}=dom;
  window.eval(script);
  const row=window.document.querySelector('.voc-review-word');
  assert.ok(row);
  assert.equal(window.document.querySelector('#vocImportRows > label'),null);
  assert.equal(row.querySelector('.voc-review-name strong').textContent,'resilience');
  assert.equal(row.querySelector('.voc-review-word-audio').querySelectorAll('button').length,2);
  const extra=row.querySelector('.voc-review-more');
  assert.ok(extra);
  assert.equal(extra.open,false);
  assert.equal(extra.querySelectorAll('.voc-import-audio button').length,2);
  assert.equal(row.querySelector('input[type="checkbox"]').checked,true);
  row.querySelector('.voc-review-word-audio button').click();
  assert.equal(row.querySelector('input[type="checkbox"]').checked,true);
  // Rerendered rows also get polished.
  window.document.getElementById('vocImportRows').innerHTML='<label><input type="checkbox"><div><strong>achieve</strong><span>v</span><div class="voc-import-audio"><button>US</button></div></div></label>';
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(window.document.querySelector('.voc-review-name strong').textContent,'achieve');
  dom.window.close();
});
