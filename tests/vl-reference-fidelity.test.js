'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
test('reference layout: light ivory tokens, exact sidebar/bottom navigation and clean header',()=>{
 const css=read('assets/vl-reference-fidelity.css');
 const shell=read('assets/vl-shell.css');
 const tokens=read('assets/vl-tokens.css');
 const html=read('index.html');
 assert.ok(tokens.includes('--bg:#F7F6F0'));
 assert.ok(tokens.includes('--card:#FCFBF7'));
 assert.ok(tokens.includes('--amber:#526749'));
 assert.ok(shell.includes('padding-left:232px'));
 assert.ok(shell.includes('.prog,html body #btnExit{display:none!important}'),'legacy header counter must be hidden');
 assert.ok(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))'),'desktop deck grid matches reference');
 assert.ok(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'),'mobile deck grid matches reference');
 assert.ok(css.includes('border-radius:6px!important'),'compact editorial card radius');
 assert.ok(html.indexOf('vl-reference-fidelity.css')>html.indexOf('vl-shell.css'),'fidelity overrides must load last');
 assert.ok(html.includes('Instrument+Sans'));
});
test('four main sections and an independent Search entry preserve underlying legacy tabs',()=>{
 const script=read('assets/vl-shell.js');
 assert.ok(script.includes("{id:'search',label:'Search'"));
 assert.ok(script.includes("['list','Decks']"));
 assert.ok(script.includes("['my','My words']"));
 assert.ok(script.includes("['cards','Flashcards']"));
 assert.ok(script.includes("['files','Import & Learn']"));
 assert.ok(!script.includes("['files','Import & Learn'],['dict','AI Search']"));
 assert.ok(script.includes("id='vlExitStudy'") || script.includes("exit.id='vlExitStudy'"));
});
test('initial ivory mode is shown once, then later user theme choice stays saved',()=>{
 const script=read('assets/inline-script-1.js');
 assert.ok(script.includes("store.get('vl_reference_light_seen_v1')"));
 assert.ok(script.includes("store.set('vl_reference_light_seen_v1','1')"));
 assert.ok(script.includes("store.set('engl01_theme',theme)"));
});
