import guard from 'pi-guard/src/index.ts';
// Keep upstream's Bash parser/file matcher; unrelated tools remain automatic.
export default function(pi) {
  guard(new Proxy(pi, { get(target, key) {
    if (key !== 'on') return Reflect.get(target, key);
    return (event, handler) => target.on(event, event === 'tool_call'
      ? async (call, ctx) => ['bash','write','edit'].includes(call.toolName) ? handler(call, ctx.mode === 'rpc' && process.env.PI_LOCAL_DESKTOP_UI !== '1' ? new Proxy(ctx, { get: (target, property) => property === 'hasUI' ? false : Reflect.get(target, property) }) : ctx) : undefined
      : handler);
  } }));
}
