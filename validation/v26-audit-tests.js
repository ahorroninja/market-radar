'use strict';
const MR=require('../v26-smart-dca.js');
const assert=(x,m)=>{if(!x)throw Error('FAIL: '+m);console.log('PASS:',m)};
const near=(a,b,e=.011)=>Math.abs(a-b)<=e, sum=o=>Object.values(o).reduce((a,b)=>a+b,0);
const A=[{key:'W',target:50},{key:'V',target:30},{key:'E',target:20}];
function run(args){return MR.smartDcaAllocation({assets:A,monthly:1000,maxAssetShare:.60,drawdownStrength:1,underweightStrength:.35,...args});}
let r=run({portfolio:{W:5000,V:3000,E:2000},data:{W:{dd:0},V:{dd:0},E:{dd:0}}});
assert(near(r.allocations.W,500)&&near(r.allocations.V,300)&&near(r.allocations.E,200),'neutral allocation equals target weights');
assert(near(sum(r.allocations),1000),'neutral allocation conserves contribution');
r=run({portfolio:{W:5000,V:3000,E:2000},data:{W:{dd:0},V:{dd:-.30},E:{dd:0}}});
assert(r.allocations.V>300,'30% drawdown increases allocation to affected asset');
assert(near(sum(r.allocations),1000),'drawdown allocation conserves contribution');
r=run({portfolio:{W:9000,V:500,E:500},data:{W:{dd:0},V:{dd:0},E:{dd:0}}});
assert(r.allocations.W<500&&r.allocations.V>300&&r.allocations.E>200,'portfolio drift tilts new money toward underweights');
r=MR.smartDcaAllocation({assets:A,monthly:777.77,maxAssetShare:.40,portfolio:{},data:{W:{dd:-.50},V:{dd:0},E:{dd:0}},drawdownStrength:1,underweightStrength:.35});
assert(near(sum(r.allocations),777.77,.001),'cent-level cash conservation');
assert(Math.max(...Object.values(r.allocations))<=311.12,'40% concentration cap respected');
r=MR.smartDcaAllocation({assets:A,monthly:1000,maxAssetShare:.80,portfolio:{},data:{W:{dd:0},V:{dd:0}},drawdownStrength:1,underweightStrength:.35});
assert(!('E' in r.allocations),'asset without contemporaneous data is excluded');
assert(near(sum(r.allocations),1000),'remaining eligible assets receive full contribution');
r=MR.smartDcaAllocation({assets:A,monthly:0,portfolio:{},data:{W:{dd:0},V:{dd:0},E:{dd:0}}});
assert(sum(r.allocations)===0,'zero contribution produces no purchase');
r=MR.smartDcaAllocation({assets:A,monthly:1000,portfolio:{},data:{}});
assert(sum(r.allocations)===0,'no contemporaneous data produces no invented purchase');
// Determinism: identical information set must produce identical order-independent result.
const r1=run({portfolio:{W:4100,V:3700,E:2200},data:{W:{dd:-.12},V:{dd:-.08},E:{dd:-.22}}});
const r2=run({portfolio:{W:4100,V:3700,E:2200},data:{W:{dd:-.12},V:{dd:-.08},E:{dd:-.22}}});
assert(JSON.stringify(r1.allocations)===JSON.stringify(r2.allocations),'allocator is deterministic for identical inputs');
console.log('ALL V2.6 ADVERSARIAL ALLOCATION TESTS PASSED');
