export const MACRO_IDS = ["VIXCLS", "BAMLH0A0HYM2", "T10Y2Y", "NFCI"];
export function macroAt(histories, date, { requireVintage = false } = {}) {
  const values = {},
    dates = {};
  for (const id of MACRO_IDS) {
    const series = histories?.[id];
    if (!series || (requireVintage && series.basis !== "vintage")) return null;
    let last = null;
    for (const p of series.points || []) {
      if (
        p.date > date ||
        p.availableFrom > date ||
        (p.availableUntil && p.availableUntil < date) ||
        !Number.isFinite(p.value)
      )
        continue;
      if (
        !last ||
        p.date > last.date ||
        (p.date === last.date && p.availableFrom > last.availableFrom)
      )
        last = p;
    }
    if (
      !last ||
      (Date.parse(date) - Date.parse(last.date)) / 86400000 >
        (id === "NFCI" ? 21 : 10)
    )
      return null;
    values[id] = last.value;
    dates[id] = last.date;
  }
  const score = Math.max(
    0,
    Math.min(
      100,
      72 -
        values.VIXCLS * 0.65 -
        values.BAMLH0A0HYM2 * 2 +
        values.T10Y2Y * 4 -
        values.NFCI * 8,
    ),
  );
  return {
    values,
    dates,
    score,
    basis: requireVintage ? "vintage" : "latest",
    asOf: date,
  };
}
