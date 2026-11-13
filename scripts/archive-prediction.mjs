import fs from "node:fs";

const DATA = "data/daily539.json";
const OUT = "data/predictions539.json";
const MODEL_VERSION = "multifactor-v1.1-archived";
const baseRate = 5 / 39;

function gaps(draws) {
  const gap = Array(40).fill(draws.length);
  const seen = new Set();
  for (let i = draws.length - 1; i >= 0 && seen.size < 39; i--) {
    for (const n of draws[i].numbers) {
      if (!seen.has(n)) { seen.add(n); gap[n] = draws.length - 1 - i; }
    }
  }
  return gap;
}

function advancedRanking(draws) {
  const windows = [30, 90, 180, 365], weights = [.34, .29, .22, .15], out = [];
  for (let n = 1; n <= 39; n++) {
    let z = 0;
    windows.forEach((w, i) => {
      const sample = draws.slice(-Math.min(w, draws.length));
      const count = sample.reduce((s, d) => s + Number(d.numbers.includes(n)), 0);
      const p = (count + 5) / (sample.length + 39);
      const se = Math.sqrt(baseRate * (1 - baseRate) / (sample.length + 39));
      z += (se ? (p - baseRate) / se : 0) * weights[i];
    });
    let opportunities = 0, hits = 0;
    for (let i = 0; i < draws.length - 1; i++) {
      if (draws[i].numbers.some(x => Math.abs(x - n) === 1)) {
        opportunities++;
        if (draws[i + 1].numbers.includes(n)) hits++;
      }
    }
    const conditional = (hits + 5) / (opportunities + 39);
    const se = Math.sqrt(baseRate * (1 - baseRate) / (opportunities + 39));
    const cz = se ? (conditional - baseRate) / se : 0;
    out.push({ n, frequencyZ: z, score: z * .82 + Math.max(-2, Math.min(2, cz)) * .18 });
  }
  return out.sort((a, b) => b.score - a.score || Math.abs(a.n - 20) - Math.abs(b.n - 20) || a.n - b.n);
}

function multiFactorRanking(draws) {
  const candidates = Array.from({ length: 39 }, (_, i) => i + 1), len = draws.length;
  if (len < 30) return candidates.map(n => ({ n, score: 0 }));
  const freqWindow = w => {
    const sample = draws.slice(-Math.min(w, len));
    return candidates.map(n => {
      const k = sample.reduce((s, d) => s + Number(d.numbers.includes(n)), 0);
      const p = (k + 5) / (sample.length + 39);
      return (p - baseRate) / Math.sqrt(baseRate * (1 - baseRate) / (sample.length + 39));
    });
  };
  const z30 = freqWindow(30), z90 = freqWindow(90), z365 = freqWindow(365), gap = gaps(draws);
  const lags = [1, 2, 3, 5], lagWeights = [.34, .26, .22, .18];
  const linkScores = Array(40).fill(0);
  const subsets = nums => {
    const out = [];
    for (let i = 0; i < nums.length; i++) out.push([nums[i]]);
    for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) out.push([nums[i], nums[j]]);
    for (let i = 0; i < nums.length; i++) for (let j = i + 1; j < nums.length; j++) for (let k = j + 1; k < nums.length; k++) out.push([nums[i], nums[j], nums[k]]);
    return out;
  };
  lags.forEach((lag, li) => {
    if (len <= lag) return;
    const patterns = subsets(draws[len - lag].numbers);
    for (const pattern of patterns) {
      let support = 0;
      const hits = Array(40).fill(0);
      for (let i = lag; i < len; i++) {
        const prev = draws[i - lag].numbers;
        if (!pattern.every(n => prev.includes(n))) continue;
        support++;
        for (const n of draws[i].numbers) hits[n]++;
      }
      const alpha = pattern.length === 1 ? 25 : pattern.length === 2 ? 60 : 100;
      const reliability = Math.min(1, support / (support + alpha));
      for (let n = 1; n <= 39; n++) {
        const posterior = (hits[n] + alpha * baseRate) / (support + alpha);
        const lift = (posterior - baseRate) / baseRate;
        const contribution = Math.max(-1.5, Math.min(2.5, lift)) * reliability;
        linkScores[n] += lagWeights[li] * contribution / patterns.length;
      }
    }
  });
  const maxGap = Math.max(1, ...gap.slice(1)), advanced = advancedRanking(draws);
  const adv = new Map(advanced.map(x => [x.n, x.frequencyZ]));
  return candidates.map((n, i) => {
    const trend = .40 * z30[i] + .30 * z90[i] + .30 * z365[i];
    const omission = Math.min(2, gap[n] / maxGap);
    const score = .52 * linkScores[n] + .30 * trend + .08 * omission + .10 * adv.get(n);
    return { n, score: Number(score.toFixed(8)), linkScore: Number(linkScores[n].toFixed(8)), trend: Number(trend.toFixed(8)), omission: Number(omission.toFixed(8)) };
  }).sort((a, b) => b.score - a.score || Math.abs(a.n - 20) - Math.abs(b.n - 20) || a.n - b.n);
}

function main() {
  const source = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const draws = (source.draws || []).filter(d => Array.isArray(d.numbers) && d.numbers.length === 5)
    .sort((a, b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period));
  if (draws.length < 150) throw new Error("歷史資料不足，至少需要 150 期才建立正式預測紀錄。");
  let archive = { modelVersion: MODEL_VERSION, updatedAt: null, predictions: [] };
  if (fs.existsSync(OUT)) {
    try { archive = { ...archive, ...JSON.parse(fs.readFileSync(OUT, "utf8")) }; } catch {}
  }
  archive.predictions ||= [];
  let changed = false;

  // 先用最新官方開獎結果結算上一筆預測；不回填或捏造過去的 ChatGPT 推薦。
  for (const prediction of archive.predictions) {
    if (prediction.result) continue;
    const actual = draws.find(d => d.date > prediction.sourceDate ||
      (d.date === prediction.sourceDate && d.period > prediction.sourcePeriod));
    if (actual) {
      const actualSet = new Set(actual.numbers);
      prediction.result = {
        period: actual.period, date: actual.date, numbers: actual.numbers,
        hits: prediction.top5.filter(n => actualSet.has(n)),
        hitCount: prediction.top5.filter(n => actualSet.has(n)).length,
        settledAt: new Date().toISOString()
      };
      changed = true;
    }
  }

  const latest = draws.at(-1);
  const exists = archive.predictions.some(p => p.sourcePeriod === latest.period);
  if (!exists) {
    const ranking = multiFactorRanking(draws);
    archive.predictions.push({
      id: latest.period + "-" + MODEL_VERSION,
      modelVersion: MODEL_VERSION,
      createdAt: new Date().toISOString(),
      target: "next-draw",
      sourcePeriod: latest.period,
      sourceDate: latest.date,
      top5: ranking.slice(0, 5).map(x => x.n),
      backup5: ranking.slice(5, 10).map(x => x.n),
      ranking: ranking.map((x, i) => ({ rank: i + 1, number: x.n, score: x.score, linkScore: x.linkScore, trend: x.trend, omission: x.omission }))
    });
    changed = true;
  }
  archive.modelVersion = MODEL_VERSION;
  if (!changed) { console.log("預測存檔無變動，略過寫檔，避免觸發無限部署。"); return; }
  archive.updatedAt = new Date().toISOString();
  archive.predictions.sort((a, b) => a.sourceDate.localeCompare(b.sourceDate) || a.sourcePeriod.localeCompare(b.sourcePeriod));
  fs.writeFileSync(OUT, JSON.stringify(archive, null, 2) + "\n");
  const settled = archive.predictions.filter(p => p.result);
  const avg = settled.length ? (settled.reduce((s, p) => s + p.result.hitCount, 0) / settled.length).toFixed(3) : "尚無";
  console.log("預測紀錄", archive.predictions.length, "筆；已結算", settled.length, "筆；平均命中", avg, "；最新來源期別", latest.period);
}
main();
