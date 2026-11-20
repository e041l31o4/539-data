import fs from "node:fs";

const DATA = "data/daily539.json";
const OUT = "data/predictions539.json";
const MODEL_VERSION = "twohit-priority-v1.3.1-position-drag-archived";
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


function positionDragRanking(draws) {
  const len = draws.length, latest = draws.at(-1), base = 5 / 39;
  const candidates = Array.from({ length: 39 }, (_, i) => i + 1);
  if (len < 40 || !latest) return candidates.map((n, i) => ({ n, score: 0, rank: i + 1 }));
  const horizonWeights = [.34, .26, .18, .13, .09], scores = Array(40).fill(0);
  const add = (position, trigger, lag, weight, calendar = false) => {
    let opportunities = 0;
    const hits = Array(40).fill(0);
    const byDate = calendar ? new Map(draws.map((d, i) => [d.date, i])) : null;
    for (let i = 0; i < len - 1; i++) {
      let targetIndex = i + lag;
      if (calendar) {
        const dt = new Date(draws[i].date + "T00:00:00Z");
        dt.setUTCDate(dt.getUTCDate() + 1);
        targetIndex = byDate.get(dt.toISOString().slice(0, 10));
      }
      if (targetIndex === undefined || targetIndex >= len - 1) continue;
      const source = draws[i];
      const match = position === 0 ? source.numbers.includes(trigger) : source.numbers[position - 1] === trigger;
      if (!match) continue;
      opportunities++;
      for (const n of draws[targetIndex].numbers) hits[n]++;
    }
    const alpha = 25;
    for (let n = 1; n <= 39; n++) {
      const posterior = (hits[n] + alpha * base) / (opportunities + alpha);
      const se = Math.sqrt(base * (1 - base) / (opportunities + alpha));
      const z = se ? (posterior - base) / se : 0;
      scores[n] += weight * Math.max(-2, Math.min(2, z));
    }
  };
  // All five official ascending-sorted positions and horizons 1-5.
  for (let p = 1; p <= 5; p++) {
    for (let lag = 1; lag <= 5; lag++) add(p, latest.numbers[p - 1], lag, .75 / 5 * horizonWeights[lag - 1]);
  }
  // Current draw's five numbers as position-independent triggers.
  for (const trigger of latest.numbers) {
    for (let lag = 1; lag <= 5; lag++) add(0, trigger, lag, .10 / 5 * horizonWeights[lag - 1]);
  }
  // Exact calendar D+1 pairs, only when the following date has an official draw.
  for (let p = 1; p <= 5; p++) add(p, latest.numbers[p - 1], 1, .15 / 5, true);
  return candidates.map(n => ({ n, score: scores[n] }))
    .sort((a, b) => b.score - a.score || Math.abs(a.n - 20) - Math.abs(b.n - 20) || a.n - b.n)
    .map((x, i) => ({ ...x, rank: i + 1 }));
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
  const baseRanking = candidates.map((n, i) => {
    const trend = .40 * z30[i] + .30 * z90[i] + .30 * z365[i];
    const omission = Math.min(2, gap[n] / maxGap);
    const baseScore = .30 * trend + .08 * omission + .10 * (adv.get(n) || 0);
    return { n, baseScore, trend, omission, linkScore: linkScores[n] };
  }).sort((a, b) => b.baseScore - a.baseScore || Math.abs(a.n - 20) - Math.abs(b.n - 20) || a.n - b.n);
  const drag = positionDragRanking(draws);
  const baseRank = new Map(baseRanking.map((x, i) => [x.n, (39 - i) / 38]));
  const dragMap = new Map(drag.map(x => [x.n, x]));
  return candidates.map(n => {
    const d = dragMap.get(n);
    return { ...baseRanking.find(x => x.n === n), score: .95 * baseRank.get(n) + .05 * ((39 - d.rank) / 38), dragScore: d.score, dragRank: d.rank };
  }).sort((a, b) => b.score - a.score || Math.abs(a.n - 20) - Math.abs(b.n - 20) || a.n - b.n);
}


function experimentalRankings(draws, formalRanking, previousTop5 = []) {
  const advanced = new Map(advancedRanking(draws).map(x => [x.n, x.frequencyZ]));
  const twoStar = formalRanking.map(x => ({
    n: x.n,
    score: .30 * x.trend + .08 * x.omission + .10 * (advanced.get(x.n) || 0)
  })).sort((a, b) => b.score - a.score || a.n - b.n);

  const scores = formalRanking.map(x => x.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length) || 1;
  const tripleChallenge = formalRanking.map(x => ({
    n: x.n,
    score: x.score - (previousTop5.includes(x.n) ? .5 * sd : 0)
  })).sort((a, b) => b.score - a.score || a.n - b.n);

  return {
    twoStar: twoStar.slice(0, 5).map(x => x.n),
    tripleChallenge: tripleChallenge.slice(0, 5).map(x => x.n)
  };
}


function adaptiveObjectiveRanking(draws, formalRanking) {
  const names = ["hot", "gap", "neighbor", "tail"];
  const strategies = hist => {
    const freq = Array(40).fill(0), gap = gaps(hist), prev = hist.at(-1)?.numbers || [];
    hist.slice(-30).forEach(d => d.numbers.forEach(n => freq[n]++));
    const neighbor = new Set(prev.flatMap(n => [n - 1, n + 1]).filter(n => n >= 1 && n <= 39));
    const tails = new Set(prev.map(n => n % 10));
    const all = Array.from({ length: 39 }, (_, i) => i + 1);
    const sort = score => all.slice().sort((a, b) => score(b) - score(a) || Math.abs(a - 20) - Math.abs(b - 20) || a - b);
    return {
      hot: sort(n => freq[n]),
      gap: sort(n => gap[n]),
      neighbor: sort(n => neighbor.has(n) ? 1 : 0),
      tail: sort(n => tails.has(n % 10) ? 1 : 0)
    };
  };
  const outcomes = Object.fromEntries(names.map(k => [k, []]));
  const start = Math.max(150, draws.length - 100);
  for (let i = start; i < draws.length; i++) {
    const ranks = strategies(draws.slice(0, i)), actual = new Set(draws[i].numbers);
    for (const name of names) outcomes[name].push(ranks[name].slice(0, 5).filter(n => actual.has(n)).length);
  }
  const windows = [30, 60, 100], windowWeights = [.5, .3, .2], raw = {};
  for (const name of names) {
    let observed = 0, totalWeight = 0;
    windows.forEach((w, j) => {
      const vals = outcomes[name].slice(-w), weight = windowWeights[j];
      if (vals.length) { observed += weight * vals.reduce((a, b) => a + b, 0) / vals.length; totalWeight += weight; }
    });
    const avg = totalWeight ? observed / totalWeight : 5 * baseRate;
    const count = outcomes[name].length;
    const shrunk = (avg * count + 5 * baseRate * 40) / (count + 40);
    raw[name] = Math.max(.85, Math.min(1.15, shrunk / (5 * baseRate)));
  }
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const weights = Object.fromEntries(names.map(k => [k, raw[k] / total]));
  const current = strategies(draws);
  const formalMap = new Map(formalRanking.map((x, i) => [x.n, (39 - i) / 38]));
  const scores = Array.from({ length: 39 }, (_, i) => {
    const n = i + 1;
    const strategy = names.reduce((sum, k) => sum + weights[k] * (39 - current[k].indexOf(n)) / 38, 0);
    return { n, score: .65 * formalMap.get(n) + .35 * strategy };
  }).sort((a, b) => b.score - a.score || a.n - b.n);
  return { top5: scores.slice(0, 5).map(x => x.n), weights, samples: outcomes.hot.length,
    recentMeanHits: Object.fromEntries(names.map(k => [k, outcomes[k].length ? Number((outcomes[k].reduce((a,b)=>a+b,0)/outcomes[k].length).toFixed(3)) : null])) };
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
      const topHits = prediction.top5.filter(n => actualSet.has(n));
      const backupHits = (prediction.backup5 || []).filter(n => actualSet.has(n));
      const top10Hits = [...(prediction.top5 || []), ...(prediction.backup5 || [])].filter(n => actualSet.has(n));
      const experimental = prediction.experimentalModels || {};
      const twoStarHits = (experimental.twoStar?.top5 || []).filter(n => actualSet.has(n));
      const tripleHits = (experimental.tripleChallenge?.top5 || []).filter(n => actualSet.has(n));
      const adaptiveHits = (experimental.adaptive?.top5 || []).filter(n => actualSet.has(n));
      prediction.result = {
        period: actual.period, date: actual.date, numbers: actual.numbers,
        hits: topHits, hitCount: topHits.length, fourStar: topHits.length >= 4,
        backupHits, backupHitCount: backupHits.length, fourStarBackup: backupHits.length >= 4,
        top10Hits, top10HitCount: top10Hits.length, fourStarTop10: top10Hits.length >= 4,
        experimental: {
          twoStarHits, twoStarHitCount: twoStarHits.length, twoStarFourPlus: twoStarHits.length >= 4,
          tripleChallengeHits: tripleHits, tripleChallengeHitCount: tripleHits.length, tripleChallengeFourPlus: tripleHits.length >= 4,
          adaptiveHits, adaptiveHitCount: adaptiveHits.length, adaptiveFourPlus: adaptiveHits.length >= 4
        },
        settledAt: new Date().toISOString()
      };
      changed = true;
    }
  }

  const latest = draws.at(-1);
  const exists = archive.predictions.some(p => p.sourcePeriod === latest.period);
  const pendingLatest = archive.predictions.find(p => p.sourcePeriod === latest.period && !p.result);
  if (pendingLatest && (
    pendingLatest.modelVersion !== MODEL_VERSION ||
    !pendingLatest.experimentalModels?.adaptive ||
    !pendingLatest.experimentalModels?.twoStar ||
    !pendingLatest.experimentalModels?.tripleChallenge
  )) {
    const ranking = multiFactorRanking(draws);
    const previousTop5 = archive.predictions
      .filter(p => p.sourceDate < pendingLatest.sourceDate ||
        (p.sourceDate === pendingLatest.sourceDate && p.sourcePeriod < pendingLatest.sourcePeriod))
      .at(-1)?.top5 || [];
    const experimental = experimentalRankings(draws, ranking, previousTop5);
    const adaptive = adaptiveObjectiveRanking(draws, ranking);

    // Preserve the previously issued pending pick for audit before revising it.
    if (pendingLatest.modelVersion !== MODEL_VERSION) {
      pendingLatest.revisions ||= [];
      pendingLatest.revisions.push({
        modelVersion: pendingLatest.modelVersion || "unknown",
        revisedAt: new Date().toISOString(),
        top5: pendingLatest.top5,
        backup5: pendingLatest.backup5
      });
    }
    pendingLatest.id = latest.period + "-" + MODEL_VERSION;
    pendingLatest.modelVersion = MODEL_VERSION;
    pendingLatest.top5 = ranking.slice(0, 5).map(x => x.n);
    pendingLatest.backup5 = ranking.slice(5, 10).map(x => x.n);
    pendingLatest.modelFactors = { baseRankWeight: 0.95, positionDragRankWeight: 0.05, positions: [1, 2, 3, 4, 5], includesAnyPositionTrigger: true, nextDrawHorizons: [1, 2, 3, 4, 5], exactCalendarDPlus1: true };
    pendingLatest.ranking = ranking.map((x, i) => ({
      rank: i + 1, number: x.n, score: x.score, baseScore: x.baseScore,
      dragScore: x.dragScore, dragRank: x.dragRank,
      linkScore: x.linkScore, trend: x.trend, omission: x.omission
    }));
    pendingLatest.experimentalModels = {
      twoStar: {
        version: "ablate-link-v1",
        objective: "優先檢驗二星以上比例",
        top5: experimental.twoStar
      },
      tripleChallenge: {
        version: "turnover-0.5sd-v1",
        objective: "獨立檢驗三星以上比例，不保證提高",
        top5: experimental.tripleChallenge
      },
      adaptive: {
        version: "adaptive-rank-ensemble-v1",
        objective: "依最近100期策略實績動態調整權重，獨立追蹤未來命中",
        ...adaptive
      }
    };
    changed = true;
  }
  if (!exists) {
    const ranking = multiFactorRanking(draws);
    const previousTop5 = archive.predictions.at(-1)?.top5 || [];
    const experimental = experimentalRankings(draws, ranking, previousTop5);
    const adaptive = adaptiveObjectiveRanking(draws, ranking);
    archive.predictions.push({
      id: latest.period + "-" + MODEL_VERSION,
      modelVersion: MODEL_VERSION,
      createdAt: new Date().toISOString(),
      target: "next-draw",
      sourcePeriod: latest.period,
      sourceDate: latest.date,
      top5: ranking.slice(0, 5).map(x => x.n),
      backup5: ranking.slice(5, 10).map(x => x.n),
      modelFactors: { baseRankWeight: 0.95, positionDragRankWeight: 0.05, positions: [1, 2, 3, 4, 5], includesAnyPositionTrigger: true, nextDrawHorizons: [1, 2, 3, 4, 5], exactCalendarDPlus1: true },
      experimentalModels: {
        twoStar: { version: "ablate-link-v1", objective: "優先檢驗中二星以上比例", top5: experimental.twoStar },
        tripleChallenge: { version: "turnover-0.5sd-v1", objective: "降低連續重複、觀察三星以上比例", top5: experimental.tripleChallenge },
        adaptive: { version: "adaptive-rank-ensemble-v1", objective: "依最近100期策略實績動態調整權重，獨立追蹤未來命中", ...adaptive }
      },
      ranking: ranking.map((x, i) => ({ rank: i + 1, number: x.n, score: x.score, baseScore: x.baseScore, dragScore: x.dragScore, dragRank: x.dragRank, linkScore: x.linkScore, trend: x.trend, omission: x.omission }))
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
