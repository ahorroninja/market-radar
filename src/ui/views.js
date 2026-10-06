import { macroAt } from "../core/macro.js";
import { rollingComparison } from "../core/rolling.js";
import {
  indicatorSnapshot,
  seriesStatus,
  SCORE_WEIGHTS,
} from "../core/radar.js";
import { buildPortfolioSnapshot } from "../core/portfolio.js";
import { allocateSmartDca } from "../core/smart-dca.js";
import { runBacktest } from "../core/backtest.js";
import { createBackup, restoreBackup } from "../storage/backup.js";
import { validateSettings } from "../domain/settings.js";
export const eur = (n) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
const num = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
const pct = (n) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("es-ES", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(n);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const enabled = (c) =>
  c.settings.assets.filter((a) => a.enabled && a.targetWeight > 0);
const series = (c, id) => c.marketCache?.[id]?.points || [];
const symbol = (c, a) =>
  c.settings.dataProvider?.symbols?.[a.id] || a.symbols?.yahoo || "";
const bands = {
  normal: "Cerca de máximos",
  interesting: "Corrección moderada",
  opportunity: "Corrección relevante",
  strong: "Caída intensa",
  extraordinary: "Caída extrema",
};
const blockNames = {
  valuation: "Valoración",
  trend: "Tendencia",
  sentiment: "Sentimiento",
  macro: "Macro y crédito",
  breadth: "Amplitud",
};
const status = (c, a) => {
  const data = c.marketCache?.[a.id];
  if (data?.symbol && data.symbol !== symbol(c, a))
    return { usable: false, label: "Símbolo modificado", stale: true };
  if (data?.currency !== "EUR")
    return {
      usable: false,
      label: data ? "Falta conversión a EUR" : "Sin datos",
      stale: true,
    };
  return seriesStatus(data);
};
const holdings = (c) =>
  c.settings.assets
    .filter((a) => a.enabled)
    .map((a) => ({ assetId: a.id, value: c.settings.holdings?.[a.id] ?? 0 }));
const snapshot = (c) => buildPortfolioSnapshot(c.asOf, holdings(c));
const currentMacro = (c) =>
  macroAt(c.macroHistories, c.asOf || new Date().toISOString().slice(0, 10));
const indicators = (c) =>
  enabled(c).map((a) =>
    indicatorSnapshot(a.id, series(c, a.id), { macro: currentMacro(c)?.score }),
  );
const notice = (m) => `<div class="notice" role="status">${esc(m)}</div>`;
function sparkline(points) {
  if (points.length < 2) return "";
  const tail = points.slice(-252),
    lo = Math.min(...tail.map((p) => p.close)),
    hi = Math.max(...tail.map((p) => p.close)),
    xy = tail
      .map(
        (p, i) =>
          `${((i / (tail.length - 1)) * 240).toFixed(1)},${(48 - ((p.close - lo) / (hi - lo || 1)) * 44).toFixed(1)}`,
      )
      .join(" ");
  return `<svg class="spark" viewBox="0 0 240 52" role="img" aria-label="Evolución de las últimas 252 sesiones"><polyline points="${xy}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}
function failures(c) {
  return (c.failures || [])
    .map((f) =>
      notice(
        `${c.settings.assets.find((a) => a.id === f.assetId)?.name || f.assetId}: ${f.message}`,
      ),
    )
    .join("");
}
export function renderRadar(o, c) {
  const a = enabled(c),
    p = snapshot(c),
    macro = currentMacro(c),
    ready = a.filter((x) => status(c, x).usable).length;
  o.innerHTML = `<section class="view"><div class="view-title"><div><h1>Radar de mercado</h1><p>Cierres diarios · precios ajustados en EUR</p></div><button id="refresh" ${c.refreshing ? "disabled" : ""}>${c.refreshing ? "Actualizando…" : "Actualizar"}</button></div>
 <div class="stats"><article><span>Cartera registrada</span><b>${eur(p.totalValue)}</b></article><article><span>Aportación mensual</span><b>${eur(c.settings.monthlyContribution)}</b></article><article><span>Reserva táctica</span><b>${eur(c.settings.reserve ?? 0)}</b></article><article><span>Datos utilizables</span><b>${ready} / ${a.length}</b></article></div>
 ${c.migrationNotice ? notice(c.migrationNotice) : ""}${failures(c)}
 <div class="panel"><div class="asset-head"><strong>Contexto macro · FRED</strong><span>${macro ? num(macro.score) + " / 100" : "No disponible"}</span></div>${
   macro
     ? `<dl class="indicators">${Object.entries(macro.values)
         .map(
           ([k, v]) =>
             `<div><dt>${esc(k)} · ${macro.dates[k]}</dt><dd>${num(v)}</dd></div>`,
         )
         .join(
           "",
         )}</dl><p>Indicador heurístico de régimen, no probabilidad de crisis. ${Object.values(c.macroHistories || {}).every((s) => s.basis === "vintage") ? "Datos con fechas de publicación disponibles." : "Valores históricos revisados; no aptos para decisiones pasadas."}</p>`
     : "<p>Actualiza para obtener las series oficiales. Se indica el fallo real cuando el servicio no las entrega.</p>"
 }</div>
 <div class="notice">Una caída indica distancia al máximo de las últimas 252 sesiones; no demuestra que el activo esté barato. El Smart DCA usa pesos, caída e infraponderación. El score completo requiere datos adicionales.</div>
 <div class="cards radar-cards">${a
   .map((x) => {
     const s = c.marketCache?.[x.id],
       i = indicatorSnapshot(x.id, series(c, x.id), { macro: macro?.score }),
       t = status(c, x);
     return `<article class="card radar-card"><div class="asset-head"><div><strong>${esc(x.name)}</strong><small>${esc(symbol(c, x))} · ${esc(s?.asOf || "sin cierre")}</small></div><span class="badge ${t.usable ? "" : "warning"}">${esc(t.label)}</span></div>${sparkline(series(c, x.id))}<div class="asset-head"><span>Score técnico ${num(i.technicalScore)} / 100</span><span>${i.marketScore === null ? "Macro no incluida" : "Técnico + macro: " + num(i.marketScore)}</span></div><div class="asset-head"><div><span class="caption">Caída desde máximo 252 s</span><b class="large">${pct(i.drawdown)}</b></div><span>${esc(bands[i.band] || "Sin histórico")}</span></div><dl class="indicators"><div><dt>Momentum 12 m</dt><dd>${pct(i.momentum)}</dd></div><div><dt>RSI Wilder 14</dt><dd>${num(i.rsi)}</dd></div><div><dt>Media 50</dt><dd>${num(i.m50)} €</dd></div><div><dt>Media 200</dt><dd>${num(i.m200)} €</dd></div></dl><details><summary>Datos del score · cobertura ${pct(i.coverage)}</summary><dl>${Object.entries(
       SCORE_WEIGHTS,
     )
       .map(
         ([k, w]) =>
           `<div><dt>${blockNames[k]} (${pct(w)})</dt><dd>${i.components[k] === null ? "No disponible" : num(i.components[k]) + " / 100"}</dd></div>`,
       )
       .join(
         "",
       )}</dl><p>Score de oportunidad: ${i.score === null ? "no calculable con la cobertura actual" : num(i.score)}. RSI es un indicador técnico; no sustituye el sentimiento. La caída no sustituye la valoración.</p></details></article>`;
   })
   .join("")}</div></section>`;
  o.querySelector("#refresh").onclick = () => c.refresh();
}
export function renderBuy(o, c) {
  const a = enabled(c),
    p = snapshot(c),
    unusable = a.filter((x) => !status(c, x).usable);
  o.innerHTML = `<section class="view"><div class="view-title"><div><h1>Plan de compra</h1><p>Sólo dinero nuevo · importes en euros enteros</p></div></div><div class="panel"><label>Reserva que quieres añadir a esta aportación (€)<input id="extra" type="number" min="0" max="${c.settings.reserve ?? 0}" step="1" value="0"></label><p>Reserva registrada: ${eur(c.settings.reserve ?? 0)}. Este plan no ejecuta compras ni modifica la cartera o la reserva.</p></div><div id="plan"></div></section>`;
  const container = o.querySelector("#plan");
  function plan() {
    try {
      const extra = Number(o.querySelector("#extra").value);
      if (
        !Number.isInteger(extra) ||
        extra < 0 ||
        extra > (c.settings.reserve ?? 0)
      )
        throw new Error(
          "El importe extra debe ser entero y no superar la reserva.",
        );
      const amount = c.settings.monthlyContribution + extra;
      if (unusable.length && amount > 0)
        throw new Error(
          "Actualiza los precios antes de calcular: " +
            unusable.map((x) => x.name).join(", ") +
            ". Se conserva tu presupuesto; no se redistribuye hacia otros activos por un fallo de datos.",
        );
      if (c.settings.smartDcaPolicy.useMacro && !currentMacro(c))
        throw new Error(
          "No hay macro reciente. Desactiva su ajuste en Smart DCA o actualiza.",
        );
      const r = allocateSmartDca({
        contribution: amount,
        assets: a,
        portfolio: p,
        indicators: indicators(c),
        policy: c.settings.smartDcaPolicy,
      });
      container.innerHTML = `<div class="stats"><article><span>Aportación</span><b>${eur(c.settings.monthlyContribution)}</b></article><article><span>Reserva elegida</span><b>${eur(extra)}</b></article><article><span>Total a distribuir</span><b>${eur(amount)}</b></article><article><span>Total asignado</span><b>${eur(Object.values(r.allocations).reduce((s, v) => s + v, 0))}</b></article></div><div class="table-wrap panel"><table><thead><tr><th>Activo</th><th>Peso objetivo</th><th>Peso actual</th><th>Caída</th><th>Compra</th><th>Reparto</th></tr></thead><tbody>${a.map((x) => `<tr><td>${esc(x.name)}</td><td>${pct(x.targetWeight)}</td><td>${pct(p.weights[x.id])}</td><td>${pct(indicators(c).find((i) => i.assetId === x.id)?.drawdown)}</td><td class="money">${eur(r.allocations[x.id] || 0)}</td><td>${pct(amount ? (r.allocations[x.id] || 0) / amount : 0)}</td></tr>`).join("")}</tbody></table></div><details class="panel"><summary>Cómo se reparte</summary><p>Peso × [1 + intensidad de caída × caída + intensidad de déficit × déficit relativo]. Se normaliza y se redondea al euro conservando el total.</p><p>El límite táctico permite como máximo ${pct(c.settings.smartDcaPolicy.maxContributionShare)} adicionales sobre el peso objetivo de cada activo. No es un límite de peso total de cartera.</p><p>Los pesos actuales se calculan sobre las posiciones de este Radar. La reserva queda fuera; las cifras dependen de que hayas actualizado los valores en Ajustes.</p></details>`;
    } catch (e) {
      container.innerHTML = notice(e.message);
    }
  }
  o.querySelector("#extra").oninput = plan;
  plan();
}
function equityChart(results) {
  const colors = ["#7c9cff", "#f3c26b", "#59d6b5", "#e69cda"],
    labels = [
      "DCA objetivo",
      "Rebalanceo con aportaciones",
      "Smart DCA",
      "Smart DCA + macro",
    ];
  const all = results.flatMap((r) => r.observations.map((p) => p.value)),
    hi = Math.max(...all, 1),
    n = results[0].observations.length;
  return `<div class="panel"><div class="legend">${labels
    .slice(0, results.length)
    .map((l, i) => `<span style="color:${colors[i]}">${l}</span>`)
    .join(
      "",
    )}</div><svg class="equity-chart" viewBox="0 0 800 240" role="img" aria-label="Comparación de valor de cartera con las mismas aportaciones"><text x="4" y="18" fill="#aebbd5" font-size="14">${esc(eur(hi))}</text>${results.map((r, i) => `<polyline fill="none" stroke="${colors[i]}" stroke-width="2.5" points="${r.observations.map((p, j) => `${40 + (j / Math.max(1, n - 1)) * 750},${220 - (p.value / hi) * 190}`).join(" ")}"/>`).join("")}<text x="4" y="238" fill="#aebbd5" font-size="14">0 €</text></svg><div class="legend"><span>${results[0].startDate}</span><span>${results[0].endDate}</span></div></div>`;
}
export function renderBacktest(o, c) {
  const all = enabled(c);
  o.innerHTML = `<section class="view"><div class="view-title"><div><h1>Comparar estrategias</h1><p>Mismo universo, mismas aportaciones y mismas fechas</p></div></div><form id="bt" class="panel"><div class="form-grid"><label>Universo<select name="universe"><option value="core">Core 4 · histórico largo</option><option value="all">Todos los activos</option><option value="custom">Selección personalizada</option></select></label><label>Período<select name="period"><option value="3">3 años</option><option value="5">5 años</option><option value="10">10 años</option><option value="max">Máximo común</option></select></label><label>Ventanas móviles<select name="rolling"><option value="1">1 año</option><option value="2">2 años</option><option value="3" selected>3 años</option></select></label></div><div class="form-grid"><label>Desde<input name="start" type="date" required></label><label>Hasta<input name="end" type="date" required></label><label>Capital inicial total (€)<input name="capital" type="number" min="0" step="1" value="0"></label></div><fieldset><legend>Activos del ensayo</legend><div class="asset-selection">${all.map((a) => `<label><input type="checkbox" name="asset" value="${esc(a.id)}" ${["world", "sp500", "value", "em-value"].includes(a.id) ? "checked" : ""}>${esc(a.name)}</label>`).join("")}</div></fieldset><p>Los ETFs recientes acortan el período común. Se requieren 252 sesiones de calentamiento por activo. El capital inicial se reparte por pesos objetivo, sin usar tu cartera actual como si hubiera existido en el pasado.</p><button>Comparar las tres estrategias</button></form><div id="br" aria-live="polite"></div></section>`;
  const f = o.querySelector("#bt"),
    out = o.querySelector("#br");
  function chooseDates() {
    const selected = all.filter(
        (a) => f.querySelector(`input[name="asset"][value="${a.id}"]`).checked,
      ),
      firsts = selected.map((a) => series(c, a.id)[252]?.date).filter(Boolean),
      lasts = selected.map((a) => series(c, a.id).at(-1)?.date).filter(Boolean);
    if (firsts.length === selected.length && lasts.length) {
      const end = lasts.sort()[0],
        earliest = firsts.sort().at(-1),
        cut = new Date(end + "T00:00:00Z");
      cut.setUTCFullYear(
        cut.getUTCFullYear() - Number(f.elements.period.value),
      );
      f.elements.end.value = end;
      f.elements.start.value =
        f.elements.period.value === "max"
          ? earliest
          : [earliest, cut.toISOString().slice(0, 10)].sort().at(-1);
    }
  }
  f.elements.universe.onchange = () => {
    if (f.elements.universe.value !== "custom") {
      for (const input of f.querySelectorAll('[name="asset"]'))
        input.checked =
          f.elements.universe.value === "all" ||
          ["world", "sp500", "value", "em-value"].includes(input.value);
      chooseDates();
    }
  };
  f.elements.period.onchange = chooseDates;
  for (const input of f.querySelectorAll('[name="asset"]'))
    input.onchange = () => {
      f.elements.universe.value = "custom";
      chooseDates();
    };
  chooseDates();
  f.onsubmit = (e) => {
    e.preventDefault();
    out.innerHTML = notice("Calculando…");
    setTimeout(() => {
      try {
        const d = new FormData(f),
          ids = d.getAll("asset"),
          assets = all.filter((a) => ids.includes(a.id));
        if (!assets.length) throw new Error("Selecciona al menos un activo.");
        if (
          assets.some(
            (a) =>
              c.marketCache?.[a.id]?.currency !== "EUR" ||
              c.marketCache?.[a.id]?.symbol !== symbol(c, a),
          )
        )
          throw new Error(
            "Descarga precios en EUR con los símbolos actuales antes del backtest.",
          );
        const capital = Number(d.get("capital"));
        if (!Number.isInteger(capital) || capital < 0)
          throw new Error("Capital inicial inválido.");
        const sum = assets.reduce((s, a) => s + a.targetWeight, 0),
          req = {
            assets,
            histories: Object.fromEntries(
              assets.map((a) => [a.id, series(c, a.id)]),
            ),
            initialHoldings: Object.fromEntries(
              assets.map((a) => [a.id, (capital * a.targetWeight) / sum]),
            ),
            monthlyContribution: c.settings.monthlyContribution,
            startDate: d.get("start"),
            endDate: d.get("end"),
            warmupTradingDays: 252,
            macroHistories: c.macroHistories,
            smartDcaPolicy: { ...c.settings.smartDcaPolicy, useMacro: false },
          };
        const results = ["targetDca", "contributionRebalance", "smartDca"].map(
          (strategy) => runBacktest({ ...req, strategy }),
        );
        let macroMessage = "";
        try {
          results.push(runBacktest({ ...req, strategy: "smartDcaMacro" }));
        } catch (e) {
          macroMessage = e.message;
        }
        const rolling = rollingComparison(req, Number(d.get("rolling")));
        const labels = [
          "DCA objetivo",
          "Rebalanceo con aportaciones",
          "Smart DCA",
          "Smart DCA + macro",
        ];
        const metrics = [
          ["Capital inicial", (r) => eur(r.initialValue)],
          ["Aportaciones", (r) => eur(r.totalContributed)],
          ["Valor final", (r) => eur(r.terminalValue)],
          ["Ganancia de mercado", (r) => eur(r.marketGain)],
          ["TWR anualizado", (r) => pct(r.metrics.annualizedTwr)],
          ["XIRR", (r) => pct(r.metrics.xirr)],
          ["Caída máxima del rendimiento", (r) => pct(r.metrics.maxDrawdown)],
          ["Volatilidad anual", (r) => pct(r.metrics.volatility)],
          ["Sharpe (tasa libre de riesgo 0)", (r) => num(r.metrics.sharpe)],
        ];
        out.innerHTML = `${macroMessage ? notice("Comparación macro no calculada: " + macroMessage) : ""}${equityChart(results)}<div class="panel table-wrap"><table><thead><tr><th>Métrica</th>${labels
          .slice(0, results.length)
          .map((x) => `<th>${x}</th>`)
          .join(
            "",
          )}</tr></thead><tbody>${metrics.map(([name, fn]) => `<tr><td>${name}</td>${results.map((r) => `<td>${fn(r)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>${notice(`${results[0].ledger.length} compras mensuales · período común ${results[0].startDate} a ${results[0].endDate}. Dividendos/splits según cierre ajustado de Yahoo. Sin comisiones, impuestos, intereses de la reserva ni deslizamiento. Días comunes a todos los activos; volatilidad anualizada a 252 sesiones.`)}<div class="panel"><h2>Ventanas móviles · ${d.get("rolling")} años</h2><div class="stats"><article><span>Ventanas completas</span><b>${rolling.n}</b></article><article><span>Smart DCA supera a DCA</span><b>${rolling.wins} / ${rolling.n}</b></article><article><span>Diferencia mediana TWR anual</span><b>${pct(rolling.median)}</b></article><article><span>P10 / P90</span><b>${pct(rolling.p10)} / ${pct(rolling.p90)}</b></article></div><p>${rolling.insufficient ? "Muestra insuficiente: menos de 5 ventanas válidas. " : ""}${rolling.overlapping ? "Las ventanas se solapan. No son pruebas estadísticas independientes." : "Ventanas sin solapamiento; resultados descriptivos."} Paso de 12 meses; mismo calentamiento previo en cada ensayo.</p></div><details class="panel"><summary>Auditar las compras Smart DCA</summary><div class="table-wrap"><table><thead><tr><th>Compra</th><th>Última información</th><th>Reparto</th></tr></thead><tbody>${results[2].ledger
          .map(
            (l) =>
              `<tr><td>${l.executionDate}</td><td>${l.signalCutoff}</td><td>${Object.entries(
                l.allocations,
              )
                .map(
                  ([id, v]) =>
                    `${esc(assets.find((a) => a.id === id).name)}: ${eur(v)}`,
                )
                .join(" · ")}</td></tr>`,
          )
          .join(
            "",
          )}</tbody></table></div></details><p class="muted">Este ensayo es descriptivo. No prueba que una estrategia vaya a superar al DCA en el futuro. No se incluyen series fundamentales actuales en decisiones pasadas.</p>`;
      } catch (e) {
        out.innerHTML = notice(e.message);
      }
    }, 0);
  };
}
export function renderSettings(o, c) {
  const rows = c.settings.assets
    .map(
      (a, i) =>
        `<tr><td><input aria-label="Nombre del activo ${i + 1}" data-name="${i}" value="${esc(a.name)}"></td><td><input aria-label="Activar ${esc(a.name)}" data-enabled="${i}" type="checkbox" ${a.enabled ? "checked" : ""}></td><td><input aria-label="Peso de ${esc(a.name)}" data-target="${i}" type="number" min="0" max="100" step="any" value="${a.targetWeight * 100}"></td><td><input aria-label="Valor actual de ${esc(a.name)}" data-holding="${i}" type="number" min="0" step="any" value="${c.settings.holdings?.[a.id] ?? 0}"></td><td><input aria-label="Símbolo Yahoo de ${esc(a.name)}" data-symbol="${i}" value="${esc(symbol(c, a))}"></td></tr>`,
    )
    .join("");
  o.innerHTML = `<section class="view"><div class="view-title"><div><h1>Ajustes</h1><p>Versión ${esc(c.version)} · datos guardados en este dispositivo</p></div></div><form id="settings" class="panel"><div class="form-grid"><label>Aportación mensual (€)<input name="contribution" type="number" min="0" step="1" required value="${c.settings.monthlyContribution}"></label><label>Reserva táctica (€)<input name="reserve" type="number" min="0" step="1" required value="${c.settings.reserve ?? 0}"></label></div><label>Servicio Yahoo<input name="worker" type="url" required value="${esc(c.settings.dataProvider?.baseUrl || "")}"></label><p>${esc(c.settings.targetBasis || "Pesos relativos de los activos incluidos en el Radar.")}</p><div class="table-wrap"><table class="settings-table"><thead><tr><th>Activo</th><th>Activo</th><th>Peso %</th><th>Cartera €</th><th>Símbolo Yahoo</th></tr></thead><tbody>${rows}</tbody></table></div><div class="actions"><button type="button" id="normalize">Normalizar pesos al 100%</button><button type="button" id="add">Añadir activo</button></div><fieldset><legend>Fuentes macro</legend><label class="check"><input name="macroEnabled" type="checkbox" ${c.settings.macroEnabled !== false ? "checked" : ""}>Actualizar macro FRED</label><label>Clave FRED (local; permite históricos con vintages)<input name="fredKey" type="password" autocomplete="off" value="${esc(c.settings.credentials?.fredKey || "")}"></label></fieldset><fieldset><legend>Smart DCA</legend><label class="check"><input name="useMacro" type="checkbox" ${c.settings.smartDcaPolicy.useMacro ? "checked" : ""}>Modular la intensidad de caída con el régimen macro</label><p>Ajuste experimental, desactivado por defecto. La intensidad de caída se multiplica por 1 + 0,5 × (score macro − 50) / 50. No se cambia la aportación ni se ejecutan ventas.</p><div class="form-grid"><label>Intensidad de caída<input name="draw" type="number" min="0" step="0.1" value="${c.settings.smartDcaPolicy.drawdownStrength}"></label><label>Intensidad de infraponderación<input name="under" type="number" min="0" step="0.05" value="${c.settings.smartDcaPolicy.underweightStrength}"></label><label>Máximo extra sobre objetivo (%)<input name="cap" type="number" min="0" max="100" step="1" value="${c.settings.smartDcaPolicy.maxContributionShare * 100}"></label></div></fieldset><button>Guardar ajustes</button><div id="settings-feedback" aria-live="polite"></div></form><div class="panel"><h2>Copias de seguridad</h2><label class="check"><input id="secrets" type="checkbox">Incluir claves API guardadas en la exportación</label><button id="export">Exportar configuración e histórico</button><label>Restaurar backup (V3 o versiones anteriores)<input id="import" type="file" accept="application/json,.json,.txt"></label><p>Las claves de versiones anteriores se conservan localmente. El servicio actual usa Yahoo; FRED proporciona el contexto macro; EODHD queda archivado y no se utiliza para precios. Yahoo es la única fuente de precios.</p></div></section>`;
  const f = o.querySelector("#settings"),
    feedback = o.querySelector("#settings-feedback");
  function staged() {
    const s = structuredClone(c.settings);
    s.holdings = { ...s.holdings };
    s.monthlyContribution = Number(f.elements.contribution.value);
    s.reserve = Number(f.elements.reserve.value);
    s.dataProvider = {
      ...s.dataProvider,
      baseUrl: f.elements.worker.value.trim(),
      symbols: {},
    };
    s.assets = s.assets.map((a, i) => ({
      ...a,
      name: o.querySelector(`[data-name="${i}"]`).value.trim() || a.id,
      enabled: o.querySelector(`[data-enabled="${i}"]`).checked,
      targetWeight: Number(o.querySelector(`[data-target="${i}"]`).value) / 100,
      symbols: {
        ...a.symbols,
        yahoo: o.querySelector(`[data-symbol="${i}"]`).value.trim(),
      },
    }));
    s.assets.forEach(
      (a, i) =>
        (s.holdings[a.id] = Number(
          o.querySelector(`[data-holding="${i}"]`).value,
        )),
    );
    s.smartDcaPolicy = {
      drawdownStrength: Number(f.elements.draw.value),
      underweightStrength: Number(f.elements.under.value),
      maxContributionShare: Number(f.elements.cap.value) / 100,
      useMacro: f.elements.useMacro.checked,
      macroStrength: 0.5,
    };
    s.macroEnabled = f.elements.macroEnabled.checked;
    s.credentials = {
      ...s.credentials,
      fredKey: f.elements.fredKey.value.trim(),
    };
    return s;
  }
  f.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const s = validateSettings(staged());
      await c.commit({ settings: s, marketCache: c.marketCache });
      c.settings = s;
      feedback.innerHTML = notice(
        "Ajustes guardados. Actualiza precios si has cambiado símbolos.",
      );
      c.notify("Ajustes guardados");
    } catch (e) {
      feedback.innerHTML = notice(e.message);
    }
  };
  o.querySelector("#normalize").onclick = () => {
    const inputs = c.settings.assets.map((a, i) => ({
        input: o.querySelector(`[data-target="${i}"]`),
        on: o.querySelector(`[data-enabled="${i}"]`).checked,
      })),
      sum = inputs
        .filter((x) => x.on)
        .reduce((s, x) => s + Number(x.input.value), 0);
    if (!Number.isFinite(sum) || sum <= 0)
      return (feedback.innerHTML = notice("Introduce pesos positivos."));
    inputs
      .filter((x) => x.on)
      .forEach((x) => (x.input.value = (Number(x.input.value) * 100) / sum));
  };
  o.querySelector("#add").onclick = () => {
    const s = staged();
    s.assets.push({
      id: "asset-" + crypto.randomUUID(),
      name: "Nuevo activo",
      enabled: false,
      targetWeight: 0,
      symbols: { yahoo: "" },
    });
    renderSettings(o, { ...c, settings: s });
  };
  o.querySelector("#export").onclick = () => {
    try {
      const b = createBackup(
        {
          settings: c.settings,
          marketCache: c.marketCache,
          macroHistories: c.macroHistories,
        },
        { includeSecrets: o.querySelector("#secrets").checked },
      );
      const u = URL.createObjectURL(
          new Blob([JSON.stringify(b, null, 2)], { type: "application/json" }),
        ),
        a = document.createElement("a");
      a.href = u;
      a.download = `market-radar-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(u), 1000);
    } catch (e) {
      c.notify(e.message);
    }
  };
  o.querySelector("#import").onchange = async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      const staged = restoreBackup(JSON.parse(await file.text()), c);
      await c.commit(staged);
      Object.assign(c, staged);
      c.notify("Backup restaurado");
      renderSettings(o, c);
    } catch (e) {
      c.notify(`Backup rechazado: ${e.message}`);
    }
  };
}
export const VIEW_RENDERERS = {
  radar: renderRadar,
  buy: renderBuy,
  backtest: renderBacktest,
  settings: renderSettings,
};
