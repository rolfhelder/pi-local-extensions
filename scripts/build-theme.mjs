import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {contextIndicatorCss} from './pi-app-appearance.mjs';
const target=fileURLToPath(new URL('../themes/context-bar.css',import.meta.url));
await mkdir(path.dirname(target),{recursive:true});await writeFile(target,contextIndicatorCss()+'\n');
console.log('Generated themes/context-bar.css');
