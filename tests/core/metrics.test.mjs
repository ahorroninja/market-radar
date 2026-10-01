import test from 'node:test';
import assert from 'node:assert/strict';
import { timeWeightedReturn, maxDrawdown, annualizedVolatility, sharpeRatio } from '../../src/core/metrics.js';

const approx=(actual,expected,tol=1e-10)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected}`);

test('TWR ignores external contributions on flat market',()=>{
 const observations=[
  {date:'2026-01-01',value:1000,externalFlow:0},
  {date:'2026-02-01',value:2000,externalFlow:1000},
  {date:'2026-03-01',value:3000,externalFlow:1000}
 ];
 approx(timeWeightedReturn(observations),0);
});

test('TWR measures market return net of beginning-of-period contribution',()=>{
 const observations=[
  {date:'2026-01-01',value:1000,externalFlow:0},
  {date:'2026-02-01',value:2200,externalFlow:1000}
 ];
 approx(timeWeightedReturn(observations),.1);
});

test('max drawdown measures peak-to-trough decline',()=>{
 approx(maxDrawdown([{value:100},{value:120},{value:90},{value:110}]),-.25);
});

test('max drawdown is zero for monotonic gains',()=>assert.equal(maxDrawdown([{value:100},{value:110},{value:120}]),0));

test('annualized volatility is zero for constant periodic returns',()=>approx(annualizedVolatility([.01,.01,.01],12),0));

test('Sharpe is null when volatility is zero',()=>assert.equal(sharpeRatio([.01,.01,.01],0,12),null));

test('invalid metric inputs return null rather than fabricated values',()=>{
 assert.equal(timeWeightedReturn([]),null);
 assert.equal(maxDrawdown([]),null);
 assert.equal(annualizedVolatility([],12),null);
});
