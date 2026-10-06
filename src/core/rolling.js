import { runBacktest } from "./backtest.js";
export function rollingComparison(req, years = 3, stepMonths = 12) {
  const first = req.startDate,
    end = req.endDate,
    windows = [];
  let cursor = new Date(first + "T00:00:00Z");
  while (true) {
    const startDate = cursor.toISOString().slice(0, 10),
      finish = new Date(cursor);
    finish.setUTCFullYear(finish.getUTCFullYear() + years);
    finish.setUTCDate(finish.getUTCDate() - 1);
    const endDate = finish.toISOString().slice(0, 10);
    if (endDate > end) break;
    const results = ["targetDca", "smartDca"].map((strategy) =>
      runBacktest({
        ...req,
        strategy,
        initialHoldings: {},
        startDate,
        endDate,
        smartDcaPolicy: { ...req.smartDcaPolicy, useMacro: false },
      }),
    );
    const delta =
      results[1].metrics.annualizedTwr - results[0].metrics.annualizedTwr;
    windows.push({ startDate, endDate, delta });
    cursor.setUTCMonth(cursor.getUTCMonth() + stepMonths);
    if (windows.length > 200) break;
  }
  const sorted = windows
      .map((w) => w.delta)
      .filter(Number.isFinite)
      .sort((a, b) => a - b),
    n = sorted.length,
    q = (p) => (n ? sorted[Math.floor((n - 1) * p)] : null);
  return {
    windows,
    n,
    wins: sorted.filter((x) => x > 0).length,
    median: q(0.5),
    p10: q(0.1),
    p90: q(0.9),
    overlapping: stepMonths < years * 12,
    insufficient: n < 5,
  };
}
