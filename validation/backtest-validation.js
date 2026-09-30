// Deterministic validation harness for Market Radar backtest.
// Intentionally isolated from production runtime.
(function(){
'use strict';
const assert=(ok,msg)=>{if(!ok)throw new Error('FAIL: '+msg);console.log('PASS:',msg)};
const approx=(a,b,e=1e-9)=>Math.abs(a-b)<=e;

function maxDD(values){let peak=-Infinity,dd=0;for(const v of values){peak=Math.max(peak,v);if(peak>0)dd=Math.min(dd,v/peak-1)}return dd}
function twr(series){let growth=1;for(let i=1;i<series.length;i++){const base=series[i-1].value+(series[i].flow||0);if(base>0)growth*=series[i].value/base}return growth-1}
function xirr(flows){if(flows.length<2)return NaN;const t0=new Date(flows[0].date);const npv=r=>flows.reduce((s,x)=>s+x.value/Math.pow(1+r,(new Date(x.date)-t0)/31557600000),0);let lo=-.9999,hi=10,nlo=npv(lo),nhi=npv(hi);if(nlo*nhi>0)return NaN;for(let i=0;i<150;i++){const mid=(lo+hi)/2,nm=npv(mid);if(nlo*nm<=0){hi=mid;nhi=nm}else{lo=mid;nlo=nm}}return(lo+hi)/2}

// 1) TWR must ignore external contributions.
const flat=[{value:100,flow:100},{value:200,flow:100},{value:300,flow:100}];
assert(approx(twr(flat),0),'TWR ignores deposits when market return is zero');
const up=[{value:100,flow:100},{value:220,flow:100},{value:352,flow:100}]; // +10%, then +10%
assert(approx(twr(up),0.21),'TWR compounds market returns independently of deposits');

// 2) Max drawdown known sequence.
assert(approx(maxDD([100,120,90,108]),-0.25),'Max drawdown is measured peak-to-trough');

// 3) XIRR known one-year doubling.
const xr=xirr([{date:'2025-01-01',value:-1000},{date:'2026-01-01',value:2000}]);
assert(Math.abs(xr-1)<0.003,'XIRR returns ~100% for one-year doubling');

// 4) No-look-ahead invariant for signals.
function momentum(history,idx,lookback=3){if(idx<lookback)return null;return history[idx]/history[idx-lookback]-1}
const original=[100,101,102,103,104,105,106];
const altered=[100,101,102,103,104,9999,1];
assert(approx(momentum(original,4),momentum(altered,4)),'Signal at t is unchanged by future prices');

// 5) Rolling window count: monthly step, deterministic expected count.
function rollingCount(sessions,window,step=21){let n=0;for(let i=0;i+window<=sessions;i+=step)n++;return n}
assert(rollingCount(1260,252)===49,'Five years of sessions yields 49 one-year rolling windows at ~monthly step');
assert(rollingCount(756,756)===1,'Three years with a three-year window correctly yields only one observation');

// 6) DCA cash conservation: every contribution must be invested exactly once.
function allocateDCA(monthly,weights){const sum=weights.reduce((a,b)=>a+b,0);const allocations=weights.map(w=>monthly*w/sum);return allocations}
const alloc=allocateDCA(1000,[25,15,10,5]);
assert(approx(alloc.reduce((a,b)=>a+b,0),1000),'DCA allocation conserves monthly cash');

console.log('\nALL BACKTEST VALIDATION TESTS PASSED');
})();
