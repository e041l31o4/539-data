import fs from "node:fs";
const draws=JSON.parse(fs.readFileSync("data/daily539.json","utf8")).draws.filter(d=>d.numbers?.length===5).sort((a,b)=>a.date.localeCompare(b.date)||a.period.localeCompare(b.period));
const BASE=5/39,WINDOW=[30,90,180,365],LAGS=[1,2,3,5],LAG_WEIGHTS=[.34,.26,.22,.18],split=Math.floor(draws.length*.7);
const dateIndex=new Map(draws.map((d,i)=>[d.date,i]));
const subsets=nums=>{const a=[];for(let i=0;i<nums.length;i++)a.push([nums[i]]);for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++)a.push([nums[i],nums[j]]);for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++)for(let k=j+1;k<nums.length;k++)a.push([nums[i],nums[j],nums[k]]);return a;};
function newState(){return{maps:LAGS.map(()=>new Map()),opportunities:Array(40).fill(0),conditionalHits:Array(40).fill(0),freq:Object.fromEntries([30,90,180,365].map(w=>[w,Array(40).fill(0)]))};}
function addTransition(s,t){
 if(t>=0){for(const n of draws[t].numbers)for(const w of WINDOW)s.freq[w][n]++;for(const w of WINDOW)if(t>=w)for(const n of draws[t-w].numbers)s.freq[w][n]--;}
 if(t>=1){const prev=draws[t-1].numbers,next=draws[t].numbers;for(let n=1;n<=39;n++)if(prev.some(x=>Math.abs(x-n)===1)){s.opportunities[n]++;if(next.includes(n))s.conditionalHits[n]++;}}
 LAGS.forEach((lag,li)=>{if(t<lag)return;const prev=draws[t-lag].numbers,next=draws[t].numbers,map=s.maps[li];for(const pattern of subsets(prev)){const key=pattern.join(",");let stat=map.get(key);if(!stat){stat={support:0,hits:Array(40).fill(0),size:pattern.length};map.set(key,stat);}stat.support++;for(const n of next)stat.hits[n]++;}});
}
function formalRank(i,s){
 const len=i,candidates=Array.from({length:39},(_,j)=>j+1);
 const fz=(n,windows,weights)=>{let z=0;windows.forEach((w,wi)=>{const size=Math.min(w,len),count=s.freq[w][n],p=(count+5)/(size+39),se=Math.sqrt(BASE*(1-BASE)/(size+39));z+=weights[wi]*(p-BASE)/se;});return z;};
 const z30=candidates.map(n=>fz(n,[30],[1])),z90=candidates.map(n=>fz(n,[90],[1])),z365=candidates.map(n=>fz(n,[365],[1])),adv=candidates.map(n=>fz(n,[30,90,180,365],[.34,.29,.22,.15]));
 const last=Array(40).fill(-1);for(let t=len-1;t>=0;t--)for(const n of draws[t].numbers)if(last[n]<0)last[n]=len-1-t;
 const maxGap=Math.max(1,...last.slice(1)),scored=candidates.map((n,j)=>{const trend=.4*z30[j]+.3*z90[j]+.3*z365[j],omission=Math.min(2,(last[n]<0?len:last[n])/maxGap);return{n,score:.30*trend+.08*omission+.10*adv[j]};});
 return scored.sort((a,b)=>b.score-a.score||Math.abs(a.n-20)-Math.abs(b.n-20)||a.n-b.n).map(x=>x.n);
}
const state=newState();for(let t=0;t<split;t++)addTransition(state,t);
const p3Counts=Array.from({length:40},()=>Array(40).fill(0)),p3Opp=Array(40).fill(0);
function addP3(d,n){const trigger=d.numbers[2];p3Opp[trigger]++;for(const x of n.numbers)p3Counts[trigger][x]++;}
for(let i=0;i<split;i++){const dt=new Date(draws[i].date+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+1);const j=dateIndex.get(dt.toISOString().slice(0,10));if(j!==undefined&&j<split)addP3(draws[i],draws[j]);}
const blank=()=>({pairs:0,hits:0,ge1:0,ge2:0,ge3:0}),formal=blank(),p3=blank(),random=blank(),paired=[],sizeResults=Object.fromEntries([3,5,10].map(k=>[k,{formal:blank(),drag:blank(),pairs:[]} ]));
const byTrigger=Array.from({length:40},(_,i)=>({trigger:i,samples:0,hits:0,ge1:0,blocks:[{n:0,ge1:0},{n:0,ge1:0},{n:0,ge1:0}]}));
const blockSize=Math.ceil((draws.length-split)/3),record=(s,h)=>{s.pairs++;s.hits+=h;if(h>=1)s.ge1++;if(h>=2)s.ge2++;if(h>=3)s.ge3++;};
for(let i=split;i<draws.length-1;i++){
 addTransition(state,i);
 const dt=new Date(draws[i].date+"T00:00:00Z");dt.setUTCDate(dt.getUTCDate()+1);const j=dateIndex.get(dt.toISOString().slice(0,10));
 if(j!==undefined&&j===i+1){
  const actual=new Set(draws[j].numbers),fp=formalRank(j,state),fh=fp.filter(n=>actual.has(n)).length;record(formal,fh);
  const trig=draws[i].numbers[2],rank=Array.from({length:39},(_,k)=>k+1).map(n=>({n,rate:p3Opp[trig]?p3Counts[trig][n]/p3Opp[trig]:0,h:p3Counts[trig][n]})).sort((a,b)=>b.rate-a.rate||b.h-a.h||a.n-b.n),pp=rank.slice(0,5).map(x=>x.n),ph=pp.filter(n=>actual.has(n)).length;record(p3,ph);paired.push({date:draws[j].date,formalHits:fh,dragHits:ph,formalGe1:fh>0,dragGe1:ph>0});
  const s=byTrigger[trig],bi=Math.min(2,Math.floor((i-split)/blockSize));s.samples++;s.hits+=ph;if(ph>0)s.ge1++;s.blocks[bi].n++;if(ph>0)s.blocks[bi].ge1++;
  record(random,draws[j].numbers.filter(n=>n<=5).length);addP3(draws[i],draws[j]);
 }
}
const exactAtLeast1=1-(34/39)*(33/38)*(32/37)*(31/36)*(30/35);
const summary=s=>({pairs:s.pairs,avgHits:s.pairs?s.hits/s.pairs:0,atLeast1:s.pairs?s.ge1/s.pairs:0,atLeast2:s.pairs?s.ge2/s.pairs:0,atLeast3:s.pairs?s.ge3/s.pairs:0});
function exactMcNemar(b,c){const n=b+c;if(!n)return 1;let tail=0;const k=Math.min(b,c);for(let i=0;i<=k;i++){let logC=0;for(let q=1;q<=i;q++)logC+=Math.log(n-q+1)-Math.log(q);tail+=Math.exp(logC-n*Math.log(2));}return Math.min(1,2*tail);}
function blockBootstrap(values,seed=539,replicates=5000,block=7){let x=seed>>>0;const rand=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};const n=values.length,means=[];for(let r=0;r<replicates;r++){let sum=0,count=0;while(count<n){const start=Math.floor(rand()*n),take=Math.min(block,n-count);for(let q=0;q<take;q++){sum+=values[(start+q)%n];count++;}}means.push(sum/n);}means.sort((a,b)=>a-b);return{low:means[Math.floor(.025*replicates)],high:means[Math.floor(.975*replicates)],replicates,blockLength:block};}
const meanDiff=paired.map(x=>x.dragHits-x.formalHits),ge1Diff=paired.map(x=>Number(x.dragGe1)-Number(x.formalGe1));
const dragOnly=paired.filter(x=>x.dragGe1&&!x.formalGe1).length,formalOnly=paired.filter(x=>x.formalGe1&&!x.dragGe1).length;
const pairedComparison={pairs:paired.length,avgHitsDifference:meanDiff.reduce((a,b)=>a+b,0)/paired.length,avgHitsDifference95CI:blockBootstrap(meanDiff,539),atLeast1Difference:ge1Diff.reduce((a,b)=>a+b,0)/paired.length,atLeast1Difference95CI:blockBootstrap(ge1Diff,539+1),mcnemar:{dragOnly,formalOnly,discordant:dragOnly+formalOnly,exactTwoSidedP:exactMcNemar(dragOnly,formalOnly)},interpretation:"Paired same-date comparison. Confidence intervals use circular moving-block bootstrap (7 adjacent calendar-day pairs, 5000 replicates) to reduce serial-dependence underestimation. McNemar exact test compares discordant at-least-one-hit outcomes."};
const bySelectionSize=Object.fromEntries([3,5,10].map(k=>{const a=sizeResults[k].pairs,md=a.map(x=>x.dragHits-x.formalHits),gd=a.map(x=>Number(x.dragGe1)-Number(x.formalGe1)),dw=a.filter(x=>x.dragGe1&&!x.formalGe1).length,fw=a.filter(x=>x.formalGe1&&!x.dragGe1).length;return[k,{formal:summary(sizeResults[k].formal),position3Drag:summary(sizeResults[k].drag),paired:{avgHitsDifference:md.reduce((x,y)=>x+y,0)/a.length,avgHitsDifference95CI:blockBootstrap(md,539+k),atLeast1Difference:gd.reduce((x,y)=>x+y,0)/a.length,atLeast1Difference95CI:blockBootstrap(gd,539+k+10),mcnemar:{dragOnly:dw,formalOnly:fw,exactTwoSidedP:exactMcNemar(dw,fw)}}}];}));
const out={version:"dplus1-formal-vs-position3-v1",dataThrough:draws.at(-1).date,trainThrough:draws[split-1].date,testFrom:draws[split].date,testPairs:formal.pairs,method:"Exact D -> D+1 calendar-day pairs only. Expanding walk-forward. Formal multifactor weights match production: link 0, trend .30, omission .08, advanced .10. Position-3 drag uses only earlier D->D+1 pairs. Random reference is hypergeometric.",randomBaseline:{avgHits:25/39,atLeast1:exactAtLeast1},formalMultifactor:summary(formal),position3DragTop5:summary(p3),pairedComparison,bySelectionSize,byTrigger:byTrigger.filter(x=>x.samples).map(x=>({...x,avgHits:x.hits/x.samples,atLeast1:x.ge1/x.samples,blocks:x.blocks.map(b=>({samples:b.n,atLeast1:b.n?b.ge1/b.n:null}))})).sort((a,b)=>b.samples-a.samples)};
fs.writeFileSync("data/drag-validation539.json",JSON.stringify(out,null,2)+"\n");
console.log(JSON.stringify({testPairs:out.testPairs,randomBaseline:out.randomBaseline,formalMultifactor:out.formalMultifactor,position3DragTop5:out.position3DragTop5,pairedComparison:out.pairedComparison,bySelectionSize:out.bySelectionSize}));
