function domainError(code,message){const e=new Error(message);e.code=code;return e;}
function finite(n){return typeof n==='number'&&Number.isFinite(n);}
function sortedEntries(obj){return Object.entries(obj).sort(([a],[b])=>a.localeCompare(b));}

export function roundWholeEuros(raw,total){
 if(!Number.isInteger(total)||total<0)throw domainError('INVALID_CONTRIBUTION','Contribution must be a non-negative whole number of euros');
 const rows=sortedEntries(raw).map(([id,value])=>{if(!finite(value)||value<0)throw domainError('INVALID_ALLOCATION','Raw allocation must be finite and non-negative');const floor=Math.floor(value);return{id,value,floor,remainder:value-floor};});
 const floors=rows.reduce((s,r)=>s+r.floor,0);let left=total-floors;
 if(left<0)throw domainError('ROUNDING_OVERFLOW','Raw allocations exceed contribution');
 const order=[...rows].sort((a,b)=>b.remainder-a.remainder||a.id.localeCompare(b.id));
 const out=Object.fromEntries(rows.map(r=>[r.id,r.floor]));
 for(let i=0;i<left;i++)out[order[i%order.length].id]++;
 return Object.fromEntries(sortedEntries(out));
}

function validate(req){
 if(!req||!Number.isInteger(req.contribution)||req.contribution<0)throw domainError('INVALID_CONTRIBUTION','Contribution must be a non-negative whole number of euros');
 if(!Array.isArray(req.assets)||!req.assets.length)throw domainError('INVALID_ASSETS','Assets are required');
 if(!req.policy||![req.policy.drawdownStrength,req.policy.underweightStrength,req.policy.maxContributionShare].every(finite))throw domainError('INVALID_POLICY','Smart DCA policy is invalid');
 if(req.policy.drawdownStrength<0||req.policy.underweightStrength<0||req.policy.maxContributionShare<=0||req.policy.maxContributionShare>1)throw domainError('INVALID_POLICY','Smart DCA policy is out of range');
}

function cappedWeights(scores,cap){
 const ids=Object.keys(scores).sort();
 const weights=Object.fromEntries(ids.map(id=>[id,0]));
 let remaining=1,open=new Set(ids);
 while(open.size&&remaining>1e-12){
  const scoreSum=[...open].reduce((s,id)=>s+scores[id],0);
  const provisional=[...open].map(id=>[id,scoreSum>0?remaining*scores[id]/scoreSum:remaining/open.size]);
  const capped=provisional.filter(([,w])=>w>cap+1e-12);
  if(!capped.length){for(const[id,w]of provisional)weights[id]+=w;remaining=0;break;}
  for(const[id]of capped){const room=cap-weights[id];if(room>0){weights[id]+=room;remaining-=room;}open.delete(id);}
 }
 return weights;
}

export function allocateSmartDca(req){
 validate(req);
 const assets=[...req.assets].sort((a,b)=>a.id.localeCompare(b.id));
 const indicators=new Map((req.indicators||[]).map(x=>[x.assetId,x]));
 const holdingValues=new Map((req.portfolio?.holdings||[]).map(x=>[x.assetId,finite(x.value)&&x.value>=0?x.value:0]));
 const eligible=assets.filter(a=>a.enabled&&finite(a.targetWeight)&&a.targetWeight>0&&finite(indicators.get(a.id)?.drawdown)&&!(indicators.get(a.id)?.missing||[]).includes('drawdown'));
 if(req.contribution===0)return{contribution:0,allocations:Object.fromEntries(eligible.map(a=>[a.id,0])),eligibleAssetIds:eligible.map(a=>a.id),effectiveMaxShare:eligible.length?Math.max(req.policy.maxContributionShare,1/eligible.length):req.policy.maxContributionShare,diagnostics:{targetComponent:{},drawdownComponent:{},underweightComponent:{},warnings:[]}};
 if(!eligible.length)throw domainError('NO_ELIGIBLE_ASSETS','No enabled asset has the required signal data');
 const targetSum=eligible.reduce((s,a)=>s+a.targetWeight,0);
 const totalPortfolio=[...holdingValues.values()].reduce((a,b)=>a+b,0);
 const effectiveMaxShare=Math.max(req.policy.maxContributionShare,1/eligible.length);
 const warnings=[];if(effectiveMaxShare>req.policy.maxContributionShare+1e-12)warnings.push({code:'CAP_RELAXED',configured:req.policy.maxContributionShare,effective:effectiveMaxShare});
 const targetComponent={},drawdownComponent={},underweightComponent={},scores={};
 for(const a of eligible){
  const target=a.targetWeight/targetSum;
  const dd=indicators.get(a.id).drawdown;
  const drawdown=Math.max(0,-dd);
  const currentWeight=totalPortfolio>0?(holdingValues.get(a.id)||0)/totalPortfolio:target;
  const underweight=Math.max(0,target-currentWeight);
  targetComponent[a.id]=target;
  drawdownComponent[a.id]=drawdown;
  underweightComponent[a.id]=underweight;
  scores[a.id]=target*(1+req.policy.drawdownStrength*drawdown+req.policy.underweightStrength*(target>0?underweight/target:0));
 }
 const weights=cappedWeights(scores,effectiveMaxShare);
 const raw=Object.fromEntries(Object.entries(weights).map(([id,w])=>[id,w*req.contribution]));
 const allocations=roundWholeEuros(raw,req.contribution);
 return{contribution:req.contribution,allocations,eligibleAssetIds:eligible.map(a=>a.id),effectiveMaxShare,diagnostics:{targetComponent,drawdownComponent,underweightComponent,warnings}};
}
