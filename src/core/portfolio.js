function err(code,message){const e=new Error(message);e.code=code;return e;}
export function buildPortfolioSnapshot(asOf,holdings){
 if(!Array.isArray(holdings))throw err('INVALID_HOLDING','Holdings must be an array');
 const seen=new Set();
 for(const h of holdings){if(!h||typeof h.assetId!=='string'||!h.assetId||!Number.isFinite(h.value)||h.value<0||seen.has(h.assetId))throw err('INVALID_HOLDING','Holding is invalid or duplicated');seen.add(h.assetId);}
 const totalValue=holdings.reduce((s,h)=>s+h.value,0);
 const weights=Object.fromEntries([...holdings].sort((a,b)=>a.assetId.localeCompare(b.assetId)).map(h=>[h.assetId,totalValue?h.value/totalValue:0]));
 return{asOf,holdings:holdings.map(h=>({...h})),totalValue,weights};
}
export function targetGaps(assets,portfolio){
 const enabled=assets.filter(a=>a.enabled&&Number.isFinite(a.targetWeight)&&a.targetWeight>0);
 const sum=enabled.reduce((s,a)=>s+a.targetWeight,0);if(!sum)throw err('INVALID_TARGETS','No positive enabled targets');
 return Object.fromEntries(enabled.sort((a,b)=>a.id.localeCompare(b.id)).map(a=>[a.id,Math.max(0,a.targetWeight/sum-(portfolio.weights[a.id]||0))]));
}
