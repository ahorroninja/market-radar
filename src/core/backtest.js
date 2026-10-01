import { allocateSmartDca, roundWholeEuros } from './smart-dca.js';
import { drawdown } from './indicators.js';
import { buildPortfolioSnapshot } from './portfolio.js';

function err(code,message){const e=new Error(message);e.code=code;return e;}
function priceMap(points){return new Map(points.map(p=>[p.date,p.close]));}
function commonDates(assets,histories,start,end){
 const sets=assets.map(a=>new Set((histories[a.id]||[]).filter(p=>p.date>=start&&p.date<=end).map(p=>p.date)));
 if(!sets.length)return[];
 return [...sets[0]].filter(d=>sets.every(s=>s.has(d))).sort();
}
function firstPerMonth(dates){const out=[],seen=new Set();for(const d of dates){const m=d.slice(0,7);if(!seen.has(m)){seen.add(m);out.push(d);}}return out;}
function priorPoints(points,date){return points.filter(p=>p.date<date);}
function priorClose(points,date){return priorPoints(points,date).at(-1)?.close??null;}
function targetAllocation(assets,amount){const enabled=assets.filter(a=>a.enabled&&a.targetWeight>0).sort((a,b)=>a.id.localeCompare(b.id));const sum=enabled.reduce((s,a)=>s+a.targetWeight,0);return roundWholeEuros(Object.fromEntries(enabled.map(a=>[a.id,amount*a.targetWeight/sum])),amount);}

export function runBacktest(req){
 if(!req||!Array.isArray(req.assets)||!Number.isInteger(req.monthlyContribution)||req.monthlyContribution<0)throw err('INVALID_BACKTEST','Invalid backtest request');
 const assets=req.assets.filter(a=>a.enabled).sort((a,b)=>a.id.localeCompare(b.id));
 const dates=firstPerMonth(commonDates(assets,req.histories,req.startDate,req.endDate));
 const maps=Object.fromEntries(assets.map(a=>[a.id,priceMap(req.histories[a.id]||[])]));
 const shares=Object.fromEntries(assets.map(a=>[a.id,0]));
 const initial=req.initialHoldings||{};
 // Initial holding values are converted to shares at the last known pre-start price.
 for(const a of assets){const p=priorClose(req.histories[a.id]||[],req.startDate);if((initial[a.id]||0)>0&&!p)throw err('MISSING_INITIAL_PRICE',`No pre-start price for ${a.id}`);shares[a.id]=p?(initial[a.id]||0)/p:0;}
 const ledger=[],externalFlows=[];
 for(const executionDate of dates){
  const signalCutoffs=assets.map(a=>priorPoints(req.histories[a.id]||[],executionDate).at(-1)?.date).filter(Boolean).sort();
  if(signalCutoffs.length!==assets.length)throw err('INSUFFICIENT_HISTORY','All assets require prior signal history');
  const signalCutoff=signalCutoffs[0]; // conservative common cutoff: never later than any asset's available prior date
  const holdingValues=assets.map(a=>({assetId:a.id,value:shares[a.id]*(priorClose(req.histories[a.id]||[],executionDate)??0)}));
  const portfolio=buildPortfolioSnapshot(signalCutoff,holdingValues);
  const indicators=assets.map(a=>{const pts=(req.histories[a.id]||[]).filter(p=>p.date<=signalCutoff);const dd=drawdown(pts);return{assetId:a.id,asOf:signalCutoff,drawdown:dd,trend:null,valuation:null,sentiment:null,macro:null,breadth:null,missing:dd===null?['drawdown']:[]};});
  let allocations;
  if(req.strategy==='targetDca')allocations=targetAllocation(assets,req.monthlyContribution);
  else if(req.strategy==='smartDca')allocations=allocateSmartDca({contribution:req.monthlyContribution,assets,portfolio,indicators,policy:req.smartDcaPolicy}).allocations;
  else throw err('UNSUPPORTED_STRATEGY',`Unsupported strategy ${req.strategy}`);
  for(const a of assets){const price=maps[a.id].get(executionDate);if(!Number.isFinite(price)||price<=0)throw err('MISSING_EXECUTION_PRICE',`Missing execution price ${a.id} ${executionDate}`);shares[a.id]+=(allocations[a.id]||0)/price;}
  externalFlows.push({date:executionDate,amount:req.monthlyContribution});
  ledger.push({executionDate,signalCutoff,allocations:{...allocations},executionPrices:Object.fromEntries(assets.map(a=>[a.id,maps[a.id].get(executionDate)]))});
 }
 const lastDate=commonDates(assets,req.histories,req.startDate,req.endDate).at(-1);
 const terminalValue=lastDate?assets.reduce((s,a)=>s+shares[a.id]*maps[a.id].get(lastDate),0):Object.values(initial).reduce((a,b)=>a+b,0);
 const initialValue=Object.values(initial).reduce((a,b)=>a+b,0),totalContributed=externalFlows.reduce((s,x)=>s+x.amount,0);
 return{ledger,externalFlows,totalContributed,terminalValue,marketGain:terminalValue-initialValue-totalContributed,terminalShares:shares};
}
