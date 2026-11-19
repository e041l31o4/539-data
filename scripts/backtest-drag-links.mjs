import fs from "node:fs";

const DATA = "data/daily539.json";
const OUT = "data/drag-links539.json";
const source = JSON.parse(fs.readFileSync(DATA, "utf8"));
const draws = source.draws
  .filter(d => Array.isArray(d.numbers) && d.numbers.length === 5)
  .sort((a, b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period));
const baselineRate = 5 / 39;
const records = [];

for (let position = 0; position <= 5; position++) {
  for (let trigger = 1; trigger <= 39; trigger++) {
    for (let lag = 1; lag <= 5; lag++) {
      const hits = Array(40).fill(0);
      let opportunities = 0;
      for (let i = 0; i + lag < draws.length; i++) {
        const current = draws[i].numbers;
        const matched = position === 0
          ? current.includes(trigger)
          : current[position - 1] === trigger;
        if (!matched) continue;
        opportunities++;
        for (const n of draws[i + lag].numbers) if (n !== trigger) hits[n]++;
      }
      const top = Array.from({ length: 39 }, (_, i) => i + 1)
        .filter(n => n !== trigger)
        .map(number => ({
          number,
          hits: hits[number],
          rate: opportunities ? hits[number] / opportunities : 0,
          lift: opportunities ? (hits[number] / opportunities) / baselineRate : 0
        }))
        .sort((a, b) => b.rate - a.rate || b.hits - a.hits || a.number - b.number)
        .slice(0, 10);
      records.push({ position, trigger, lag, opportunities, top });
    }
  }
}

const report = {
  source: source.source,
  generatedAt: new Date().toISOString(),
  updatedAt: source.updatedAt,
  historyCount: draws.length,
  from: draws[0].date,
  through: draws.at(-1).date,
  baselineRate,
  positionDefinition: "官方資料 numbers 陣列為升冪排序；position 1-5 指排序位置，不代表實際搖出先後順序。",
  lagDefinition: "lag 1 指下一個開獎期，不保證是下一個日曆日；lag 2-5 依序為後續第 2-5 個開獎期。",
  records
};
fs.writeFileSync(OUT, JSON.stringify(report));
console.log(`Generated ${records.length} trigger rows from ${draws.length} draws: ${OUT}`);
