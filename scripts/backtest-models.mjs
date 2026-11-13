import fs from "node:fs";

const DATA = "data/daily539.json";
const OUT = "data/model-backtest539.json";
const draws = JSON.parse(fs.readFileSync(DATA, "utf8")).draws
  .filter(d => Array.isArray(d.numbers) && d.numbers.length === 5)
  .sort((a, b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period));
const BASE = 5 / 39;
const TEST_SIZE = Math.min(3000, draws.length - 365);
const START = draws.length - TEST_SIZE;
const WINDOW = [30, 90, 180, 365];

function exactBaseline() {
  const choose = (n, k) => { let x = 1; for (let i = 1; i <= k; i++) x = x * (n - i + 1) / i; return x; };
  const p = h => choose(5, h) * choose(34, 5 - h) / choose(39, 5);
  return {
    averageHits: 25 / 39,
    atLeast1: 1 - p(0),
    atLeast2: 1 - p(0) - p(1),
    atLeast3: 1 - p(0) - p(1) - p(2)
  };
}

function rank(drawIndex, weights, gapWeight = 0) {
  const z = Array(40).fill(0);
  WINDOW.forEach((w, wi) => {
    const weight = weights[wi];
    if (!weight) return;
    const from = Math.max(0, drawIndex - w), size = drawIndex - from;
    const counts = Array(40).fill(0);
    for (let i = from; i < drawIndex; i++) for (const n of draws[i].numbers) counts[n]++;
    for (let n = 1; n <= 39; n++) {
      const p = (counts[n] + 5) / (size + 39);
      const se = Math.sqrt(BASE * (1 - BASE) / (size + 39));
      z[n] += weight * (p - BASE) / se;
    }
  });
  let last = Array(40).fill(-1);
  for (let i = drawIndex - 1; i >= 0; i--) {
    for (const n of draws[i].numbers) if (last[n] < 0) last[n] = drawIndex - 1 - i;
  }
  const maxGap = Math.max(1, ...last.slice(1));
  return Array.from({ length: 39 }, (_, i) => i + 1)
    .map(n => ({ n, score: z[n] + gapWeight * Math.min(2, (last[n] < 0 ? drawIndex : last[n]) / maxGap) }))
    .sort((a, b) => b.score - a.score || Math.abs(a.n - 20) - Math.abs(b.n - 20) || a.n - b.n)
    .slice(0, 5).map(x => x.n);
}

function subsets(nums) {
  const out = [];
  for (let i = 0; i < nums.length; i++) out.push([nums[i]]);
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) out.push([nums[i], nums[j]]);
  for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) for (let k = j + 1; k < nums.length; k++) out.push([nums[i], nums[j], nums[k]]);
  return out;
}
const LAGS = [1, 2, 3, 5], LAG_WEIGHTS = [.34, .26, .22, .18];
function newCurrentState() { return { maps: LAGS.map(() => new Map()) }; }
function addTransition(state, t) {
  LAGS.forEach((lag, li) => {
    if (t < lag) return;
    const prev = draws[t - lag].numbers, next = draws[t].numbers, map = state.maps[li];
    for (const pattern of subsets(prev)) {
      const key = pattern.join(",");
      let stat = map.get(key);
      if (!stat) { stat = { support: 0, hits: Array(40).fill(0), size: pattern.length }; map.set(key, stat); }
      stat.support++;
      for (const n of next) stat.hits[n]++;
    }
  });
}
function currentModelRank(i, state) {
  const len = i, candidates = Array.from({ length: 39 }, (_, j) => j + 1);
  const fz = (n, windows, weights) => {
    let z = 0;
    windows.forEach((w, wi) => {
      const from = Math.max(0, len - w), size = len - from;
      let count = 0;
      for (let t = from; t < len; t++) if (draws[t].numbers.includes(n)) count++;
      const p = (count + 5) / (size + 39);
      const se = Math.sqrt(BASE * (1 - BASE) / (size + 39));
      z += weights[wi] * (p - BASE) / se;
    });
    return z;
  };
  const z30 = candidates.map(n => fz(n,[30],[1]));
  const z90 = candidates.map(n => fz(n,[90],[1]));
  const z365 = candidates.map(n => fz(n,[365],[1]));
  const adv = candidates.map(n => fz(n,[30,90,180,365],[.34,.29,.22,.15]));
  const last = Array(40).fill(-1);
  for (let t=len-1;t>=0;t--) for(const n of draws[t].numbers) if(last[n]<0) last[n]=len-1-t;
  const maxGap=Math.max(1,...last.slice(1)), link=Array(40).fill(0);
  LAGS.forEach((lag,li)=>{
    if(len<=lag)return;
    const patterns=subsets(draws[len-lag].numbers),map=state.maps[li];
    for(const pattern of patterns){
      const stat=map.get(pattern.join(",")); if(!stat)continue;
      const alpha=stat.size===1?25:stat.size===2?60:100;
      const reliability=Math.min(1,stat.support/(stat.support+alpha));
      for(let n=1;n<=39;n++){
        const posterior=(stat.hits[n]+alpha*BASE)/(stat.support+alpha);
        const lift=(posterior-BASE)/BASE;
        const contribution=Math.max(-1.5,Math.min(2.5,lift))*reliability;
        link[n]+=LAG_WEIGHTS[li]*contribution/patterns.length;
      }
    }
  });
  return candidates.map((n,j)=>{
    const trend=.40*z30[j]+.30*z90[j]+.30*z365[j];
    const omission=Math.min(2,(last[n]<0?len:last[n])/maxGap);
    return {n,score:.52*link[n]+.30*trend+.08*omission+.10*adv[j]};
  }).sort((a,b)=>b.score-a.score||Math.abs(a.n-20)-Math.abs(b.n-20)||a.n-b.n).slice(0,5).map(x=>x.n);
}
const models = [
  { id: "recent30", label: "近30期頻率", weights: [1, 0, 0, 0] },
  { id: "recent90", label: "近90期頻率", weights: [0, 1, 0, 0] },
  { id: "long365", label: "近365期頻率", weights: [0, 0, 0, 1] },
  { id: "balanced", label: "30/90/365融合", weights: [.4, .3, 0, .3] },
  { id: "longBlend", label: "短中長期融合", weights: [.25, .25, .2, .3] },
  { id: "momentum", label: "短期動能", weights: [1, -.5, 0, 0] },
  { id: "frequencyGap", label: "頻率＋遺漏", weights: [.4, .3, 0, .3], gapWeight: .1 },
  { id: "gapOnly", label: "單純遺漏", weights: [0, 0, 0, 0], gapWeight: 1 }
];

function blank() { return { periods: 0, totalHits: 0, distribution: [0,0,0,0,0,0], ge1: 0, ge2: 0, ge3: 0, overlapTotal: 0, overlapCount: 0 }; }
function add(m, hit, overlap = null) { m.periods++; m.totalHits += hit; m.distribution[hit]++; if (hit >= 1) m.ge1++; if (hit >= 2) m.ge2++; if (hit >= 3) m.ge3++; if (overlap !== null) { m.overlapTotal += overlap; m.overlapCount++; } }
function summary(m) {
  return {
    periods: m.periods,
    averageHits: Number((m.totalHits / m.periods).toFixed(4)),
    atLeast1Pct: Number((100 * m.ge1 / m.periods).toFixed(2)),
    atLeast2Pct: Number((100 * m.ge2 / m.periods).toFixed(2)),
    atLeast3Pct: Number((100 * m.ge3 / m.periods).toFixed(2)),
    hitDistribution: m.distribution,
    averageOverlapPreviousPick: m.overlapCount ? Number((m.overlapTotal / m.overlapCount).toFixed(3)) : null
  };
}

const result = {};
const currentTotal = blank(), currentSegments = [blank(), blank(), blank()];
let previousCurrentPicks = null;
const currentState = newCurrentState();
for (let t = 0; t < START; t++) addTransition(currentState, t);
for (let i = START; i < draws.length; i++) {
  const picks = currentModelRank(i, currentState), actual = new Set(draws[i].numbers);
  const hits = picks.filter(n => actual.has(n)).length;
  const overlap = previousCurrentPicks ? picks.filter(n => previousCurrentPicks.includes(n)).length : null;
  add(currentTotal, hits, overlap);
  const segment = Math.min(2, Math.floor((i - START) / Math.ceil(TEST_SIZE / 3)));
  add(currentSegments[segment], hits, overlap);
  previousCurrentPicks = picks;
  addTransition(currentState, i);
}
for (const model of models) {
  const total = blank(), segments = [blank(), blank(), blank()];
  let previousPicks = null;
  for (let i = START; i < draws.length; i++) {
    const picks = rank(i, model.weights, model.gapWeight || 0);
    const actual = new Set(draws[i].numbers);
    const hits = picks.filter(n => actual.has(n)).length;
    const overlap = previousPicks ? picks.filter(n => previousPicks.includes(n)).length : null;
    add(total, hits, overlap);
    const segment = Math.min(2, Math.floor((i - START) / Math.ceil(TEST_SIZE / 3)));
    add(segments[segment], hits, overlap);
    previousPicks = picks;
  }
  result[model.id] = { label: model.label, overall: summary(total), segments: segments.map(summary) };
}

result.currentMultifactor = { label: "現行正式多因子模型（原公式逐期重播）", overall: summary(currentTotal), segments: currentSegments.map(summary) };

const report = {
  version: "rolling-539-lab-v1",
  dataThrough: draws.at(-1).date,
  dataPeriod: draws.at(-1).period,
  historyCount: draws.length,
  testPeriodCount: TEST_SIZE,
  testFrom: draws[START].date,
  testTo: draws.at(-1).date,
  selectionRule: "每期只使用該期開獎前已知資料；依分數排序選前5碼；沒有使用當期結果。",
  randomBaseline: exactBaseline(),
  models: result
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== serialized) fs.writeFileSync(OUT, serialized);
for (const model of models) {
  const x = result[model.id].overall;
  console.log(model.id, "avg", x.averageHits, ">=1", x.atLeast1Pct, ">=2", x.atLeast2Pct, ">=3", x.atLeast3Pct);
}
console.log("Backtest saved:", OUT, "periods:", TEST_SIZE);
