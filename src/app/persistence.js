import { freshSettings } from '../domain/defaults.js';
export const SETTINGS_KEY='market-radar-v3-settings',CACHE_KEY='market-radar-v3-cache';

export function migrateSettings(saved={}){
 const defaults=freshSettings();
 const savedProvider=saved?.dataProvider||{};
 const providerIsCurrent=savedProvider.type===defaults.dataProvider.type;
 return {
  ...defaults,
  ...saved,
  dataProvider: providerIsCurrent
   ? {...defaults.dataProvider,...savedProvider,symbols:{...defaults.dataProvider.symbols,...(savedProvider.symbols||{})}}
   : defaults.dataProvider,
  smartDcaPolicy:{...defaults.smartDcaPolicy,...(saved.smartDcaPolicy||{})},
  holdings:{...defaults.holdings,...(saved.holdings||{})},
  assets:Array.isArray(saved.assets)?saved.assets.map(old=>{
   const current=defaults.assets.find(a=>a.id===old.id);
   return current?{...current,...old,symbols:{...current.symbols,...(old.symbols||{})}}:old;
  }):defaults.assets
 };
}

export function loadState(storage=localStorage){let settings=freshSettings(),marketCache={};try{const x=storage.getItem(SETTINGS_KEY);if(x)settings=migrateSettings(JSON.parse(x));}catch{}try{marketCache=JSON.parse(storage.getItem(CACHE_KEY)||'{}');}catch{}return{settings,marketCache};}
export function saveSettings(settings,storage=localStorage){storage.setItem(SETTINGS_KEY,JSON.stringify(settings));}
export function saveCache(cache,storage=localStorage){storage.setItem(CACHE_KEY,JSON.stringify(cache));}
