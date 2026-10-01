import { normalizePriceSeries } from './normalize.js';
function err(code,message){const e=new Error(message);e.code=code;return e;}
export function parseStooqCsv(assetId,text){
 const lines=String(text||'').trim().split(/\r?\n/);if(lines.length<2)throw err('EMPTY_PROVIDER_DATA',`No data for ${assetId}`);
 const head=lines[0].split(',').map(x=>x.trim().toLowerCase()),di=head.indexOf('date'),ci=head.indexOf('close');if(di<0||ci<0)throw err('INVALID_PROVIDER_DATA','CSV needs Date and Close');
 const rows=lines.slice(1).filter(Boolean).map(line=>{const c=line.split(',');return{date:c[di]?.trim(),close:Number(c[ci])};});return normalizePriceSeries(assetId,'stooq',rows);
}
export async function fetchMarketSeries(asset,settings,fetchImpl=fetch){
 const symbol=settings?.dataProvider?.symbols?.[asset.id]||asset.symbols?.stooq;if(!symbol)throw err('MISSING_SYMBOL',`No market symbol for ${asset.name||asset.id}`);
 const target=`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}&d1=20000101&i=d`;
 const proxy=settings?.dataProvider?.proxyUrl?.trim();const url=proxy?`${proxy}${proxy.includes('?')?'&':'?'}url=${encodeURIComponent(target)}`:target;
 let res;try{res=await fetchImpl(url);}catch{throw err('PROVIDER_NETWORK','Market provider unavailable');}if(!res.ok)throw err('PROVIDER_HTTP',`Market provider HTTP ${res.status}`);return parseStooqCsv(asset.id,await res.text());
}
