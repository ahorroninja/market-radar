import { migrateLegacyState } from "../storage/backup.js";
import { freshSettings } from "../domain/defaults.js";
export const SETTINGS_KEY = "market-radar-v3-settings",
  CACHE_KEY = "market-radar-v3-cache";

export function migrateSettings(saved = {}) {
  const defaults = freshSettings();
  const savedProvider = saved?.dataProvider || {};
  const rc3Weights = [
    0.3, 0.15, 0.15, 0.08, 0.08, 0.06, 0.05, 0.05, 0.04, 0.04,
  ];
  const untouched =
    Array.isArray(saved.assets) &&
    saved.assets.length === 10 &&
    saved.assets.every(
      (a, i) =>
        a.id === defaults.assets[i].id && a.targetWeight === rc3Weights[i],
    );
  if (untouched) {
    const oldSymbols = [
      "URTH",
      "SPY",
      "IWVL.L",
      "AVES",
      "IXN",
      "AIQ",
      "ITA",
      "URA",
      "REMX",
      "GLD",
    ];
    saved = {
      ...saved,
      assets: saved.assets.map((a, i) => ({
        ...a,
        targetWeight: defaults.assets[i].targetWeight,
        symbols: {
          ...a.symbols,
          yahoo:
            a.symbols?.yahoo === oldSymbols[i]
              ? defaults.assets[i].symbols.yahoo
              : a.symbols?.yahoo || defaults.assets[i].symbols.yahoo,
        },
      })),
      targetBasis: defaults.targetBasis,
    };
  }
  const providerIsCurrent = savedProvider.type === defaults.dataProvider.type;
  return {
    ...defaults,
    ...saved,
    dataProvider: providerIsCurrent
      ? {
          ...defaults.dataProvider,
          ...savedProvider,
          symbols: {
            ...defaults.dataProvider.symbols,
            ...(savedProvider.symbols || {}),
          },
        }
      : defaults.dataProvider,
    smartDcaPolicy: {
      ...defaults.smartDcaPolicy,
      ...(saved.smartDcaPolicy || {}),
    },
    holdings: { ...defaults.holdings, ...(saved.holdings || {}) },
    assets: Array.isArray(saved.assets)
      ? saved.assets.map((old) => {
          const current = defaults.assets.find((a) => a.id === old.id);
          return current
            ? {
                ...current,
                ...old,
                symbols: { ...current.symbols, ...(old.symbols || {}) },
              }
            : old;
        })
      : defaults.assets,
  };
}

export function loadState(storage = localStorage) {
  let settings = freshSettings(),
    marketCache = {};
  try {
    const snapshot = storage.getItem("market-radar-v3-snapshot");
    if (snapshot) {
      const saved = JSON.parse(snapshot);
      return {
        settings: migrateSettings(saved.settings),
        marketCache: saved.marketCache || {},
        macroHistories: saved.macroHistories || {},
        lastRefresh: saved.lastRefresh,
      };
    }
  } catch {}
  try {
    const x = storage.getItem(SETTINGS_KEY);
    if (x) {
      const saved = JSON.parse(x);
      settings = migrateSettings(saved);
      const old = storage.getItem("mr_state");
      if (old && !saved.legacyMigrated) {
        const legacy = migrateLegacyState(JSON.parse(old));
        if (!Object.keys(saved.holdings || {}).length)
          settings.holdings = legacy.settings.holdings;
        if (saved.reserve === undefined)
          settings.reserve = legacy.settings.reserve;
        if (!saved.credentials)
          settings.credentials = legacy.settings.credentials;
        settings.legacyMigrated = true;
      }
    } else {
      const old = storage.getItem("mr_state");
      if (old) return migrateLegacyState(JSON.parse(old));
    }
  } catch {}
  try {
    marketCache = JSON.parse(storage.getItem(CACHE_KEY) || "{}");
  } catch {}
  return { settings, marketCache };
}
export function saveSettings(settings, storage = localStorage) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
export function saveCache(cache, storage = localStorage) {
  storage.setItem(CACHE_KEY, JSON.stringify(cache));
}
