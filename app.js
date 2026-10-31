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
function advancedPick(a){
 const base=5/39,windows=[30,90,180,365],scores=[];
 const limit=a.length;
 for(let n=1;n<=39;n++){
  let z=0,parts=[];
  windows.forEach((w,i)=>{
   const sample=a.slice(-Math.min(w,limit)),count=sample.reduce((s,d)=>s+(d.numbers.includes(n)?1:0),0);
   const post=(count+5)/(sample.length+39),se=Math.sqrt(base*(1-base)/(sample.length+39));
   const v=se?(post-base)/se:0;z+=v*[.34,.29,.22,.15][i];parts.push({w,count,rate:post});
  });
  let opportunities=0,hits=0;
  for(let i=0;i<limit-1;i++){
   const prev=a[i].numbers;
   if(prev.some(x=>Math.abs(x-n)===1)){opportunities++;if(a[i+1].numbers.includes(n))hits++}
  }
  const conditional=(hits+5)/(opportunities+39),cse=Math.sqrt(base*(1-base)/(opportunities+39));
  const cz=cse?(conditional-base)/cse:0;
  const score=z*.82+Math.max(-2,Math.min(2,cz))*.18;
  scores.push({n,score,parts,opportunities,hits,conditional});
 }
 return scores.sort((x,y)=>y.score-x.score||Math.abs(x.n-20)-Math.abs(y.n-20)||x.n-y.n).slice(0,5).map(x=>x.n);
}
const weights={neighbor:25,transition:15,hot:15,total:10,gap:10,cold:5,tail:10,structure:10};function ranking(a){const m=models(a),sum=Object.values(weights).reduce((x,y)=>x+y,0);return Array.from({length:39},(_,i)=>{let n=i+1,s=Object.keys(weights).reduce((v,k)=>v+weights[k]/sum*m[k][n],0);return{n,score:s}}).sort((x,y)=>y.score-x.score||x.n-y.n)}function recommendations(a){if(a.length<100)return null;let r=ranking(a);return{main:r.slice(0,5).map(x=>x.n).sort((x,y)=>x-y),alt:r.slice(5,10).map(x=>x.n).sort((x,y)=>x-y),rank:r}}function renderOverview(){const last=draws.at(-1),first=draws[0];$("#totalDraws").textContent=fmt(draws.length);$("#latestPeriod").textContent=last?.period||"—";$("#latestDate").textContent=last?.date||"尚無紀錄";$("#dateRange").textContent=first&&last?first.date+" — "+last.date:"尚未建立";$("#updatedAt").textContent=window.datasetUpdated?new Date(window.datasetUpdated).toLocaleString("zh-TW"):"尚未同步";$("#dataStatus").textContent=draws.length?"資料可用":"等待資料";if(last){const f=freq(draws.slice(-30));let hot=Array.from({length:39},(_,i)=>i+1).sort((a,b)=>f[b]-f[a]||a-b).slice(0,3);$("#hotNumber").textContent=hot.map(n=>String(n).padStart(2,"0")).join(" · ")}}function renderRecommend(){
 if(draws.length<150){$("#mainPicks").innerHTML='<span class="empty">資料不足，至少需要 150 期才能進行方法驗證。</span>';return}
 const sample=draws.slice(-1000),split=Math.max(100,Math.floor(sample.length*.7)),train=sample.slice(0,split),test=sample.slice(split);
 const pickers={
  "近期熱號":a=>{const f=freq(a.slice(-30));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>f[y]-f[x]||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "遺漏值":a=>{const g=gaps(a);return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>g[y]-g[x]||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "前後號±1":a=>{const s=new Set(a.at(-1).numbers.flatMap(n=>[n-1,n+1]).filter(n=>n>=1&&n<=39));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(s.has(y)?1:0)-(s.has(x)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "隔期重複":a=>a.at(-1).numbers.slice(),
  "尾數延伸":a=>{const tails=new Set(a.at(-1).numbers.map(n=>n%10));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(tails.has(y%10)?1:0)-(tails.has(x%10)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "算術變化":a=>{const s=new Set(a.at(-1).numbers.flatMap(n=>[n-1,n+1,40-n,((n*2-1)%39)+1,((n*3-1)%39)+1,((n+19-1)%39)+1]).filter(n=>n>=1&&n<=39));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(s.has(y)?1:0)-(s.has(x)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "貝葉斯融合模型":advancedPick,"綜合模型":a=>recommendations(a)?.main||[]
 };
 const names=Object.keys(pickers),stats=Object.fromEntries(names.map(n=>[n,{n:0,hit24:0,hits:0}]));
 for(let i=100;i<train.length;i++){const hist=train.slice(0,i),actual=train[i].numbers;for(const name of names){const hit=pickers[name](hist).filter(n=>actual.includes(n)).length,s=stats[name];s.n++;s.hits+=hit;if(hit>=2&&hit<=4)s.hit24++}}
 const rate=s=>s.n?s.hit24/s.n:0;
 const best=names.slice().sort((a,b)=>rate(stats[b])-rate(stats[a])||(stats[b].hits/stats[b].n-stats[a].hits/stats[a].n))[0];
 let testN=0,test24=0;for(let i=0;i<test.length;i++){const hist=sample.slice(0,split+i),hit=pickers[best](hist).filter(n=>n===0?false:test[i].numbers.includes(n)).length;testN++;if(hit>=2&&hit<=4)test24++}
 const main=pickers[best](draws).slice().sort((a,b)=>a-b),used=new Set(main),alt=ranking(draws).map(x=>x.n).filter(n=>!used.has(n)).slice(0,5).sort((a,b)=>a-b);
 $("#mainPicks").innerHTML=balls(main);$("#altPicks").innerHTML=balls(alt);
 const last=draws.at(-1),f30=freq(draws.slice(-30)),f100=freq(draws.slice(-100)),g=gaps(draws);
 const reasonFor=n=>{
  const prev=last.numbers,near=prev.filter(x=>Math.abs(x-n)===1);
  const tailCount=prev.filter(x=>x%10===n%10).length;
  if(best==="前後號±1")return near.length?"前一期 "+near.map(x=>String(x).padStart(2,"0")).join("、")+" 的前後號":"前後號候選排序入選";
  if(best==="近期熱號")return "近30期出現 "+f30[n]+" 次";
  if(best==="遺漏值")return "目前遺漏 "+g[n]+" 期";
  if(best==="隔期重複")return "前一期開出號碼延續觀察";
  if(best==="尾數延伸")return tailCount?"前一期有 "+tailCount+" 個相同尾數":"尾數候選排序入選";
  if(best==="算術變化")return "符合前期號碼衍生的算術候選";
  if(best==="貝葉斯融合模型")return "多視窗頻率＋前期鄰號條件機率的收縮估計";
  return "綜合模型排序入選";
 };
 let reasonBox=$("#pickReasons");
 if(!reasonBox){reasonBox=document.createElement("div");reasonBox.id="pickReasons";reasonBox.className="panel";$("#recommend").appendChild(reasonBox)}
 reasonBox.innerHTML='<div class="panel-head"><b>本期五碼入選原因</b><span class="muted">依 '+best+' 策略｜截至 '+last.date+'</span></div><div class="table-wrap"><table><thead><tr><th>號碼</th><th>策略依據</th><th>近30期</th><th>近100期</th><th>目前遺漏</th></tr></thead><tbody>'+main.map(n=>'<tr><td><b>'+String(n).padStart(2,"0")+'</b></td><td>'+reasonFor(n)+'</td><td>'+f30[n]+' 次</td><td>'+f100[n]+' 次</td><td>'+g[n]+' 期</td></tr>').join("")+'</tbody></table></div><small class="muted">頻率與遺漏值是歷史描述，不代表下一期開出機率較高；同一策略下的候選排序只用於模型比較。</small>';
 const rateText=testN?(test24/testN*100).toFixed(1)+"%":"樣本不足";
 $("#recommendBasis").textContent="訓練區段優選："+best+"｜保留驗證區段 "+rateText;
 $("#sampleCount").textContent=fmt(draws.length)+" 期歷史資料";
 const pill=document.querySelector(".recommend-card .pill");if(pill)pill.textContent="回測優選 TOP 5";
 const tf=tailFreq(draws.slice(-100)),sizes=[3,4,4,4,4,4,4,4,4,4];let tr=tf.map((v,i)=>({tail:i,score:v/sizes[i]})).sort((a,b)=>b.score-a.score).slice(0,3);
 $("#tailRanks").innerHTML=tr.map(x=>'<div class="tail-item"><b>'+x.tail+" 尾</b><small>"+x.score.toFixed(1)+" 次/號</small></div>").join("")
}function renderSequence(){/* 已簡化：詳細條件關聯不再佔用首頁版面 */}
function renderStats(){const a=recent(draws,$("#periodSelect").value),f=freq(a),max=Math.max(...f.slice(1),1),g=gaps(draws);$("#frequencyGrid").innerHTML=Array.from({length:39},(_,i)=>{let n=i+1,v=f[n];return'<div class="freq-item '+(v>=max*.8?"hot":"")+'"><b>'+String(n).padStart(2,"0")+'</b><span>'+v+" 次</span></div>"}).join("");let t=tailFreq(a),tm=Math.max(...t,1);$("#tailChart").innerHTML=t.map((v,i)=>'<div class="tail-col"><b>'+v+'</b><div class="tail-bar" style="height:'+Math.max(3,v/tm*88)+'px"></div><small>'+i+" 尾</small></div>").join("");let top=Array.from({length:39},(_,i)=>i+1).sort((x,y)=>g[y]-g[x]).slice(0,16);$("#gapList").innerHTML=top.map(n=>'<div class="gap-item"><b>'+String(n).padStart(2,"0")+'</b><small>'+g[n]+" 期</small></div>").join("")}function renderBacktest(){
 const requested=Number($("#backtestSelect").value),start=Math.max(100,draws.length-requested),total=draws.length-start;
 if(total<20){$("#btSamples").textContent="資料不足";$("#btAverage").textContent="—";$("#btOne").textContent="—";return}
 const split=start+Math.floor(total*.7),names=["近期熱號","遺漏值","前後號±1","隔期重複","尾數延伸","算術變化","貝葉斯融合模型","綜合模型"];
 const pickers={
  "近期熱號":a=>{const f=freq(a.slice(-30));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>f[y]-f[x]||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "遺漏值":a=>{const g=gaps(a);return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>g[y]-g[x]||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "前後號±1":a=>{const s=new Set(a.at(-1).numbers.flatMap(n=>[n-1,n+1]).filter(n=>n>=1&&n<=39));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(s.has(y)?1:0)-(s.has(x)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "隔期重複":a=>a.at(-1).numbers.slice(),
  "尾數延伸":a=>{const tails=new Set(a.at(-1).numbers.map(n=>n%10));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(tails.has(y%10)?1:0)-(tails.has(x%10)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "算術變化":a=>{const s=new Set(a.at(-1).numbers.flatMap(n=>[n-1,n+1,40-n,((n*2-1)%39)+1,((n*3-1)%39)+1,((n+19-1)%39)+1]).filter(n=>n>=1&&n<=39));return Array.from({length:39},(_,i)=>i+1).sort((x,y)=>(s.has(y)?1:0)-(s.has(x)?1:0)||Math.abs(x-20)-Math.abs(y-20)||x-y).slice(0,5)},
  "綜合模型":a=>recommendations(a)?.main||[]
 };
 const blank=()=>({n:0,hits:0,atLeast1:0,dist:Array(6).fill(0),details:[]});
 const stats=Object.fromEntries(names.map(name=>[name,{train:blank(),test:blank()}]));
 for(let i=start;i<draws.length;i++){
  const hist=draws.slice(0,i),actual=draws[i].numbers,part=i<split?"train":"test";
  names.forEach(name=>{const picked=pickers[name](hist),hit=picked.filter(n=>actual.includes(n)).length,s=stats[name][part];s.n++;s.hits+=hit;s.dist[hit]++;if(hit>0)s.atLeast1++;if(part==="test")s.details.push({draw:draws[i],picked,hit})});
 }
 const score=s=>s.n?(s.dist[2]+s.dist[3]+s.dist[4])/s.n:0;
 const best=names.slice().sort((x,y)=>score(stats[y].train)-score(stats[x].train)||(stats[y].train.hits/Math.max(1,stats[y].train.n)-stats[x].train.hits/Math.max(1,stats[x].train.n)))[0];
 const result=stats[best].test,random24=0.11397,fmtPct=x=>(x*100).toFixed(1)+"%";
 $("#btSamples").textContent=fmt(result.n);$("#btAverage").textContent=result.n?(result.hits/result.n).toFixed(3):"—";$("#btOne").textContent=result.n?fmtPct(result.atLeast1/result.n):"—";
 const panel=$("#backtestRows").closest(".panel");let box=$("#backtestCompare");if(!box){box=document.createElement("div");box.id="backtestCompare";panel.insertAdjacentElement("beforebegin",box)}
 box.className="panel";box.innerHTML='<div class="panel-head"><b>2～4 顆命中驗證</b><span class="muted">先用前 70% 挑方法，再用後 30% 驗證</span></div>'+
 '<div class="backtest-summary"><div><small>訓練期選出的方法</small><strong>'+best+'</strong></div><div><small>驗證期命中 2～4 顆</small><strong>'+fmt(result.dist[2]+result.dist[3]+result.dist[4])+' 期／'+fmtPct(score(result))+'</strong></div><div><small>隨機選 5 號理論值</small><strong>11.4%</strong></div></div>'+
 '<div class="table-wrap"><table><thead><tr><th>方法</th><th>命中2顆</th><th>命中3顆</th><th>命中4顆</th><th>2～4顆合計</th><th>平均命中</th></tr></thead><tbody>'+
 names.map(name=>{const s=stats[name].test;return '<tr'+(name===best?' class="hit"':'')+'><td><b>'+name+'</b></td><td>'+s.dist[2]+' 期</td><td>'+s.dist[3]+' 期</td><td>'+s.dist[4]+' 期</td><td><b>'+fmt(s.dist[2]+s.dist[3]+s.dist[4])+' 期（'+fmtPct(score(s))+'）</b></td><td>'+(s.n?(s.hits/s.n).toFixed(3):"—")+'</td></tr>'}).join('')+
 '</tbody></table></div><small>驗證流程：前 70% 歷史資料只負責挑選方法；後 30% 完全保留作測試，避免拿測試答案回頭調參。公平隨機選 5 號，命中 2～4 顆的理論比例約 11.4%。若模型未高於此值，就不宣稱有優勢。</small>';
 const recentRows=result.details.slice(-8).reverse();$("#backtestRows").innerHTML=recentRows.map(x=>'<tr><td>'+x.draw.period+'</td><td><div class="table-balls">'+balls(x.picked)+'</div></td><td><div class="table-balls">'+balls(x.draw.numbers)+'</div></td><td class="hit">'+x.hit+' 顆</td></tr>').join('')||'<tr><td colspan="4">尚無驗證資料</td></tr>';
}
function renderHistory(){const q=$("#searchInput").value.trim().toLowerCase(),filtered=draws.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.period.localeCompare(a.period)).filter(d=>!q||d.period.toLowerCase().includes(q)||d.date.includes(q)),pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));page=Math.min(page,pages-1);const rows=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);$("#historyRows").innerHTML=rows.map(d=>'<tr><td>'+d.period+'</td><td>'+d.date+'</td><td><div class="table-balls">'+d.numbers.map(n=>'<span class="ball">'+String(n).padStart(2,"0")+"</span>").join("")+"</div></td></tr>").join("")||'<tr><td colspan="3">查無資料</td></tr>';$("#historyCount").textContent="第 "+(page+1)+" / "+pages+" 頁 · 共 "+fmt(filtered.length)+" 筆";$("#prevPage").disabled=page===0;$("#nextPage").disabled=page>=pages-1}function render(){renderOverview();renderRecommend();renderSequence();renderStats();renderBacktest();renderHistory()}async function load(){try{page=0;const r=await fetch("./data/daily539.json?v=20261031-4",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const j=await r.json();window.datasetUpdated=j.updatedAt;draws=(j.draws||[]).filter(d=>Array.isArray(d.numbers)&&d.numbers.length===5).sort((a,b)=>a.date.localeCompare(b.date)||a.period.localeCompare(b.period));render()}catch(e){$("#dataStatus").textContent="尚無資料";$("#mainPicks").innerHTML='<span class="empty">尚未匯入官方歷史資料，請執行 GitHub Actions 的資料更新工作。</span>';$("#historyRows").innerHTML='<tr><td colspan="3">資料集尚未建立。</td></tr>';console.error(e)}}$("#periodSelect").addEventListener("change",renderStats);$("#backtestSelect").addEventListener("change",renderBacktest);$("#searchInput").addEventListener("input",()=>{page=0;renderHistory()});$("#prevPage").addEventListener("click",()=>{page--;renderHistory()});$("#nextPage").addEventListener("click",()=>{page++;renderHistory()});$("#refreshBtn").addEventListener("click",renderRecommend);$("#exportBtn").addEventListener("click",()=>{const lines=["期別,日期,號碼",...draws.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.period.localeCompare(a.period)).map(d=>[d.period,d.date,'"'+d.numbers.join(" ")+'"'].join(","))];const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="539-history.csv";a.click();URL.revokeObjectURL(url)});load();