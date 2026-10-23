import {performance} from 'node:perf_hooks';
import {randomUUID} from 'node:crypto';
import path from 'node:path';

export const ms=value=>Math.round(Math.max(0,value)*1000)/1000;
export function sessionIdentity(ctx,env=process.env){
 const current=ctx.sessionManager.getSessionFile();
 const file=current?path.resolve(ctx.cwd,current):null;
 const supplied=env.PI_SESSION_FILE?path.resolve(ctx.cwd,env.PI_SESSION_FILE):null;
 const key=p=>process.platform==='win32'?p?.toLowerCase():p;
 return {session_id:ctx.sessionManager.getSessionId(),session_file:file,persistence:file?'session_jsonl':'in_memory',
  session_path_source:'session_manager',env_session_path:supplied?(key(file)===key(supplied)?'matches':'mismatch_ignored'):'unset_normal_in_sdk'};
}
function union(intervals){
 let total=0,end=-Infinity;
 for(const [a,b] of intervals.toSorted((x,y)=>x[0]-y[0])){total+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
 return ms(total);
}
export class RunTiming {
 constructor(identity,{clock=()=>performance.now(),wall=()=>Date.now(),start,startedAt}={}){
  this.clock=clock;this.wall=wall;this.start=start??clock();this.startedAt=startedAt??wall();this.identity=identity;this.id=randomUUID();
  this.promptStartSource=start===undefined?'before_agent_start_or_turn_start':'input_hook';
  this.calls=[];this.openTools=new Map();this.thoughts=[];this.openThoughts=new Map();this.thoughtSeen=false;this.thoughtIncomplete=false;
  this.turnStart=this.start;this.turnNumber=0;this.toolOffset=0;this.requestCount=0;this.messageNumber=0;this.lastResponseEnd=null;this.lastStop=null;this.additionalInputs=0;
 }
 startTurn(index){this.turnStart=this.clock();this.turnNumber++;this.sdkTurnIndex=index;this.toolOffset=this.calls.length;}
 startMessage(){this.messageNumber++;}
 updateMessage(event){
  const t=this.clock(),kind=event.type,key=this.messageNumber+':'+(event.contentIndex??0);
  if(kind==='thinking_start'||kind==='thinking_delta'){this.thoughtSeen=true;if(!this.openThoughts.has(key))this.openThoughts.set(key,t);}
  if(kind==='thinking_end')this.closeThought(key,t,false);
 }
 closeThought(key,end,incomplete){const start=this.openThoughts.get(key);if(start===undefined)return;this.thoughts.push([start,end]);this.openThoughts.delete(key);this.thoughtIncomplete ||= incomplete;}
 endMessage(stopReason){const now=this.clock();for(const key of this.openThoughts.keys())this.closeThought(key,now,true);this.lastResponseEnd=now;this.lastStop=stopReason;return now;}
 startTool(event){this.openTools.set(event.toolCallId,{id:event.toolCallId,name:event.toolName,parent:event.parentToolCallId??null,start:this.clock()});}
 endTool(event){
  const open=this.openTools.get(event.toolCallId),end=this.clock();this.openTools.delete(event.toolCallId);
  const known=Number.isFinite(event.durationMs)&&event.durationMs>=0;
  this.calls.push({tool_call_id:event.toolCallId,tool_name:event.toolName,parent_tool_call_id:event.parentToolCallId??open?.parent??null,
   execution_ms:known?ms(event.durationMs):0,event_interval_ms:open?ms(end-open.start):null,
   executed:known,status:event.isError?'error':'completed',duration_source:known?'pi_execute_monotonic':'not_executed_per_pi_contract',
   interval:open?[open.start,end]:null});
 }
 snapshot(scope,end=this.clock()){
  const calls=this.calls.filter(c=>!c.interval||c.interval[1]<=end),thoughts=this.thoughts.filter(([,b])=>b<=end);
  const allThoughts=[...thoughts,...[...this.openThoughts.values()].map(a=>[a,end])];
  return {schema_version:1,run_id:this.id,scope,clock:'performance.now_monotonic',precision:'milliseconds_rounded_to_0.001; Pi tool precision retained',
   started_at:new Date(this.startedAt).toISOString(),ended_at:new Date(this.startedAt+(end-this.start)).toISOString(),
   prompt_start_source:this.promptStartSource,wall_timestamp_policy:'start_wall_plus_monotonic_elapsed',
   total_latency_ms:ms(end-this.start),turn_latency_ms:ms(end-this.turnStart),
   tool_execution_ms:ms(calls.reduce((sum,c)=>sum+c.execution_ms,0)),
   top_level_tool_execution_ms:ms(calls.filter(c=>!c.parent_tool_call_id).reduce((sum,c)=>sum+c.execution_ms,0)),
   tool_wall_ms:union(calls.flatMap(c=>c.interval?[c.interval]:[])),tool_call_count:calls.length,
   open_tool_call_count:this.openTools.size,
   thought_time_ms:this.thoughtSeen?union(allThoughts):null,
   thought_measurement:this.thoughtSeen?'observed_thinking_stream_wall_time':'not_observed',
   thought_timing_complete:this.thoughtSeen?!this.thoughtIncomplete&&this.openThoughts.size===0:null,
   internal_reasoning_compute_ms:null,provider_request_count:this.requestCount,
   turn_number:this.turnNumber,sdk_turn_index:this.sdkTurnIndex??null,stop_reason:this.lastStop,additional_input_count:this.additionalInputs};
 }
 turnTools(){return this.calls.slice(this.toolOffset).map(({interval,...call})=>call);}
}
