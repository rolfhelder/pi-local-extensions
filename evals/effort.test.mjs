import test from 'node:test';
import assert from 'node:assert/strict';
import {applyEffort,levels,rewriteSubmit} from '../extensions/effort-core.mjs';
import {addDesktopModelAliases} from '../extensions/pi-app-compat.mjs';
test('desktop metadata aliases preserve canonical SDK fields and cloud models',()=>{
 const local={provider:'local-llama',id:'omnicoder-local',maxTokens:8192};addDesktopModelAliases(local);addDesktopModelAliases(local);
 assert.equal(local.modelId,'omnicoder-local');assert.equal(local.maxOutput,8192);assert.equal(local.id,'omnicoder-local');assert.deepEqual(Object.keys(local),['provider','id','maxTokens']);
 const cloud={provider:'example',id:'other',maxTokens:10};addDesktopModelAliases(cloud);assert.equal(cloud.modelId,undefined);
});
test('budget presets change real request budget without claiming native effort',()=>{const p={messages:[],max_completion_tokens:8192};for(const model of ['qwen','gemma','omnicoder']){assert.equal(applyEffort(p,model,'low').reasoning_budget_tokens,512);assert.equal(applyEffort(p,model,'high').reasoning_budget_tokens,4096);assert.equal(applyEffort(p,model,'high').reasoning_effort,undefined);assert.equal(applyEffort(p,model,'off').chat_template_kwargs.enable_thinking,false);}});
test('GPT-OSS native effort is transmitted, off rejected, answer space retained',()=>{const p={messages:[],max_tokens:2048};assert.deepEqual(levels('gpt-oss'),['low','medium','high']);assert.equal(applyEffort(p,'gpt-oss','high').reasoning_effort,'high');assert.equal(applyEffort(p,'gpt-oss','high').reasoning_budget_tokens,1024);assert.throws(()=>applyEffort(p,'gpt-oss','off'),/not supported/);});
test('model menu dispatch does not alter ordinary input or other commands',()=>{assert.equal(rewriteSubmit('/model'),'/local-model');assert.equal(rewriteSubmit('/model gemma'),'/local-model gemma');assert.equal(rewriteSubmit('/effort high'),'/effort high');assert.equal(rewriteSubmit('explain /model'),'explain /model');});
