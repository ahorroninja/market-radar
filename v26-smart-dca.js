// Market Radar V2.6 — Smart DCA
(function(global){
'use strict';
const sum=a=>a.reduce((x,y)=>x+y,0);
function smartDcaAllocation({assets,portfolio={},data={},monthly=1000,maxAssetShare=.40,drawdownStrength=1.0,underweightStrength=.35}){
 const eligible=assets.filter(a=>{const d=data[a.key];return d&&Number.isFinite(d.dd)&&Number.isFinite(a.target)&&a.target>0});
 if(!eligible.length||monthly<=0)return {allocations:{},diagnostics:{eligible:0}};
 const targetSum=sum(eligible.map(a=>a.target));
 const portTotal=sum(eligible.map(a=>Math.max(0,+portfolio[a.key]||0)));
 const raw=eligible.map(a=>{const target=a.target/targetSum,actual=portTotal?Math.max(0,+portfolio[a.key]||0)/portTotal:target,under=Math.max(-.20,Math.min(.20,target-actual)),dd=Math.max(0,Math.min(.50,-data[a.key].dd)),dip=Math.min(1,dd/.30),multiplier=Math.max(.10,1+drawdownStrength*dip+underweightStrength*(under/Math.max(target,.01)));return {key:a.key,target,actual,dd,dip,score:target*multiplier}});
 let remaining=1,open=new Set(raw.map(x=>x.key)),weights={};
 while(open.size){const pool=raw.filter(x=>open.has(x.key)),poolScore=sum(pool.map(x=>x.score));let capped=false;for(const x of pool){const w=poolScore?remaining*x.score/poolScore:remaining/pool.length;if(w>maxAssetShare+1e-12){weights[x.key]=maxAssetShare;remaining-=maxAssetShare;open.delete(x.key);capped=true;break}}if(!capped){for(const x of pool)weights[x.key]=poolScore?remaining*x.score/poolScore:remaining/pool.length;break}}
 const cents=Math.round(monthly*100);let used=0;const allocations={};raw.forEach((x,i)=>{const c=i===raw.length-1?cents-used:Math.round(cents*(weights[x.key]||0));used+=c;allocations[x.key]=c/100});
 const invested=sum(Object.values(allocations));if(Math.abs(invested-monthly)>.011)throw new Error('Smart DCA invariant: contribution not conserved');if(Object.values(allocations).some(v=>v<-.001))throw new Error('Smart DCA invariant: negative allocation');
 return {allocations,diagnostics:{eligible:eligible.length,invested,monthly,maxAssetShare,rows:raw.map(x=>({...x,weight:weights[x.key]||0,amount:allocations[x.key]}))}};
}
function validateSmartDca(){const assets=[{key:'A',target:60},{key:'B',target:40}],data={A:{dd:0},B:{dd:-.30}},r=smartDcaAllocation({assets,data,monthly:1000,maxAssetShare:.70});if(Math.abs(sum(Object.values(r.allocations))-1000)>.01)throw Error('FAIL cash conservation');if(!(r.allocations.B>400))throw Error('FAIL drawdown tilt');const flat=smartDcaAllocation({assets,data:{A:{dd:0},B:{dd:0}},monthly:1000,maxAssetShare:.80});if(Math.abs(flat.allocations.A-600)>.02||Math.abs(flat.allocations.B-400)>.02)throw Error('FAIL target anchor');return true}
global.MR26={smartDcaAllocation,validateSmartDca,version:'2.6.0'};if(typeof module!=='undefined'&&module.exports)module.exports=global.MR26;
})(typeof window!=='undefined'?window:globalThis);
