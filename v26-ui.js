// Market Radar V2.6 candidate UI — validation branch only.
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>(+x||0).toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
function reason(row){
  const dd=row.dd||0, gap=(row.target-row.actual)*100;
  if(dd>=.20)return `Caída fuerte (${Math.round(dd*100)}%)`;
  if(dd>=.10)return `En corrección (${Math.round(dd*100)}%)`;
  if(gap>=3)return `Infraponderado ${gap.toFixed(1)} pp`;
  if(gap<=-3)return `Sobreponderado ${Math.abs(gap).toFixed(1)} pp`;
  return 'Cerca del peso objetivo';
}
function currentRecommendation(){
  if(!window.MR26||typeof ASSETS==='undefined'||typeof state==='undefined')return null;
  const assets=ASSETS.map(a=>({name:a[0],key:a[1]||a[2],target:a[3]}));
  const data={};for(const a of assets){const d=state.data?.[a.key];if(d&&Number.isFinite(d.dd))data[a.key]={dd:d.dd};}
  return MR26.smartDcaAllocation({assets,portfolio:state.portfolio||{},data,monthly:+state.monthly||1000,maxAssetShare:.40,drawdownStrength:1,underweightStrength:.35});
}
function renderSmartDca(){
  const root=document.getElementById('app');if(!root||document.getElementById('mr26SmartDca'))return;
  if(typeof state==='undefined'||state.view!=='ranking')return;
  const r=currentRecommendation();if(!r||!r.diagnostics?.rows?.length)return;
  const names=Object.fromEntries(ASSETS.map(a=>[a[1]||a[2],a[0]]));
  const rows=[...r.diagnostics.rows].sort((a,b)=>b.amount-a.amount);
  const box=document.createElement('section');box.id='mr26SmartDca';box.className='section';
  box.innerHTML=`<div class="top"><div><div class="brand">Compra del mes · Smart DCA <span class="vtag">V2.6</span></div><div class="muted">Invierte siempre ${money(r.diagnostics.monthly)} · sesgo hacia caídas · sin vender</div></div></div><div class="notice good"><b>Regla:</b> pesos objetivo como ancla, oportunidad por drawdown y corrección secundaria de infraponderación. Máximo 40% de la aportación en un activo.</div><div class="assetList">${rows.map(x=>`<div class="card rank"><div class="grow"><div class="assetName">${esc(names[x.key]||x.key)}</div><div class="small">${esc(reason(x))} · cartera ${(x.actual*100).toFixed(1)}% / objetivo ${(x.target*100).toFixed(1)}%</div></div><div class="amount">${money(x.amount)}</div></div>`).join('')}</div><div class="small" style="margin-top:10px">Total asignado: <b>${money(r.diagnostics.invested)}</b>. Esta recomendación distribuye aportaciones nuevas; no genera órdenes de venta.</div>`;
  root.prepend(box);
}
const obs=new MutationObserver(renderSmartDca);obs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});setTimeout(renderSmartDca,0);
window.MR26UI={currentRecommendation,renderSmartDca};
})();
