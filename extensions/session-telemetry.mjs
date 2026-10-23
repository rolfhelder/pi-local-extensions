import {performance} from 'node:perf_hooks';
import {RunTiming,sessionIdentity} from './session-telemetry-core.mjs';

// All writes go through Pi's existing single session writer. Never append to a
// guessed PI_SESSION_FILE independently and never rewrite a live transcript.
export default function sessionTelemetry(pi){
 let run,pending,last;
 const activeFor=ctx=>run&&run.identity.session_id===ctx.sessionManager.getSessionId();
 const finish=(ctx,status)=>{
  if(!activeFor(ctx)){run=undefined;return;}
  const now=performance.now(),end=status==='completed'?Math.max(run.lastResponseEnd??run.start,...run.calls.map(call=>call.interval?.[1]??run.start)):now;
  last={...run.identity,telemetry:{...run.snapshot('run',end),status,settlement_latency_ms:Math.max(0,now-run.start)}};
  pi.appendEntry('session-telemetry.run',last);run=undefined;
 };
 pi.on('input',(_event,ctx)=>{if(activeFor(ctx))run.additionalInputs++;else pending={start:performance.now(),startedAt:Date.now()};});
 pi.on('before_agent_start',(_event,ctx)=>{
  if(run)finish(ctx,'interrupted');
  run=new RunTiming(sessionIdentity(ctx),_event.messageType==='custom'?{}:pending??{});pending=undefined;
 });
 pi.on('turn_start',(event,ctx)=>{if(!activeFor(ctx))run=new RunTiming(sessionIdentity(ctx));run.startTurn(event.turnIndex);});
 pi.on('before_provider_request',(_event,ctx)=>{if(activeFor(ctx))run.requestCount++;});
 pi.on('message_start',(event,ctx)=>{if(activeFor(ctx)&&event.message.role==='assistant')run.startMessage();});
 pi.on('message_update',(event,ctx)=>{if(activeFor(ctx)&&event.message.role==='assistant')run.updateMessage(event.assistantMessageEvent);});
 pi.on('message_end',(event,ctx)=>{
  if(!activeFor(ctx)||event.message.role!=='assistant')return;
  const end=run.endMessage(event.message.stopReason);
  // The pinned SDK's supported message_end replacement runs before its writer.
  // Provider conversion ignores this diagnostic property; integration-tested.
  return {message:{...event.message,telemetry:run.snapshot('assistant_response',end)}};
 });
 pi.on('tool_execution_start',(event,ctx)=>{if(activeFor(ctx))run.startTool(event);});
 pi.on('tool_execution_end',(event,ctx)=>{if(activeFor(ctx))run.endTool(event);});
 pi.on('turn_end',(event,ctx)=>{
  if(!activeFor(ctx))return;
  const data={...run.identity,message_entry_id:event.messageEntryId,tool_result_entry_ids:event.toolResultEntryIds,
   telemetry:{...run.snapshot('turn'),status:event.outcome},tools:run.turnTools()};
  return {entries:[{type:'custom',customType:'session-telemetry.turn',data}]};
 });
 pi.on('agent_settled',(event,ctx)=>finish(ctx,event.aborted?'aborted':run?.lastStop==='error'?'error':'completed'));
 pi.on('session_before_switch',(_event,ctx)=>{if(run)finish(ctx,'interrupted');pending=undefined;});
 pi.on('session_shutdown',(_event,ctx)=>{if(run)finish(ctx,'interrupted');pending=undefined;});
 pi.registerCommand('telemetry',{description:'Show the last run timing summary (no model call)',handler:async(_args,ctx)=>{
  const saved=(last?.session_id===ctx.sessionManager.getSessionId()?last:undefined)??ctx.sessionManager.getBranch().findLast(e=>e.type==='custom'&&e.customType==='session-telemetry.run')?.data;
  if(!saved){ctx.ui.notify('No completed timing record yet. Telemetry starts with the next prompt.','info');return;}
  const t=saved.telemetry;
  ctx.ui.notify(`Last run: ${t.status}; ${(t.total_latency_ms/1000).toFixed(2)} seconds total (${t.total_latency_ms} ms). Tool calls: ${t.tool_execution_ms} ms; observed thinking stream: ${t.thought_time_ms??'unavailable'} ms. Tool sum may overlap; hidden reasoning compute is not measurable.`,'info');
 }});
}
