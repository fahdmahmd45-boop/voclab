'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const script=fs.readFileSync(path.join(__dirname,'../assets/vl-shell.js'),'utf8');
const PAGES=['home','dict','list','files','cards','mcq','type','my'];
const page='<header><div class="hwrap"><div class="hbtns"><button id="btnDrawer"></button></div></div></header><main>'+
'<div class="tabs">'+PAGES.map((p,i)=>'<button class="tab'+(i?'':' on')+'" data-p="'+p+'">'+p+'</button>').join('')+'</div>'+
PAGES.map((p,i)=>'<div class="panel'+(i?'':' on')+'" id="p-'+p+'"></div>').join('')+'</main>';
const tick=()=>new Promise(resolve=>setTimeout(resolve,30));
async function setup(){
  const dom=new JSDOM(page,{runScripts:'dangerously',url:'https://voclab.website'});
  const {window}=dom;
  window.eval(`let picked=false;
    document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
      document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
      t.classList.add('on');
    });
    window.voclabToggleTheme=()=>{window.__themes=(window.__themes||0)+1};
    window.goHome=()=>{picked=false;document.querySelector('.tab[data-p="home"]').click()};`);
  window.eval(script);
  await tick();
  return dom;
}
test('navigation uses only Home Library Study Create and routes through existing tabs',async()=>{
  const dom=await setup(),d=dom.window.document;
  assert.deepEqual([...d.querySelectorAll('.vl-nav-item')].map(x=>x.dataset.dest),['home','library','study','create']);
  d.querySelector('[data-dest="study"]').click();await tick();
  assert.equal(d.querySelector('.tab.on').dataset.p,'cards');
  assert.deepEqual([...d.querySelectorAll('#vlSubnav button')].map(x=>x.dataset.p),['cards','mcq','type']);
  d.querySelector('#vlSubnav button[data-p="mcq"]').click();await tick();
  assert.equal(d.querySelector('.tab.on').dataset.p,'mcq');
  d.querySelector('[data-dest="create"]').click();await tick();
  assert.equal(d.querySelector('.tab.on').dataset.p,'files');
  d.querySelector('#vlSubnav button[data-p="dict"]').click();await tick();
  assert.equal(d.querySelector('.tab.on').dataset.p,'dict');
  dom.window.close();
});
test('programmatic navigation and theme toggling stay synchronized',async()=>{
  const dom=await setup(),d=dom.window.document;
  d.querySelector('.tab[data-p="my"]').click();await tick();
  assert.equal(d.querySelector('.vl-nav-item.on').dataset.dest,'library');
  d.querySelector('.tab[data-p="home"]').click();await tick();
  assert.equal(d.querySelector('#vlSubnav').hidden,true);
  d.getElementById('vlThemeBtn').click();
  assert.equal(dom.window.__themes,1);
  dom.window.close();
});
test('focus mode provides an exit, not an unreachable hidden nav',async()=>{
  const dom=await setup(),d=dom.window.document;
  d.querySelector('[data-dest="study"]').click();await tick();
  assert.equal(d.body.classList.contains('vl-in-session'),false);
  dom.window.eval('picked=true');d.body.click();await tick();
  assert.equal(d.body.classList.contains('vl-in-session'),true);
  const exit=d.getElementById('vlExitStudy');
  assert.ok(exit);
  exit.click();await tick();
  assert.equal(d.querySelector('.tab.on').dataset.p,'home');
  assert.equal(d.body.classList.contains('vl-in-session'),false);
  dom.window.close();
});
