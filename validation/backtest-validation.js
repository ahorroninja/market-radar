'use strict';
const E=require('./backtest-engine');
const assert=(ok,msg)=>{if(!ok)throw new Error('FAIL: '+msg);console.log('PASS:',msg)};
const approx=(a,b,e=1e-8)=>Math.abs(a-b)<=e;

assert(approx(E.maxDrawdown([100,120,90,108]),-.25),'max drawdown peak-to-trough');
const xr=E.xirr([{date:'2025-01-01',value:-1000},{date:'2026-01-01',value:2000}]);
assert(Math.abs(xr-1)<.003,'XIRR one-year doubling ~= 100%');

// Flat market: every strategy must end exactly at contributed capital.
function market(days,fn){const start=new Date('2020-01-02T00:00:00Z'),h=[];for(let i=0;i<days;i++){const d=new Date(start);d.setUTCDate(d.getUTCDate()+i);if(d.getUTCDay()===0||d.getUTCDay()===6)continue;h.push({date:d.toISOString().slice(0,10),close:fn(h.length)})}return h}
const flat=market(1000,()=>100),assetsFlat=[{name:'A',weight:60,history:flat},{name:'B',weight:40,history:flat}];
const f=E.simulate({assets:assetsFlat,monthly:1000});
for(const n of ['DCA','REBALANCE','MR_TECH','MR_MACRO']){assert(approx(f.metrics[n].final,f.contributed,.01),`${n} conserves cash in flat market`);assert(Math.abs(f.metrics[n].twrAnnual)<1e-10,`${n} TWR is zero in flat market`)}

// Identical assets: all allocation methods must have identical terminal value.
const rising=market(1000,i=>100*Math.pow(1.0005,i)),same=[{name:'A',weight:70,history:rising},{name:'B',weight:30,history:rising}];
const s=E.simulate({assets:same,monthly:1000});
assert(approx(s.metrics.DCA.final,s.metrics.REBALANCE.final,.01),'DCA == rebalance for identical return streams');
assert(approx(s.metrics.DCA.final,s.metrics.MR_TECH.final,.01),'DCA == MR tech for identical return streams');
assert(approx(s.metrics.DCA.final,s.metrics.MR_MACRO.final,.01),'DCA == MR macro when macro is neutral and returns identical');

// Macro must be inert when constant 50.
const divergent=[{name:'Trend',weight:50,history:market(1200,i=>100*Math.pow(1.0008,i))},{name:'Lag',weight:50,history:market(1200,i=>100*Math.pow(.9999,i))}];
const neutral=E.simulate({assets:divergent,monthly:1000,macroAt:()=>50});
assert(approx(neutral.metrics.MR_TECH.final,neutral.metrics.MR_MACRO.final,.01),'MR macro == MR tech with neutral macro');

// Future prices cannot alter a signal at t.
const p=Array.from({length:400},(_,i)=>100+i*.1),p2=p.slice();for(let i=320;i<p2.length;i++)p2[i]=9999-i;
assert(approx(E.opportunity(p,300,50),E.opportunity(p2,300,50)),'signal has no price look-ahead');

// Rolling windows must produce many observations, not a single cherry-picked period.
const roll=E.rolling({assets:divergent,monthly:1000,windowSessions:252,step:21});
assert(roll.length>=20,'rolling 1Y creates >=20 observations on long history');
assert(roll.every(x=>Number.isFinite(x.tech)&&Number.isFinite(x.macro)),'rolling advantages are finite');

console.log(`\nALL ${18} VALIDATION CHECKS PASSED`);
