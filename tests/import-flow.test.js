'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const js=fs.readFileSync(require('node:path').join(__dirname,'../assets/import-learn.js'),'utf8');
const sampleWords=Array.from({length:30},(_,i)=>({word:'Word'+String(i+1),type:'n',arabic:'معنى',english_definition:'Meaning of Word'+String(i+1),example:'Example for Word'+String(i+1),source_excerpt:'Word'+String(i+1),ipa:'/wɜːd/'}));
const generated=Array.from({length:3},(_,i)=>({kind:'mcq',word:'Word'+String(i+1),prompt:'What does Word'+String(i+1)+' mean?',options:['A','B','C','D'],answer:'A',explanation:'A is correct'}));
const tick=()=>new Promise(resolve=>setTimeout(resolve,50));
test('large import switches setup -> paginated review -> standalone quiz -> saved replay',async()=>{
  const dom=new JSDOM('<!doctype html><html><head></head><body><header></header><div id="p-files"></div><button class="tab" data-p="files"></button></body></html>',{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://voclab.website'
  });
  const {window}=dom;
  window.scrollTo=()=>{};
  const audioCalls=[];
  window.speak=(phrase,locale)=>audioCalls.push({phrase,locale});
  let modeCalls=[];
  window.fetch=async(_url,opts)=>{
    const body=JSON.parse(opts.body);
    modeCalls.push(body.mode);
    return {ok:true,json:async()=>body.mode==='file'
      ? {words:sampleWords,file_processing:{document_type:'mixed',sampled:false}}
      : {questions:generated}};
  };
  window.eval(js);
  const get=id=>window.document.getElementById(id);
  assert.equal(window.document.querySelector('#p-files').dataset.flowStage,'setup');
  assert.equal(window.document.querySelectorAll('.voc-flow-view').length,4);
  const input=get('vocImportFile');
  const file=new window.File(['This is a test vocabulary document.'], 'lesson.txt', {type:'text/plain'});
  Object.defineProperty(input,'files',{configurable:true,value:[file]});
  get('vocImportAnalyze').click();
  for(let i=0;i<30 && window.document.querySelector('#p-files').dataset.flowStage!=='review';i++)await tick();
  assert.equal(window.document.querySelector('#p-files').dataset.flowStage,'review');
  assert.equal(modeCalls[0],'file');
  assert.equal(window.document.querySelectorAll('#vocImportRows label').length,5);
  const firstRow=window.document.querySelector('#vocImportRows label');
  const selectedBefore=firstRow.querySelector('input[type="checkbox"]').checked;
  const wordAudio=firstRow.querySelectorAll('.voc-import-audio-button');
  assert.equal(wordAudio.length,4,'US/UK buttons for word and example');
  wordAudio[0].click();
  wordAudio[1].click();
  wordAudio[2].click();
  assert.deepEqual(audioCalls.slice(0,3),[
    {phrase:'Word1',locale:'en-US'},
    {phrase:'Word1',locale:'en-GB'},
    {phrase:'Example for Word1',locale:'en-US'}
  ]);
  assert.equal(firstRow.querySelector('input[type="checkbox"]').checked,selectedBefore,'audio must not toggle word selection');
  assert.equal(window.document.querySelector('#vocImportResults').parentElement,window.document.querySelectorAll('.voc-flow-view')[1]);
  window.document.querySelector('.voc-review-pagination button:last-child').click();
  assert.equal(window.document.querySelectorAll('#vocImportRows label').length,5);
  get('vocImportQuiz').click();
  assert.equal(window.document.querySelector('#p-files').dataset.flowStage,'practice');
  assert.ok(get('vocImportPracticeOutput').querySelector('.voc-quiz-progress'),'estimated quiz progress visible during generation');
  assert.ok(get('vocImportPracticeOutput').querySelector('[role="progressbar"]'));
  for(let i=0;i<30 && !get('vocImportPracticeOutput').querySelector('.voc-import-quiz');i++)await tick();
  assert.equal(modeCalls[1],'quiz');
  assert.ok(get('vocImportPracticeOutput').querySelector('.voc-import-quiz'));
  const meter=get('vocImportPracticeOutput').querySelector('.voc-import-quiz [role="progressbar"]');
  assert.ok(meter,'actual completion meter appears inside quiz');
  assert.equal(meter.getAttribute('aria-valuenow'),'0');
  get('vocImportPracticeOutput').querySelector('.voc-import-answer').click();
  const checkButton=[...get('vocImportPracticeOutput').querySelectorAll('button')].find(b=>b.textContent==='Check answer');
  checkButton.click();
  checkButton.click();
  const nextMeter=get('vocImportPracticeOutput').querySelector('.voc-import-quiz [role="progressbar"]');
  assert.equal(Number(nextMeter.getAttribute('aria-valuenow'))>0,true,'progress increases after answering question');
  assert.equal([...window.document.querySelectorAll('.voc-flow-view')].filter(x=>!x.hidden).length,1);
  window.document.querySelector('[data-stage="saved"]').click();
  assert.equal(window.document.querySelector('#p-files').dataset.flowStage,'saved');
  assert.ok(get('vocImportSavedQuizzes').querySelector('button'));
  get('vocImportSavedQuizzes').querySelector('button').click();
  assert.equal(window.document.querySelector('#p-files').dataset.flowStage,'practice');
  assert.equal(modeCalls.length,2,'replays should not call the AI');
  dom.window.close();
});
