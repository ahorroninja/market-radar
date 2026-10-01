import { normalizePriceSeries } from './normalize.js';
function err(code,message){const e=new Error(message);e.code=code;return e;}
export function parseYahooChart(assetId,payload){
 const result=payload?.chart?.result?.[0];if(!result)throw err('EMPTY_PROVIDER_DATA',`No data for ${assetId}`);
 const timestamps=result.timestamp||[],quote=result.indicators?.quote?.[0]?.close||[],adjusted=result.indicators?.adjclose?.[0]?.adjclose||[];
 const rows=[];for(let i=0;i<timestamps.length;i++){const close=Number(adjusted[i]??quote[i]);if(!Number.isFinite(close)||close<=0)continue;rows.push({date:new Date(timestamps[i]*1000).toISOString().slice(0,10),close});}
 if(!rows.length)throw err('EMPTY_PROVIDER_DATA',`No valid prices for ${assetId}`);return normalizePriceSeries(assetId,'yahoo',rows);
}
export async function fetchMarketSeries(asset,settings,fetchImpl=fetch){
 const symbol=settings?.dataProvider?.symbols?.[asset.id]||asset.symbols?.yahoo;if(!symbol)throw err('MISSING_SYMBOL',`No market symbol for ${asset.name||asset.id}`);
 const base=(settings?.dataProvider?.baseUrl||'https://market-radar-data.ahorroninja.workers.dev').replace(/\/$/,'');
 const period1=Math.floor(Date.UTC(2000,0,1)/1000),period2=Math.floor(Date.now()/1000)+86400;
 const url=`${base}/chart?symbol=${encodeURIComponent(symbol)}&period1=${period1}&period2=${period2}`;
 let res;try{res=await fetchImpl(url);}catch{throw err('PROVIDER_NETWORK','Market data service unavailable');}
 if(!res.ok)throw err('PROVIDER_HTTP',`Market data service HTTP ${res.status}`);
 let payload;try{payload=await res.json();}catch{throw err('INVALID_PROVIDER_DATA','Market data service returned invalid JSON');}
 if(payload?.chart?.error)throw err('PROVIDER_UPSTREAM',payload.chart.error.description||'Yahoo Finance error');return parseYahooChart(asset.id,payload);
}
