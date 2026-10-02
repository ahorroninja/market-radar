export const APP_VERSION='3.0.0-rc3';
export const DEFAULT_SETTINGS=Object.freeze({
 monthlyContribution:1000,
 holdings:{},
 dataProvider:{type:'yahoo-worker',baseUrl:'https://market-radar.ahorradorninja.workers.dev',symbols:{}},
 smartDcaPolicy:{drawdownStrength:1,underweightStrength:.35,maxContributionShare:.40},
 assets:[
  {id:'world',name:'MSCI World',enabled:true,targetWeight:.30,symbols:{yahoo:'URTH'}},
  {id:'sp500',name:'S&P 500',enabled:true,targetWeight:.15,symbols:{yahoo:'SPY'}},
  {id:'value',name:'World Value',enabled:true,targetWeight:.15,symbols:{yahoo:'IWVL.L'}},
  {id:'em-value',name:'Emerging Markets Value',enabled:true,targetWeight:.08,symbols:{yahoo:'AVES'}},
  {id:'world-tech',name:'World Information Technology',enabled:true,targetWeight:.08,symbols:{yahoo:'IXN'}},
  {id:'ai-infra',name:'AI Infrastructure',enabled:true,targetWeight:.06,symbols:{yahoo:'AIQ'}},
  {id:'defense',name:'Defense',enabled:true,targetWeight:.05,symbols:{yahoo:'ITA'}},
  {id:'nuclear',name:'Nuclear / Uranium',enabled:true,targetWeight:.05,symbols:{yahoo:'URA'}},
  {id:'metals',name:'Strategic Metals',enabled:true,targetWeight:.04,symbols:{yahoo:'REMX'}},
  {id:'gold',name:'Gold',enabled:true,targetWeight:.04,symbols:{yahoo:'GLD'}}
 ]
});
export function freshSettings(){return structuredClone(DEFAULT_SETTINGS);}
