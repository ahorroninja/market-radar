import { normalizePriceSeries } from "./normalize.js";
function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}
export function parseYahooChart(assetId, payload) {
  const result = payload?.chart?.result?.[0];
  if (!result) throw err("EMPTY_PROVIDER_DATA", `Sin precios para ${assetId}`);
  const timestamps = result.timestamp || [],
    quote = result.indicators?.quote?.[0]?.close || [],
    adjusted = result.indicators?.adjclose?.[0]?.adjclose || [];
  const current = result.meta?.currentTradingPeriod?.regular;
  const now = Date.now() / 1000;
  const rows = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (
      timestamps[i] > now ||
      (current && now < current.end && timestamps[i] >= current.start)
    )
      continue;
    const raw = adjusted.length ? adjusted[i] : quote[i];
    if (raw == null) continue;
    const close = Number(raw);
    if (!Number.isFinite(close) || close <= 0) continue;
    rows.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      close,
    });
  }
  if (!rows.length)
    throw err("EMPTY_PROVIDER_DATA", `Sin precios válidos para ${assetId}`);
  return {
    ...normalizePriceSeries(assetId, "yahoo", rows),
    currency: result.meta?.currency || null,
    symbol: result.meta?.symbol || null,
    priceBasis: adjusted.length ? "adjusted" : "close",
  };
}
async function chart(symbol, assetId, settings, fetchImpl) {
  const base = (
    settings?.dataProvider?.baseUrl ||
    "https://market-radar.ahorradorninja.workers.dev"
  ).replace(/\/$/, "");
  const period1 = Math.floor(Date.UTC(2000, 0, 1) / 1000),
    period2 = Math.floor(Date.now() / 1000) + 86400;
  const url = `${base}/chart?symbol=${encodeURIComponent(symbol)}&period1=${period1}&period2=${period2}`;
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(25000) });
  } catch {
    throw err(
      "PROVIDER_NETWORK",
      `No se pudo descargar ${symbol}. Comprueba la conexión y el servicio.`,
    );
  }
  if (!res.ok)
    throw err(
      "PROVIDER_HTTP",
      `Servicio de precios: HTTP ${res.status} (${symbol})`,
    );
  let payload;
  try {
    payload = await res.json();
  } catch {
    throw err(
      "INVALID_PROVIDER_DATA",
      "El servicio devolvió una respuesta inválida.",
    );
  }
  if (payload?.chart?.error)
    throw err(
      "PROVIDER_UPSTREAM",
      payload.chart.error.description || "Error Yahoo Finance",
    );
  return parseYahooChart(assetId, payload);
}
export function convertToEuro(series, fx) {
  const unit =
    series.currency === "GBp" || series.currency === "GBX" ? 0.01 : 1;
  const points = [];
  let i = 0;
  for (const p of series.points) {
    if (!fx.points.length || p.date < fx.points[0].date) continue;
    while (i + 1 < fx.points.length && fx.points[i + 1].date <= p.date) i++;
    const rate = fx.points[i];
    if (
      !rate ||
      rate.date > p.date ||
      (Date.parse(p.date) - Date.parse(rate.date)) / 86400000 > 7
    )
      throw err("MISSING_FX", `Falta tipo de cambio para ${p.date}.`);
    points.push({ date: p.date, close: (p.close * unit) / rate.close });
  }
  if (!points.length)
    throw err("MISSING_FX", "No hay histórico de cambio para esta serie.");
  return {
    ...series,
    points,
    asOf: points.at(-1).date,
    quoteCurrency: series.currency,
    currency: "EUR",
    fxSymbol: fx.symbol,
  };
}
export async function fetchMarketSeries(
  asset,
  settings,
  fetchImpl = fetch,
  fxCache = new Map(),
) {
  const symbol =
    settings?.dataProvider?.symbols?.[asset.id] || asset.symbols?.yahoo;
  if (!symbol)
    throw err(
      "MISSING_SYMBOL",
      `Falta el símbolo de ${asset.name || asset.id}`,
    );
  const result = await chart(symbol, asset.id, settings, fetchImpl);
  result.symbol = symbol;
  if (!result.currency || result.currency === "EUR") return result;
  const currency = ["GBp", "GBX"].includes(result.currency)
    ? "GBP"
    : result.currency;
  if (!/^[A-Z]{3}$/.test(currency))
    throw err(
      "UNSUPPORTED_CURRENCY",
      `Divisa no reconocida: ${result.currency}`,
    );
  const fxSymbol = `EUR${currency}=X`;
  if (!fxCache.has(fxSymbol))
    fxCache.set(fxSymbol, chart(fxSymbol, fxSymbol, settings, fetchImpl));
  return convertToEuro(result, await fxCache.get(fxSymbol));
}
