import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateSmartDca, roundWholeEuros } from '../../src/core/smart-dca.js';

const asset=(id,targetWeight,enabled=true)=>({id,name:id,enabled,targetWeight,symbols:{}});
const indicator=(assetId,drawdown)=>({assetId,asOf:'2026-09-30',drawdown,trend:0,valuation:0,sentiment:0,macro:0,breadth:0,missing:[]});
const portfolio=(values)=>({asOf:'2026-09-30',holdings:Object.entries(values).map(([assetId,value])=>({assetId,value})),totalValue:Object.values(values).reduce((a,b)=>a+b,0),weights:{}});
const policy={drawdownStrength:1,underweightStrength:.35,maxContributionShare:.40};

function request(overrides={}){
 const assets=[asset('world',.6),asset('value',.4)];
 return {contribution:1000,assets,portfolio:portfolio({world:6000,value:4000}),indicators:[indicator('world',0),indicator('value',0)],policy,...overrides};
}

test('whole-euro largest-remainder rounding conserves contribution',()=>{
 assert.deepEqual(roundWholeEuros({a:333.6,b:333.3,c:333.1},1000),{a:334,b:333,c:333});
});

test('zero contribution stays zero',()=>{
 const r=allocateSmartDca(request({contribution:0}));
 assert.equal(Object.values(r.allocations).reduce((a,b)=>a+b,0),0);
});

test('neutral signals and on-target portfolio anchor allocation to targets',()=>{
 const r=allocateSmartDca(request());
 assert.deepEqual(r.allocations,{value:400,world:600});
});

test('deeper drawdown receives a larger tactical allocation',()=>{
 const r=allocateSmartDca(request({indicators:[indicator('world',0),indicator('value',-.25)]}));
 assert.ok(r.allocations.value>400);
 assert.equal(Object.values(r.allocations).reduce((a,b)=>a+b,0),1000);
});

test('underweight is a secondary positive tilt',()=>{
 const r=allocateSmartDca(request({portfolio:portfolio({world:8000,value:2000})}));
 assert.ok(r.allocations.value>400);
 assert.equal(Object.values(r.allocations).reduce((a,b)=>a+b,0),1000);
});

test('strategic 60 percent target is not incorrectly capped at 40 percent',()=>{
 const r=allocateSmartDca(request());
 assert.equal(r.tacticalCap,.4);
 assert.equal(r.allocations.world,600);
 assert.equal(r.allocations.value,400);
});

test('tactical cap limits overweight above each strategic target',()=>{
 const assets=[asset('a',.34),asset('b',.33),asset('c',.33)];
 const tight={...policy,maxContributionShare:.05,drawdownStrength:10};
 const r=allocateSmartDca(request({assets,policy:tight,portfolio:portfolio({a:3400,b:3300,c:3300}),indicators:[indicator('a',-.9),indicator('b',0),indicator('c',0)]}));
 assert.ok(r.allocations.a<=390); // 34% strategic + max 5% tactical, rounded euros
 assert.equal(Object.values(r.allocations).reduce((a,b)=>a+b,0),1000);
});

test('disabled assets are never eligible or allocated',()=>{
 const assets=[asset('a',.6),asset('b',.4,false)];
 const r=allocateSmartDca(request({assets,portfolio:portfolio({a:6000,b:4000}),indicators:[indicator('a',0),indicator('b',-.9)]}));
 assert.deepEqual(r.eligibleAssetIds,['a']);
 assert.equal(r.allocations.b,undefined);
 assert.equal(r.allocations.a,1000);
});

test('missing required drawdown does not become a fabricated zero signal',()=>{
 const bad=indicator('value',null); bad.missing=['drawdown'];
 const r=allocateSmartDca(request({indicators:[indicator('world',0),bad]}));
 assert.deepEqual(r.eligibleAssetIds,['world']);
 assert.equal(r.allocations.world,1000);
});

test('no eligible assets is an explicit domain error',()=>{
 const assets=[asset('a',1,false)];
 assert.throws(()=>allocateSmartDca(request({assets,portfolio:portfolio({a:1000}),indicators:[indicator('a',0)]})),e=>e?.code==='NO_ELIGIBLE_ASSETS');
});

test('negative or non-integer contribution is rejected',()=>{
 assert.throws(()=>allocateSmartDca(request({contribution:-1})),e=>e?.code==='INVALID_CONTRIBUTION');
 assert.throws(()=>allocateSmartDca(request({contribution:999.5})),e=>e?.code==='INVALID_CONTRIBUTION');
});

test('result is deterministic independent of input ordering',()=>{
 const a=request();
 const b=request({assets:[...a.assets].reverse(),indicators:[...a.indicators].reverse(),portfolio:{...a.portfolio,holdings:[...a.portfolio.holdings].reverse()}});
 assert.deepEqual(allocateSmartDca(a).allocations,allocateSmartDca(b).allocations);
});
