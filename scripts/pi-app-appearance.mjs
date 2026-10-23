// Pi App 0.7.6 already publishes context percentage in its accessible tooltip.
// Its supported custom-CSS setting can expose it without renderer code changes.
const begin='/* local-ai context indicator: begin */';
const end='/* local-ai context indicator: end */';
const indicator='.composer-metrics-inline > [role="img"]:has(> .composer-context-ring)';
export function contextIndicatorCss(){
 const rules=[begin,
 `${indicator} { --local-ai-context-fill:0%; width:140px; min-width:140px; height:28px; display:flex; flex-direction:column; gap:2px; padding:0; color:var(--text-secondary); }`,
 `${indicator} > .composer-context-ring { display:none; }`,
 `${indicator}::before { content:""; display:block; width:100%; height:14px; flex:none; border-radius:4px; background:linear-gradient(to right, #56b9ad 0 var(--local-ai-context-fill), color-mix(in srgb, var(--text-secondary) 20%, transparent) var(--local-ai-context-fill) 100%); }`,
 `${indicator}:has(> .is-high)::before { background:linear-gradient(to right, #d87878 0 var(--local-ai-context-fill), color-mix(in srgb, var(--text-secondary) 20%, transparent) var(--local-ai-context-fill) 100%); }`,
 `${indicator}::after { content:attr(aria-label); display:block; width:100%; height:12px; flex:none; overflow:hidden; text-indent:-8ch; font:500 10px/12px Consolas,monospace; font-variant-numeric:tabular-nums; white-space:nowrap; }`,
 `${indicator}[aria-label^="上下文 "]::after { text-indent:-7ch; }`];
 // Whole percent, rounded down from the app's existing one-decimal estimate.
 // Boundaries prevent e.g. 7% matching 17%; support both shipped locales.
 for(let n=0;n<=100;n++)rules.push(`${indicator}[aria-label*="(${n}." ], ${indicator}[aria-label*="（${n}." ], ${indicator}[aria-label$="(${n}%)"], ${indicator}[aria-label$="（${n}%）"] { --local-ai-context-fill:${n}%; }`);
 return rules.concat(end).join('\n');
}
export function contextAppearance(previous={}){
 const existing=previous.enabled?String(previous.css??''):'';
 const start=existing.indexOf(begin),stop=existing.indexOf(end,start);
 const preserved=start>=0&&stop>=0?existing.slice(0,start)+existing.slice(stop+end.length):existing;
 return {enabled:true,css:preserved.trimEnd()+'\n'+contextIndicatorCss()};
}
