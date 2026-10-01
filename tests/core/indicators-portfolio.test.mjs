import test from 'node:test';
import assert from 'node:assert/strict';
import { drawdown, simpleReturn, sma, trendSignal, opportunityBand } from '../../src/core/indicators.js';
import { buildPortfolioSnapshot, targetGaps } from '../../src/core/portfolio.js';

const points=closes=>closes.map((close,i)=>({date:`2026-01-${String(i+1).padStart(2,'0')}`,close}));

test('drawdown is zero at a new high',()=>assert.equal(drawdown(points([100,110,120])),0));
test('drawdown measures fall from prior peak',()=>assert.equal(drawdown(points([100,120,90])),-.25));
test('drawdown missing history returns null, not zero',()=>assert.equal(drawdown([]),null));
test('simple return is deterministic',()=>assert.equal(simpleReturn(points([100,105,110]),2),.1));
test('simple return with insufficient history is null',()=>assert.equal(simpleReturn(points([100]),2),null));
test('SMA uses exactly requested trailing observations',()=>assert.equal(sma(points([1,2,3,4,5]),3),4));
test('trend signal compares last close with SMA and is bounded',()=>{
 assert.equal(trendSignal(points([1,2,3,4,5]),3),1);
 assert.equal(trendSignal(points([5,4,3,2,1]),3),-1);
});
test('opportunity bands respect frozen drawdown thresholds',()=>{
 assert.equal(opportunityBand(-.02),'normal');
 assert.equal(opportunityBand(-.07),'interesting');
 assert.equal(opportunityBand(-.15),'opportunity');
 assert.equal(opportunityBand(-.25),'strong');
 assert.equal(opportunityBand(-.35),'extraordinary');
 assert.equal(opportunityBand(null),null);
});

test('portfolio snapshot computes weights from holdings',()=>{
 const r=buildPortfolioSnapshot('2026-09-30',[{assetId:'a',value:6000},{assetId:'b',value:4000}]);
 assert.equal(r.totalValue,10000);assert.equal(r.weights.a,.6);assert.equal(r.weights.b,.4);
});
test('zero-value portfolio has explicit zero weights',()=>{
 const r=buildPortfolioSnapshot('2026-09-30',[{assetId:'a',value:0},{assetId:'b',value:0}]);
 assert.deepEqual(r.weights,{a:0,b:0});
});
test('invalid holding value is rejected rather than silently coerced',()=>{
 assert.throws(()=>buildPortfolioSnapshot('2026-09-30',[{assetId:'a',value:-1}]),e=>e?.code==='INVALID_HOLDING');
});
test('target gaps identify only underweights against normalized enabled targets',()=>{
 const assets=[{id:'a',enabled:true,targetWeight:.6},{id:'b',enabled:true,targetWeight:.4}];
 const p=buildPortfolioSnapshot('2026-09-30',[{assetId:'a',value:8000},{assetId:'b',value:2000}]);
 assert.deepEqual(targetGaps(assets,p),{a:0,b:.2});
});
