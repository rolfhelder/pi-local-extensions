# Validation

Tests use this repository's own locked dependencies; no source imports the original setup checkout. A system Node executable is required. No tests start the user's local model or contact the running Pi App.

| Command | Coverage |
|---|---|
| `pnpm test` | PowerShell policy decisions, context formatting, effort payloads, tokenizer budgets, deterministic telemetry clocks, overlapping/nested tools, path resolution, manifest and CSS generation, Windows LSP patch preservation. |
| `pnpm test:package` | A real isolated Pi worker loads the package and optional LSP/tokenizer/desktop factories; commands register once without a provider request. |
| `pnpm test:telemetry` | A real Pi RPC process with a scripted local HTTP provider verifies response metadata, turn/run JSONL, tool sums, thinking stream, stale env paths, abort, append-only resume and exclusion from provider messages. |
| `pnpm test:effort` | Real-Pi RPC checks command registration, no inference for `/effort`, session-only defaults, explicit persistence, 4096/512 budget transmission and launcher restart requests. |

Artifacts, synthetic sessions and reports are ignored under `.state/`. Tests create disposable files there; they are never included in commits.

Initial independent validation on October 23, 2026 passed **60 unit/guard checks**, the package/factory load check, real-Pi telemetry persistence/abort/resume, and real-Pi effort persistence with 4096/512-token request budgets. The documented `pi install .` command also succeeded in a disposable agent directory. No GPU model was loaded by these checks.

Native Windows with Node 24.22.1 and Pi 1.3.0 is the verified environment. Native macOS/Linux acceptance remains pending. The PowerShell policy requires a supported PowerShell shell, while its test suite is intended for Windows. The portable arithmetic and metadata code does not itself establish native integration coverage on another OS. No check establishes model coding quality, hidden reasoning compute time, cross-process session locking or every language-server capability.
