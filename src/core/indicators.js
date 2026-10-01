function valid(points){return Array.isArray(points)&&points.every(p=>p&&Number.isFinite(p.close)&&p.close>0);}
export function drawdown(points){if(!valid(points)||!points.length)return null;const peak=Math.max(...points.map(p=>p.close));return points.at(-1).close/peak-1;}
export function simpleReturn(points,period){if(!valid(points)||!Number.isInteger(period)||period<1||points.length<=period)return null;return points.at(-1).close/points.at(-(period+1)).close-1;}
export function sma(points,period){if(!valid(points)||!Number.isInteger(period)||period<1||points.length<period)return null;const tail=points.slice(-period);return tail.reduce((s,p)=>s+p.close,0)/period;}
export function trendSignal(points,period){const avg=sma(points,period);if(avg===null)return null;const d=points.at(-1).close/avg-1;return d>0?1:d<0?-1:0;}
export function opportunityBand(dd){if(!Number.isFinite(dd))return null;if(dd>-0.05)return'normal';if(dd>-0.10)return'interesting';if(dd>-0.20)return'opportunity';if(dd>-0.30)return'strong';return'extraordinary';}
