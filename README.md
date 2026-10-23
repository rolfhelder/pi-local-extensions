# Pi Local Extensions

**A portable collection of Pi extensions for local coding agents.** Session timing, real thinking-budget controls, practical guardrails and optional desktop helpers—kept separate from model downloads and machine configuration.

Tested with **Pi SDK 1.3.0 · Node 24.22.1 · native Windows**. The repository is private. Original code is MIT; upstream dependencies retain their own licenses.

## Extensions

| Extension | What it does | Default package |
|---|---|:---:|
| Session telemetry | Records prompt-to-answer latency, tool execution and observed thinking-stream time in session JSONL. `/telemetry` shows the latest run. | ✓ |
| Thinking effort | `/effort off/low/medium/high`, saved per-model defaults, and local request budgets. | ✓ |
| PowerShell guard | Prompts for destructive shell/Git actions while allowing ordinary commands and commits. | ✓ |
| Bash/file guard | Uses upstream pi-guard for Bash and sensitive file operations. | ✓ |
| Context usage | Estimated token count and percentage in the Pi CLI status area. | ✓ |
| Tool budget | Starts with a smaller tool surface by deactivating extra LSP/browser tools. | ✓ |
| Windows LSP adapter | Applies the tested URI-normalization patch to pinned upstream LSP without changing its original file. | Optional |
| Local token budget | GPT-OSS-specific llama.cpp tokenizer check and output-budget clamp. | Optional |
| Pi App compatibility | Bridges local-model metadata for Pi App 0.7.6 and SDK 1.3.0. | Optional |

Helper modules are not auto-loaded as extensions. Third-party LSP and pi-guard are pinned dependencies, not copied implementations.

## Install on another PC

Install Node 24+, pnpm 12.14.0 and Pi 1.3.0 first. Authenticate Git with GitHub for access to this private repository. Then:

```powershell
git clone https://github.com/rolfhelder/pi-local-extensions.git
cd pi-local-extensions
pnpm install --frozen-lockfile --ignore-scripts
pi install .
```

This adds the six default extensions to the active Pi agent configuration. It does not install a model, start llama.cpp, replace your provider configuration or change the working folder. If you use a custom agent directory, set `PI_CODING_AGENT_DIR` before running `pi install .` and use that same directory when launching Pi.

For a Git-source installation after authentication, use `pi install git:github.com/rolfhelder/pi-local-extensions@v0.1.0`. The tag pins this snapshot. See the [installation and configuration guide](docs/INSTALL.md) for guard rules, local-model effort settings and optional adapters.

## Session history with useful timing

Telemetry uses Pi's existing session writer. Finalized assistant messages gain a `telemetry` object; turn and run summaries are appended as custom entries. No separate process writes to the live session file, and diagnostics are excluded from model requests.

**Total prompt-to-final-answer time is the primary metric.** Tool sums can overlap; thought time means observed stream time, not hidden GPU compute. Unavailable values stay unavailable. See the [telemetry contract and limitations](docs/TELEMETRY.md) before comparing models or sessions.

## Optional Pi App appearance

The [Pi App guide](docs/PI-APP.md) explains the SDK metadata adapter and extension descriptions. `themes/context-bar.css` replaces the tiny composer circle with a thick horizontal bar and token/percentage caption through the app's existing custom-CSS setting. No app binary or renderer source is modified.

## Verify before enabling

```powershell
pnpm test
pnpm test:package
pnpm test:telemetry
pnpm test:effort
```

These checks use isolated Pi workers and scripted loopback providers. They do not require a GPU or cloud API key. Tests and evidence are described in [validation](docs/TESTING.md). Native macOS/Linux acceptance is pending; the PowerShell policy is Windows-specific.

## Relationship to the local-AI setup

Extracted from [local-agent-pi-llama-cpp-16gb](https://github.com/rolfhelder/local-agent-pi-llama-cpp-16gb). That repository still contains its working bundled copies and launchers. Do not enable both copies of the same extension in one Pi session: duplicate commands and hooks are undesirable. This library is the independent source snapshot for reuse; installing it does not silently rewire an existing setup.

No model weights, runtimes, credentials, personal prompt templates, transcripts or original Git history are included.
