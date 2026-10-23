// Real Pi RPC + scripted HTTP provider. No GPU or external API is used.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,nodeExe,piEntry,environment} from './runtime.mjs';
const base=path.join(root,'.state/evals/session-telemetry-'+Date.now());
const agent=path.join(base,'agent'),session=path.join(base,'sessions with spaces/live.jsonl');
await mkdir(agent,{recursive:true});await mkdir(path.dirname(session),{recursive:true});await writeFile(path.join(base,'note.txt'),'fixture');
const requests=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{
 let body='';for await(const b of req)body+=b;const payload=JSON.parse(body);requests.push(payload);
 res.writeHead(200,{'Content-Type':'text/event-stream'});
 const emit=(delta,finish=null)=>res.write('data: '+JSON.stringify({id:'telemetry-'+requests.length,object:'chat.completion.chunk',created:1,model:'telemetry-local',choices:[{index:0,delta,finish_reason:finish}]})+'\n\n');
 emit({role:'assistant',reasoning_content:'Planning'});await pause(25);emit({reasoning_content:' a small test.'});await pause(25);
 if(requests.length===3){req.on('close',()=>res.end());return;} // deliberate abort fixture
 if(requests.length===1){
  const shell=process.platform==='win32'?'powershell':'bash';
  const command=process.platform==='win32'?'Start-Sleep -Milliseconds 60; Write-Output $env:PI_SESSION_FILE':'sleep 0.06; printf "%s" "$PI_SESSION_FILE"';
  emit({tool_calls:[{index:0,id:'shell',type:'function',function:{name:shell,arguments:JSON.stringify({command})}},{index:1,id:'read',type:'function',function:{name:'read',arguments:JSON.stringify({path:'note.txt'})}}]});emit({},'tool_calls');
 }else{emit({content:'done'});emit({},'stop');}
 res.end('data: [DONE]\n\n');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
await writeFile(path.join(agent,'models.json'),JSON.stringify({providers:{'local-llama':{baseUrl:`http://127.0.0.1:${server.address().port}/v1`,api:'openai-completions',apiKey:'local',models:[{id:'telemetry-local',reasoning:true,input:['text'],contextWindow:32768,maxTokens:2048,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}]}}}));
const wrong=path.join(base,'wrong-session.jsonl');let child;
function launch(){
 const events=[],waiting=new Map();let buffer='',stderr='';
 child=spawn(nodeExe,[piEntry,'--mode','rpc','--session',session,'--tools',process.platform==='win32'?'read,powershell':'read,bash','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files','--extension',path.join(root,'extensions/session-telemetry.mjs'),'--provider','local-llama','--model','telemetry-local','--thinking','medium'],{cwd:base,windowsHide:true,env:environment({PI_CODING_AGENT_DIR:agent,PI_SESSION_FILE:wrong}),stdio:['pipe','pipe','pipe']});
 child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',b=>{buffer+=b;let n;while((n=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,n);buffer=buffer.slice(n+1);try{const e=JSON.parse(line);events.push(e);if(e.type==='response'&&waiting.has(e.id)){waiting.get(e.id)(e);waiting.delete(e.id);}}catch{}}});
 const until=async predicate=>{const end=Date.now()+15000;while(!predicate()){if(Date.now()>end)throw Error('RPC timeout: '+stderr.slice(-800));await pause(20);}};
 const send=async(type,data={})=>{const id='t'+Math.random();let timer;const result=await Promise.race([new Promise(r=>{waiting.set(id,r);child.stdin.write(JSON.stringify({id,type,...data})+'\n');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('RPC '+type+' timed out: '+stderr.slice(-600))),15000);})]).finally(()=>clearTimeout(timer));assert.equal(result.success,true,JSON.stringify(result));return result;};
 return {events,until,send,stderr:()=>stderr};
}
const load=async()=> (await readFile(session,'utf8')).trim().split('\n').map(JSON.parse);
try{
 let rpc=launch();await rpc.send('prompt',{message:'Exercise only the scripted tools.'});await rpc.until(()=>rpc.events.some(e=>e.type==='agent_settled'));
 let entries=await load();const assistants=entries.filter(e=>e.type==='message'&&e.message.role==='assistant');const turns=entries.filter(e=>e.customType==='session-telemetry.turn');
 let runs=entries.filter(e=>e.customType==='session-telemetry.run');
 assert.equal(assistants.length,2);assert.equal(turns.length,2);assert.equal(runs.length,1);
 for(const e of assistants){assert.ok(e.message.telemetry.total_latency_ms>0);assert.ok(e.message.telemetry.thought_time_ms>0);assert.equal(e.message.telemetry.internal_reasoning_compute_ms,null);}
 assert.equal(runs[0].data.telemetry.total_latency_ms,assistants.at(-1).message.telemetry.total_latency_ms,'run ends at the final answer');
 assert.ok(assistants.at(-1).message.telemetry.total_latency_ms>assistants[0].message.telemetry.total_latency_ms,'one prompt spans multiple model/tool turns');
 const toolResults=entries.filter(e=>e.type==='message'&&e.message.role==='toolResult');
 assert.equal(toolResults.length,2);assert.equal(runs[0].data.telemetry.tool_execution_ms,toolResults.reduce((s,e)=>s+e.message.durationMs,0));
 assert.equal(runs[0].data.session_file,session);assert.equal(runs[0].data.env_session_path,'mismatch_ignored');
 assert.ok(toolResults.find(e=>e.message.toolCallId==='shell').message.content.some(c=>c.text?.includes(session)));
 assert.ok(requests.every(r=>r.messages.every(m=>!Object.hasOwn(m,'telemetry'))),'telemetry must not enter provider messages');
 await rpc.send('prompt',{message:'Abort fixture.'});await rpc.until(()=>requests.length===3);await pause(100);await rpc.send('abort');await rpc.until(()=>rpc.events.filter(e=>e.type==='agent_settled').length===2);
 entries=await load();runs=entries.filter(e=>e.customType==='session-telemetry.run');assert.equal(runs.at(-1).data.telemetry.status,'aborted');
 const prefix=await readFile(session,'utf8');child.stdin.end();await rpc.until(()=>child.exitCode!==null);assert.equal(rpc.stderr(),'');
 rpc=launch();await rpc.send('prompt',{message:'Resume fixture.'});await rpc.until(()=>rpc.events.some(e=>e.type==='agent_settled'));
 const resumed=await readFile(session,'utf8');assert.ok(resumed.startsWith(prefix));assert.ok(resumed.endsWith('\n'));
 entries=await load();assert.equal(new Set(entries.map(e=>e.id)).size,entries.length);assert.equal(entries.filter(e=>e.customType==='session-telemetry.run').length,3);
 const report={assistantTelemetry:true,turnRecords:true,toolSumMatchesPi:true,thinkingObserved:true,wrongEnvIgnored:true,shellEnvCorrect:true,abortRecorded:true,resumeAppends:true,noProviderContextPollution:true,artifactDirectory:base};
 await writeFile(path.join(base,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{child?.kill();server.closeAllConnections();server.close();}
