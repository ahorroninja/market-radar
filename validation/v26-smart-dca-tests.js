// Run after v26-smart-dca.js (browser console or Node require).
'use strict';
const MR=typeof require==='function'?require('../v26-smart-dca.js'):globalThis.MR26;
const assert=(x,m)=>{if(!x)throw Error('FAIL: '+m);console.log('PASS:',m)};
const total=o=>Object.values(o).reduce((a,b)=>a+b,0);
assert(MR.validateSmartDca(),'built-in validation');
const assets=[{key:'W',target:50},{key:'V',target:30},{key:'E',target:20}];
let r=MR.smartDcaAllocation({assets,monthly:1000,portfolio:{W:5000,V:3000,E:2000},data:{W:{dd:0},V:{dd:0},E:{dd:0}},maxAssetShare:.60});
assert(Math.abs(r.allocations.W-500)<.02&&Math.abs(r.allocations.V-300)<.02&&Math.abs(r.allocations.E-200)<.02,'neutral market equals target DCA');
r=MR.smartDcaAllocation({assets,monthly:1000,portfolio:{W:5000,V:3000,E:2000},data:{W:{dd:-.05},V:{dd:-.30},E:{dd:-.10}},maxAssetShare:.60});
assert(r.allocations.V>300,'deepest drawdown receives a positive tilt');
assert(total(r.allocations)===1000,'exactly 1000 EUR invested');
assert(Math.max(...Object.values(r.allocations))<=600.01,'asset cap respected');
r=MR.smartDcaAllocation({assets,monthly:777.77,portfolio:{},data:{W:{dd:-.5},V:{dd:0},E:{dd:0}},maxAssetShare:.40});
assert(Math.abs(total(r.allocations)-777.77)<.001,'cent-level cash conservation');
assert(Math.max(...Object.values(r.allocations))<=311.12,'40% concentration cap respected');
console.log('ALL V2.6 SMART DCA TESTS PASSED');
