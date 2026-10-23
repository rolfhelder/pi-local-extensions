import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,nodeExe,piEntry,environment} from './runtime.mjs';
const cwd=path.join(root,'.state/evals/effort-runtime-'+Date.now());await mkdir(cwd,{recursive:true});
const requests=[],events=[],waiters=new Map();let buffer='',stderr='';
const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;const payload=JSON.parse(body);requests.push(payload);res.writeHead(200,{'Content-Type':'text/event-stream'});const base={id:'effort-test',object:'chat.completion.chunk',created:1,model:payload.model};res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{role:'assistant',content:'OK'},finish_reason:null}]})+'\n\n');res.write('data: '+JSON.stringify({...base,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:1,total_tokens:11}})+'\n\n');res.end('data: [DONE]\n\n');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
await writeFile(path.join(cwd,'models.json'),JSON.stringify({providers:{'local-llama':{baseUrl:`http://127.0.0.1:${server.address().port}/v1`,api:'openai-completions',apiKey:'local',models:['omnicoder','gpt-oss'].map(name=>({id:name+'-local',reasoning:true,input:['text'],contextWindow:131072,maxTokens:8192,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}))}}}));
const preference=path.join(cwd,'preferences.json'),restart=path.join(cwd,'restart.json');
const child=spawn(nodeExe,[piEntry,'--mode','rpc','--no-session','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--extension',path.join(root,'extensions/effort.mjs'),'--provider','local-llama','--model','omnicoder-local','--thinking','medium'],{cwd,windowsHide:true,env:environment({PI_CODING_AGENT_DIR:cwd,PI_EFFORT_PREFERENCES:preference,PI_LOCAL_RESTART_REQUEST:restart,PI_LOCAL_THINKING_BUDGET:'2048',PI_LOCAL_OUTPUT_CAP:'8192'}),stdio:['pipe','pipe','pipe']});
child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',b=>{buffer+=b;let at;while((at=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,at);buffer=buffer.slice(at+1);try{const e=JSON.parse(line);events.push(e);if(e.type==='response'&&waiters.has(e.id)){waiters.get(e.id)(e);waiters.delete(e.id);}}catch{}}});
const waitFor=async(predicate)=>{const end=Date.now()+30000;while(!predicate()){if(Date.now()>end)throw Error('RPC wait timeout: '+stderr.slice(-600));await new Promise(r=>setTimeout(r,50));}};
const send=async(type,fields={})=>{const id='r'+Math.random();const response=new Promise(resolve=>waiters.set(id,resolve));child.stdin.write(JSON.stringify({id,type,...fields})+'\n');const timer=new Promise((_,reject)=>setTimeout(()=>reject(Error('RPC response timeout '+type+': '+stderr.slice(-600))),30000).unref());const result=await Promise.race([response,timer]);assert.equal(result.success,true,JSON.stringify(result));return result;};
try{
 const commands=await send('get_commands');assert.ok(commands.data.commands.some(c=>c.name==='effort'));assert.ok(commands.data.commands.some(c=>c.name==='local-model'));
 await send('prompt',{message:'/effort high'});await waitFor(()=>events.some(e=>e.method==='notify'&&e.message?.includes('current session only')));
 await assert.rejects(readFile(preference,'utf8'),{code:'ENOENT'});
 assert.equal((await send('get_state')).data.thinkingLevel,'high');
 await send('prompt',{message:'Reply OK'});await waitFor(()=>events.some(e=>e.type==='agent_end'));
 assert.equal(requests.length,1);assert.equal(requests[0].reasoning_budget_tokens,4096);assert.equal(requests[0].chat_template_kwargs.enable_thinking,true);
 // Pi App's switch calls SDK setThinkingLevel rather than the TUI event.
 await send('set_thinking_level',{level:'low'});
 const ended=events.filter(e=>e.type==='agent_end').length;
 await send('prompt',{message:'Reply OK again'});await waitFor(()=>events.filter(e=>e.type==='agent_end').length>ended);
 assert.equal(requests.length,2);assert.equal(requests[1].reasoning_budget_tokens,512);
 await send('prompt',{message:'/effort high --save'});await waitFor(()=>events.some(e=>e.method==='notify'&&e.message?.includes('Saved')));
 assert.equal(JSON.parse(await readFile(preference,'utf8')).omnicoder,'high');assert.equal(requests.length,2);
 await send('prompt',{message:'/local-model gemma'});await waitFor(()=>events.some(e=>e.method==='notify'&&e.message?.includes('Switching')));
 // RPC prompt acknowledgements precede extension execution; one read-only round
 // trip lets the RPC loop observe the subsequently requested idle shutdown.
 await send('get_state');
 await waitFor(()=>child.exitCode!==null);assert.equal(JSON.parse(await readFile(restart,'utf8')).model,'gemma');
 const report={commandsRegistered:true,noLlmCallForEffort:true,sessionOnlyByDefault:true,explicitSavePersists:true,highBudgetTransmitted:requests[0].reasoning_budget_tokens,sdkSwitchLowBudgetTransmitted:requests[1].reasoning_budget_tokens,modelRestartRequested:true,stderr};await writeFile(path.join(cwd,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{child.kill();server.close();}
