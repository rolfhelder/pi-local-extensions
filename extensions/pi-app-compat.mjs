// Pi App 0.7.6's worker reads legacy modelId/maxOutput metadata in two
// places, while Pi SDK 1.3.0 exposes id/maxTokens. Supply local aliases only;
// provider requests keep using the SDK's canonical fields.
export function addDesktopModelAliases(model){
 if(model?.provider!=='local-llama')return;
 if(!Object.isExtensible(model))throw Error('Pi App model compatibility requires extensible SDK metadata; review the pinned SDK');
 if(model.modelId===undefined)Object.defineProperty(model,'modelId',{configurable:true,enumerable:false,get(){return this.id;}});
 if(model.maxOutput===undefined)Object.defineProperty(model,'maxOutput',{configurable:true,enumerable:false,get(){return this.maxTokens;}});
}
export default function(pi){
 pi.on('session_start',(_event,ctx)=>addDesktopModelAliases(ctx.model));
 pi.on('model_select',(event,ctx)=>addDesktopModelAliases(event.model||ctx.model));
}
