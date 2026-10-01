// Market Radar V2.6 — Smart DCA candidate (validation branch only)
// Philosophy: always invest the monthly contribution; use drawdown + target-weight deficit
// to decide WHERE to add. No selling, no market timing, no leverage, no future data.
(function(){
'use strict';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const k=a=>a[1]||a[2];

function smartDcaPlan(assets, state, monthly){
  const total=assets.reduce((s,a)=>s+(+state.portfolio?.[k(a)]||0),0);
  const targetSum=assets.reduce((s,a)=>s+a[3],0)||1;
  const rows=assets.map(a=>{
    const key=k(a), value=+state.portfolio?.[key]||0;
    const target=a[3]/targetSum;
    const actual=total?value/total:0;
    const deficit=clamp((target-actual)/Math.max(target,.0001),-1,1);
    // dd is <=0. 0% drawdown -> 0; -10% -> .5; -20% or worse -> 1.
    const dd=state.data?.[key]?.dd;
    const draw=Number.isFinite(dd)?clamp((-dd)/.20):0;
    // Evidence-led simple score: 80% drawdown, 20% target deficit.
    const deficit01=clamp((deficit+1)/2);
    const score=.80*draw+.20*deficit01;
    return {a,key,value,target,actual,deficit,dd:Number.isFinite(dd)?dd:null,draw,score};
  });

  // Anchor every contribution to target weights. Tilt is deliberately bounded.
  // At least 50% of each contribution follows target weights; max single asset 40%.
  const baseShare=.50, tiltShare=1-baseShare;
  const positive=rows.map(r=>Math.max(.05,r.score));
  const ps=positive.reduce((x,y)=>x+y,0)||1;
  let raw=rows.map((r,i)=>baseShare*r.target+tiltShare*positive[i]/ps);

  // Cap concentration and redistribute overflow proportionally to uncapped names.
  const cap=.40; let w=raw.slice();
  for(let pass=0;pass<8;pass++){
    let excess=0, free=[];
    for(let i=0;i<w.length;i++){if(w[i]>cap){excess+=w[i]-cap;w[i]=cap}else free.push(i)}
    if(excess<1e-10||!free.length)break;
    const denom=free.reduce((s,i)=>s+w[i],0)||free.length;
    free.forEach(i=>w[i]+=excess*(denom===free.length?1/free.length:w[i]/denom));
  }
  const ws=w.reduce((x,y)=>x+y,0)||1; w=w.map(x=>x/ws);
  let amounts=w.map(x=>Math.round(monthly*x/10)*10);
  // Exact cash conservation after €10 rounding.
  amounts[amounts.length-1]+=monthly-amounts.reduce((x,y)=>x+y,0);
  return rows.map((r,i)=>({...r,weight:w[i],amount:amounts[i]})).sort((a,b)=>b.amount-a.amount);
}

function assertPlan(plan,monthly){
  const sum=plan.reduce((s,x)=>s+x.amount,0);
  if(Math.abs(sum-monthly)>.01)throw Error('Smart DCA cash conservation failed');
  if(plan.some(x=>x.amount<0))throw Error('Smart DCA negative allocation');
  if(plan.some(x=>x.weight>.400001))throw Error('Smart DCA concentration cap failed');
  return true;
}

window.MR26SmartDCA={plan:smartDcaPlan,assert:assertPlan,version:'2.6.0-validation',method:'80% drawdown + 20% target deficit; 50% target anchor; 40% max asset'};
})();
