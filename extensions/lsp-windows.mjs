import {pathToFileURL} from 'node:url';
import {prepareWindowsLsp} from '../scripts/prepare-windows-lsp.mjs';
export default async function(pi){
 const extension=process.platform==='win32'?await import(pathToFileURL(await prepareWindowsLsp()).href):await import('pi-lsp-extension/dist/index.js');
 return extension.default(pi);
}
