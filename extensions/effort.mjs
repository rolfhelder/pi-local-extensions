import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {CustomEditor,getAgentDir} from '@earendil-works/pi-coding-agent';
import {applyEffort,budgets,capabilities,canonical,levels,modelKey,rewriteSubmit} from './effort-core.mjs';
const preferences=process.env.PI_EFFORT_PREFERENCES||path.join(getAgentDir(),'local-ai-effort.json');
const names=Object.fromEntries(Object.entries(capabilities).map(([key,value])=>[key,value.label]));
export default function(pi){
 let customBudget=process.env.PI_LOCAL_THINKING_BUDGET===undefined?undefined:Number(process.env.PI_LOCAL_THINKING_BUDGET);
 let previous='medium',initialized=false;
 const describe=(model,level)=>`${names[model]||model}: ${level}; ${model==='gpt-oss'?'native effort + ':'local '}thinking budget ${customBudget??budgets[level]} tokens; total response cap ${process.env.PI_LOCAL_OUTPUT_CAP||8192}.`;
 const notify=(ctx,text)=>ctx.ui.notify(text,'info');
 const showStatus=ctx=>{if(ctx.mode==='tui')ctx.ui.setStatus('01-effort',`Effort: ${canonical(pi.getThinkingLevel())} [${modelKey(ctx.model?.id)==='gpt-oss'?'native + budget':'budget preset'}]`);};
 const set=async(level,ctx,persist=false)=>{
  const model=modelKey(ctx.model?.id);level=canonical(level.trim().toLowerCase());
  if(!names[model]||!levels(model).includes(level)){notify(ctx,`Supported: ${levels(model).join(', ')}. ${model==='gpt-oss'?'GPT-OSS has native low/medium/high; reasoning off is unsupported.':'These are local token-budget presets, not native model effort levels.'}`);return;}
  if(!ctx.isIdle()){notify(ctx,'Stop the current response before changing effort.');return;}
  customBudget=undefined;pi.setThinkingLevel(level);previous=level;
  if(persist){const saved=JSON.parse(await readFile(preferences,'utf8').catch(()=>'{}'));saved[model]=level;await writeFile(preferences,JSON.stringify(saved,null,2)+'\n');}
  showStatus(ctx);notify(ctx,describe(model,level)+(persist?' Saved for future Pi sessions.':' Applied to the current session only.'));
 };
 pi.registerCommand('effort',{description:'Set real local thinking effort: off/low/medium/high; no argument opens picker',getArgumentCompletions:prefix=>Object.keys(budgets).filter(x=>x.startsWith(prefix)).map(value=>({value,label:value})),handler:async(args,ctx)=>{
  const model=modelKey(ctx.model?.id);if(args.trim()){const parts=args.trim().split(/\s+/);if(parts.length>2||(parts.length===2&&parts[1]!=='--save')){notify(ctx,'Usage: /effort off|low|medium|high [--save]. Without --save, changes apply to this session only.');return;}await set(parts[0],ctx,parts[1]==='--save');return;}
  const level=await ctx.ui.select(describe(model,canonical(pi.getThinkingLevel())),levels(model).map(x=>`${x} — ${budgets[x]} thinking tokens`));
  if(level)await set(level.split(' ')[0],ctx);
 }});
 pi.registerCommand('local-model',{description:'Local model list and effort picker (also shown by /model)',handler:async(args,ctx)=>{
  const current=modelKey(ctx.model?.id);let selected=args.trim();
  if(!selected){const choice=await ctx.ui.select(`Model: ${names[current]}; effort: ${canonical(pi.getThinkingLevel())}`,['Change effort',...Object.entries(names).map(([key,label])=>`${key} — ${label}${key===current?' [loaded]':''} — ${key==='gpt-oss'?'native low/medium/high':'budget presets; thinking on/off'}`)]);if(!choice)return;if(choice==='Change effort'){const level=await ctx.ui.select('Effort',levels(current));if(level)await set(level,ctx);return;}selected=choice.split(' ')[0];}
  if(!names[selected]){notify(ctx,'Models: '+Object.keys(names).join(', '));return;}
  if(selected===current){notify(ctx,describe(current,canonical(pi.getThinkingLevel())));return;}
  if(!process.env.PI_LOCAL_RESTART_REQUEST){notify(ctx,`Start local-ai --model ${selected} to switch the loaded model. This session was not launched by pia.`);return;}
  if(!ctx.isIdle()){notify(ctx,'Stop the current response before switching models.');return;}
  await writeFile(process.env.PI_LOCAL_RESTART_REQUEST,JSON.stringify({model:selected}));notify(ctx,`Switching to ${names[selected]}; pia will reload one model and resume this session.`);ctx.shutdown();
 }});
 pi.on('session_start',async(_event,ctx)=>{
  const saved=JSON.parse(await readFile(preferences,'utf8').catch(()=>'{}')),model=modelKey(ctx.model?.id);
  if(saved[model]&&levels(model).includes(saved[model])){customBudget=undefined;pi.setThinkingLevel(saved[model]);previous=saved[model];}
  previous=canonical(pi.getThinkingLevel());initialized=true;
  showStatus(ctx);
  if(ctx.mode==='tui')ctx.ui.setEditorComponent((tui,theme,keybindings)=>{
   const editor=new CustomEditor(tui,theme,keybindings);let submit;
   Object.defineProperty(editor,'onSubmit',{configurable:true,get:()=>text=>submit?.(rewriteSubmit(text)),set:value=>{submit=value;}});return editor;
  });
 });
 pi.on('thinking_level_select',(_event,ctx)=>{const level=canonical(pi.getThinkingLevel());if(initialized&&level!==previous)customBudget=undefined;previous=level;showStatus(ctx);});
 pi.on('before_provider_request',(event,ctx)=>{
  if(ctx.model?.provider!=='local-llama'||!Array.isArray(event.payload?.messages))return;
  const model=modelKey(ctx.model.id);if(!names[model])return;
  // SDK clients (including Pi App's built-in switch) need not emit the TUI
  // thinking_level_select event. Observe the actual session level here too.
  const level=canonical(pi.getThinkingLevel());if(initialized&&level!==previous)customBudget=undefined;previous=level;
  return applyEffort(event.payload,model,level,customBudget);
 });
 pi.on('session_shutdown',(_event,ctx)=>{if(ctx.mode==='tui')ctx.ui.setStatus('01-effort',undefined);});
}
