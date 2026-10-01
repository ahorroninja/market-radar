import { drawdown, opportunityBand } from '../core/indicators.js';
import { buildPortfolioSnapshot } from '../core/portfolio.js';
import { allocateSmartDca } from '../core/smart-dca.js';
import { runBacktest } from '../core/backtest.js';

const eur=n=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const pct=n=>n==null?'—':new Intl.NumberFormat('es-ES',{style:'percent',maximumFractionDigits:1}).format(n);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function enabled(ctx){return (ctx.settings.assets||[]).filter(a=>a.enabled);}
function series(ctx,id){return ctx.marketCache?.[id]?.points||[];}
function indicators(ctx){return enabled(ctx).map(a=>{const dd=drawdown(series(ctx,a.id));return{assetId:a.id,asOf:ctx.marketCache?.[a.id]?.asOf??null,drawdown:dd,trend:null,valuation:null,sentiment:null,macro:null,breadth:null,missing:dd===null?['drawdown']:[]};});}

export function renderRadar(outlet,ctx){
 const rows=enabled(ctx).map(a=>{const dd=drawdown(series(ctx,a.id));return`<article class="card"><div><strong>${esc(a.name||a.id)}</strong><small>${esc(a.id)}</small></div><div class="metric"><b>${pct(dd)}</b><span>${esc(opportunityBand(dd)||'sin datos')}</span></div></article>`;}).join('');
 outlet.innerHTML=`<section class="view"><div class="view-title"><div><h1>Radar</h1><p>Situación de mercado por activo</p></div></div><div class="cards">${rows||'<div class="empty">No hay activos habilitados.</div>'}</div></section>`;
}

export function renderBuy(outlet,ctx){
 const assets=enabled(ctx);const holdings=assets.map(a=>({assetId:a.id,value:Number(ctx.settings.holdings?.[a.id]||0)}));
 let body='';
 try{
  const result=allocateSmartDca({contribution:ctx.settings.monthlyContribution,assets,portfolio:buildPortfolioSnapshot(ctx.asOf,holdings),indicators:indicators(ctx),policy:ctx.settings.smartDcaPolicy});
  body=Object.entries(result.allocations).map(([id,amount])=>`<article class="card"><div><strong>${esc(assets.find(a=>a.id===id)?.name||id)}</strong><small>Compra recomendada</small></div><div class="buy-amount">${eur(amount)}</div></article>`).join('');
 }catch(e){body=`<div class="notice">No se puede calcular Smart DCA: ${esc(e.message)}</div>`;}
 outlet.innerHTML=`<section class="view"><div class="view-title"><div><h1>Comprar</h1><p>Smart DCA · aportación ${eur(ctx.settings.monthlyContribution)}</p></div></div><div class="cards">${body}</div></section>`;
}

export function renderBacktest(outlet,ctx){
 outlet.innerHTML=`<section class="view"><div class="view-title"><div><h1>Backtest</h1><p>Compara Target DCA y Smart DCA sin look-ahead</p></div></div><form id="backtest-form" class="panel"><label>Desde <input name="start" type="date" required></label><label>Hasta <input name="end" type="date" required></label><label>Estrategia <select name="strategy"><option value="smartDca">Smart DCA</option><option value="targetDca">Target DCA</option></select></label><button type="submit">Ejecutar</button></form><div id="backtest-result"></div></section>`;
 const form=outlet.querySelector('#backtest-form'),result=outlet.querySelector('#backtest-result');
 const all=enabled(ctx).flatMap(a=>series(ctx,a.id).map(p=>p.date)).sort();if(all.length){form.start.value=all[0];form.end.value=all.at(-1);}
 form.addEventListener('submit',ev=>{ev.preventDefault();try{const data=new FormData(form);const assets=enabled(ctx);const r=runBacktest({assets,histories:Object.fromEntries(assets.map(a=>[a.id,series(ctx,a.id)])),initialHoldings:ctx.settings.holdings||{},monthlyContribution:ctx.settings.monthlyContribution,startDate:data.get('start'),endDate:data.get('end'),strategy:data.get('strategy'),smartDcaPolicy:ctx.settings.smartDcaPolicy});result.innerHTML=`<div class="stats"><article><span>Aportado</span><b>${eur(r.totalContributed)}</b></article><article><span>Valor final</span><b>${eur(r.terminalValue)}</b></article><article><span>Ganancia mercado</span><b>${eur(r.marketGain)}</b></article><article><span>Aportaciones</span><b>${r.ledger.length}</b></article></div>`;}catch(e){result.innerHTML=`<div class="notice">${esc(e.message)}</div>`;}});
}

export function renderSettings(outlet,ctx){
 const rows=(ctx.settings.assets||[]).map(a=>`<tr><td>${esc(a.name||a.id)}</td><td>${a.enabled?'Sí':'No'}</td><td>${pct(a.targetWeight)}</td></tr>`).join('');
 outlet.innerHTML=`<section class="view"><div class="view-title"><div><h1>Ajustes</h1><p>Market Radar V3</p></div></div><div class="panel"><div class="setting-row"><span>Aportación mensual</span><b>${eur(ctx.settings.monthlyContribution)}</b></div><div class="setting-row"><span>Smart DCA · fuerza drawdown</span><b>${ctx.settings.smartDcaPolicy.drawdownStrength}</b></div><div class="setting-row"><span>Smart DCA · fuerza infraponderación</span><b>${ctx.settings.smartDcaPolicy.underweightStrength}</b></div></div><div class="panel table-wrap"><table><thead><tr><th>Activo</th><th>Activo</th><th>Target</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

export const VIEW_RENDERERS={radar:renderRadar,buy:renderBuy,backtest:renderBacktest,settings:renderSettings};
