import fs from "node:fs";
const DATA="data/daily539.json",OUT="data/drag-links539.json";
const source=JSON.parse(fs.readFileSync(DATA,"utf8"));
const draws=source.draws.filter(d=>Array.isArray(d.numbers)&&d.numbers.length===5).sort((a,b)=>a.date.localeCompare(b.date)||a.period.localeCompare(b.period));
const baselineRate=5/39,records=[];
for(let position=0;position<=5;position++)for(let trigger=1;trigger<=39;trigger++)for(let lag=1;lag<=5;lag++){
 const hits=Array(40).fill(0);let opportunities=0;
 for(let i=0;i+lag<draws.length;i++){const arr=draws[i].numbers,match=position===0?arr.includes(trigger):arr[position-1]===trigger;if(!match)continue;opportunities++;for(const n of draws[i+lag].numbers)if(n!==trigger)hits[n]++}
 const top=Array.from({length:39},(_,i)=>i+1).map(number=>({number,hits:hits[number],rate:opportunities?hits[number]/opportunities:0,lift:opportunities?(hits[number]/opportunities)/baselineRate:0})).sort((a,b)=>b.rate-a.rate||b.hits-a.hits||a.number-b.number);
 records.push({position,trigger,lag,opportunities,top});
}
// Exact next-calendar-day drag links. Events without a draw on the following calendar date are not counted.
const drawByDate=new Map(draws.map(d=>[d.date,d]));
const nextDayRecords=[];
for(let position=0;position<=5;position++)for(let trigger=1;trigger<=39;trigger++){
 const hits=Array(40).fill(0);let opportunities=0;
 for(const draw of draws){
  const dt=new Date(draw.date+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+1);
  const nextDate=dt.toISOString().slice(0,10),next=drawByDate.get(nextDate);
  if(!next)continue;
  const matched=position===0?draw.numbers.includes(trigger):draw.numbers[position-1]===trigger;
  if(!matched)continue;
  opportunities++;for(const n of next.numbers)hits[n]++;
 }
 const top=Array.from({length:39},(_,i)=>i+1).map(number=>({number,hits:hits[number],rate:opportunities?hits[number]/opportunities:0,lift:opportunities?(hits[number]/opportunities)/baselineRate:0})).sort((a,b)=>b.rate-a.rate||b.hits-a.hits||a.number-b.number);
 nextDayRecords.push({position,trigger,opportunities,top});
}
// Expanding walk-forward validation: each test prediction uses only historical pairs available before that draw.
const split=Math.floor(draws.length*.7);
const counts=Array.from({length:5},()=>Array.from({length:40},()=>Array(40).fill(0)));
const opp=Array.from({length:5},()=>Array(40).fill(0));
function addPair(i){for(let p=0;p<5;p++){const trigger=draws[i].numbers[p];opp[p][trigger]++;for(const n of draws[i+1].numbers)counts[p][trigger][n]++;}}
for(let i=0;i<split-1;i++)addPair(i);
let totalHits=0,atLeast=0;
const byPosition=Array.from({length:5},()=>({hits:0,atLeast:0,n:0}));
for(let t=split;t<draws.length;t++){
 const triggers=draws[t-1].numbers,candidates=[];
 for(let n=1;n<=39;n++){let h=0,o=0;for(let p=0;p<5;p++){const tr=triggers[p];h+=counts[p][tr][n];o+=opp[p][tr];}candidates.push({n,rate:o?h/o:0,h});}
 candidates.sort((a,b)=>b.rate-a.rate||b.h-a.h||a.n-b.n);
 const actual=draws[t].numbers,picks=candidates.slice(0,5).map(x=>x.n),hits=picks.filter(n=>actual.includes(n)).length;
 totalHits+=hits;if(hits>0)atLeast++;
 for(let p=0;p<5;p++){const tr=triggers[p],ranked=Array.from({length:39},(_,i)=>i+1).map(n=>({n,rate:opp[p][tr]?counts[p][tr][n]/opp[p][tr]:0,h:counts[p][tr][n]})).sort((a,b)=>b.rate-a.rate||b.h-a.h||a.n-b.n).slice(0,5);const ph=ranked.filter(x=>actual.includes(x.n)).length;byPosition[p].hits+=ph;byPosition[p].n++;if(ph>0)byPosition[p].atLeast++;}
 addPair(t-1);
}
const testDraws=draws.length-split,randomExpectedHits=25/39,randomAtLeastOne=1-(34*33*32*31*30)/(39*38*37*36*35);
const validation={method:"Expanding walk-forward. For each test draw, rank candidates from position-specific trigger-number to next-draw co-occurrence counts using only pairs available before the prediction. Top 5; exclude previous draw's trigger numbers.",trainThrough:draws[split-1]?.date,testFrom:draws[split]?.date,testThrough:draws.at(-1)?.date,trainDraws:split,testDraws,randomExpectedHits,randomAtLeastOne,rows:[{name:"Combined position trigger TOP5",avgHitsPerDraw:totalHits/testDraws,hitRate:totalHits/(testDraws*5),atLeastOneRate:atLeast/testDraws,hits:totalHits,picks:testDraws*5},...byPosition.map((x,i)=>({name:"Position "+(i+1)+" TOP5",avgHitsPerDraw:x.hits/x.n,atLeastOneRate:x.atLeast/x.n}))]};
// Exact next-calendar-day expanding walk-forward validation. Only date D -> D+1 pairs are used.
const dayCounts=Array.from({length:5},()=>Array.from({length:40},()=>Array(40).fill(0)));
const dayOpp=Array.from({length:5},()=>Array(40).fill(0));
function addDayPair(draw,next){for(let p=0;p<5;p++){const trigger=draw.numbers[p];dayOpp[p][trigger]++;for(const n of next.numbers)dayCounts[p][trigger][n]++;}}
const dayIndex=new Map(draws.map((d,i)=>[d.date,i]));\nfor(let i=0;i<split;i++){const draw=draws[i],dt=new Date(draw.date+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+1);const nextDate=dt.toISOString().slice(0,10),next=drawByDate.get(nextDate),nextIndex=dayIndex.get(nextDate);if(next&&nextIndex!==undefined&&nextIndex<split)addDayPair(draw,next);}
let dayHits=0,dayAtLeast=0,dayAtLeast2=0,dayTestPairs=0;
const dayByPosition=Array.from({length:5},()=>({hits:0,atLeast:0,n:0}));
for(let i=split;i<draws.length;i++){
 const draw=draws[i],dt=new Date(draw.date+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+1);const next=drawByDate.get(dt.toISOString().slice(0,10));if(!next)continue;
 const candidates=[];
 for(let n=1;n<=39;n++){let h=0,o=0;for(let p=0;p<5;p++){const trigger=draw.numbers[p];h+=dayCounts[p][trigger][n];o+=dayOpp[p][trigger];}candidates.push({n,rate:o?h/o:0,h});}
 candidates.sort((a,b)=>b.rate-a.rate||b.h-a.h||a.n-b.n);
 const hits=candidates.slice(0,5).filter(x=>next.numbers.includes(x.n)).length;
 dayHits+=hits;if(hits>0)dayAtLeast++;if(hits>=2)dayAtLeast2++;dayTestPairs++;
 for(let p=0;p<5;p++){const trigger=draw.numbers[p],ranked=Array.from({length:39},(_,j)=>j+1).map(n=>({n,rate:dayOpp[p][trigger]?dayCounts[p][trigger][n]/dayOpp[p][trigger]:0,h:dayCounts[p][trigger][n]})).sort((a,b)=>b.rate-a.rate||b.h-a.h||a.n-b.n).slice(0,5);const ph=ranked.filter(x=>next.numbers.includes(x.n)).length;dayByPosition[p].hits+=ph;dayByPosition[p].n++;if(ph>0)dayByPosition[p].atLeast++;}
 addDayPair(draw,next);
}
const nextDayValidation={method:"Expanding walk-forward on exact calendar-day pairs only. A pair is included only when a draw exists on D+1; all training pairs precede each prediction date.",trainThrough:draws[split-1]?.date,testFrom:draws[split]?.date,testThrough:draws.at(-1)?.date,testPairs:dayTestPairs,randomExpectedHits:25/39,randomAtLeastOne:randomAtLeastOne,rows:[{name:"Combined position trigger TOP5",avgHitsPerPair:dayTestPairs?dayHits/dayTestPairs:0,atLeastOneRate:dayTestPairs?dayAtLeast/dayTestPairs:0,atLeastTwoRate:dayTestPairs?dayAtLeast2/dayTestPairs:0},...dayByPosition.map((x,i)=>({name:"Position "+(i+1)+" TOP5",position:i+1,avgHitsPerPair:x.n?x.hits/x.n:0,atLeastOneRate:x.n?x.atLeast/x.n:0,testPairs:x.n}))]};
const report={source:source.source,generatedAt:new Date().toISOString(),updatedAt:source.updatedAt,historyCount:draws.length,from:draws[0].date,through:draws.at(-1).date,baselineRate,positionDefinition:"官方資料 numbers 陣列為升冪排序；position 1-5 指排序位置，不代表實際搖出先後順序。",lagDefinition:"lag 1 指下一個開獎期，不保證是下一個日曆日；lag 2-5 依序為後續第 2-5 個開獎期。",validation,nextDayValidation,nextDayRecords,records};
fs.writeFileSync(OUT,JSON.stringify(report));console.log(`Generated ${records.length} trigger rows from ${draws.length} draws; next-draw holdout ${validation.rows[0].avgHitsPerDraw.toFixed(3)}; next-calendar-day holdout ${nextDayValidation.rows[0].avgHitsPerPair.toFixed(3)} across ${dayTestPairs} pairs.`);
