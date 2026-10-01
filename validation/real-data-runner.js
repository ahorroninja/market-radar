'use strict';
// Paste/export mr_state JSON from the PWA into validation/mr-state.json locally.
// This file is intentionally NOT committed because it can contain API keys.
const fs=require('fs'),E=require('./backtest-engine');
const path=process.argv[2]||'validation/mr-state.json';
if(!fs.existsSync(path)){console.error('Usage: node validation/real-data-runner.js <mr-state.json>');process.exit(2)}
const state=JSON.parse(fs.readFileSync(path,'utf8'));
const defs=[['MSCI World','IE000ZYRH0Q7',25],['S&P 500','IE0032126645',5],['World Value','IE00BP3QZB59',15],['EM Value','IE00BG0SKF03',10]];
const assets=defs.map(([name,key,weight])=>({name,weight,history:(state.data?.[key]?.history||[]).map(x=>({date:x.d||x.date,close:+(x.c??x.close)})).filter(x=>x.date&&Number.isFinite(x.close))}));
if(assets.some(a=>a.history.length<500)){console.error('Core 4 history incomplete:',assets.map(a=>[a.name,a.history.length]));process.exit(3)}
function macroAt(date){const ids=['VIXCLS','BAMLH0A0HYM2','T10Y2Y','NFCI'],v={};for(const id of ids){const a=state.macroHistory?.[id]||[];let found=null;for(const x of a){if((x.d||x.date)<=date)found=+(x.v??x.value);else break}v[id]=found}if(ids.some(id=>!Number.isFinite(v[id])))return 50;return E.clamp(72-v.VIXCLS*.65-v.BAMLH0A0HYM2*2+v.T10Y2Y*4-v.NFCI*8)}
const full=E.simulate({assets,monthly:+state.monthly||1000,macroAt});
const fmt=x=>(100*x).toFixed(2)+'%';
console.log('\nCORE 4 FULL SAMPLE');console.table(Object.fromEntries(Object.entries(full.metrics).map(([k,m])=>[k,{final:m.final.toFixed(0),twr:fmt(m.twrAnnual),xirr:fmt(m.xirr),maxDD:fmt(m.maxDD),sharpe:m.sharpe.toFixed(2)}])));
for(const years of [1,2,3]){const r=E.rolling({assets,monthly:+state.monthly||1000,macroAt,windowSessions:252*years,step:21});for(const field of ['tech','macro']){const a=r.map(x=>x[field]).sort((x,y)=>x-y),q=p=>a[Math.floor((a.length-1)*p)]||0;console.log(`${field.toUpperCase()} rolling ${years}Y: n=${a.length}, wins=${a.filter(x=>x>0).length}/${a.length}, median=${fmt(q(.5))}, P10=${fmt(q(.1))}, P90=${fmt(q(.9))}, worst=${fmt(a[0]||0)}, best=${fmt(a.at(-1)||0)}`)}}
