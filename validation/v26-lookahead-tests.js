'use strict';
const MR=require('../v26-smart-dca.js');
const assert=(x,m)=>{if(!x)throw Error('FAIL: '+m);console.log('PASS:',m)};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const assets=[{key:'A',target:50},{key:'B',target:30},{key:'C',target:20}];
function decision(history,portfolio,monthly=1000){const data={};for(const a of assets){const h=history[a.key]||[];if(!h.length)continue;const prices=h.map(x=>x.p),last=prices.at(-1),peak=Math.max(...prices);data[a.key]={dd:last/peak-1};}return MR.smartDcaAllocation({assets,portfolio,data,monthly,maxAssetShare:.60,drawdownStrength:1,underweightStrength:.35}).allocations;}
const past={A:[{d:'2026-01-01',p:100},{d:'2026-02-01',p:90}],B:[{d:'2026-01-01',p:100},{d:'2026-02-01',p:100}],C:[{d:'2026-01-01',p:100},{d:'2026-02-01',p:95}]};
const portfolio={A:5000,B:3000,C:2000};
const atT=decision(past,portfolio);
// Mutating future observations must not alter the decision already made at t.
const futureCrash=JSON.parse(JSON.stringify(past));futureCrash.A.push({d:'2026-03-01',p:10});futureCrash.B.push({d:'2026-03-01',p:500});futureCrash.C.push({d:'2026-03-01',p:1});
const pastSlice=Object.fromEntries(Object.entries(futureCrash).map(([k,v])=>[k,v.filter(x=>x.d<='2026-02-01')]));
assert(same(atT,decision(pastSlice,portfolio)),'future prices cannot change a decision at t');
assert(!same(atT,decision(futureCrash,portfolio)),'future prices do change a later decision, proving the test is sensitive');
// Current observation is allowed; only future observations are forbidden.
const changedNow=JSON.parse(JSON.stringify(past));changedNow.A[1].p=50;assert(!same(atT,decision(changedNow,portfolio)),'decision responds to information available at t');
// No history means no fabricated allocation.
assert(Object.keys(decision({},portfolio)).length===0,'missing history produces no fabricated decision');
console.log('ALL NO-LOOKAHEAD INVARIANTS PASSED');
