function finite(n){return typeof n==='number'&&Number.isFinite(n);}

export function timeWeightedReturn(observations){
 if(!Array.isArray(observations)||observations.length<2)return null;
 let growth=1;
 for(let i=1;i<observations.length;i++){
  const prev=observations[i-1],cur=observations[i];
  const flow=finite(cur.externalFlow)?cur.externalFlow:0;
  if(!finite(prev.value)||!finite(cur.value)||prev.value<0||cur.value<0)return null;
  const capital=prev.value+flow;
  if(capital<=0)return null;
  growth*=cur.value/capital;
 }
 return growth-1;
}

export function maxDrawdown(observations){
 if(!Array.isArray(observations)||!observations.length)return null;
 let peak=-Infinity,worst=0;
 for(const x of observations){const v=typeof x==='number'?x:x?.value;if(!finite(v)||v<0)return null;peak=Math.max(peak,v);if(peak>0)worst=Math.min(worst,v/peak-1);}
 return worst;
}

export function annualizedVolatility(returns,periodsPerYear=12){
 if(!Array.isArray(returns)||!returns.length||!returns.every(finite)||!finite(periodsPerYear)||periodsPerYear<=0)return null;
 const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const variance=returns.reduce((s,r)=>s+(r-mean)**2,0)/returns.length;
 return Math.sqrt(variance)*Math.sqrt(periodsPerYear);
}

export function sharpeRatio(returns,riskFreeAnnual=0,periodsPerYear=12){
 const vol=annualizedVolatility(returns,periodsPerYear);if(vol===null||vol===0||!finite(riskFreeAnnual))return null;
 const mean=returns.reduce((a,b)=>a+b,0)/returns.length;
 const annualReturn=mean*periodsPerYear;
 return (annualReturn-riskFreeAnnual)/vol;
}
