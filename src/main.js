import { createShell } from "./ui/shell.js";
import { VIEW_RENDERERS } from "./ui/views.js";
import { APP_VERSION } from "./domain/defaults.js";
import { loadState, saveSettings, migrateSettings } from "./app/persistence.js";
import { readSnapshot, writeSnapshot } from "./storage/market-cache.js";
import { advanceProspective } from "./core/prospective.js";
import { refreshMarketData } from "./app/refresh.js";
const state = loadState();
try {
  const saved = await readSnapshot();
  if (saved) {
    state.settings = migrateSettings(saved.settings);
    state.marketCache = saved.marketCache || {};
    state.macroHistories = saved.macroHistories || {};
    state.lastRefresh = saved.lastRefresh;
    state.paperJournal = saved.paperJournal ?? null;
  }
} catch {
  state.migrationNotice =
    "No se pudo abrir el histórico local. Exporta una copia antes de cambiar de dispositivo.";
}
const ctx = { ...state, version: APP_VERSION, refreshing: false };
let shell, notifyTimer;
function setAsOf() {
  ctx.asOf =
    Object.values(ctx.marketCache)
      .map((x) => x.asOf)
      .filter(Boolean)
      .sort()
      .at(-1) || null;
}
function render() {
  VIEW_RENDERERS[shell.route](shell.outlet, ctx);
}
ctx.notify = (t) => {
  clearTimeout(notifyTimer);
  shell.setStatus(t);
  notifyTimer = setTimeout(() => shell.setStatus(APP_VERSION), 8000);
};
ctx.commit = async (staged) => {
  const snapshot = {
    settings: staged.settings,
    marketCache: staged.marketCache,
    macroHistories: staged.macroHistories ?? ctx.macroHistories ?? {},
    lastRefresh: staged.lastRefresh ?? ctx.lastRefresh ?? null,
    paperJournal: staged.paperJournal ?? ctx.paperJournal ?? null,
  };
  if (!(await writeSnapshot(snapshot))) {
    // Single serialized state preserves transactional restore when IndexedDB is unavailable.
    localStorage.setItem("market-radar-v3-snapshot", JSON.stringify(snapshot));
  }
  Object.assign(ctx, staged);
  setAsOf();
  try {
    saveSettings(ctx.settings);
  } catch {
    ctx.notify(
      "Histórico guardado. No se pudo actualizar la copia de ajustes.",
    );
  }
};
ctx.refresh = async () => {
  if (ctx.refreshing) return;
  ctx.refreshing = true;
  render();
  shell.setStatus("Actualizando…");
  try {
    const staged = {
      settings: structuredClone(ctx.settings),
      marketCache: structuredClone(ctx.marketCache),
      macroHistories: structuredClone(ctx.macroHistories || {}),
    };
    const r = await refreshMarketData(staged, {
      onProgress: (n, total) => shell.setStatus(`Actualizando ${n}/${total}`),
    });
    staged.settings = ctx.settings;
    if (ctx.paperJournal) {
      try {
        staged.paperJournal = advanceProspective(
          ctx.paperJournal,
          staged.marketCache,
        );
        ctx.paperNotice = null;
      } catch (e) {
        ctx.paperNotice = e.message;
      }
    }
    staged.lastRefresh = new Date().toISOString();
    await ctx.commit(staged);
    if (!r.failures.length) ctx.migrationNotice = null;
    ctx.lastRefresh = new Date().toISOString();
    ctx.notify(
      r.failures.length
        ? `${r.updated} actualizados · ${r.failures.length} fallos`
        : `${r.updated} activos actualizados`,
    );
  } catch (e) {
    ctx.notify(`No se pudo guardar: ${e.message}`);
  } finally {
    ctx.refreshing = false;
    render();
  }
};
setAsOf();
shell = createShell(document.querySelector("#app"), {
  initialRoute: location.hash.slice(1) || "radar",
  onRouteChange: (route, outlet) => {
    location.hash = route;
    VIEW_RENDERERS[route](outlet, ctx);
  },
});
shell.setStatus(APP_VERSION);
window.addEventListener("hashchange", () => {
  if (location.hash.slice(1) !== shell.route)
    shell.navigate(location.hash.slice(1));
});
if (!navigator.onLine) ctx.notify("Sin conexión: usando histórico guardado.");

if (
  navigator.onLine &&
  (!ctx.lastRefresh ||
    Date.now() - Date.parse(ctx.lastRefresh) > 20 * 3600000) &&
  shell.route === "radar"
)
  setTimeout(() => ctx.refresh(), 300);
