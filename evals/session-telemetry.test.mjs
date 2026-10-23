import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {RunTiming,sessionIdentity} from '../extensions/session-telemetry-core.mjs';
import extension from '../extensions/session-telemetry.mjs';

test('monotonic durations retain fractional milliseconds despite wall-clock changes',()=>{
 let now=10.125,wall=100000;const t=new RunTiming({},{clock:()=>now,wall:()=>wall});t.startTurn(0);wall=-500000;now=23.75;
 const s=t.snapshot('turn');assert.equal(s.total_latency_ms,13.625);assert.equal(s.started_at,'1970-01-01T00:01:40.000Z');assert.equal(s.thought_time_ms,null);
});
test('parallel and nested tool sums remain distinct from wall time; missing execution is not fabricated',()=>{
 let now=0;const t=new RunTiming({},{clock:()=>now});
 t.startTool({toolCallId:'a',toolName:'shell'});now=5;t.startTool({toolCallId:'a/1',toolName:'read',parentToolCallId:'a'});
 now=10;t.startTool({toolCallId:'b',toolName:'browser'});now=20;t.endTool({toolCallId:'a/1',toolName:'read',parentToolCallId:'a',durationMs:15});
 now=30;t.endTool({toolCallId:'a',toolName:'shell',durationMs:30});now=40;t.endTool({toolCallId:'b',toolName:'browser',durationMs:30,isError:true});
 t.endTool({toolCallId:'blocked',toolName:'write',isError:true});const s=t.snapshot('turn');
 assert.equal(s.tool_execution_ms,75);assert.equal(s.top_level_tool_execution_ms,60);assert.equal(s.tool_wall_ms,40);assert.equal(s.tool_call_count,4);
 assert.equal(t.turnTools().at(-1).executed,false);assert.equal(t.turnTools()[2].status,'error');
});
test('thinking measures observed phases only and flags a truncated phase',()=>{
 let now=0;const t=new RunTiming({},{clock:()=>now});t.startMessage();now=10;t.updateMessage({type:'thinking_start',contentIndex:0});
 now=20;t.updateMessage({type:'thinking_delta',contentIndex:0});now=25;t.updateMessage({type:'thinking_end',contentIndex:0});
 now=30;t.endMessage('stop');assert.equal(t.snapshot('assistant_response').thought_time_ms,15);assert.equal(t.snapshot('turn').thought_timing_complete,true);
 t.startMessage();now=40;t.updateMessage({type:'thinking_delta',contentIndex:0});now=50;t.endMessage('aborted');
 assert.equal(t.snapshot('turn').thought_time_ms,25);assert.equal(t.snapshot('turn').thought_timing_complete,false);assert.equal(t.snapshot('turn').internal_reasoning_compute_ms,null);
});
test('session manager wins over stale shell env; ephemeral sessions stay in memory',()=>{
 const cwd=path.resolve('.'),file=path.join(cwd,'current.jsonl');const ctx={cwd,sessionManager:{getSessionFile:()=>file,getSessionId:()=> 's'}};
 assert.equal(sessionIdentity(ctx,{PI_SESSION_FILE:path.join(cwd,'wrong.jsonl')}).env_session_path,'mismatch_ignored');
 assert.equal(sessionIdentity(ctx,{}).session_file,file);ctx.sessionManager.getSessionFile=()=>undefined;assert.equal(sessionIdentity(ctx,{}).persistence,'in_memory');
});
test('hooks enrich response messages and persist one turn/run record through the Pi writer',async()=>{
 const handlers={},written=[];const ctx={cwd:process.cwd(),sessionManager:{getSessionId:()=> 's',getSessionFile:()=>path.resolve('fixture.jsonl')}};
 extension({on:(name,fn)=>handlers[name]=fn,appendEntry:(customType,data)=>written.push({customType,data}),registerCommand:()=>{}});
 handlers.input({},ctx);handlers.before_agent_start({},ctx);handlers.turn_start({turnIndex:0},ctx);handlers.message_start({message:{role:'assistant'}},ctx);
 const enriched=handlers.message_end({message:{role:'assistant',content:[{type:'text',text:'ok'}],stopReason:'stop'}},ctx);
 assert.equal(enriched.message.telemetry.scope,'assistant_response');assert.equal(enriched.message.content[0].text,'ok');
 const turn=handlers.turn_end({messageEntryId:'m1',toolResultEntryIds:[],outcome:'completed'},ctx);assert.equal(turn.entries[0].data.message_entry_id,'m1');
 handlers.agent_settled({aborted:false},ctx);handlers.agent_settled({aborted:false},ctx);assert.equal(written.length,1);assert.equal(written[0].data.telemetry.status,'completed');
});
