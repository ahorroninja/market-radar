export const APP_VERSION='3.0.0-rc2';
export const DEFAULT_SETTINGS=Object.freeze({
 monthlyContribution:1000,
 holdings:{},
 dataProvider:{type:'stooq',proxyUrl:'',symbols:{}},
 smartDcaPolicy:{drawdownStrength:1,underweightStrength:.35,maxContributionShare:.40},
 assets:[
  {id:'world',name:'MSCI World',enabled:true,targetWeight:.30,symbols:{stooq:'URTH.US'}},
  {id:'sp500',name:'S&P 500',enabled:true,targetWeight:.15,symbols:{stooq:'SPY.US'}},
  {id:'value',name:'World Value',enabled:true,targetWeight:.15,symbols:{stooq:'IWVL.UK'}},
  {id:'em-value',name:'Emerging Markets Value',enabled:true,targetWeight:.08,symbols:{stooq:'AVES.US'}},
  {id:'world-tech',name:'World Information Technology',enabled:true,targetWeight:.08,symbols:{stooq:'IXN.US'}},
  {id:'ai-infra',name:'AI Infrastructure',enabled:true,targetWeight:.06,symbols:{stooq:'AIQ.US'}},
  {id:'defense',name:'Defense',enabled:true,targetWeight:.05,symbols:{stooq:'ITA.US'}},
  {id:'nuclear',name:'Nuclear / Uranium',enabled:true,targetWeight:.05,symbols:{stooq:'URA.US'}},
  {id:'metals',name:'Strategic Metals',enabled:true,targetWeight:.04,symbols:{stooq:'REMX.US'}},
  {id:'gold',name:'Gold',enabled:true,targetWeight:.04,symbols:{stooq:'GLD.US'}}
 ]
});
export function freshSettings(){return structuredClone(DEFAULT_SETTINGS);}
