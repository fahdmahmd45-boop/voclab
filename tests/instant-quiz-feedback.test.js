'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const script=fs.readFileSync(path.join(__dirname,'../assets/import-learn.js'),'utf8');
const tick=()=>new Promise(resolve=>setTimeout(resolve,40));

async function makeQuiz(question){
  const dom=new JSDOM('<!doctype html><html><head></head><body><header></header><div id="p-files"></div><button class="tab" data-p="files"></button></body></html>',{
    runScripts:'dangerously',pretendToBeVisual:true,url:'https://voclab.website'
  });
  const {window}=dom;
  window.scrollTo=()=>{};
  const sounds=[];
  // Browsers with HTML audio should use cached WAV playback.
  // JSDOM tests the Web Audio fallback by default.
  window.AudioContext=class {
    currentTime=0;
    state='running';
    destination={};
    createOscillator(){return {type:'sine',frequency:{setValueAtTime(){}},connect(){},start(){sounds.push('start')},stop(){}};}
    createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}
    close(){return Promise.resolve()}
  };
  let apiCalls=0;
  window.fetch=async(_url,opts)=>{
    const body=JSON.parse(opts.body);apiCalls++;
    return {ok:true,json:async()=>body.mode==='file'
      ? {words:[{word:'achieve',type:'v',arabic:'يحقق',english_definition:'To reach a goal.',example:'We achieve goals.'}],file_processing:{document_type:'list'}}
      : {questions:[question]}};
  };
  window.eval(script);
  const d=window.document;
  Object.defineProperty(d.getElementById('vocImportFile'),'files',{configurable:true,value:[new window.File(['achieve'],'words.txt',{type:'text/plain'})]});
  d.getElementById('vocImportAnalyze').click();
  for(let i=0;i<40 && d.getElementById('p-files').dataset.flowStage!=='review';i++)await tick();
  assert.equal(d.getElementById('p-files').dataset.flowStage,'review');
  d.getElementById('vocImportQuiz').click();
  for(let i=0;i<40 && !d.querySelector('.voc-import-quiz');i++)await tick();
  assert.ok(d.querySelector('.voc-import-quiz'));
  return {dom,d,sounds,getCalls:()=>apiCalls};
}

test('correct multiple choice grades instantly, sounds once and only Next remains',async()=>{
  const {dom,d,sounds,getCalls}=await makeQuiz({
    kind:'mcq',word:'achieve',prompt:'What does achieve mean?',
    options:['Reach a goal','Avoid a task','Forget a goal','Postpone work'],
    answer:'Reach a goal',explanation:'Achieve means accomplish.'
  });
  const options=[...d.querySelectorAll('.voc-import-answer')];
  const next=d.querySelector('.voc-import-quiz button.next');
  assert.equal(next.disabled,true);
  options[0].click();
  assert.equal(d.querySelector('.voc-feedback-correct strong').textContent,'✓ Correct!');
  assert.equal(d.querySelectorAll('.voc-answer-correct').length,1);
  assert.equal(next.disabled,false);
  assert.equal(next.textContent,'View results');
  assert.equal(sounds.length,2,'the success chime has two notes');
  options[1].click();
  assert.equal(sounds.length,2,'cannot change answer or replay success');
  assert.equal(getCalls(),2,'answer click must not call AI');
  dom.window.close();
});

test('wrong multiple choice immediately reveals expected answer and does not play success audio',async()=>{
  const {dom,d,sounds}=await makeQuiz({
    kind:'mcq',word:'achieve',prompt:'What does achieve mean?',
    options:['Reach a goal','Avoid a task','Forget a goal','Postpone work'],
    answer:'Reach a goal',explanation:'Achieve means accomplish.'
  });
  const options=[...d.querySelectorAll('.voc-import-answer')];
  options[1].click();
  assert.equal(d.querySelector('.voc-feedback-incorrect strong').textContent,'✕ Not quite');
  assert.equal(d.querySelector('.voc-correct-answer-text').textContent,'Correct answer: Reach a goal');
  assert.equal(d.querySelector('.voc-answer-correct').textContent,'Reach a goal');
  assert.equal(d.querySelector('.voc-answer-incorrect').textContent,'Avoid a task');
  assert.equal(sounds.length,0);
  assert.equal(options[0].disabled,true);
  dom.window.close();
});

test('typed questions keep explicit Check answer flow',async()=>{
  const {dom,d,sounds}=await makeQuiz({
    kind:'blank',word:'achieve',prompt:'We ____ our goals.',options:[],
    answer:'achieve',explanation:'To successfully reach a goal.'
  });
  const input=d.querySelector('.voc-import-responses input');
  const next=d.querySelector('.voc-import-quiz button.next');
  assert.equal(next.textContent,'Check answer');
  input.value='achieve';
  input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));
  assert.equal(sounds.length,0);
  next.click();
  assert.equal(d.querySelector('.voc-feedback-correct strong').textContent,'✓ Correct!');
  assert.equal(sounds.length,2);
  assert.equal(next.textContent,'View results');
  dom.window.close();
});


test('test-sound button exposes sound controls and reuses audio without AI credits',async()=>{
  const {dom,d,sounds,getCalls}=await makeQuiz({
    kind:'mcq',word:'achieve',prompt:'What does achieve mean?',
    options:['Reach a goal','Avoid a task','Forget a goal','Postpone work'],
    answer:'Reach a goal',explanation:'Achieve means accomplish.'
  });
  const testButton=d.querySelector('.voc-quiz-test-sound');
  assert.ok(testButton);
  testButton.click();
  assert.equal(sounds.length,2,'test button plays the same two-note chime');
  assert.equal(getCalls(),2,'testing sound must not use AI credits');
  assert.match(d.querySelector('.voc-quiz-audio-notice').textContent,/volume/);
  dom.window.close();
});

test('prefers cached HTML WAV for mobile browser and does not create AudioContexts',async()=>{
  const {dom,d,sounds,getCalls}=await makeQuiz({
    kind:'mcq',word:'achieve',prompt:'What does achieve mean?',
    options:['Reach a goal','Avoid a task','Forget a goal','Postpone work'],
    answer:'Reach a goal',explanation:'Achieve means accomplish.'
  });
  let created=0,plays=0,pauses=0;
  dom.window.URL.createObjectURL=()=>{created++;return 'blob:https://voclab.website/mock-sound'};
  dom.window.Audio=class {
    constructor(src){this.src=src;this.currentTime=0;}
    pause(){pauses++;}
    play(){plays++;return Promise.resolve();}
  };
  d.querySelector('.voc-quiz-test-sound').click();
  d.querySelector('.voc-import-answer').click();
  assert.equal(created,1,'audio asset should be created once');
  assert.equal(plays,2,'the same cached audio plays for test and correct answer');
  assert.equal(pauses,2);
  assert.equal(sounds.length,0,'Web Audio fallback is not used when WAV playback succeeds');
  assert.equal(getCalls(),2,'sound must never make extra API calls');
  dom.window.close();
});
