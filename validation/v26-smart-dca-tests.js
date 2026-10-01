// Run after v26-smart-dca.js (browser console or Node require).
'use strict';
const MR=typeof require==='function'?require('../v26-smart-dca.js'):globalThis.MR26;
const assert=(x,m)=>{if(!x)throw Error('FAIL: '+m);console.log('PASS:',m)};
const total=o=>Object.values(o).reduce((a,b)=>a+b,0);
const near=(a,b,e=.02)=>Math.abs(a-b)<=e;
assert(MR.validateSmartDca(),'built-in validation');
const assets=[{key:'W',target:50},{key:'V',target:30},{key:'E',target:20}];
let r=MR.smartDcaAllocation({assets,monthly:1000,portfolio:{W:5000,V:3000,E:2000},data:{W:{dd:0},V:{dd:0},E:{dd:0}},maxAssetShare:.60});
assert(near(r.allocations.W,500)&&near(r.allocations.V,300)&&near(r.allocations.E,200),'neutral market equals target DCA');
r=MR.smartDcaAllocation({assets,monthly:1000,portfolio:{W:5000,V:3000,E:2000},data:{W:{dd:-.05},V:{dd:-.30},E:{dd:-.10}},maxAssetShare:.60});
assert(r.allocations.V>300,'deepest drawdown receives a positive tilt');
assert(near(total(r.allocations),1000,.001),'exactly 1000 EUR invested');
assert(Math.max(...Object.values(r.allocations))<=600.01,'asset cap respected');
r=MR.smartDcaAllocation({assets,monthly:777.77,portfolio:{},data:{W:{dd:-.5},V:{dd:0},E:{dd:0}},maxAssetShare:.40});
assert(near(total(r.allocations),777.77,.001),'cent-level cash conservation');
assert(Math.max(...Object.values(r.allocations))<=311.12,'40% concentration cap respected');
// Stress: all assets crashing together. Relative target structure must remain finite and cash-safe.
r=MR.smartDcaAllocation({assets,monthly:1000,portfolio:{W:5000,V:3000,E:2000},data:{W:{dd:-.45},V:{dd:-.50},E:{dd:-.40}},maxAssetShare:.40});
assert(near(total(r.allocations),1000,.001),'crash: contribution conserved');
assert(Object.values(r.allocations).every(Number.isFinite),'crash: finite allocations');
assert(Object.values(r.allocations).every(x=>x>=0),'crash: no negative allocation');
assert(Math.max(...Object.values(r.allocations))<=400.01,'crash: concentration cap respected');
// Stress: extreme portfolio drift. New money should help repair it without selling.
r=MR.smartDcaAllocation({assets,monthly:1000,portfolio:{W:9500,V:300,E:200},data:{W:{dd:0},V:{dd:-.15},E:{dd:-.15}},maxAssetShare:.50});
assert(r.allocations.W<500,'drift: overweight asset receives less than target DCA');
assert(r.allocations.V>300||r.allocations.E>200,'drift: underweights receive corrective tilt');
assert(near(total(r.allocations),1000,.001),'drift: contribution conserved');
// Missing/new ETF data: unavailable assets are excluded and available target weights renormalize.
r=MR.smartDcaAllocation({assets,monthly:1000,portfolio:{},data:{W:{dd:0},V:{dd:0}},maxAssetShare:.80});
assert(!('E' in r.allocations),'missing data: unavailable asset not purchased');
assert(near(total(r.allocations),1000,.001),'missing data: contribution fully redistributed');
assert(near(r.allocations.W,625,.02)&&near(r.allocations.V,375,.02),'missing data: targets renormalized');
// Degenerate inputs should fail safe, not invent trades.
r=MR.smartDcaAllocation({assets,monthly:0,portfolio:{},data:{W:{dd:0},V:{dd:0},E:{dd:0}}});
assert(total(r.allocations)===0,'zero contribution: no purchases');
r=MR.smartDcaAllocation({assets,monthly:1000,portfolio:{},data:{}});
assert(total(r.allocations)===0,'no market data: no invented purchases');
console.log('ALL V2.6 SMART DCA STRESS TESTS PASSED');
