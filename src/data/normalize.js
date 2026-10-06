function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}
function isoDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === s;
}
export function normalizePriceSeries(assetId, source, rows) {
  if (
    typeof assetId !== "string" ||
    !assetId ||
    typeof source !== "string" ||
    !source ||
    !Array.isArray(rows)
  )
    throw err("INVALID_SERIES", "Invalid series envelope");
  const byDate = new Map();
  for (const row of rows) {
    if (!isoDate(row?.date))
      throw err("INVALID_DATE", `Invalid date ${row?.date}`);
    if (!Number.isFinite(row?.close) || row.close <= 0)
      throw err("INVALID_PRICE", `Invalid close for ${row.date}`);
    if (byDate.has(row.date) && byDate.get(row.date) !== row.close)
      throw err("CONFLICTING_PRICE", `Conflicting close for ${row.date}`);
    byDate.set(row.date, row.close);
  }
  const points = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, close]) => ({ date, close }));
  return { assetId, points, asOf: points.at(-1)?.date ?? null, source };
}
