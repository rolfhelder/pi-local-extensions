import {readFileSync} from 'node:fs';
const config=JSON.parse(readFileSync(new URL('../config/effort.json',import.meta.url),'utf8'));
export const budgets=config.budgets,capabilities=config.models;
export function levels(model){return capabilities[model]?.off?['off','low','medium','high']:['low','medium','high'];}
export function canonical(level){return ({minimal:'low',xhigh:'high',max:'high'})[level]||level;}
export function applyEffort(payload,model,level,customBudget){
  level=canonical(level);
  if(!levels(model).includes(level))throw Error(`${model} supports ${levels(model).join(', ')}; off is not supported for GPT-OSS`);
  const result={...payload,chat_template_kwargs:{...payload.chat_template_kwargs,enable_thinking:level!=='off'}};
  result.reasoning_effort=level==='off'?'none':model==='gpt-oss'?level:undefined;
  if(result.reasoning_effort===undefined)delete result.reasoning_effort;
  const cap=result.max_tokens??result.max_completion_tokens??8192;
  result.reasoning_budget_tokens=Math.max(0,Math.min(customBudget??budgets[level],Math.max(0,cap-1024)));
  return result;
}
export function modelKey(id){return id?.replace(/-local$/,'');}
export function rewriteSubmit(text){return text==='/model'||text.startsWith('/model ')?text.replace(/^\/model/,'/local-model'):text;}
