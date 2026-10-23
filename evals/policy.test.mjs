import test from 'node:test';
import assert from 'node:assert/strict';
import { getPowerShellConfig } from '@earendil-works/pi-coding-agent';
import windowsPolicy, { inspectPowerShell } from '../extensions/windows-destructive-policy.mjs';
const allow = ['Get-Content README.md', 'git status --short', 'git commit -m "ordinary local commit"', 'pnpm test', 'npm install lodash', 'Set-Content src/app.js "ordinary code edit"', 'Write-Output "Remove-Item -Recurse is a dangerous example"', 'Write-Output "[IO.File]::Delete(example)"', 'git diff --name-only', 'git checkout feature/my-branch'];
const ask = ['Remove-Item -LiteralPath victim.txt', 'rM victim.txt', 'del victim.txt', 'Get-ChildItem sandbox | Remove-Item -Recurse', 'git reset --hard HEAD~1', 'git -C sandbox reset --soft HEAD~1', 'git clean -fd', 'git restore src/app.js', 'git checkout -- src/app.js', 'git branch -D old', 'git branch --delete old', 'git tag -d v1', 'git stash clear', 'git push origin main --force-with-lease', 'git push -f origin main', 'git push origin :old', 'git commit --amend --no-edit', 'gh repo delete example/repo', 'cmd /c "del victim.txt"', '[System.IO.File]::Delete("victim.txt")', 'node -e "require(\'fs\').rmSync(\'victim.txt\')"', 'pwsh -EncodedCommand ABCD', 'Format-Volume -DriveLetter Z'];
test('PowerShell 7 chains use the same parser as Pi and retain deletion protection',async()=>{
 if(!/pwsh/i.test(getPowerShellConfig().shell))return;
 assert.equal((await inspectPowerShell('Get-Location && Write-Output safe')).action,'allow');
 assert.equal((await inspectPowerShell('Get-Location && Remove-Item victim.txt')).action,'ask');
});
for (const command of allow) test(`allow: ${command}`, async () => assert.equal((await inspectPowerShell(command)).action, 'allow'));
for (const command of ask) test(`ask: ${command}`, async () => assert.equal((await inspectPowerShell(command)).action, 'ask'));
for (const [label, ctx, expected, prompts] of [
  ['TUI approve', { mode: 'tui', hasUI: true, approved: true }, false, 1],
  ['TUI decline', { mode: 'tui', hasUI: true, approved: false }, true, 1],
  ['headless', { mode: 'print', hasUI: false }, true, 0],
  ['RPC unattended', { mode: 'rpc', hasUI: true }, true, 0],
]) test(label, async () => {
  let handler, count = 0;
  windowsPolicy({ on: (_name, callback) => { handler = callback; } });
  const result = await handler({ toolName: 'powershell', input: { command: 'Remove-Item -LiteralPath victim.txt' } }, { ...ctx, ui: { confirm: async () => { count++; return ctx.approved; } } });
  assert.equal(Boolean(result?.block), expected);
  assert.equal(count, prompts);
});
test('desktop SDK can approve or decline; unattended RPC still blocks',async()=>{
 const before=process.env.PI_LOCAL_DESKTOP_UI;process.env.PI_LOCAL_DESKTOP_UI='1';
 try{
  let handler,count=0;windowsPolicy({on:(_name,callback)=>{handler=callback;}});
  for(const approved of [true,false]){
   const result=await handler({toolName:'powershell',input:{command:'Remove-Item -LiteralPath victim.txt'}},{mode:'rpc',hasUI:true,ui:{confirm:async()=>{count++;return approved;}}});
   assert.equal(Boolean(result?.block),!approved);
  }
  assert.equal(count,2);
 }finally{if(before===undefined)delete process.env.PI_LOCAL_DESKTOP_UI;else process.env.PI_LOCAL_DESKTOP_UI=before;}
});
