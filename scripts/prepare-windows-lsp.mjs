import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
export async function prepareWindowsLsp(){
 const original=require.resolve('pi-lsp-extension/dist/index.js');
 let source=await readFile(original,'utf8');
 for(const [before,after] of [['this._diagnostics.get(uri)','this._diagnostics.get(piaDiagnosticUri(uri))'],['this._diagnostics.set(params.uri, params.diagnostics)','this._diagnostics.set(piaDiagnosticUri(params.uri), params.diagnostics)']]){
  if(source.split(before).length!==2)throw Error('Pinned LSP source changed; review Windows URI patch.');
  source=source.replace(before,after);
 }
 source+='\nfunction piaDiagnosticUri(uri) { return process.platform === "win32" ? decodeURIComponent(uri).toLowerCase() : uri; }\n';
 const target=path.join(path.dirname(original),'pi-local-extensions-windows.mjs');await writeFile(target,source);return target;
}
