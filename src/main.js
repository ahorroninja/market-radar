import { createShell } from './ui/shell.js';
import { VIEW_RENDERERS } from './ui/views.js';
import { freshSettings,APP_VERSION } from './domain/defaults.js';

const SETTINGS_KEY='market-radar-v3-settings';
function loadSettings(){try{const raw=localStorage.getItem(SETTINGS_KEY);return raw?{...freshSettings(),...JSON.parse(raw)}:freshSettings();}catch{return freshSettings();}}
function loadCache(){try{return JSON.parse(localStorage.getItem('market-radar-v3-cache')||'{}');}catch{return {};}}

const ctx={settings:loadSettings(),marketCache:loadCache(),asOf:new Date().toISOString().slice(0,10),version:APP_VERSION};
const root=document.querySelector('#app');
const shell=createShell(root,{initialRoute:location.hash.slice(1)||'radar',onRouteChange(route,outlet){location.hash=route;VIEW_RENDERERS[route](outlet,ctx);}});
shell.setStatus(APP_VERSION);
window.addEventListener('hashchange',()=>shell.navigate(location.hash.slice(1)));
