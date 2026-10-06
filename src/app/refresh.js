import { fetchMacroHistories } from "../data/macro-provider.js";
import { fetchMarketSeries } from "../data/provider.js";
export async function refreshMarketData(
  ctx,
  { fetchImpl = fetch, onProgress = () => {} } = {},
) {
  const assets = ctx.settings.assets.filter((a) => a.enabled),
    next = { ...ctx.marketCache },
    fxCache = new Map();
  let done = 0;
  const failures = [];
  for (const a of assets) {
    try {
      next[a.id] = await fetchMarketSeries(a, ctx.settings, fetchImpl, fxCache);
    } catch (e) {
      failures.push({
        assetId: a.id,
        code: e.code || "PROVIDER_ERROR",
        message: e.message,
      });
    }
    onProgress(++done, assets.length, a.id);
  }
  if (ctx.settings.macroEnabled !== false) {
    try {
      onProgress(done, assets.length, "macro");
      ctx.macroHistories = await fetchMacroHistories(ctx.settings, fetchImpl);
    } catch (e) {
      failures.push({
        assetId: "macro",
        message: e.message,
        code: "MACRO_UNAVAILABLE",
      });
    }
  }
  ctx.marketCache = next;
  ctx.failures = failures;
  ctx.asOf =
    Object.values(next)
      .map((x) => x.asOf)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  return { updated: assets.length - failures.length, failures };
}
