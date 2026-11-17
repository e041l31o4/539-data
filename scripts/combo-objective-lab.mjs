import fs from "node:fs";

const draws = JSON.parse(fs.readFileSync("data/daily539.json", "utf8")).draws
  .filter(d => Array.isArray(d.numbers) && d.numbers.length === 5)
  .sort((a,b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period));
const TEST = Math.min(3000, draws.length - 365);
const START = draws.length - TEST;
const N=39, WINDOW=365, PAIR_P=10/741;
const choose=(n,k)=>{let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return v;};
const pHit=[0,1,2,3,4,5].map(h=>choose(5,h)*choose(34,5-h)/choose(39,5));
const baseline={atLeast2Pct:100*(pHit[2]+pHit[3]+pHit[4]+pHit[5]),atLeast3Pct:100*(pHit[3]+pHit[4]+pHit[5])};
function blank(){return {periods:0,ge2:0,ge3:0,total:0,dist:[0,0,0,0,0,0]};}
function add(s,h){s.periods++;s.total+=h;s.dist[h]++;if(h>=2)s.ge2++;if(h>=3)s.ge3++;}
function summary(s){return {periods:s.periods,averageHits:+(s.total/s.periods).toFixed(4),atLeast2Pct:+(100*s.ge2/s.periods).toFixed(2),atLeast3Pct:+(100*s.ge3/s.periods).toFixed(2),distribution:s.dist};}
const lambdas=[0,0.25,0.5,1,2];
const stats=new Map(lambdas.map(x=>[x,blank()]));
const segments=new Map(lambdas.map(x=>[x,[blank(),blank(),blank()]]));
const baseStats=blank();
for(let i=START;i<draws.length;i++){
  const from=Math.max(0,i-WINDOW), len=i-from;
  const freq=Array(N+1).fill(0), pairs=Array.from({length:N+1},()=>Array(N+1).fill(0));
  for(let t=from;t<i;t++){
    const a=draws[t].numbers;
    for(const n of a)freq[n]++;
    for(let x=0;x<5;x++)for(let y=x+1;y<5;y++){const u=a[x],v=a[y];pairs[u][v]++;pairs[v][u]++;}
  }
  const ranked=Array.from({length:N},(_,j)=>j+1).map(n=>({n,score:(freq[n]+0.5)/(len+1)-5/39}))
    .sort((a,b)=>b.score-a.score||a.n-b.n);
  const pool=ranked.slice(0,12).map(x=>x.n);
  const individual=new Map(ranked.map(x=>[x.n,x.score]));
  const pairScore=(a,b)=>{
    const observed=pairs[a][b], expected=len*PAIR_P;
    const se=Math.sqrt(Math.max(1e-9,len*PAIR_P*(1-PAIR_P)));
    // Empirical-Bayes style shrinkage prevents rare pairs dominating.
    return Math.max(-2,Math.min(2,(observed-expected)/se))*Math.min(1,len/(len+120));
  };
  let bestBase=null;
  const best=new Map(lambdas.map(x=>[x,null]));
  for(let a=0;a<pool.length-4;a++)for(let b=a+1;b<pool.length-3;b++)for(let c=b+1;c<pool.length-2;c++)for(let d=c+1;d<pool.length-1;d++)for(let e=d+1;e<pool.length;e++){
    const combo=[pool[a],pool[b],pool[c],pool[d],pool[e]];
    let single=combo.reduce((s,n)=>s+individual.get(n),0), synergy=0;
    for(let x=0;x<5;x++)for(let y=x+1;y<5;y++)synergy+=pairScore(combo[x],combo[y]);
    for(const lam of lambdas){
      const score=single+lam*synergy;
      const prev=best.get(lam);
      if(!prev||score>prev.score)best.set(lam,{score,combo});
    }
  }
  const actual=new Set(draws[i].numbers), seg=Math.min(2,Math.floor((i-START)/Math.ceil(TEST/3)));
  const simple=ranked.slice(0,5).map(x=>x.n);
  const baseHits=simple.filter(n=>actual.has(n)).length;add(baseStats,baseHits);
  for(const lam of lambdas){const h=best.get(lam).combo.filter(n=>actual.has(n)).length;add(stats.get(lam),h);add(segments.get(lam)[seg],h);}
}
const models={};
for(const lam of lambdas)models[String(lam)]={overall:summary(stats.get(lam)),segments:segments.get(lam).map(summary)};
const report={version:"combo-objective-pair-lab-v1",dataThrough:draws.at(-1).date,historyCount:draws.length,testPeriodCount:TEST,testFrom:draws[START].date,testTo:draws.at(-1).date,method:"每期只用此前365期資料；先以近期頻率選12碼候選池，再窮舉其中792種五碼組合。配對共現分數以超幾何基準近似的二項期望、標準誤及收縮計算；lambda固定，不以測試結果挑參數。",randomBaseline:baseline,individualTop5:summary(baseStats),pairOptimized:models};
fs.writeFileSync("data/combo-objective-lab539.json",JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({randomBaseline:baseline,individualTop5:summary(baseStats),pairOptimized:models},null,2));
