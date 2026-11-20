import fs from "node:fs";

const DATA="data/daily539.json";
const FORMAL="data/predictions539.json";
const OUT="data/drag-forward539.json";
const source=JSON.parse(fs.readFileSync(DATA,"utf8"));
const draws=(source.draws||[]).filter(d=>Array.isArray(d.numbers)&&d.numbers.length===5)
  .sort((a,b)=>a.date.localeCompare(b.date)||a.period.localeCompare(b.period));
const archive=JSON.parse(fs.readFileSync(FORMAL,"utf8"));
if(draws.length<2)throw new Error("歷史開獎資料不足，無法建立前瞻拖牌預測。");
const latest=draws.at(-1);
const prior=archive.predictions.find(p=>p.sourcePeriod===latest.period);
if(!prior?.top5?.length)throw new Error("找不到最新期別對應的正式模型預測，停止建立前瞻紀錄。");

let log={version:"position3-forward-v1",updatedAt:null,dataThrough:latest.date,predictions:[]};
if(fs.existsSync(OUT)){
  try{log={...log,...JSON.parse(fs.readFileSync(OUT,"utf8"))};}catch{}
}
log.predictions||=[];
const findNext=(p)=>draws.find(d=>d.date>p.sourceDate||(d.date===p.sourceDate&&d.period>p.sourcePeriod));
const nextDate=date=>{const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);};

// Only settle predictions against official results that occurred after their source draw.
for(const p of log.predictions){
  if(!p.result){
    const actual=findNext(p);
    if(actual){
      const set=new Set(actual.numbers);
      p.result={period:actual.period,date:actual.date,numbers:actual.numbers,
        formalHits:(p.formalTop5||[]).filter(n=>set.has(n)),
        dragHits:(p.dragTop5||[]).filter(n=>set.has(n)),
        formalHitCount:(p.formalTop5||[]).filter(n=>set.has(n)).length,
        dragHitCount:(p.dragTop5||[]).filter(n=>set.has(n)).length,
        settledAt:new Date().toISOString()};
    }
  }
  if(p.calendarNextDay?.status==="pending"){
    const d1=nextDate(p.sourceDate);
    const actual=draws.find(d=>d.date===d1);
    const later=draws.some(d=>d.date>d1);
    if(actual){
      const set=new Set(actual.numbers);
      p.calendarNextDay={status:"settled",period:actual.period,date:actual.date,numbers:actual.numbers,
        formalHits:(p.formalTop5||[]).filter(n=>set.has(n)),
        dragHits:(p.dragTop5||[]).filter(n=>set.has(n))};
    }else if(later){
      p.calendarNextDay={status:"no_draw",targetDate:d1};
    }
  }
}

// Build a new sealed forecast from historical next-draw pairs only.
if(!log.predictions.some(p=>p.sourcePeriod===latest.period)){
  const opportunities=Array(40).fill(0),hits=Array.from({length:40},()=>Array(40).fill(0));
  for(let i=0;i<draws.length-1;i++){
    const trigger=draws[i].numbers[2];
    opportunities[trigger]++;
    for(const n of draws[i+1].numbers)hits[trigger][n]++;
  }
  const trigger=latest.numbers[2],samples=opportunities[trigger];
  const ranking=Array.from({length:39},(_,i)=>i+1).map(n=>({
    number:n,hits:hits[trigger][n],rate:samples?hits[trigger][n]/samples:0
  })).sort((a,b)=>b.rate-a.rate||b.hits-a.hits||a.number-b.number);
  log.predictions.push({
    id:latest.period+"-position3-forward-v1",
    createdAt:new Date().toISOString(),
    sourcePeriod:latest.period,sourceDate:latest.date,sourceNumbers:latest.numbers,
    triggerPosition:3,triggerNumber:trigger,trainingPairs:samples,
    trainingThrough:draws.at(-2).date,
    formalTop5:prior.top5.slice(0,5),
    dragTop5:ranking.slice(0,5).map(x=>x.number),
    dragRanking:ranking,
    calendarNextDay:{status:"pending",targetDate:nextDate(latest.date)}
  });
}

log.dataThrough=latest.date;
log.updatedAt=new Date().toISOString();
log.predictions.sort((a,b)=>a.sourceDate.localeCompare(b.sourceDate)||a.sourcePeriod.localeCompare(b.sourcePeriod));
fs.writeFileSync(OUT,JSON.stringify(log,null,2)+"\n");
const settled=log.predictions.filter(p=>p.result);
const avg=(key)=>settled.length?settled.reduce((s,p)=>s+p.result[key],0)/settled.length:0;
console.log(JSON.stringify({
  dataThrough:log.dataThrough,predictions:log.predictions.length,settled:settled.length,
  latest:log.predictions.at(-1),
  settledSummary:{pairs:settled.length,formalAvgHits:avg("formalHitCount"),dragAvgHits:avg("dragHitCount")}
}));
