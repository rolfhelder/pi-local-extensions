import test from 'node:test';
import assert from 'node:assert/strict';
import extension, { contextStatus } from '../extensions/context-status.mjs';
test('known context, percent and explicit estimate', () => assert.equal(contextStatus({ tokens: 8192, contextWindow: 32768, percent: 25 }), 'Context: 8,192 / 32,768 tokens (25.0%) [estimate]'));
test('unknown usage after compaction is not zero', () => assert.equal(contextStatus({ tokens: null, contextWindow: 32768 }), 'Context: ? / 32,768 tokens'));
test('model window fallback', () => assert.match(contextStatus(undefined, { contextWindow: 131072 }), /\? \/ 131,072/));
test('over capacity remains visible', () => assert.match(contextStatus({ tokens: 40000, contextWindow: 32768 }), /122.1%/));
test('TUI events update status, RPC stays quiet, shutdown clears', () => {
  const hooks = new Map(), calls = [];
  extension({ on: (name, handler) => hooks.set(name, handler) });
  const ctx = { mode: 'tui', model: { contextWindow: 32768 }, getContextUsage: () => ({ tokens: 1000, contextWindow: 32768 }), ui: { setStatus: (...args) => calls.push(args) } };
  hooks.get('turn_end')({}, ctx); hooks.get('turn_end')({}, { ...ctx, mode: 'rpc' });
  assert.equal(calls.length, 1); assert.match(calls[0][1], /1,000/);
  hooks.get('session_shutdown')({}, ctx); assert.equal(calls[1][1], undefined);
});
