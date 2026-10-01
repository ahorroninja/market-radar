export const APP_VERSION='3.0.0-dev';
export const DEFAULT_SETTINGS=Object.freeze({
 monthlyContribution:1000,
 holdings:{},
 smartDcaPolicy:{drawdownStrength:1,underweightStrength:.35,maxContributionShare:.40},
 assets:[
  {id:'world',name:'MSCI World',enabled:true,targetWeight:.60,symbols:{}},
  {id:'value',name:'World Value',enabled:true,targetWeight:.40,symbols:{}}
 ]
});
export function freshSettings(){return structuredClone(DEFAULT_SETTINGS);}
