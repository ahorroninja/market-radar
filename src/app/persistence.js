import { freshSettings } from '../domain/defaults.js';
export const SETTINGS_KEY='market-radar-v3-settings',CACHE_KEY='market-radar-v3-cache';
export function loadState(storage=localStorage){let settings=freshSettings(),marketCache={};try{const x=storage.getItem(SETTINGS_KEY);if(x)settings={...settings,...JSON.parse(x)};}catch{}try{marketCache=JSON.parse(storage.getItem(CACHE_KEY)||'{}');}catch{}return{settings,marketCache};}
export function saveSettings(settings,storage=localStorage){storage.setItem(SETTINGS_KEY,JSON.stringify(settings));}
export function saveCache(cache,storage=localStorage){storage.setItem(CACHE_KEY,JSON.stringify(cache));}
