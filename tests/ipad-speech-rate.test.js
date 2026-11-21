'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const original=fs.readFileSync(path.join(__dirname,'../assets/inline-script-1.js'),'utf8');
const importScript=fs.readFileSync(path.join(__dirname,'../assets/import-learn.js'),'utf8');
const start=original.indexOf('function voclabSpeechRate(){');
const end=original.indexOf('/* ---------- sound effects',start);
assert.ok(start>=0&&end>start);
const source=original.slice(start,end);
function setup(userAgent,touches){
 const spoken=[];
 const ctx={
   navigator:{userAgent,maxTouchPoints:touches},
   speechSynthesis:{
     cancel(){},getVoices(){return [{lang:'en-US',name:'US'},{lang:'en-GB',name:'UK'}]},
     speak(u){spoken.push(u)}
   },
   SpeechSynthesisUtterance:class {constructor(text){this.text=text}},
   window:{}
 };
 vm.runInNewContext(source,ctx);
 return {ctx,spoken};
}
test('iPad Safari and desktop-mode iPadOS speak at a deliberate pace',()=>{
 for(const [ua,touches] of [
   ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',5],
   ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',5]
 ]){
   const {ctx,spoken}=setup(ua,touches);
   assert.equal(ctx.voclabSpeechRate(),.72);
   ctx.speak('Primarily','en-US');
   assert.equal(spoken[0].rate,.72);
   assert.equal(spoken[0].voice.lang,'en-US');
 }
});
test('laptop/desktop and phone speech stays controlled without false iPad detection',()=>{
 for(const [ua,touches] of [
   ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',0],
   ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)',5],
   ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)',0]
 ]){
   const {ctx,spoken}=setup(ua,touches);
   ctx.speak('Initially','en-GB');
   assert.equal(spoken[0].rate,.80);
   assert.equal(spoken[0].voice.lang,'en-GB');
 }
});
test('Import & Learn fallback uses shared speech pace',()=>{
 assert.ok(importScript.includes("utterance.rate=typeof window.voclabSpeechRate==='function'?window.voclabSpeechRate():.80"));
});
