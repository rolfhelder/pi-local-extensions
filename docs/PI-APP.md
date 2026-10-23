# Pi App helpers

These helpers target Pi App 0.7.6 and Pi SDK 1.3.0. They do not install Pi App, llama.cpp, models, provider configuration or a user-SDK selection automatically.

## Extension inventory

Pi App discovers package manifests and conventional extension directories. Its inventory does not enumerate arbitrary `settings.extensions` files reliably. The original setup uses per-extension directories containing an `index.js` re-export and `package.json` with name/description metadata. The worker explicitly loads the same index paths once; the app can then match its inventory to loaded capabilities.

`config/desktop-extensions.json` contains the short descriptions. A package installed through `settings.packages` can appear as one package entry rather than separate cards. To preserve individual cards, use the setup repository's profile generator with the desired library source paths, or create those thin entry directories in your active agent directory. Do not copy implementation files into multiple auto-loaded locations.

## Model metadata compatibility

`extensions/pi-app-compat.mjs` supplies the legacy `modelId` and `maxOutput` aliases expected by parts of Pi App 0.7.6. It affects only local-llama metadata and preserves canonical SDK fields. The optional `extensions/pi-app-sdk-compat.mjs` is a supported user-SDK entry, not an extension factory: do not add it to the normal extension list. A Pi App user-SDK selection must reference this file from its supported user SDK wrapper, using the version installed here. Regenerate that selection after moving the checkout. Review the adapter before upgrading either component.

## Context bar

`themes/context-bar.css` uses the app's existing **Appearance → Custom CSS** setting. Paste its contents there and enable the override. It replaces the tiny composer circle with a 140 px-wide, 14 px-thick bar and the app's existing used/total token and percentage caption below it. It follows the app's estimate; it does not query the model or alter session state.

The selectors target pinned 0.7.6 markup and shipped English/Chinese tooltip formats. They trim the language prefix visually using a monospace caption. The fill advances in whole-percent steps; the caption keeps the tooltip's decimal percentage. Unknown usage stays marked with `?`. Recheck layout and selectors after app upgrades.

Rebuild with `pnpm theme:build` after changing `scripts/pi-app-appearance.mjs`. Its exported `contextAppearance()` helper merges the styling idempotently with an existing enabled CSS override. A launcher can use that helper when configuring the app. No app executable or renderer source is patched.
