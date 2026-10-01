'use strict';
const assert=(x,m)=>{if(!x)throw Error('FAIL: '+m);console.log('PASS:',m)};
const dates=['2026-01-02','2026-01-05','2026-01-30','2026-02-02','2026-02-27','2026-03-02'];
function contributionDates(ds){let last='',out=[];for(const d of ds){const month=d.slice(0,7);if(month!==last){last=month;out.push(d);}}return out;}
let c=contributionDates(dates);assert(JSON.stringify(c)===JSON.stringify(['2026-01-02','2026-02-02','2026-03-02']),'exactly one contribution occurs per calendar month');
assert(c.every((d,i)=>d===dates.filter(x=>x.slice(0,7)===d.slice(0,7))[0]),'contribution executes on first available trading observation of month');
assert(c.length*1000===3000,'three months produce exactly three monthly contributions');
// Missing calendar days/weekends must not create extra or skipped contributions.
c=contributionDates(['2026-01-30','2026-02-03','2026-02-04','2026-03-05']);assert(c.length===3&&c[1]==='2026-02-03','weekends/holidays resolve to first available observation');
// Repeated dates inside same month cannot double-contribute.
c=contributionDates(['2026-04-01','2026-04-01','2026-04-02']);assert(c.length===1,'duplicate observations cannot double-contribute');
console.log('ALL CONTRIBUTION TIMING INVARIANTS PASSED');
