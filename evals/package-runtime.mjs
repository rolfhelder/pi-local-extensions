import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root,nodeExe,piEntry,environment} from './runtime.mjs';
const dir=path.join(root,'.state/package-load-'+Date.now());await mkdir(dir,{recursive:true});
const events=[],pending=new Map();let buffer='',stderr='';
const child=spawn(nodeExe,[piEntry,'--mode','rpc','--no-session','--no-extensions','--no-skills','--no-prompt-templates','--no-context-files',
 '--extension',root,'--extension',path.join(root,'extensions/lsp-windows.mjs'),'--extension',path.join(root,'extensions/local-token-budget.mjs'),'--extension',path.join(root,'extensions/pi-app-compat.mjs')],
 {cwd:dir,windowsHide:true,env:environment({PI_CODING_AGENT_DIR:dir,PI_GUARD:await readFile(path.join(root,'config/guard.rules.json'),'utf8')}),stdio:['pipe','pipe','pipe']});
child.stderr.on('data',b=>stderr+=b);child.stdout.on('data',b=>{buffer+=b;let n;while((n=buffer.indexOf('\n'))>=0){const s=buffer.slice(0,n);buffer=buffer.slice(n+1);try{const e=JSON.parse(s);events.push(e);if(e.type==='response'&&pending.has(e.id)){pending.get(e.id)(e);pending.delete(e.id);}}catch{}}});
async function send(type){let timer;const id='p'+Math.random();return Promise.race([new Promise(r=>{pending.set(id,r);child.stdin.write(JSON.stringify({id,type})+'\n');}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Package load timed out: '+stderr)),20000);})]).finally(()=>clearTimeout(timer));}
try{
 const r=await send('get_commands');assert.equal(r.success,true,JSON.stringify(r));const names=r.data.commands.map(c=>c.name);
 for(const name of ['effort','telemetry','lsp'])assert.equal(names.filter(n=>n===name).length,1,name);
 assert.ok(!/Failed to load|Cannot find|Error:/.test(stderr),stderr);
 const state=await send('get_state');assert.equal(state.success,true);
 const report={packageFactoriesLoaded:true,optionalLspLoaded:true,commandsUnique:true,noProviderRequest:true,stderr};
 await writeFile(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}finally{child.kill();}
