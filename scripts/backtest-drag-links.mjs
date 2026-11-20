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
const validation={method:"Expanding walk-forward. For each test draw, rank candidates from position-specific trigger-number to next-draw co-occurrence counts using only pairs available before the prediction. Top 5; repeated numbers are allowed among all 39 candidates.",trainThrough:draws[split-1]?.date,testFrom:draws[split]?.date,testThrough:draws.at(-1)?.date,trainDraws:split,testDraws,randomExpectedHits,randomAtLeastOne,rows:[{name:"Combined position trigger TOP5",avgHitsPerDraw:totalHits/testDraws,hitRate:totalHits/(testDraws*5),atLeastOneRate:atLeast/testDraws,hits:totalHits,picks:testDraws*5},...byPosition.map((x,i)=>({name:"Position "+(i+1)+" TOP5",avgHitsPerDraw:x.hits/x.n,atLeastOneRate:x.atLeast/x.n}))]};
// Exact next-calendar-day expanding walk-forward validation. Only date D -> D+1 pairs are used.
const dayCounts=Array.from({length:5},()=>Array.from({length:40},()=>Array(40).fill(0)));
const dayOpp=Array.from({length:5},()=>Array(40).fill(0));
function addDayPair(draw,next){for(let p=0;p<5;p++){const trigger=draw.numbers[p];dayOpp[p][trigger]++;for(const n of next.numbers)dayCounts[p][trigger][n]++;}}
const dayIndex=new Map(draws.map((d,i)=>[d.date,i]));
for(let i=0;i<split;i++){const draw=draws[i],dt=new Date(draw.date+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+1);const nextDate=dt.toISOString().slice(0,10),next=drawByDate.get(nextDate),nextIndex=dayIndex.get(nextDate);if(next&&nextIndex!==undefined&&nextIndex<split)addDayPair(draw,next);}
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
// Position-3 trigger-number breakdown for exact next-calendar-day pairs.
// This is a separate expanding walk-forward audit; each prediction uses only earlier D -> D+1 pairs.
const p3Counts=Array.from({length:40},()=>Array(40).fill(0));
const p3Opp=Array(40).fill(0);
const p3Stats=Array.from({length:40},(_,i)=>({trigger:i+1,samples:0,top3Hits:0,top5Hits:0,top10Hits:0,top3AtLeast1:0,top5AtLeast1:0,top10AtLeast1:0,blocks:Array.from({length:3},()=>({samples:0,top5AtLeast1:0,top5Hits:0}))}));
function addP3Pair(draw,next){const trigger=draw.numbers[2];p3Opp[trigger]++;for(const n of next.numbers)p3Counts[trigger][n]++;}
function nextCalendarPairAt(i){const dt=new Date(draws[i].date+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+1);const date=dt.toISOString().slice(0,10),next=drawByDate.get(date),nextIndex=dayIndex.get(date);return next&&nextIndex!==undefined?{next,nextIndex}:null;}
for(let i=0;i<split;i++){const pair=nextCalendarPairAt(i);if(pair&&pair.nextIndex<split)addP3Pair(draws[i],pair.next);}
let p3Total={samples:0,top3Hits:0,top5Hits:0,top10Hits:0,top3AtLeast1:0,top5AtLeast1:0,top10AtLeast1:0};
const p3BlockSize=Math.ceil((draws.length-split)/3);
for(let i=split;i<draws.length;i++){
 const pair=nextCalendarPairAt(i);if(!pair)continue;
 const trigger=draws[i].numbers[2],actual=new Set(pair.next.numbers);
 const ranked=Array.from({length:39},(_,j)=>j+1).map(number=>({number,rate:p3Opp[trigger]?p3Counts[trigger][number]/p3Opp[trigger]:0,hits:p3Counts[trigger][number]})).sort((a,b)=>b.rate-a.rate||b.hits-a.hits||a.number-b.number);
 const h3=ranked.slice(0,3).filter(x=>actual.has(x.number)).length;
 const h5=ranked.slice(0,5).filter(x=>actual.has(x.number)).length;
 const h10=ranked.slice(0,10).filter(x=>actual.has(x.number)).length;
 const s=p3Stats[trigger],block=Math.min(2,Math.floor((i-split)/p3BlockSize)),b=s.blocks[block];
 s.samples++;s.top3Hits+=h3;s.top5Hits+=h5;s.top10Hits+=h10;s.top3AtLeast1+=h3>0?1:0;s.top5AtLeast1+=h5>0?1:0;s.top10AtLeast1+=h10>0?1:0;
 b.samples++;b.top5Hits+=h5;b.top5AtLeast1+=h5>0?1:0;
 p3Total.samples++;p3Total.top3Hits+=h3;p3Total.top5Hits+=h5;p3Total.top10Hits+=h10;p3Total.top3AtLeast1+=h3>0?1:0;p3Total.top5AtLeast1+=h5>0?1:0;p3Total.top10AtLeast1+=h10>0?1:0;
 addP3Pair(draws[i],pair.next);
}
const p3Choose=(n,k)=>{let v=1;for(let j=1;j<=k;j++)v=v*(n-j+1)/j;return v;};
const position3TriggerValidation={
 method:"Exact D -> D+1 calendar-day pairs; expanding walk-forward; each trigger-number ranking is based only on earlier pairs. TOP3/TOP5/TOP10 are evaluated separately. Trigger means the number in official ascending-sorted position 3, not physical draw order.",
 trainThrough:draws[split-1]?.date,testFrom:draws[split]?.date,testThrough:draws.at(-1)?.date,testPairs:p3Total.samples,
 randomBaseline:{top3AtLeast1:1-p3Choose(34,3)/p3Choose(39,3),top5AtLeast1:randomAtLeastOne,top10AtLeast1:1-p3Choose(34,10)/p3Choose(39,10),avgHitsTop3:15/39,avgHitsTop5:25/39,avgHitsTop10:50/39},
 overall:{top3AvgHits:p3Total.samples?p3Total.top3Hits/p3Total.samples:0,top5AvgHits:p3Total.samples?p3Total.top5Hits/p3Total.samples:0,top10AvgHits:p3Total.samples?p3Total.top10Hits/p3Total.samples:0,top3AtLeast1:p3Total.samples?p3Total.top3AtLeast1/p3Total.samples:0,top5AtLeast1:p3Total.samples?p3Total.top5AtLeast1/p3Total.samples:0,top10AtLeast1:p3Total.samples?p3Total.top10AtLeast1/p3Total.samples:0},
 byTrigger:p3Stats.filter(x=>x.samples>0).map(x=>({...x,top3AvgHits:x.top3Hits/x.samples,top5AvgHits:x.top5Hits/x.samples,top10AvgHits:x.top10Hits/x.samples,top3AtLeast1:x.top3AtLeast1/x.samples,top5AtLeast1:x.top5AtLeast1/x.samples,top10AtLeast1:x.top10AtLeast1/x.samples,blocks:x.blocks.map(b=>({...b,top5AtLeast1:b.samples?b.top5AtLeast1/b.samples:null,top5AvgHits:b.samples?b.top5Hits/b.samples:null}))})).sort((a,b)=>b.samples-a.samples||a.trigger-b.trigger)
};

const report={source:source.source,generatedAt:new Date().toISOString(),updatedAt:source.updatedAt,historyCount:draws.length,from:draws[0].date,through:draws.at(-1).date,baselineRate,positionDefinition:"官方資料 numbers 陣列為升冪排序；position 1-5 指排序位置，不代表實際搖出先後順序。",lagDefinition:"lag 1 指下一個開獎期，不保證是下一個日曆日；lag 2-5 依序為後續第 2-5 個開獎期。",validation,nextDayValidation,position3TriggerValidation,nextDayRecords,records};
fs.writeFileSync(OUT,JSON.stringify(report));
console.log(JSON.stringify({nextDraw:validation,nextCalendarDay:nextDayValidation}));
