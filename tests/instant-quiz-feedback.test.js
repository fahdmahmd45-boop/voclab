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

test('question changes retain a single progress meter and results return to saved quizzes safely',async()=>{
  const {dom,d}=await makeQuiz({
    kind:'mcq',word:'achieve',prompt:'What does achieve mean?',
    options:['Reach a goal','Avoid a task','Forget a goal','Postpone work'],
    answer:'Reach a goal',explanation:'Achieve means accomplish.'
  });
  const meter=d.querySelector('.voc-quiz-slim-meter');
  assert.ok(meter);
  assert.equal(d.querySelectorAll('.voc-quiz-slim-meter').length,1);
  d.querySelector('.voc-import-answer').click();
  d.querySelector('.voc-quiz-stage button.next').click();
  assert.equal(d.querySelector('.voc-quiz-slim-meter'),meter,'progress node should not be torn down at results');
  assert.equal(d.querySelectorAll('.voc-quiz-slim-meter').length,1);
  assert.equal(d.querySelector('.voc-quiz-results .voc-quiz-result-number').textContent,'1 / 1');
  assert.ok(d.querySelector('.voc-quiz-results button'));
  const saved=JSON.parse(dom.window.localStorage.getItem('engl01_import_quizzes')||'[]');
  assert.equal(saved[0].words[0].word,'achieve','the reviewed source words are persisted for back navigation');
  // Simulate a fresh file selection, which clears the current in-memory word list.
  d.getElementById('vocImportFile').dispatchEvent(new dom.window.Event('change'));
  d.querySelector('.voc-quiz-result-actions button:last-child').click();
  assert.equal(d.getElementById('p-files').dataset.flowStage,'review','saved quiz restores approved vocabulary');
  assert.ok(d.querySelector('#vocImportRows'));
  assert.equal(d.querySelector('#vocImportRows').textContent.includes('achieve'),true);
  assert.equal(d.getElementById('vocImportResults').textContent.includes('No clear target vocabulary'),false);
  dom.window.close();
});

test('older saved quizzes review their real question vocabulary without invented definitions',async()=>{
  const {dom,d}=await makeQuiz({
    kind:'mcq',word:'achieve',prompt:'What does achieve mean?',
    options:['Reach a goal','Avoid a task','Forget a goal','Postpone work'],
    answer:'Reach a goal',explanation:'Achieve means accomplish.'
  });
  const saved=JSON.parse(dom.window.localStorage.getItem('engl01_import_quizzes'));
  delete saved[0].words;
  dom.window.localStorage.setItem('engl01_import_quizzes',JSON.stringify(saved));
  // Re-create the page so the Saved button reads this older stored record,
  // rather than the closure created before the fixture was changed.
  dom.window.eval(script);
  d.querySelector('[data-stage="saved"]').click();
  d.querySelector('#vocImportSavedQuizzes button').click();
  d.querySelector('.voc-import-answer').click();
  d.querySelector('.voc-quiz-stage button.next').click();
  d.querySelector('.voc-quiz-result-actions button:last-child').click();
  assert.equal(d.getElementById('p-files').dataset.flowStage,'review');
  assert.match(d.getElementById('vocImportResults').textContent,/Review the words/);
  assert.match(d.getElementById('vocImportResults').textContent,/achieve/);
  assert.match(d.getElementById('vocImportResults').textContent,/This older quiz did not save full definitions/);
  assert.equal(d.getElementById('vocImportResults').textContent.includes('No clear target vocabulary'),false);
  dom.window.close();
});

test('Review words is enabled during replay and Continue quiz keeps the current question',async()=>{
  const {dom,d,getCalls}=await makeQuiz({
    kind:'mcq',word:'achieve',prompt:'What does achieve mean?',
    options:['Reach a goal','Avoid a task','Forget a goal','Postpone work'],
    answer:'Reach a goal',explanation:'Achieve means accomplish.'
  });
  const nav=d.querySelector('[data-stage="review"]');
  assert.equal(nav.disabled,false,'Review words should be available from Practice');
  d.querySelector('.voc-import-answer').click();
  d.querySelector('.voc-quiz-stage button.next').click();
  assert.equal(d.querySelector('.voc-quiz-result-number').textContent,'1 / 1');
  nav.click();
  assert.equal(d.getElementById('p-files').dataset.flowStage,'review');
  assert.equal(d.querySelectorAll('#vocImportRows label').length,1);
  assert.match(d.querySelector('#vocImportRows').textContent,/achieve/);
  assert.equal(d.querySelectorAll('.voc-return-to-quiz').length,1);
  d.querySelector('.voc-return-to-quiz').click();
  assert.equal(d.getElementById('p-files').dataset.flowStage,'practice');
  assert.equal(d.querySelector('.voc-quiz-result-number').textContent,'1 / 1','quiz progress remains intact');
  assert.equal(getCalls(),2,'reviewing words should not make AI calls');
  dom.window.close();
});

test('older quiz without stored words enables Review words and preserves its question answer and explanation',async()=>{
  const {dom,d,getCalls}=await makeQuiz({
    kind:'mcq',word:'achieve',prompt:'What does achieve mean?',
    options:['Reach a goal','Avoid a task','Forget a goal','Postpone work'],
    answer:'Reach a goal',explanation:'Achieve means accomplish.'
  });
  const saved=JSON.parse(dom.window.localStorage.getItem('engl01_import_quizzes'));
  delete saved[0].words;
  dom.window.localStorage.setItem('engl01_import_quizzes',JSON.stringify(saved));
  dom.window.eval(script);
  d.querySelector('[data-stage="saved"]').click();
  d.querySelector('#vocImportSavedQuizzes button').click();
  const nav=d.querySelector('[data-stage="review"]');
  assert.equal(nav.disabled,false);
  nav.click();
  assert.equal(d.getElementById('p-files').dataset.flowStage,'review');
  const review=d.querySelector('.voc-legacy-review');
  assert.ok(review);
  assert.match(review.textContent,/Quiz answer: Reach a goal/);
  assert.match(review.textContent,/Achieve means accomplish/);
  assert.equal(review.querySelectorAll('.voc-legacy-word').length,1);
  assert.equal(review.querySelectorAll('.voc-import-audio-button').length,2);
  review.querySelector('.voc-return-to-quiz').click();
  assert.equal(d.getElementById('p-files').dataset.flowStage,'practice');
  assert.equal(getCalls(),2);
  dom.window.close();
});
