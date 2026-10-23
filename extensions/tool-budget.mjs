// Preserve the core coding tools and selected LSP/navigation tools. Additional tools
// remain registered and can be explicitly activated later through Pi's tool controls.
const excluded = new Set(['lsp_symbols','lsp_code_actions','lsp_completions','code_overview','ast_search','code_rewrite',
  'launch_browser','navigate_browser','evaluate_browser']);
export default function(pi) {
  pi.on('session_start', () => pi.setActiveTools(pi.getActiveTools().filter(name => !excluded.has(name))));
}
