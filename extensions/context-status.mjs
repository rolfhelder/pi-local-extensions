export function contextStatus(usage, model) {
  const window = usage?.contextWindow ?? model?.contextWindow;
  const number = value => new Intl.NumberFormat('en-US').format(value);
  if (!window) return 'Context: unknown';
  if (usage?.tokens == null) return `Context: ? / ${number(window)} tokens`;
  const percent = usage.percent ?? usage.tokens / window * 100;
  return `Context: ${number(usage.tokens)} / ${number(window)} tokens (${percent.toFixed(1)}%) [estimate]`;
}
export default function(pi) {
  const update = (_event, ctx) => {
    if (ctx.mode === 'tui') ctx.ui.setStatus('00-context', contextStatus(ctx.getContextUsage(), ctx.model));
  };
  for (const event of ['session_start','model_select','turn_start','turn_end','agent_settled','session_compact','session_compact_failed']) pi.on(event, update);
  pi.on('session_shutdown', (_event, ctx) => { if (ctx.mode === 'tui') ctx.ui.setStatus('00-context', undefined); });
}
