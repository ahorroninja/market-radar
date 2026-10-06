// Calendar duration after the indicator warm-up; never invent earlier ETF prices.
export function longHistoryUniverse(
  assets,
  histories,
  years = 5,
  warmup = 252,
) {
  return assets.filter((a) => {
    const points = histories[a.id] || [];
    const first = points[warmup]?.date,
      last = points.at(-1)?.date;
    if (!first || !last) return false;
    const cutoff = new Date(last + "T00:00:00Z");
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
    return first < cutoff.toISOString().slice(0, 10);
  });
}
