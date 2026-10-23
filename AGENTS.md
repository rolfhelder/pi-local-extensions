# Portable Pi extension library

- Keep this repository private unless its owner authorizes publication.
- Never commit session transcripts, credentials, machine paths, binaries or weights.
- Target the pinned Pi SDK 1.3.0; test before changing this compatibility contract.
- Prefer public SDK imports. Package state belongs in the active Pi agent directory, not the installed package.
- Preserve single-writer session persistence. Do not independently append to a live JSONL file.
- Distinguish observed reasoning-stream time from hidden model compute time.
- Tests use isolated Pi processes and scripted loopback providers; do not contact the user's running model or Pi App.
- Prefer rg and targeted file reads. Do not recursively scan dependency stores, browser caches or session data.
- Run unit and relevant scripted-runtime checks before shipping a change.
