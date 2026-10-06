import { validateSettings } from "../domain/settings.js";
import { normalizePriceSeries } from "../data/normalize.js";
import { freshSettings } from "../domain/defaults.js";
function err(message) {
  const e = new Error(message);
  e.code = "INVALID_BACKUP";
  return e;
}
function clone(x) {
  return structuredClone(x);
}
function checkSettings(s) {
  try {
    validateSettings(s);
  } catch (e) {
    throw err(e.message);
  }
}
function validateCache(cache) {
  if (!cache || typeof cache !== "object" || Array.isArray(cache))
    throw err("Histórico inválido");
  for (const [id, s] of Object.entries(cache)) {
    if (!s || s.assetId !== id || !Array.isArray(s.points))
      throw err("Serie inválida");
    try {
      const normalized = normalizePriceSeries(id, s.source, s.points);
      if (
        normalized.points.length !== s.points.length ||
        normalized.points.some((p, i) => p.date !== s.points[i].date) ||
        (s.asOf !== undefined && s.asOf !== normalized.asOf)
      )
        throw err("Fechas duplicadas, desordenadas o cierre incorrecto");
    } catch (e) {
      throw err(e.message);
    }
  }
}
function validateMacro(histories) {
  if (histories === undefined) return;
  if (!histories || typeof histories !== "object" || Array.isArray(histories))
    throw err("Macro inválida");
  for (const [id, series] of Object.entries(histories)) {
    if (
      !["VIXCLS", "BAMLH0A0HYM2", "T10Y2Y", "NFCI"].includes(id) ||
      !series ||
      !["vintage", "revised"].includes(series.basis) ||
      !Array.isArray(series.points)
    )
      throw err("Serie macro inválida");
    for (const p of series.points) {
      if (
        !p ||
        !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
        !Number.isFinite(p.value) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(p.availableFrom) ||
        (series.basis === "vintage" &&
          !/^\d{4}-\d{2}-\d{2}$/.test(p.availableUntil))
      )
        throw err("Observación macro inválida");
    }
  }
}
function withoutSecrets(x) {
  if (Array.isArray(x)) return x.map(withoutSecrets);
  if (x && typeof x === "object")
    return Object.fromEntries(
      Object.entries(x)
        .filter(([k]) => !/key|token|secret|password/i.test(k))
        .map(([k, v]) => [k, withoutSecrets(v)]),
    );
  return x;
}
export const LEGACY_IDS = [
  "IE000ZYRH0Q7",
  "IE0032126645",
  "IE00BP3QZB59",
  "IE00BG0SKF03",
  "IE00BM67HT60",
  "IE000X59ZHE2",
  "IE000YYE6WK5",
  "IE0003BJ2JS4",
  "IE000KHX9DX6",
  "SGLN.L",
];
export function migrateLegacyState(old) {
  const settings = freshSettings();
  settings.monthlyContribution = old.monthly ?? 1000;
  settings.reserve = old.reserve ?? 0;
  settings.holdings = Object.fromEntries(
    settings.assets.map((a, i) => [a.id, old.portfolio?.[LEGACY_IDS[i]] ?? 0]),
  );
  if (old.workerUrl) settings.dataProvider.baseUrl = old.workerUrl;
  // Preserve credentials locally, but don't reuse legacy histories with unknown currencies,
  // stitched instruments and anomalies. They remain in the original backup/storage.
  settings.credentials = {
    fredKey: old.fredKey || "",
    eodKey: old.eodKey || "",
  };
  checkSettings(settings);
  return {
    settings,
    marketCache: {},
    migrationNotice:
      "Configuración antigua recuperada. Descarga precios nuevos: el histórico antiguo no tenía divisa ni procedencia verificables.",
  };
}
export function createBackup(
  state,
  { includeSecrets = false, now = new Date().toISOString() } = {},
) {
  checkSettings(state?.settings);
  validateCache(state?.marketCache || {});
  validateMacro(state?.macroHistories);
  return {
    schemaVersion: 1,
    exportedAt: now,
    settings: includeSecrets
      ? clone(state.settings)
      : withoutSecrets(state.settings),
    marketCache: clone(state.marketCache || {}),
    ...(state.macroHistories
      ? { macroHistories: clone(state.macroHistories) }
      : {}),
    secretsIncluded: Boolean(includeSecrets),
  };
}
export function restoreBackup(envelope, currentState) {
  if (
    envelope?.format === "market-radar-backup" &&
    envelope.version === 1 &&
    envelope.state
  )
    return migrateLegacyState(envelope.state);
  if (envelope?.monthly !== undefined && envelope.portfolio)
    return migrateLegacyState(envelope);
  if (
    !envelope ||
    envelope.schemaVersion !== 1 ||
    typeof envelope.exportedAt !== "string" ||
    typeof envelope.secretsIncluded !== "boolean"
  )
    throw err("Formato de backup no reconocido");
  const staged = {
    settings: clone(envelope.settings),
    marketCache: clone(envelope.marketCache || {}),
    ...(envelope.macroHistories
      ? { macroHistories: clone(envelope.macroHistories) }
      : {}),
  };
  if (!envelope.secretsIncluded && currentState?.settings?.credentials)
    staged.settings.credentials = clone(currentState.settings.credentials);
  checkSettings(staged.settings);
  validateCache(staged.marketCache);
  validateMacro(staged.macroHistories);
  return staged;
}
