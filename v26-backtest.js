// Market Radar V2.6 — backtest rebuilt from V26_SPEC.md
(function(){
'use strict';
const K=a=>key(a);
function monthly(){const n=Number(state.monthly);return Number.isFinite(n)&&n>0?n:1000;}
function commonDates(u,maps){if(!u.length)return[];return[...maps.get(K(u[0])).keys()].filter(d=>u.every(a=>maps.get(K(a)).has(d))).sort();}
function warmupBefore(u,maps,date,n=252){return commonDates(u,maps).filter(d=>d<date).slice(-n);}
function snapshotBefore(hist,u,shares,maps){
 const assets=u.map(a=>({key:K(a),target:a[3]})),portfolio={},data={};
 for(const a of u){const k=K(a),prior=hist[k],last=prior.at(-1);if(!last)continue;portfolio[k]=shares[k]*last.c;const t=calc(prior);if(t&&Number.isFinite(t.dd))data[k]={dd:t.dd};}
 return {assets,portfolio,data};
}
function simulateV26(u,maps,dates,warmupDates=[]){
 if(!window.MR26)throw Error('MR26 engine unavailable');if(!dates.length)throw Error('V2.6 backtest: empty date range');
 const names=['DCA objetivo','Rebalanceo','Smart DCA V2.6'];
 const shares=Object.fromEntries(names.map(n=>[n,Object.fromEntries(u.map(a=>[K(a),0]))]));
 const cash=Object.fromEntries(names.map(n=>[n,0])),series=Object.fromEntries(names.map(n=>[n,[]])),flows=Object.fromEntries(names.map(n=>[n,[]]));
 const hist=Object.fromEntries(u.map(a=>[K(a),warmupDates.map(d=>({d,c:maps.get(K(a)).get(d)}))]));let lastMonth='',contrib=0;
 const targetSum=u.reduce((s,a)=>s+a[3],0);if(!(targetSum>0))throw Error('V2.6 backtest: invalid target sum');
 for(const d of dates){
  const month=d.slice(0,7),isBuy=month!==lastMonth;
  if(isBuy){lastMonth=month;const flow=monthly();contrib+=flow;for(const n of names){cash[n]+=flow;flows[n].push({d,v:-flow});}
   for(const a of u){const k=K(a),p=maps.get(k).get(d),amt=flow*a[3]/targetSum;if(!(p>0))throw Error(`V2.6 invalid price ${k} ${d}`);shares['DCA objetivo'][k]+=amt/p;cash['DCA objetivo']-=amt;}
   const vals=Object.fromEntries(u.map(a=>[K(a),shares['Rebalanceo'][K(a)]*maps.get(K(a)).get(d)]));const investedBefore=Object.values(vals).reduce((x,y)=>x+y,0),gaps=u.map(a=>Math.max(0,investedBefore*a[3]/targetSum-vals[K(a)])),gs=gaps.reduce((x,y)=>x+y,0);
   for(let i=0;i<u.length;i++){const a=u[i],amt=gs?flow*gaps[i]/gs:flow*a[3]/targetSum;shares['Rebalanceo'][K(a)]+=amt/maps.get(K(a)).get(d);cash['Rebalanceo']-=amt;}
   const snap=snapshotBefore(hist,u,shares['Smart DCA V2.6'],maps);if(Object.keys(snap.data).length!==u.length)throw Error(`V2.6 insufficient pre-decision history at ${d}`);
   const alloc=MR26.smartDcaAllocation({...snap,monthly:flow,maxAssetShare:.40,drawdownStrength:1,underweightStrength:.35}).allocations;
   const invested=Object.values(alloc).reduce((x,y)=>x+y,0);if(Math.abs(invested-flow)>.011)throw Error(`V2.6 contribution invariant ${d}: ${invested} != ${flow}`);if(Object.values(alloc).some(v=>v>flow*.40+.011))throw Error(`V2.6 cap invariant ${d}`);
   for(const a of u){const k=K(a),amt=alloc[k]||0;shares['Smart DCA V2.6'][k]+=amt/maps.get(k).get(d);cash['Smart DCA V2.6']-=amt;}
  }
  // Critical timing rule: today's close becomes signal history only AFTER today's execution.
  for(const a of u)hist[K(a)].push({d,c:maps.get(K(a)).get(d)});
  for(const n of names){const v=cash[n]+u.reduce((s,a)=>s+shares[n][K(a)]*maps.get(K(a)).get(d),0);series[n].push({d,v,flow:isBuy?monthly():0});}
 }
 const res={};for(const n of names){const p=perf(series[n],flows[n]);res[n]={...p,gain:p.final-contrib};}return{res,series,contrib};
}
function rollingV26(u,maps,dates,years){const n=Math.round(years*252),out=[];if(dates.length<n)return out;for(let i=0;i+n<=dates.length;i+=21){const rd=dates.slice(i,i+n),warm=warmupBefore(u,maps,rd[0]),r=simulateV26(u,maps,rd,warm);out.push({start:rd[0],end:rd.at(-1),edge:r.res['Smart DCA V2.6'].twr-r.res['DCA objetivo'].twr});}return out;}
function portfolioBacktestV26(){const g=getUniverse();if(!g)return null;let{u,maps,dates}=g,start=dates[0];if(state.btYears!=='max'){const cut=new Date();cut.setFullYear(cut.getFullYear()-+state.btYears);start=[start,iso(cut)].sort().at(-1);}dates=dates.filter(d=>d>=start);if(dates.length<250)return null;const warm=warmupBefore(u,maps,dates[0]);if(warm.length<220)return null;const sim=simulateV26(u,maps,dates,warm),roll=rollingV26(u,maps,dates,+state.btRollYears||3);return{...sim,universe:u,dates,years:dates.length/252,roll};}
function stats(a){const s=[...a].sort((x,y)=>x-y),q=p=>s.length?s[Math.min(s.length-1,Math.floor((s.length-1)*p))]:0;return{n:s.length,w:s.filter(x=>x>0).length,med:q(.5),p10:q(.1),p90:q(.9),best:s.at(-1)||0,worst:s[0]||0};}
function backtestV26(){const b=portfolioBacktestV26(),rs=stats((b?.roll||[]).map(x=>x.edge)),ok=rs.n>=5;return `<div class="top"><div><div class="brand">Backtest de cartera <span class="vtag">V2.6</span></div><div class="muted">mismo motor Smart DCA · señal anterior a ejecución</div></div></div><div class="card"><label class="field"><span>Universo</span><select id="btUniverse"><option value="core" ${state.btUniverse==='core'?'selected':''}>Core 4 (histórico más largo)</option><option value="all" ${state.btUniverse==='all'?'selected':''}>Todos con histórico suficiente</option></select></label><label class="field"><span>Periodo</span><select id="btYears"><option value="3" ${state.btYears==3?'selected':''}>3 años</option><option value="5" ${state.btYears==5?'selected':''}>5 años</option><option value="10" ${state.btYears==10?'selected':''}>10 años</option><option value="max" ${state.btYears==='max'?'selected':''}>Máximo común</option></select></label><label class="field"><span>Rolling</span><select id="btRollYears"><option value="1" ${state.btRollYears==1?'selected':''}>1 año</option><option value="2" ${state.btRollYears==2?'selected':''}>2 años</option><option value="3" ${state.btRollYears==3?'selected':''}>3 años</option></select></label></div>${b?`<div class="notice good">${b.universe.length} activos · ${b.years.toFixed(1)} años · ${b.dates[0]} → ${b.dates.at(-1)} · aportado ${money(b.contrib)}</div><div class="section">${Object.entries(b.res).map(([n,x])=>`<div class="card"><div class="assetHead"><div><div class="assetName">${n}</div><div class="small">Beneficio ${money(x.gain)}</div></div><div class="right"><div class="assetScore">${money(x.final)}</div></div></div><div class="metrics bt"><div class="metric">TWR anual.<b>${pct(x.twr)}</b></div><div class="metric">XIRR<b>${pct(x.xirr)}</b></div><div class="metric">Max DD<b>${pct(x.dd)}</b></div><div class="metric">Volatilidad<b>${pct(x.vol)}</b></div><div class="metric">Sharpe<b>${x.sharpe.toFixed(2)}</b></div></div></div>`).join('')}</div><div class="section"><h2>Rolling solapado · ${state.btRollYears||3} año${(state.btRollYears||3)==1?'':'s'}</h2>${ok?`<div class="card"><div class="metrics bt"><div class="metric">Smart DCA gana<b>${rs.w}/${rs.n}</b></div><div class="metric">Ventaja mediana<b>${rs.med>=0?'+':''}${pct(rs.med)}</b></div><div class="metric">P10<b>${rs.p10>=0?'+':''}${pct(rs.p10)}</b></div><div class="metric">P90<b>${rs.p90>=0?'+':''}${pct(rs.p90)}</b></div><div class="metric">Mejor<b>${rs.best>=0?'+':''}${pct(rs.best)}</b></div><div class="metric">Peor<b>${rs.worst>=0?'+':''}${pct(rs.worst)}</b></div></div><div class="small">Ventanas solapadas con 252 sesiones de calentamiento previo: descriptivo, no evidencia estadística independiente.</div></div>`:`<div class="notice">${rs.n} ventanas disponibles. Muestra insuficiente para presentar una validación útil.</div>`}</div>`:'<div class="notice">No hay suficiente histórico común.</div>'}`;}
const base=render;render=function(){base();if(state.view==='backtest'){const shell=document.querySelector('#app main.shell');if(shell)shell.innerHTML=backtestV26();if($('#btUniverse'))$('#btUniverse').onchange=e=>{state.btUniverse=e.target.value;save();render()};if($('#btYears'))$('#btYears').onchange=e=>{state.btYears=e.target.value;save();render()};if($('#btRollYears'))$('#btRollYears').onchange=e=>{state.btRollYears=e.target.value;save();render()};}const tag=document.querySelector('.vtag');if(tag)tag.textContent='V2.6';};
window.MR26Backtest={snapshotBefore,simulateV26,rollingV26,portfolioBacktestV26,warmupBefore};render();
})();
