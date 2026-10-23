// Pinned SDK entry for Pi App 0.7.6. Its worker's catalog projection still
// reads modelId/maxOutput; normalize those metadata aliases at this boundary.
export * from '@earendil-works/pi-coding-agent';
import {ModelRuntime} from '@earendil-works/pi-coding-agent';
import {addDesktopModelAliases} from './pi-app-compat.mjs';
const marker=Symbol.for('pi-local-lab.desktop-model-metadata');
if(!ModelRuntime.prototype[marker]){
 for(const key of ['getModel','getModels','getAvailable']){
  const original=ModelRuntime.prototype[key];
  const decorate=value=>{for(const model of Array.isArray(value)?value:[value])addDesktopModelAliases(model);return value;};
  ModelRuntime.prototype[key]=function(...args){const value=original.apply(this,args);return value?.then?value.then(decorate):decorate(value);};
 }
 Object.defineProperty(ModelRuntime.prototype,marker,{value:true});
}
