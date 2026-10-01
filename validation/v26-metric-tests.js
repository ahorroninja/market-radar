'use strict';
const assert=(x,m)=>{if(!x)throw Error('FAIL: '+m);console.log('PASS:',m)};
const near=(a,b,e=1e-8)=>Math.abs(a-b)<=e;
// Independent reference calculations for cash-flow adjusted daily TWR and max drawdown.
function refTwr(series){let wealth=1,prev=null;for(const p of series){if(prev!==null){const base=prev+p.flow;if(base>0)wealth*=p.v/base;}prev=p.v;}const years=Math.max((series.length-1)/252,1/252);return Math.pow(wealth,1/years)-1;}
function refDd(series){let peak=-Infinity,worst=0;for(const p of series){peak=Math.max(peak,p.v);if(peak>0)worst=Math.min(worst,p.v/peak-1);}return worst;}
let s=[{v:1000,flow:1000},{v:1010,flow:0},{v:2020,flow:1000},{v:2040,flow:0}];
// External contributions must not be mistaken for investment return.
const twr=refTwr(s);assert(Number.isFinite(twr),'reference TWR finite with contributions');
const naive=Math.pow(2040/1000,252/3)-1;assert(Math.abs(twr-naive)>1,'TWR materially differs from naive CAGR when cash is injected');
s=[{v:100,flow:0},{v:120,flow:0},{v:90,flow:0},{v:108,flow:0}];assert(near(refDd(s),-.25),'max drawdown is measured peak-to-trough');
// Flat price plus contributions has zero investment return by definition.
s=[{v:1000,flow:1000},{v:2000,flow:1000},{v:3000,flow:1000},{v:4000,flow:1000}];assert(near(refTwr(s),0),'pure contributions produce zero TWR');
// 1% market gain between each observation, contribution at observation start.
s=[{v:1000,flow:1000},{v:1010,flow:0},{v:2030.1,flow:1000},{v:2050.401,flow:0}];assert(refTwr(s)>0,'positive market returns produce positive TWR despite contributions');
console.log('ALL INDEPENDENT METRIC INVARIANTS PASSED');
