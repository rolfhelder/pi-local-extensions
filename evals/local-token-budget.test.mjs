import test from 'node:test';
import assert from 'node:assert/strict';
import extension,{responseBudget} from '../extensions/local-token-budget.mjs';
test('real 102k prompt retains full output budget in native 128k window',()=>assert.equal(responseBudget(131072,101928,8192),8192));
test('budget respects real remaining space and rejects actual overflow',()=>{assert.equal(responseBudget(131072,129000,8192),1560);assert.throws(()=>responseBudget(131072,131000,8192),/overflow/);});
test('hook leaves other providers alone',async()=>{let hook;extension({on:(name,handler)=>hook=handler});const payload={messages:[],max_tokens:1};assert.equal(await hook({payload},{model:{provider:'other',id:'gpt-oss-local'}}),undefined);assert.equal(payload.max_tokens,1);});
test('hook restores a clamped request using formatted messages and tools',async()=>{
 const previousFetch=globalThis.fetch,previousEnv={...process.env};const calls=[];
 try{
  Object.assign(process.env,{PI_LOCAL_TOKENIZER_URL:'http://127.0.0.1:48763',PI_LOCAL_CONTEXT:'131072',PI_LOCAL_OUTPUT_CAP:'8192',PI_LOCAL_BUDGET_LOG:''});
  globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>url.endsWith('/apply-template')?{prompt:'formatted tools and messages'}:{tokens:Array(101928).fill(0)}};};
  let hook;extension({on:(name,handler)=>hook=handler});const payload={messages:[{role:'user',content:'long prompt'}],tools:[{type:'function',function:{name:'read'}}],max_completion_tokens:1};
  const result=await hook({payload},{model:{provider:'local-llama',id:'gpt-oss-local'}});
  assert.equal(result.max_completion_tokens,8192);assert.deepEqual(calls[0].body.tools,payload.tools);assert.equal(calls[1].body.content,'formatted tools and messages');assert.equal(calls.length,2);
 }finally{globalThis.fetch=previousFetch;process.env=previousEnv;}
});
