import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { getPowerShellConfig } from '@earendil-works/pi-coding-agent';
const parser = fileURLToPath(new URL('../scripts/Parse-PowerShell.ps1', import.meta.url));
const cache = new Map();
export async function inspectPowerShell(command) {
  if (cache.has(command)) return cache.get(command);
  const exe = process.env.PIA_POWERSHELL || getPowerShellConfig().shell;
  const parsed = await new Promise((resolve, reject) => {
    // Execute the fixed parser program, with untrusted command text only on stdin.
    // This works under Restricted execution policy without changing that policy.
    const child = spawn(exe, ['-NoProfile', '-NonInteractive', '-Command', readFileSync(parser, 'utf8')], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('PowerShell parse timed out')); }, 10000);
    child.stdout.on('data', data => { out += data; });
    child.stderr.on('data', data => { err += data; });
    child.once('error', reject);
    child.once('close', code => { clearTimeout(timer); try { if (code) throw new Error(err); resolve(JSON.parse(out.replace(/^\uFEFF/, ''))); } catch (error) { reject(error); } });
    child.stdin.end(command);
  });
  const reasons = [];
  if (parsed.errors.length) reasons.push('Command could not be parsed reliably');
  for (const item of parsed.commands) {
    const name = path.win32.basename(item.name || '').toLowerCase().replace(/\.exe$/, '');
    const args = item.elements.slice(1).map(value => value.replace(/^['"]|['"]$/g, ''));
    const lower = args.map(value => value.toLowerCase());
    if (!name) reasons.push('Dynamically computed command');
    if (/^(remove-item|clear-content|rm|del|erase|rd|rmdir|unlink|format-volume|format|clear-disk|initialize-disk|diskpart)$/.test(name)) reasons.push(`Destructive command: ${name}`);
    if (name === 'git') {
      const subcommand = lower.find(value => ['reset','clean','restore','checkout','branch','tag','stash','push','rm','worktree','reflog','commit','rebase'].includes(value));
      const flags = new Set(lower);
      if (['reset','clean','restore','rm','rebase'].includes(subcommand)
        || (subcommand === 'checkout' && (flags.has('--') || flags.has('-f') || flags.has('--force')))
        || (['branch','tag'].includes(subcommand) && (flags.has('-d') || flags.has('--delete')))
        || (subcommand === 'stash' && (flags.has('drop') || flags.has('clear')))
        || (subcommand === 'worktree' && flags.has('remove'))
        || (subcommand === 'reflog' && flags.has('expire'))
        || (subcommand === 'commit' && flags.has('--amend'))
        || (subcommand === 'push' && lower.some(value => value === '-f' || value === '--delete' || value.startsWith('--force') || value.startsWith('+') || value.startsWith(':')))) reasons.push('Destructive Git operation');
    }
    if (name === 'gh' && lower[0] === 'repo' && lower[1] === 'delete') reasons.push('Repository deletion');
    if (/^(cmd|cmd32)$/.test(name) && /\b(del|erase|rd|rmdir|format)\b/i.test(args.join(' '))) reasons.push('Destructive cmd command');
    if (/^(powershell|pwsh)$/.test(name) && lower.some(value => /^-e(nc(odedcommand)?)?$/.test(value))) reasons.push('Encoded shell payload');
    if (/^(node|python\d*|py|ruby|perl)$/.test(name) && /\b(rmSync|rmdirSync|unlinkSync|rmtree|unlink|remove|remove_all)\s*\(/i.test(args.join(' '))) reasons.push('Interpreter deletion API');
  }
  if ((parsed.members || []).some(member => /\[(?:System\.)?IO\.(?:File|Directory)\]\s*::\s*(?:Delete|Move)\s*\(/i.test(member))) reasons.push('Direct filesystem deletion/move API');
  const result = { action: reasons.length ? 'ask' : 'allow', reasons: [...new Set(reasons)] };
  if (cache.size >= 128) cache.clear();
  cache.set(command, result);
  return result;
}
export default function windowsDestructivePolicy(pi) {
  pi.on('tool_call', async (event, ctx) => {
    let decision;
    if (event.toolName === 'powershell') {
      try { decision = await inspectPowerShell(String(event.input.command || '')); }
      catch { decision = { action: 'ask', reasons: ['PowerShell policy parser unavailable'] }; }
    } else if (['write', 'edit'].includes(event.toolName) && /(^|[\\/])\.git([\\/]|$)/i.test(String(event.input.path || ''))) {
      decision = { action: 'ask', reasons: ['Direct modification of Git metadata'] };
    }
    if (!decision || decision.action === 'allow') return;
    const reason = decision.reasons.join('; ');
    if (!ctx.hasUI || (ctx.mode !== 'tui' && process.env.PI_LOCAL_DESKTOP_UI !== '1')) return { block: true, reason: `Approval required: ${reason}` };
    if (!(await ctx.ui.confirm('Destructive action', `${reason}\n\n${String(event.input.command || event.input.path || '').slice(0, 4000)}`))) {
      return { block: true, reason: 'Destructive action was not approved' };
    }
  });
}
