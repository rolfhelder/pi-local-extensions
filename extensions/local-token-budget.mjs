// Pi's chars/3.5 first-turn estimate can exceed GPT-OSS's real token count.
// Count the fully formatted local request instead; never enlarge the model window.
import { appendFile } from 'node:fs/promises';
export function responseBudget(window, prompt, cap, safety = 512) {
  if (![window,prompt,cap,safety].every(Number.isSafeInteger) || prompt < 0 || cap < 1 || safety < 0) throw Error('Invalid local token budget');
  const available = window - prompt - safety;
  if (available < 1) throw Error(`Actual local context overflow: ${prompt} prompt tokens in ${window} window`);
  return Math.min(cap, available);
}
export default function(pi) {
  pi.on('before_provider_request', async (event, ctx) => {
    if (ctx.model?.provider !== 'local-llama' || ctx.model?.id !== 'gpt-oss-local') return;
    const payload=event.payload;
    if (!Array.isArray(payload?.messages)) return;
    const url=process.env.PI_LOCAL_TOKENIZER_URL;
    if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(url||'')) throw Error('Local tokenizer URL must be loopback');
    const post=async(route,body)=>{
      const r=await fetch(url+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
      if(!r.ok)throw Error('Local token budget '+route+': '+r.status);
      return r.json();
    };
    const formatted=await post('/apply-template',payload);
    if(typeof formatted.prompt!=='string')throw Error('Local chat template returned no prompt');
    const tokenized=await post('/tokenize',{content:formatted.prompt,add_special:false,parse_special:true});
    if(!Array.isArray(tokenized.tokens))throw Error('Local tokenizer returned no tokens');
    const cap=Number(process.env.PI_LOCAL_OUTPUT_CAP),window=Number(process.env.PI_LOCAL_CONTEXT);
    const actual=tokenized.tokens.length;
    const limit=responseBudget(window,actual,cap);
    const field='max_tokens' in payload?'max_tokens':'max_completion_tokens';
    const before=payload[field];payload[field]=limit;
    if(process.env.PI_LOCAL_BUDGET_LOG)await appendFile(process.env.PI_LOCAL_BUDGET_LOG,JSON.stringify({time:new Date().toISOString(),promptTokens:actual,contextWindow:window,before,after:limit,cap})+'\n');
    return payload;
  });
}
