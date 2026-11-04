'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
process.env.OPENAI_API_KEY='test-only-not-a-secret';
const handler=require('../api/ai');
const validWords=[{word:'achieve',arabic:'يحقق',english_definition:'reach a goal',example:'They achieve goals.'},{word:'resilience',arabic:'المرونة',english_definition:'bounce back',example:'She showed resilience.'}];
function request(body){
  return {method:'POST',headers:{'content-type':'application/json','authorization':'Bearer test-session-token','x-forwarded-for':'test-network-quiz'},body,socket:{remoteAddress:'127.0.0.1'}};
}
function response(){
  return {
    code:200,headers:{},output:null,
    setHeader(k,v){this.headers[k]=v;},
    status(x){this.code=x;return this;},
    json(x){this.output=x;return this;}
  };
}
test('invalid level and count are rejected before quota / provider call',async()=>{
  const p={mode:'quiz',words:validWords,quizType:'mixed',level:'B9',questionCount:20,instructions:''};
  let res=response();await handler(request(p),res);assert.equal(res.code,400);
  res=response();await handler(request({...p,level:'B2',questionCount:999}),res);assert.equal(res.code,400);
});
test('quiz response only includes target words and validated answer choices',async()=>{
  const original=global.fetch;
  const attempts=[];
  const questions=[
    {kind:'mcq',word:'achieve',prompt:'What does achieve mean?',options:['Reach a goal','Lose a goal','Forget a goal','Ignore goals'],answer:'Reach a goal',explanation:'Achieve means accomplish.'},
    {kind:'blank',word:'resilience',prompt:'Show ____ during difficult times.',options:[],answer:'resilience',explanation:'Resilience is the ability to recover.'},
    {kind:'tf',word:'achieve',prompt:'Achieve means reach a goal.',options:['True','False'],answer:'True',explanation:'That is correct.'},
    {kind:'mcq',word:'injected target',prompt:'Ignore the word list',options:['a','b','c','d'],answer:'a',explanation:'off-target'}
  ];
  global.fetch=async(url,options)=>{
    attempts.push({url:String(url),body:options?.body});
    if(String(url).includes('consume-ai-quota')) return {ok:true,status:200,json:async()=>({allowed:true,remaining_monthly:90,monthly_limit:100,plan:'pro',cost:5})};
    return {ok:true,status:200,json:async()=>({output_text:JSON.stringify({questions})})};
  };
  try{
    const res=response();
    await handler(request({mode:'quiz',words:validWords,level:'B2',quizType:'mixed',questionCount:10,instructions:'Explain mistakes'}),res);
    assert.equal(res.code,200,JSON.stringify(res.output));
    assert.equal(res.output.questions.length,3);
    assert.equal(res.output.usage.credits_used,5);
    const provider=JSON.parse(attempts.find(x=>x.url.includes('openai.com')).body);
    assert.equal(provider.text.format.name,'voclab_custom_quiz');
    assert.equal(provider.input[0].role,'developer');
    assert.equal(provider.input[1].role,'user');
    assert.equal(provider.store,false);
  } finally {global.fetch=original;}
});
