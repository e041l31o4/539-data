const $=s=>document.querySelector(s);let draws=[],page=0;const PAGE_SIZE=12;const fmt=n=>new Intl.NumberFormat("zh-TW").format(n);const balls=arr=>arr.map(n=>'<span class="ball">'+String(n).padStart(2,"0")+"</span>").join("");const recent=(a,w)=>w==="all"?a:a.slice(-Number(w));function freq(a){const f=Array(40).fill(0);a.forEach(d=>d.numbers.forEach(n=>f[n]++));return f}function gaps(a){const g=Array(40).fill(a.length);const seen=new Set;for(let i=a.length-1;i>=0&&seen.size<39;i--)a[i].numbers.forEach(n=>{if(!seen.has(n)){seen.add(n);g[n]=a.length-1-i}});return g}function tailFreq(a){const t=Array(10).fill(0);a.forEach(d=>d.numbers.forEach(n=>t[n%10]++));return t}function minmax(x){let m=Math.min(...x.slice(1)),M=Math.max(...x.slice(1));return x.map((v,i)=>i===0?0:M===m?.5:(v-m)/(M-m))}function models(a){
 const total=Math.max(1,a.length),f30=freq(a.slice(-30)),f60=freq(a.slice(-60)),f100=freq(a.slice(-100)),fa=freq(a),g=gaps(a),tailSizes=[3,4,4,4,4,4,4,4,4,4],tailScore=Array(10).fill(0);
 [[30,.5],[60,.3],[100,.2]].forEach(([w,wt])=>{const f=tailFreq(a.slice(-w)),sum=f.reduce((x,y)=>x+y,0)||1;f.forEach((v,i)=>tailScore[i]+=wt*(v/sum)/(tailSizes[i]/39))});
 const sample=a.slice(-100),zone=[0,0,0];let odd=0,small=0,count=0,consec=0;
 sample.forEach(d=>{let has=false;d.numbers.forEach((n,i)=>{zone[n<=13?0:n<=26?1:2]++;if(n%2)odd++;if(n<=19)small++;count++;if(i&&n-d.numbers[i-1]===1)has=true});if(has)consec++});
 const last=new Set(a.at(-1)?.numbers||[]),raw={hot:Array(40).fill(0),total:Array(40).fill(0),gap:g,cold:Array(40).fill(0),tail:Array(40).fill(0),structure:Array(40).fill(0),neighbor:Array(40).fill(0),transition:Array(40).fill(0)};
 const trans=a.slice(-301);for(let n=1;n<=39;n++){
 raw.hot[n]=.5*f30[n]/Math.max(1,Math.min(30,total))+.3*f60[n]/Math.max(1,Math.min(60,total))+.2*f100[n]/Math.max(1,Math.min(100,total));raw.total[n]=fa[n]/total;raw.cold[n]=Math.min(g[n]/(fa[n]?total/fa[n]:total),3);raw.tail[n]=tailScore[n%10];
 const zr=zone[n<=13?0:n<=26?1:2]/Math.max(1,count)/(13/39),pr=n%2?odd/Math.max(1,count)/(20/39):(count-odd)/Math.max(1,count)/(19/39),sr=n<=19?small/Math.max(1,count)/(19/39):(count-small)/Math.max(1,count)/(20/39);raw.structure[n]=zr*pr*sr*(1+(sample.length?consec/sample.length:0)*(last.has(n-1)||last.has(n+1)?1:0));
 let nh=0,ns=0,th=0,ts=0;for(let i=1;i<trans.length;i++){const prev=trans[i-1].numbers,cur=trans[i].numbers;if(prev.includes(n-1)||prev.includes(n+1)){ns++;if(cur.includes(n))nh++}if(prev.includes(n)){ts++;if(cur.includes(n))th++}}raw.neighbor[n]=(nh+.5)/(ns+1);raw.transition[n]=(th+.5)/(ts+1);
 }return Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,minmax(v)]));
}
function advancedRanking(a){
 const base=5/39,windows=[30,90,180,365],weights=[.34,.29,.22,.15],scores=[],limit=a.length;
 for(let n=1;n<=39;n++){
  let z=0,parts=[];
  windows.forEach((w,i)=>{
   const sample=a.slice(-Math.min(w,limit)),count=sample.reduce((s,d)=>s+(d.numbers.includes(n)?1:0),0);
   const post=(count+5)/(sample.length+39),se=Math.sqrt(base*(1-base)/(sample.length+39));
   const v=se?(post-base)/se:0;z+=v*weights[i];parts.push({w,count,total:sample.length,rate:post,z:v});
  });
  let opportunities=0,hits=0;
  for(let i=0;i<limit-1;i++){
   if(a[i].numbers.some(x=>Math.abs(x-n)===1)){opportunities++;if(a[i+1].numbers.includes(n))hits++}
  }
  const conditional=(hits+5)/(opportunities+39),cse=Math.sqrt(base*(1-base)/(opportunities+39));
  const cz=cse?(conditional-base)/cse:0,clamped=Math.max(-2,Math.min(2,cz));
  const score=z*.82+clamped*.18;
  scores.push({n,score,frequencyZ:z,conditionalZ:cz,parts,opportunities,hits,conditional});
 }
 return scores.sort((x,y)=>y.score-x.score||Math.abs(x.n-20)-Math.abs(y.n-20)||x.n-y.n);
}
function advancedPick(a){return advancedRanking(a).slice(0,5).map(x=>x.n)}
function multiFactorRanking(a){
 const base=5/39, candidates=Array.from({length:39},(_,i)=>i+1),last=a.length;
 if(last<30)return candidates.map(n=>({n,score:0}));
 const freqWindow=w=>{const sample=a.slice(-Math.min(w,last));return candidates.map(n=>{const k=sample.reduce((s,d)=>s+(d.numbers.includes(n)?1:0),0);const p=(k+5)/(sample.length+39);return (p-base)/Math.sqrt(base*(1-base)/(sample.length+39))})};
 const z30=freqWindow(30),z90=freqWindow(90),z365=freqWindow(365),gap=gaps(a);
 const lags=[1,2,3,5],lagWeights=[.34,.26,.22,.18],linkScores=Array(40).fill(0),linkParts=Array.from({length:40},()=>[]);
 const subsets=nums=>{const out=[];for(let i=0;i<nums.length;i++)out.push([nums[i]]);for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++)out.push([nums[i],nums[j]]);for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++)for(let k=j+1;k<nums.length;k++)out.push([nums[i],nums[j],nums[k]]);return out};
 lags.forEach((lag,li)=>{
  if(last<=lag)return;
  const context=a[last-lag].numbers,patterns=subsets(context),patternResults=[];
  patterns.forEach(pattern=>{
   let support=0,hits=Array(40).fill(0);
   for(let i=lag;i<last;i++){
    const prev=a[i-lag].numbers;
    if(!pattern.every(n=>prev.includes(n)))continue;
    support++;
    a[i].numbers.forEach(n=>hits[n]++);
   }
   const alpha=pattern.length===1?25:pattern.length===2?60:100;
   const rel=Math.min(1,support/(support+alpha));
   for(let n=1;n<=39;n++){
    const posterior=(hits[n]+alpha*base)/(support+alpha);
    const lift=(posterior-base)/base;
    const contribution=Math.max(-1.5,Math.min(2.5,lift))*rel;
    linkScores[n]+=lagWeights[li]*contribution/(patterns.length||1);
    linkParts[n].push({lag,size:pattern.length,support,hit:hits[n],lift:contribution});
   }
  });
 });
 const gMax=Math.max(1,...gap.slice(1)),advanced=advancedRanking(a);
 return candidates.map((n,i)=>{
  const trend=.40*z30[i]+.30*z90[i]+.30*z365[i];
  const omission=Math.min(2,gap[n]/Math.max(1,gMax));
  const score=.52*linkScores[n]+.30*trend+.08*omission+.10*advanced.find(x=>x.n===n).frequencyZ;
  return {n,score,linkScore:linkScores[n],trend,omission,parts:linkParts[n]};
 }).sort((x,y)=>y.score-x.score||Math.abs(x.n-20)-Math.abs(y.n-20)||x.n-y.n);
}
function multiFactorPick(a){return multiFactorRanking(a).slice(0,5).map(x=>x.n)}
function adaptiveStrategyScores(a){
 const f=freq(a.slice(-30)),g=gaps(a),last=a.at(-1)?.numbers||[],tails=new Set(last.map(n=>n%10));
 const neighbor=new Set(last.flatMap(n=>[n-1,n+1]).filter(n=>n>=1&&n<=39));
 const all=Array.from({length:39},(_,i)=>i+1);
 const sort=(score)=>all.slice().sort((x,y)=>score(y)-score(x)||Math.abs(x-20)-Math.abs(y-20)||x-y);
 return {
  hot:sort(n=>f[n]),
  gap:sort(n=>g[n]),
  neighbor:sort(n=>neighbor.has(n)?1:0),
  tail:sort(n=>tails.has(n%10)?1:0)
 };
}
function adaptiveModel(a){
 const names=["hot","gap","neighbor","tail"],windowSize=Math.min(100,Math.max(0,a.length-150));
 const outcomes=Object.fromEntries(names.map(k=>[k,[]]));
 // 逐期只使用當時已知資料，避免把未來開獎洩漏進歷史預測。
 for(let i=Math.max(150,a.length-windowSize);i<a.length;i++){
  const hist=a.slice(0,i),actual=new Set(a[i].numbers),rankings=adaptiveStrategyScores(hist);
  for(const name of names)outcomes[name].push(rankings[name].slice(0,5).filter(n=>actual.has(n)).length);
 }
 const windows=[30,60,100],windowWeights=[.5,.3,.2],baseline=5/39;
 const raw={};
 for(const name of names){
  let observed=0,totalWeight=0;
  windows.forEach((w,j)=>{
   const vals=outcomes[name].slice(-w),weight=windowWeights[j];
   if(vals.length){observed+=weight*(vals.reduce((x,y)=>x+y,0)/vals.length);totalWeight+=weight}
  });
  const avg=totalWeight?observed/totalWeight:5*baseline;
  // 小樣本向隨機基準收縮，避免短期命中造成權重劇烈跳動。
  const n=outcomes[name].length,shrunk=(avg*n+5*baseline*40)/(n+40);
  raw[name]=Math.max(.85,Math.min(1.15,shrunk/(5*baseline)));
 }
 const total=Object.values(raw).reduce((x,y)=>x+y,0);
 const weights=Object.fromEntries(names.map(k=>[k,raw[k]/total]));
 const current=adaptiveStrategyScores(a),base=multiFactorRanking(a);
 const baseMap=new Map(base.map((x,i)=>[x.n,(39-i)/38]));
 const scores=Array.from({length:39},(_,i)=>{
  const n=i+1;
  const strategyScore=names.reduce((sum,k)=>sum+weights[k]*(39-current[k].indexOf(n))/38,0);
  return {n,score:.65*baseMap.get(n)+.35*strategyScore};
 }).sort((x,y)=>y.score-x.score||x.n-y.n);
 return {ranking:scores,weights,samples:outcomes.hot.length,performance:Object.fromEntries(names.map(k=>[k,outcomes[k].length?outcomes[k].reduce((x,y)=>x+y,0)/outcomes[k].length:0]))};
}


function wilson(successes,total){
 if(!total)return [0,0];const z=1.96,p=successes/total,d=1+z*z/total,c=(p+z*z/(2*total))/d,m=z*Math.sqrt((p*(1-p)+z*z/(4*total))/total)/d;return [Math.max(0,c-m),Math.min(1,c+m)];
}
function binomialUpperTail(k,n,p){
 let term=Math.pow(1-p,n),sum=0;
 for(let i=0;i<=n;i++){if(i>=k)sum+=term;if(i<n)term*=((n-i)/(i+1))*(p/(1-p))}
 return Math.min(1,sum);
}
const weights={neighbor:25,transition:15,hot:15,total:10,gap:10,cold:5,tail:10,structure:10};function ranking(a){const m=models(a),sum=Object.values(weights).reduce((x,y)=>x+y,0);return Array.from({length:39},(_,i)=>{let n=i+1,s=Object.keys(weights).reduce((v,k)=>v+weights[k]/sum*m[k][n],0);return{n,score:s}}).sort((x,y)=>y.score-x.score||x.n-y.n)}function recommendations(a){if(a.length<100)return null;let r=ranking(a);return{main:r.slice(0,5).map(x=>x.n).sort((x,y)=>x-y),alt:r.slice(5,10).map(x=>x.n).sort((x,y)=>x-y),rank:r}}function renderOverview(){const last=draws.at(-1),first=draws[0];$("#totalDraws").textContent=fmt(draws.length);$("#latestPeriod").textContent=last?.period||"—";$("#latestDate").textContent=last?.date||"尚無紀錄";$("#dateRange").textContent=first&&last?first.date+" — "+last.date:"尚未建立";$("#updatedAt").textContent=window.datasetUpdated?new Date(window.datasetUpdated).toLocaleString("zh-TW"):"尚未同步";$("#dataStatus").textContent=draws.length?"資料可用":"等待資料";if(last){const f=freq(draws.slice(-30));let hot=Array.from({length:39},(_,i)=>i+1).sort((a,b)=>f[b]-f[a]||a-b).slice(0,3);$("#hotNumber").textContent=hot.map(n=>String(n).padStart(2,"0")).join(" · ")}}function renderRecommend(){
 if(draws.length<150){$("#mainPicks").innerHTML='<span class="empty">資料不足，至少需要 150 期才能進行方法驗證。</span>';return}
 const best="多因子連動融合";
 const adaptive=adaptiveModel(draws),currentRanking=adaptive.ranking,mainRows=currentRanking.slice(0,5),altRows=currentRanking.slice(5,10),main=mainRows.map(x=>x.n),alt=altRows.map(x=>x.n);
 $("#mainPicks").innerHTML=mainRows.map((x,i)=>'<button type="button" class="pick-ball-button" data-number="'+x.n+'"><span class="rank-no">#'+(i+1)+'</span><span class="ball">'+String(x.n).padStart(2,"0")+'</span></button>').join("");$("#altPicks").innerHTML=altRows.map((x,i)=>'<span class="backup-pick"><small>#'+(i+6)+'</small><span class="ball">'+String(x.n).padStart(2,"0")+'</span></span>').join("");
 const last=draws.at(-1),f30=freq(draws.slice(-30)),f100=freq(draws.slice(-100)),g=gaps(draws);
 const universe=Array.from({length:39},(_,i)=>i+1);
 const prev=last.numbers;
 const metricFor=n=>{
  const near=prev.filter(x=>Math.abs(x-n)===1),tailCount=prev.filter(x=>x%10===n%10).length;
  const arithmetic=prev.flatMap(x=>[x-1,x+1,40-x,((x*2-1)%39)+1,((x*3-1)%39)+1,((x+18)%39)+1]).filter(x=>x>=1&&x<=39);
  if(best==="近期熱號")return {value:f30[n],unit:"近30期出現次數",rank:1+universe.filter(x=>f30[x]>f30[n]).length,rule:"按近30期次數由高至低排序"};
  if(best==="遺漏值")return {value:g[n],unit:"連續未開期數",rank:1+universe.filter(x=>g[x]>g[n]).length,rule:"按目前遺漏期數由高至低排序"};
  if(best==="前後號±1")return {value:near.length,unit:"與前期號碼相差±1的連結數",rank:1+universe.filter(x=>prev.filter(p=>Math.abs(p-x)===1).length>near.length).length,rule:"先選前期五碼的±1候選，再以距20較近者破同分"};
  if(best==="隔期重複")return {value:prev.includes(n)?1:0,unit:"是否為前一期重複號",rank:prev.includes(n)?1:6,rule:"直接沿用前一期五碼；不代表重複機率提高"};
  if(best==="尾數延伸")return {value:tailCount,unit:"前期相同尾數個數",rank:1+universe.filter(x=>prev.filter(p=>p%10===x%10).length>tailCount).length,rule:"按前一期相同尾數連結數排序"};
  if(best==="算術變化")return {value:arithmetic.filter(x=>x===n).length,unit:"符合前期衍生算式的次數",rank:1+universe.filter(x=>arithmetic.filter(v=>v===x).length>arithmetic.filter(v=>v===n).length).length,rule:"前期號碼套用±1、40−x、2x、3x及+19等候選規則"};
  if(best==="平滑多視窗模型"){const d=advancedRanking(draws).find(x=>x.n===n),rank=1+advancedRanking(draws).filter(x=>x.score>d.score).length;return {value:d.score.toFixed(3),unit:"融合分數（非機率）",rank,rule:"頻率偏離Z分數×0.82＋鄰號條件偏離Z分數×0.18"};}
  const r=ranking(draws),d=r.find(x=>x.n===n);return {value:d.score.toFixed(3),unit:"綜合加權分數（非機率）",rank:1+r.filter(x=>x.score>d.score).length,rule:"前後號25%、隔期15%、近期頻率15%、總頻率10%、遺漏10%、冷熱5%、尾數10%、結構10%"};
 };
 const allRanks=currentRanking, rankMap=new Map(allRanks.map((x,i)=>[x.n,{...x,rank:i+1}]));
 // 自適應融合排名只提供融合分數；各項細節需另外取多因子模型資料，不能直接讀取不存在的欄位。
 const factorMap=new Map(multiFactorRanking(draws).map(x=>[x.n,x]));
 const advancedMap=new Map(advancedRanking(draws).map(x=>[x.n,x]));
 const detailsHtml=n=>{
  const d=rankMap.get(n),factor=factorMap.get(n),adv=advancedMap.get(n),near=prev.filter(x=>Math.abs(x-n)===1);
  if(!d||!factor||!adv)throw new Error("號碼分析資料尚未完整建立");
  const lagSummary=[1,2,3,5].map(lag=>{const sample=draws.slice(0,-lag),hits=sample.reduce((acc,draw,i)=>acc+(draw.numbers.includes(n)&&draws[i+lag]?.numbers.includes(n)?1:0),0),opportunities=sample.filter(v=>v.numbers.includes(n)).length;return "隔"+lag+"期重複 "+hits+"/"+opportunities}).join("｜");
  return '<div class="number-detail-head"><span class="detail-ball">'+String(n).padStart(2,"0")+'</span><div><b>號碼 '+String(n).padStart(2,"0")+' 分析</b><small>綜合排名第 '+d.rank+'／39｜融合分數 '+d.score.toFixed(4)+'（非機率）</small></div></div>'+
   '<div class="number-detail-grid"><div><small>連動綜合分數</small><b>'+factor.linkScore.toFixed(4)+'</b><span>單號／雙號／三碼條件連動</span></div><div><small>長短期趨勢</small><b>'+factor.trend.toFixed(4)+'</b><span>近30、90、365期平滑頻率</span></div><div><small>遺漏調整</small><b>'+factor.omission.toFixed(4)+'</b><span>目前未開 '+g[n]+' 期</span></div><div><small>多視窗頻率 Z</small><b>'+adv.frequencyZ.toFixed(3)+'</b><span>相對隨機基準的偏離</span></div><div><small>鄰號條件命中</small><b>'+adv.hits+'／'+adv.opportunities+'</b><span>平滑條件比例 '+(adv.conditional*100).toFixed(2)+'%</span></div><div><small>前一期鄰號關聯</small><b>'+near+' 個</b><span>與前期五碼相差 ±1</span></div></div>'+
   '<div class="number-detail-block"><b>不同期距的重複觀察</b><p>'+lagSummary+'</p></div><div class="number-detail-block"><b>連動樣本明細</b><p>單號、雙號、三碼組合均以歷史條件出現次數計算，並依樣本數平滑收縮。此號碼連動訊號共有 '+factor.parts.length+' 筆條件紀錄。</p></div><div class="number-detail-block"><b>近期期數表現</b><p>近30期：'+f30[n]+' 次｜近100期：'+f100[n]+' 次｜目前遺漏：'+g[n]+' 期｜全歷史：'+freq(draws)[n]+' 次</p></div><small class="muted">分數是模型排序工具，不是下一期開出的真實機率。公平獨立開獎下，單一號碼理論出現率為5/39；歷史連動不代表因果或未來保證。</small>';
 };
 let reasonBox=$("#pickReasons");if(!reasonBox){reasonBox=document.createElement("div");reasonBox.id="pickReasons";reasonBox.className="panel";$("#recommend").appendChild(reasonBox)}
 reasonBox.innerHTML='<div class="panel-head"><b>1～39 號碼完整推薦排名</b><span class="muted">點選任一號碼查看完整分析</span></div><div class="number-rank-grid">'+allRanks.map((x,i)=>'<button type="button" class="number-rank '+(main.includes(x.n)?"is-top":"")+'" data-number="'+x.n+'"><span class="rank-no">#'+(i+1)+'</span><b>'+String(x.n).padStart(2,"0")+'</b><small>'+x.score.toFixed(3)+'</small></button>').join("")+'</div><div class="number-detail-modal" id="numberDetailModal" hidden><div class="number-detail-card"><button type="button" class="detail-close" aria-label="關閉">×</button><div id="numberDetailContent"></div></div></div><p class="number-rank-note">前五名為目前模型綜合排序；其他34碼仍可點選查看分數、連動樣本、期距表現及落後原因。分數不等於開獎機率。</p>';
 // 將分析函式掛到 window，讓全頁事件委派能穩定呼叫，不受區塊重繪影響。
 window.show539NumberDetail=(number)=>{
  const modal=document.querySelector("#numberDetailModal"),content=document.querySelector("#numberDetailContent");
  if(!modal||!content){console.error("539分析視窗不存在");return}
  modal.hidden=false;
  content.innerHTML='<p class="muted">正在整理 '+String(number).padStart(2,"0")+' 號碼分析…</p>';
  try{content.innerHTML=detailsHtml(number)}catch(err){
   console.error("539號碼分析錯誤",err);
   content.innerHTML='<div class="number-detail-block"><b>分析載入失敗</b><p>'+String(err?.message||err)+'</p><p>請重新整理後再試；錯誤已記錄，並非號碼沒有分析資料。</p></div>';
  }
 };

 $("#recommendBasis").textContent="自適應融合｜近"+adaptive.samples+"期逐期回饋";
 $("#sampleCount").textContent=fmt(draws.length)+" 期歷史資料";
 const pill=document.querySelector(".recommend-card .pill");if(pill)pill.textContent="自適應融合 TOP 5";
 let feedback=$("#adaptiveFeedback");if(!feedback){feedback=document.createElement("div");feedback.id="adaptiveFeedback";feedback.className="notice";$("#recommend").appendChild(feedback)}
 feedback.innerHTML="<b>策略自動回饋</b><span>依近30／60／100期逐期樣本外命中調整熱號、遺漏、前後號與尾數策略權重；目前樣本 "+adaptive.samples+" 期。策略權重限制在均衡範圍，避免短期波動過度影響。這是歷史表現調權，不代表提高實際中獎機率。</span>";
 const tf=tailFreq(draws.slice(-100)),sizes=[3,4,4,4,4,4,4,4,4,4];let tr=tf.map((v,i)=>({tail:i,score:v/sizes[i]})).sort((a,b)=>b.score-a.score).slice(0,3);
 $("#tailRanks").innerHTML=tr.map(x=>'<div class="tail-item"><b>'+x.tail+" 尾</b><small>"+x.score.toFixed(1)+" 次/號</small></div>").join("")
}function renderSequence(){/* 已簡化：詳細條件關聯不再佔用首頁版面 */}
function renderStats(){const a=recent(draws,$("#periodSelect").value),f=freq(a),max=Math.max(...f.slice(1),1),g=gaps(draws);$("#frequencyGrid").innerHTML=Array.from({length:39},(_,i)=>{let n=i+1,v=f[n];return'<div class="freq-item '+(v>=max*.8?"hot":"")+'"><b>'+String(n).padStart(2,"0")+'</b><span>'+v+" 次</span></div>"}).join("");let t=tailFreq(a),tm=Math.max(...t,1);$("#tailChart").innerHTML=t.map((v,i)=>'<div class="tail-col"><b>'+v+'</b><div class="tail-bar" style="height:'+Math.max(3,v/tm*88)+'px"></div><small>'+i+" 尾</small></div>").join("");let top=Array.from({length:39},(_,i)=>i+1).sort((x,y)=>g[y]-g[x]).slice(0,16);$("#gapList").innerHTML=top.map(n=>'<div class="gap-item"><b>'+String(n).padStart(2,"0")+'</b><small>'+g[n]+" 期</small></div>").join("")}function renderBacktest(){
 const requested=Number($("#backtestSelect").value),start=Math.max(100,draws.length-requested),total=draws.length-start;
 if(total<100){$("#btSamples").textContent="資料不足";$("#btAverage").textContent="—";$("#btOne").textContent="—";return}
 const names=["近期熱號","遺漏值","前後號±1","隔期重複","尾數延伸","算術變化","平滑多視窗模型","多因子連動融合","綜合模型"];
 const pickers={
  "近期熱號":a=>{const f=freq(a.slice(-30));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>f[y]-f[x]||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "遺漏值":a=>{const g=gaps(a);return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>g[y]-g[x]||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "前後號±1":a=>{const s=new Set(a.at(-1).numbers.flatMap(n=>[n-1,n+1]).filter(n=>n>=1&&n<=39));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(s.has(y)?1:0)-(s.has(x)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "隔期重複":a=>a.at(-1).numbers.slice(),
  "尾數延伸":a=>{const tails=new Set(a.at(-1).numbers.map(n=>n%10));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(tails.has(y%10)?1:0)-(tails.has(x%10)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "算術變化":a=>{const s=new Set(a.at(-1).numbers.flatMap(n=>[n-1,n+1,40-n,((n*2-1)%39)+1,((n*3-1)%39)+1,((n+19-1)%39)+1]).filter(n=>n>=1&&n<=39));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(s.has(y)?1:0)-(s.has(x)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "平滑多視窗模型":advancedPick,
  "多因子連動融合":multiFactorPick,
  "綜合模型":a=>recommendations(a)?.main||[]
 };
 const blank=()=>({n:0,hits:0,atLeast1:0,dist:Array(6).fill(0),details:[]});
 const stats=Object.fromEntries(names.map(name=>[name,blank()]));
 const adaptive=blank(),folds=5,firstTest=start+Math.floor(total*.5);
 let selectedNames=[];
 for(let fold=0;fold<folds;fold++){
  const foldStart=firstTest+Math.floor((total-(firstTest-start))*fold/folds);
  const foldEnd=firstTest+Math.floor((total-(firstTest-start))*(fold+1)/folds);
  if(foldEnd<=foldStart)continue;
  const trainEnd=foldStart,trainStats=Object.fromEntries(names.map(name=>[name,{n:0,hit24:0,hits:0}]));
  for(let i=start+100;i<trainEnd;i++){
   const hist=draws.slice(0,i),actual=draws[i].numbers;
   for(const name of names){const h=pickers[name](hist).filter(n=>actual.includes(n)).length,s=trainStats[name];s.n++;s.hits+=h;if(h>=2&&h<=4)s.hit24++}
  }
  const rate=s=>s.n?s.hit24/s.n:0;
  const best=names.slice().sort((x,y)=>rate(trainStats[y])-rate(trainStats[x])||(trainStats[y].hits/Math.max(1,trainStats[y].n)-trainStats[x].hits/Math.max(1,trainStats[x].n)))[0];
  selectedNames.push(best);
  for(let i=foldStart;i<foldEnd;i++){
   const hist=draws.slice(0,i),actual=draws[i].numbers;
   for(const name of names){
    const picked=pickers[name](hist),hit=picked.filter(n=>actual.includes(n)).length,s=stats[name];
    s.n++;s.hits+=hit;s.dist[hit]++;if(hit>0)s.atLeast1++;
   }
   const picked=pickers[best](hist),hit=picked.filter(n=>actual.includes(n)).length;
   adaptive.n++;adaptive.hits+=hit;adaptive.dist[hit]++;if(hit>0)adaptive.atLeast1++;
   adaptive.details.push({draw:draws[i],picked,hit,method:best,fold:fold+1});
  }
 }
 const recentRows=adaptive.details.slice(-8).reverse();
 $("#backtestRows").innerHTML=recentRows.map(x=>'<tr><td>'+x.draw.period+'<small class="muted">第'+x.fold+'段｜'+x.method+'</small></td><td><div class="table-balls">'+balls(x.picked)+'</div></td><td><div class="table-balls">'+balls(x.draw.numbers)+'</div></td><td class="hit">'+x.hit+' 顆</td></tr>').join('')||'<tr><td colspan="4">尚無驗證資料</td></tr>';
}function renderHistory(){const q=$("#searchInput").value.trim().toLowerCase(),filtered=draws.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.period.localeCompare(a.period)).filter(d=>!q||d.period.toLowerCase().includes(q)||d.date.includes(q)),pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));page=Math.min(page,pages-1);const rows=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);$("#historyRows").innerHTML=rows.map(d=>'<tr><td>'+d.period+'</td><td>'+d.date+'</td><td><div class="table-balls">'+d.numbers.map(n=>'<span class="ball">'+String(n).padStart(2,"0")+"</span>").join("")+"</div></td></tr>").join("")||'<tr><td colspan="3">查無資料</td></tr>';$("#historyCount").textContent="第 "+(page+1)+" / "+pages+" 頁 · 共 "+fmt(filtered.length)+" 筆";$("#prevPage").disabled=page===0;$("#nextPage").disabled=page>=pages-1}function render(){renderOverview();renderRecommend();renderSequence();renderStats();renderHistory()}async function load(){try{page=0;const r=await fetch("./data/daily539.json?v=20261031-4",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const j=await r.json();window.datasetUpdated=j.updatedAt;draws=(j.draws||[]).filter(d=>Array.isArray(d.numbers)&&d.numbers.length===5).sort((a,b)=>a.date.localeCompare(b.date)||a.period.localeCompare(b.period));render()}catch(e){$("#dataStatus").textContent="尚無資料";$("#mainPicks").innerHTML='<span class="empty">尚未匯入官方歷史資料，請執行 GitHub Actions 的資料更新工作。</span>';$("#historyRows").innerHTML='<tr><td colspan="3">資料集尚未建立。</td></tr>';console.error(e)}}// 全頁統一接收號碼點擊與關閉事件，支援推薦號碼及1～39完整排名。
document.addEventListener("click",e=>{
 const target=e.target instanceof Element?e.target:null;if(!target)return;
 const close=target.closest(".detail-close");
 if(close){const modal=close.closest(".number-detail-modal");if(modal)modal.hidden=true;return}
 const modal=target.closest(".number-detail-modal");
 if(modal&&target===modal){modal.hidden=true;return}
 const btn=target.closest("#recommend [data-number]");
 if(btn){const number=Number(btn.dataset.number);if(Number.isInteger(number)&&number>=1&&number<=39&&typeof window.show539NumberDetail==="function")window.show539NumberDetail(number)}
});
$("#periodSelect").addEventListener("change",renderStats);$("#backtestSelect").addEventListener("change",()=>{$("#backtestRows").innerHTML='<tr><td colspan="4">正在計算所選區間…</td></tr>';setTimeout(renderBacktest,30)});$("#loadBacktestBtn").addEventListener("click",()=>{$("#loadBacktestBtn").disabled=true;$("#loadBacktestBtn").textContent="計算中…";$("#backtestRows").innerHTML='<tr><td colspan="4">正在計算驗證紀錄，請稍候…</td></tr>';setTimeout(()=>{renderBacktest();$("#loadBacktestBtn").disabled=false;$("#loadBacktestBtn").textContent="重新載入驗證紀錄"},30)});$("#searchInput").addEventListener("input",()=>{page=0;renderHistory()});$("#prevPage").addEventListener("click",()=>{page--;renderHistory()});$("#nextPage").addEventListener("click",()=>{page++;renderHistory()});$("#refreshBtn").addEventListener("click",renderRecommend);$("#exportBtn").addEventListener("click",()=>{const lines=["期別,日期,號碼",...draws.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.period.localeCompare(a.period)).map(d=>[d.period,d.date,'"'+d.numbers.join(" ")+'"'].join(","))];const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="539-history.csv";a.click();URL.revokeObjectURL(url)});load();