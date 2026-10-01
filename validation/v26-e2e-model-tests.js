'use strict';
const MR=require('../v26-smart-dca.js');
const assert=(x,m)=>{if(!x)throw Error('FAIL: '+m);console.log('PASS:',m)};
const near=(a,b,e=.02)=>Math.abs(a-b)<=e;
const assets=[{key:'A',target:60},{key:'B',target:40}];
const dates=['2026-01-02','2026-01-30','2026-02-02','2026-02-27','2026-03-02','2026-03-31'];
const px={A:[100,100,100,100,100,100],B:[100,80,80,120,120,120]};
function sim(mode){const sh={A:0,B:0},hist={A:[],B:[]};let cash=0,last='',contrib=0;const values=[];for(let i=0;i<dates.length;i++){const d=dates[i];for(const a of assets)hist[a.key].push(px[a.key][i]);const month=d.slice(0,7);if(month!==last){last=month;cash+=1000;contrib+=1000;let alloc;if(mode==='DCA')alloc={A:600,B:400};else{const portfolio=Object.fromEntries(assets.map(a=>[a.key,sh[a.key]*px[a.key][i]]));const data=Object.fromEntries(assets.map(a=>{const h=hist[a.key],p=Math.max(...h);return[a.key,{dd:h.at(-1)/p-1}]}));alloc=MR.smartDcaAllocation({assets,portfolio,data,monthly:1000,maxAssetShare:.60,drawdownStrength:1,underweightStrength:.35}).allocations;}assert(near(Object.values(alloc).reduce((x,y)=>x+y,0),1000,.001),mode+' conserves each monthly contribution');for(const a of assets){const amt=alloc[a.key]||0;sh[a.key]+=amt/px[a.key][i];cash-=amt;}}
values.push(cash+assets.reduce((s,a)=>s+sh[a.key]*px[a.key][i],0));}return{final:values.at(-1),contrib,values,sh};}
const d=sim('DCA'),m=sim('MR');assert(d.contrib===3000&&m.contrib===3000,'both strategies receive identical total capital');
// Independent hand calculation: A shares=18 => 1800. B shares=4 + 5 + 400/120 = 12.333333; at 120 => 1480. Total=3280.
assert(near(d.final,3280),'reference DCA terminal value matches hand calculation');assert(m.final>d.final,'Smart DCA benefits in synthetic recovery scenario without future knowledge');
// Flat market: Smart DCA and target DCA must converge to identical terminal wealth.
for(const k of Object.keys(px))px[k]=Array(dates.length).fill(100);const df=sim('DCA'),mf=sim('MR');assert(near(df.final,3000)&&near(mf.final,3000),'flat market creates no phantom return');assert(near(df.final,mf.final),'flat market terminal wealth is strategy-neutral');
console.log('ALL END-TO-END DETERMINISTIC BACKTEST TESTS PASSED');
