# Install and configure

Use the README clone/install recipe with Node 24+, pnpm 12.14.0 and Pi 1.3.0. A private Git source needs normal GitHub Git authentication on each new machine. The package remains `private: true` to prevent accidental npm publication.

`pi install .` registers the six factories declared in package.json. Pi's package loader resolves their dependencies. The lockfile makes a cloned checkout reproducible with `pnpm install --frozen-lockfile --ignore-scripts`. Dependency lifecycle scripts are intentionally disabled; do not assume a later SDK version is compatible without testing it.

## Choose the active Pi directory

The standard location is Pi's normal agent directory. To use a working-folder-local profile on Windows:

```powershell
$env:PI_CODING_AGENT_DIR = 'D:/Projects/Code-local/.pi/local-ai/profiles/standard'
pi install .
pi
```

On macOS/Linux, set `export PI_CODING_AGENT_DIR="$HOME/Code-local/.pi/local-ai/profiles/standard"` before the same Pi commands. Exclude the agent directory from Git: it contains settings, sessions and potentially authentication. Pi generates its own configuration; no machine-specific settings file is shipped here.

## Guard behavior

The PowerShell policy uses the public SDK shell selector and a bundled data-only PowerShell parser. Normal local commits are allowed; deletions, destructive resets, forced pushes and similar commands request approval. Unattended non-desktop RPC cannot approve them. These checks are not an OS sandbox and do not cover every possible destructive program.

The Bash wrapper honors pi-guard's own configuration and `PI_GUARD`. To opt into this setup's mostly-automatic policy, set:

```powershell
$env:PI_GUARD = Get-Content ./config/guard.rules.json -Raw
pi
```

On macOS/Linux: `PI_GUARD="$(cat ./config/guard.rules.json)" pi`. Without this override, pi-guard's existing/default policy applies. The library does not weaken an existing policy automatically. `PI_LOCAL_DESKTOP_UI=1` is reserved for a real Pi App launcher with approval UI; never set it merely to bypass unattended RPC protection.

## Local effort controls

The effort hook targets provider `local-llama` and aliases `qwen-local`, `gemma-local`, `omnicoder-local`, and `gpt-oss-local`. Update `config/effort.json` deliberately for different model aliases. Other models are left alone. Budgets are local presets, not evidence of model-native effort support. GPT-OSS supports native low/medium/high and rejects off.

- `/effort high` changes this session; `/effort high --save` persists a per-model default.
- Saved preferences use `PI_EFFORT_PREFERENCES` if supplied, otherwise `local-ai-effort.json` in the active Pi agent directory. They are never written inside the installed package.
- Optional environment defaults: `PI_LOCAL_THINKING_BUDGET=2048`, `PI_LOCAL_OUTPUT_CAP=8192`.
- The launcher still needs reasoning enabled and sufficient output allowance. Changing a request budget cannot enlarge the server's context window.
- `/local-model` integrates with the setup launcher's `PI_LOCAL_RESTART_REQUEST` protocol. Standalone Pi cannot hot-swap GGUF weights through this package alone.

## Optional adapters

Optional entry points are outside the default package manifest. Load one explicitly, for example:

```powershell
pi --extension ./extensions/lsp-windows.mjs
```

The LSP adapter reuses pi-lsp-extension 1.4.0. It writes a generated patched entry adjacent to the installed upstream file so its relative dependencies resolve; the original is preserved. A read-only dependency directory cannot generate that entry. Language-server executables and project configuration remain separate setup steps. On non-Windows, the adapter delegates to upstream unchanged.

`extensions/local-token-budget.mjs` additionally requires a compatible loopback llama.cpp server with `/apply-template` and `/tokenize`, `PI_LOCAL_TOKENIZER_URL=http://127.0.0.1:PORT`, `PI_LOCAL_CONTEXT=131072`, and `PI_LOCAL_OUTPUT_CAP=8192`. It only acts on `gpt-oss-local`. It does not increase native context or configure compaction by itself.

Desktop adapters and CSS are covered in [Pi App configuration](PI-APP.md). Restart/reload only when the current agent is idle.
