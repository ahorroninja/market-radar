import { drawdown, sma, simpleReturn, opportunityBand } from "./indicators.js";
export const SCORE_WEIGHTS = {
  valuation: 0.25,
  trend: 0.2,
  sentiment: 0.2,
  macro: 0.2,
  breadth: 0.15,
};
export function rsi(points, period = 14) {
  if (points.length <= period) return null;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = points[i].close - points[i - 1].close;
    gain += Math.max(d, 0);
    loss += Math.max(-d, 0);
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < points.length; i++) {
    const d = points[i].close - points[i - 1].close;
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  return !gain && !loss ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}
export function indicatorSnapshot(assetId, points, extras = {}) {
  const last = points.at(-1),
    m50 = sma(points, 50),
    m200 = sma(points, 200),
    mom = simpleReturn(points, 252),
    dd = drawdown(points);
  const strength = rsi(points),
    clamp = (x, a = 0, b = 100) => Math.max(a, Math.min(b, x));
  const trend =
    m200 === null || m50 === null || mom === null || strength === null
      ? null
      : clamp(
          (last.close > m200 ? 30 : 5) +
            (m50 > m200 ? 25 : 5) +
            clamp(25 + mom * 100, 0, 25) +
            clamp(20 + (strength - 50) * 0.4, 0, 20),
        );
  const drawScore = dd === null ? null : clamp(-dd * 180 + 35, 20, 90),
    technicalScore =
      trend === null || drawScore === null
        ? null
        : (0.55 * trend + 0.25 * drawScore) / 0.8;
  const marketScore =
    Number.isFinite(extras.macro) && technicalScore !== null
      ? 0.55 * trend + 0.25 * drawScore + 0.2 * extras.macro
      : null;
  const components = Object.fromEntries(
    Object.keys(SCORE_WEIGHTS).map((k) => [
      k,
      k === "trend"
        ? trend
        : Number.isFinite(extras[k]) && extras[k] >= 0 && extras[k] <= 100
          ? extras[k]
          : null,
    ]),
  );
  const coverage = Object.entries(SCORE_WEIGHTS).reduce(
    (s, [k, w]) => s + (components[k] === null ? 0 : w),
    0,
  );
  // A partial score is deliberately not advertised as a full opportunity score.
  const score =
    coverage > 1 - 1e-9
      ? Object.entries(SCORE_WEIGHTS).reduce(
          (s, [k, w]) => s + components[k] * w,
          0,
        )
      : null;
  return {
    assetId,
    asOf: last?.date ?? null,
    drawdown: dd,
    technicalScore,
    marketScore,
    drawScore,
    band: opportunityBand(dd),
    m50,
    m200,
    momentum: mom,
    rsi: rsi(points),
    drawdownBasis: 252,
    ...components,
    components,
    coverage,
    score,
    missing: [
      ...(dd === null ? ["drawdown"] : []),
      ...Object.keys(components).filter((k) => components[k] === null),
    ],
  };
}
export function seriesStatus(series, now = Date.now()) {
  if (!series?.points?.length)
    return { usable: false, label: "Sin datos", stale: true };
  const age = (now - Date.parse(series.asOf + "T00:00:00Z")) / 86400000;
  const stale = !Number.isFinite(age) || age > 5 || age < -1;
  return {
    usable: !stale,
    label: stale ? "Datos antiguos" : "Cierre disponible",
    stale,
  };
}
