import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const nodeExe=process.execPath;
export const piEntry=path.join(path.dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'))),'bundle/cli.js');
export function environment(extra={}){
 return {...process.env,PI_OFFLINE:'1',PI_TELEMETRY:'0',PI_SKIP_VERSION_CHECK:'1',
  PATH:[path.dirname(process.execPath),path.join(root,'node_modules/.bin'),process.env.PATH].join(path.delimiter),...extra};
}
