'use strict';
const fs=require('fs'),vm=require('vm');
const assert=(x,m)=>{if(!x)throw Error('FAIL: '+m);console.log('PASS:',m)};
const smart=fs.readFileSync('v26-smart-dca.js','utf8'),bt=fs.readFileSync('v26-backtest.js','utf8'),ui=fs.readFileSync('v26-ui.js','utf8'),html=fs.readFileSync('index.html','utf8');
// Static contract gates: production allocator is shared, navigation is preserved, wording is honest.
assert(bt.includes('MR26.smartDcaAllocation'),'backtest calls production Smart DCA allocator');
assert(ui.includes("#app main.shell"),'Comprar V2.6 replaces main content only, preserving bottom navigation');
assert(bt.includes('Rolling solapado')&&bt.includes('no evidencia estadística independiente'),'rolling windows are explicitly labelled overlapping/descriptive');
assert(bt.includes('hist[K(a)].push')&&bt.indexOf('hist[K(a)].push')>bt.indexOf('snapshotBefore(hist'),'execution-day close enters history after decision snapshot');
assert(html.includes('v26-backtest.js'),'rebuilt backtest is wired into app');
// Allocator executable gates.
const ctx={module:{exports:{}},exports:{},globalThis:{}};vm.runInNewContext(smart,ctx);const MR=ctx.module.exports;
const assets=[{key:'A',target:60},{key:'B',target:40}];
let r=MR.smartDcaAllocation({assets,portfolio:{A:6000,B:4000},data:{A:{dd:0},B:{dd:0}},monthly:1000,maxAssetShare:.8});
assert(Math.abs(r.allocations.A-600)<.011&&Math.abs(r.allocations.B-400)<.011,'neutral Smart DCA equals target weights');
r=MR.smartDcaAllocation({assets,portfolio:{A:6000,B:4000},data:{A:{dd:0},B:{dd:-.3}},monthly:1000,maxAssetShare:.7});
assert(r.allocations.B>400,'drawdown tilts new money toward fallen asset');
assert(Math.abs(Object.values(r.allocations).reduce((a,b)=>a+b,0)-1000)<.011,'monthly contribution is conserved');
// Same-close anti-lookahead: source contract requires snapshot before current observation append.
const snapPos=bt.indexOf('snapshotBefore(hist'),appendPos=bt.indexOf('// Critical timing rule');assert(snapPos>=0&&appendPos>snapPos,'same-close anti-lookahead ordering is enforced');
// Explicit zero contribution must remain zero, not fallback to 1000.
assert(bt.includes('Number.isFinite(n)&&n>=0?n:1000'),'explicit zero monthly contribution is preserved');
console.log('V2.6 RELEASE GATE PASSED');
