import test from 'node:test';
import assert from 'node:assert/strict';
import { runBacktest } from '../../src/core/backtest.js';

const asset=(id,targetWeight)=>({id,name:id,enabled:true,targetWeight,symbols:{}});
const series=(id,rows)=>[id,rows.map(([date,close])=>({date,close}))];
const policy={drawdownStrength:1,underweightStrength:.35,maxContributionShare:.40};

function base(overrides={}){
 return {
  assets:[asset('a',.5),asset('b',.5)],
  histories:Object.fromEntries([
   series('a',[['2026-01-30',100],['2026-02-02',100],['2026-03-02',100]]),
   series('b',[['2026-01-30',100],['2026-02-02',100],['2026-03-02',100]])
  ]),
  initialHoldings:{a:0,b:0},monthlyContribution:1000,
  startDate:'2026-02-01',endDate:'2026-03-31',strategy:'smartDca',smartDcaPolicy:policy,
  ...overrides
 };
}

test('one external contribution executes on first common observation of each month',()=>{
 const r=runBacktest(base());
 assert.deepEqual(r.ledger.map(x=>x.executionDate),['2026-02-02','2026-03-02']);
 assert.equal(r.externalFlows.length,2);
 assert.equal(r.externalFlows.reduce((s,x)=>s+x.amount,0),2000);
});

test('decision signal cutoff is strictly before execution date',()=>{
 const r=runBacktest(base());
 for(const row of r.ledger) assert.ok(row.signalCutoff < row.executionDate);
});

test('execution-day crash cannot influence that same day Smart DCA decision',()=>{
 const common={
  assets:[asset('a',.5),asset('b',.5)],initialHoldings:{a:0,b:0},monthlyContribution:1000,
  startDate:'2026-02-01',endDate:'2026-02-28',strategy:'smartDca',smartDcaPolicy:policy
 };
 const normal=runBacktest({...common,histories:Object.fromEntries([series('a',[['2026-01-30',100],['2026-02-02',100]]),series('b',[['2026-01-30',100],['2026-02-02',100]])])});
 const crash=runBacktest({...common,histories:Object.fromEntries([series('a',[['2026-01-30',100],['2026-02-02',50]]),series('b',[['2026-01-30',100],['2026-02-02',100]])])});
 assert.deepEqual(crash.ledger[0].allocations,normal.ledger[0].allocations);
});

test('flat prices plus contributions create zero market gain',()=>{
 const r=runBacktest(base());
 assert.equal(r.totalContributed,2000);
 assert.equal(r.terminalValue,2000);
 assert.equal(r.marketGain,0);
});

test('target DCA allocates by strategic targets',()=>{
 const r=runBacktest(base({assets:[asset('a',.6),asset('b',.4)],strategy:'targetDca',endDate:'2026-02-28'}));
 assert.deepEqual(r.ledger[0].allocations,{a:600,b:400});
});
