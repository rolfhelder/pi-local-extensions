import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {root} from './runtime.mjs';
import {prepareWindowsLsp} from '../scripts/prepare-windows-lsp.mjs';
import {contextAppearance,contextIndicatorCss} from '../scripts/pi-app-appearance.mjs';
const require=createRequire(import.meta.url);
test('Pi manifest loads only actual factories and keeps special adapters opt-in',async()=>{
 const pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
 assert.equal(pkg.private,true);assert.equal(pkg.pi.extensions.length,6);
 for(const entry of pkg.pi.extensions){assert.ok(!(entry.includes('-core')||entry.includes('sdk-compat')||entry.includes('local-token-budget')));assert.match(await readFile(path.join(root,entry),'utf8'),/export default/);}
});
test('Windows LSP compatibility creates an adjacent patch without modifying upstream',async()=>{
 const original=require.resolve('pi-lsp-extension/dist/index.js');const before=await readFile(original);
 const target=await prepareWindowsLsp();const after=await readFile(original);
 assert.equal(createHash('sha256').update(before).digest('hex'),createHash('sha256').update(after).digest('hex'));
 assert.equal(path.dirname(target),path.dirname(original));assert.match(await readFile(target,'utf8'),/decodeURIComponent\(uri\)\.toLowerCase/);
});
test('portable context-bar CSS matches the generated artifact and merges without duplication',async()=>{
 assert.equal(await readFile(path.join(root,'themes/context-bar.css'),'utf8'),contextIndicatorCss()+'\n');
 const css=contextAppearance({enabled:true,css:'.personal { color:blue; }'});assert.deepEqual(contextAppearance(css),css);assert.match(css.css,/height:14px/);
});
