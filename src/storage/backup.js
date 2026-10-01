function err(message){const e=new Error(message);e.code='INVALID_BACKUP';return e;}
function clone(x){return structuredClone(x);}
function validateSettings(s){if(!s||!Number.isInteger(s.monthlyContribution)||s.monthlyContribution<0||!Array.isArray(s.assets))throw err('Invalid settings');for(const a of s.assets){if(!a||typeof a.id!=='string'||!a.id||typeof a.enabled!=='boolean'||!Number.isFinite(a.targetWeight)||a.targetWeight<0)throw err('Invalid asset settings');}}
function validateCache(cache){if(!cache||typeof cache!=='object'||Array.isArray(cache))throw err('Invalid market cache');for(const [id,s] of Object.entries(cache)){if(!s||s.assetId!==id||!Array.isArray(s.points))throw err('Invalid market series');for(const p of s.points)if(!p||typeof p.date!=='string'||!Number.isFinite(p.close)||p.close<=0)throw err('Invalid market point');}}
export function createBackup(state,{includeSecrets=false,now=new Date().toISOString()}={}){
 validateSettings(state?.settings);validateCache(state?.marketCache||{});
 const settings=clone(state.settings);if(!includeSecrets)delete settings.apiKey;
 return{schemaVersion:1,exportedAt:now,settings,marketCache:clone(state.marketCache||{}),secretsIncluded:Boolean(includeSecrets)};
}
export function restoreBackup(envelope,currentState){
 if(!envelope||envelope.schemaVersion!==1||typeof envelope.exportedAt!=='string'||typeof envelope.secretsIncluded!=='boolean')throw err('Unsupported or malformed backup');
 const staged={settings:clone(envelope.settings),marketCache:clone(envelope.marketCache||{})};
 validateSettings(staged.settings);validateCache(staged.marketCache);
 // Nothing mutates currentState until the complete staged snapshot has validated.
 return staged;
}
