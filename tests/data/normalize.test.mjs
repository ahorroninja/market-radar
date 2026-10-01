import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePriceSeries } from '../../src/data/normalize.js';

test('normalizer sorts dates and removes exact duplicate observations',()=>{
 const r=normalizePriceSeries('world','test',[{date:'2026-02-02',close:102},{date:'2026-01-30',close:100},{date:'2026-02-02',close:102}]);
 assert.deepEqual(r.points,[{date:'2026-01-30',close:100},{date:'2026-02-02',close:102}]);
 assert.equal(r.asOf,'2026-02-02');
});

test('conflicting duplicate dates are rejected',()=>{
 assert.throws(()=>normalizePriceSeries('world','test',[{date:'2026-02-02',close:101},{date:'2026-02-02',close:102}]),e=>e?.code==='CONFLICTING_PRICE');
});

test('invalid and non-positive closes are rejected',()=>{
 assert.throws(()=>normalizePriceSeries('world','test',[{date:'2026-02-02',close:0}]),e=>e?.code==='INVALID_PRICE');
});

test('invalid ISO dates are rejected',()=>{
 assert.throws(()=>normalizePriceSeries('world','test',[{date:'02/02/2026',close:100}]),e=>e?.code==='INVALID_DATE');
});

test('empty series remains explicit instead of inventing an as-of date',()=>{
 assert.deepEqual(normalizePriceSeries('world','test',[]),{assetId:'world',points:[],asOf:null,source:'test'});
});
