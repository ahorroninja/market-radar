// Market Radar V2.6 — Smart DCA monthly purchase UI
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>(+x||0).toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
function reason(row){const dd=row.dd||0,gap=(row.target-row.actual)*100;if(dd>=.20)return `Caída fuerte (${Math.round(dd*100)}%)`;if(dd>=.10)return `En corrección (${Math.round(dd*100)}%)`;if(gap>=3)return `Infraponderado ${gap.toFixed(1)} pp`;if(gap<=-3)return `Sobreponderado ${Math.abs(gap).toFixed(1)} pp`;return 'Cerca del peso objetivo'}
function currentRecommendation(){if(!window.MR26||typeof ASSETS==='undefined'||typeof state==='undefined')return null;const assets=ASSETS.map(a=>({name:a[0],key:a[1]||a[2],target:a[3]})),data={};for(const a of assets){const d=state.data?.[a.key];if(d&&Number.isFinite(d.dd))data[a.key]={dd:d.dd}}return MR26.smartDcaAllocation({assets,portfolio:state.portfolio||{},data,monthly:+state.monthly||1000,maxAssetShare:.40,drawdownStrength:1,underweightStrength:.35})}
function smartDcaHtml(){const r=currentRecommendation();if(!r||!r.diagnostics?.rows?.length)return '';const names=Object.fromEntries(ASSETS.map(a=>[a[1]||a[2],a[0]])),rows=[...r.diagnostics.rows].sort((a,b)=>b.amount-a.amount);return `<div id="mr26SmartDca"><div class="top"><div><div class="brand">Compra del mes · Smart DCA <span class="vtag">V2.6</span></div><div class="muted">Invierte siempre ${money(r.diagnostics.monthly)} · sesgo hacia caídas · sin vender</div></div></div><div class="notice good"><b>Regla:</b> pesos objetivo como ancla, oportunidad por drawdown y corrección secundaria de infraponderación. Máximo 40% de la aportación en un activo.</div><div class="section"><div class="assetList">${rows.map(x=>`<div class="card rank"><div class="grow"><div class="assetName">${esc(names[x.key]||x.key)}</div><div class="small">${esc(reason(x))} · cartera ${(x.actual*100).toFixed(1)}% / objetivo ${(x.target*100).toFixed(1)}%</div></div><div class="amount">${money(x.amount)}</div></div>`).join('')}</div><div class="small" style="margin-top:10px">Total asignado: <b>${money(r.diagnostics.invested)}</b>. Distribuye aportaciones nuevas; no genera ventas.</div></div></div>`}
// v251fix.js intentionally preserves provider/backtest fixes, but it also stamps every render as V2.5.1.
// V2.6 loads after it, so own the final render wrapper here and keep one authoritative version label.
const renderV26Base=render;
render=function(){renderV26Base();if(state.view==='ranking'){const html=smartDcaHtml();if(html)$('#app').innerHTML=html}const tag=document.querySelector('.vtag');if(tag)tag.textContent='V2.6';};
render();
window.MR26UI={currentRecommendation,renderSmartDca:render,version:'2.6.0'};
})();
