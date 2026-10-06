import { macroAt } from "./macro.js";
import { allocateSmartDca, roundWholeEuros } from "./smart-dca.js";
import { indicatorSnapshot } from "./radar.js";
import { buildPortfolioSnapshot } from "./portfolio.js";
import { backtestMetrics } from "./metrics.js";
import { normalizePriceSeries } from "../data/normalize.js";
function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}
function commonDates(assets, histories, start, end) {
  const sets = assets.map(
    (a) =>
      new Set(
        histories[a.id]
          .filter((p) => p.date >= start && p.date <= end)
          .map((p) => p.date),
      ),
  );
  return sets.length
    ? [...sets[0]].filter((d) => sets.every((s) => s.has(d))).sort()
    : [];
}
export function allocateTargetDca(assets, amount) {
  const enabled = assets.filter((a) => a.enabled && a.targetWeight > 0),
    sum = enabled.reduce((s, a) => s + a.targetWeight, 0);
  if (!sum) throw err("INVALID_TARGETS", "No hay pesos positivos.");
  return roundWholeEuros(
    Object.fromEntries(
      enabled.map((a) => [a.id, (amount * a.targetWeight) / sum]),
    ),
    amount,
  );
}
export function allocateContributionRebalance(assets, portfolio, amount) {
  const positive = assets.filter((a) => a.enabled && a.targetWeight > 0),
    sum = positive.reduce((s, a) => s + a.targetWeight, 0),
    total = portfolio.totalValue + amount;
  const gaps = Object.fromEntries(
    positive.map((a) => [
      a.id,
      Math.max(
        0,
        (total * a.targetWeight) / sum -
          (portfolio.holdings.find((h) => h.assetId === a.id)?.value || 0),
      ),
    ]),
  );
  const deficit = Object.values(gaps).reduce((s, v) => s + v, 0);
  return deficit
    ? roundWholeEuros(
        Object.fromEntries(
          Object.entries(gaps).map(([id, v]) => [id, (amount * v) / deficit]),
        ),
        amount,
      )
    : allocateTargetDca(assets, amount);
}
export function runBacktest(req) {
  if (
    !req ||
    !Array.isArray(req.assets) ||
    !Number.isInteger(req.monthlyContribution) ||
    req.monthlyContribution < 0 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(req.startDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(req.endDate) ||
    req.startDate > req.endDate
  )
    throw err("INVALID_BACKTEST", "Comprueba las fechas y la aportación.");
  if (
    ![
      "targetDca",
      "contributionRebalance",
      "smartDca",
      "smartDcaMacro",
    ].includes(req.strategy)
  )
    throw err("UNSUPPORTED_STRATEGY", "Estrategia no reconocida.");
  if (
    new Set(req.assets.map((a) => a.id)).size !== req.assets.length ||
    req.assets.some(
      (a) => !a.id || !Number.isFinite(a.targetWeight) || a.targetWeight < 0,
    )
  )
    throw err("INVALID_ASSETS", "IDs duplicados o pesos inválidos.");
  const assets = req.assets
    .filter((a) => a.enabled && a.targetWeight > 0)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!assets.length)
    throw err("INVALID_ASSETS", "Selecciona activos para el backtest.");
  const histories = Object.fromEntries(
    assets.map((a) => [
      a.id,
      normalizePriceSeries(a.id, "backtest", req.histories?.[a.id] || [])
        .points,
    ]),
  );
  const dates = commonDates(assets, histories, req.startDate, req.endDate);
  if (!dates.length)
    throw err(
      "INSUFFICIENT_HISTORY",
      "No hay fechas comunes para estos activos. Reduce el universo o actualiza los precios.",
    );
  const maps = Object.fromEntries(
    assets.map((a) => [
      a.id,
      new Map(histories[a.id].map((p) => [p.date, p.close])),
    ]),
  );
  const cursors = Object.fromEntries(
    assets.map((a) => [
      a.id,
      histories[a.id].filter((p) => p.date < dates[0]).length,
    ]),
  );
  const initial = req.initialHoldings || {},
    shares = Object.fromEntries(assets.map((a) => [a.id, 0]));
  let initialValue = 0;
  for (const a of assets) {
    const v = initial[a.id] ?? 0;
    if (!Number.isFinite(v) || v < 0)
      throw err("INVALID_HOLDING", "Capital inicial inválido.");
    const p = histories[a.id][cursors[a.id] - 1]?.close;
    if (v > 0 && !p)
      throw err("MISSING_INITIAL_PRICE", `Falta precio inicial de ${a.name}`);
    shares[a.id] = p ? v / p : 0;
    initialValue += v;
  }
  const ledger = [],
    externalFlows = [],
    observations = [];
  let lastMonth = "";
  for (const date of dates) {
    for (const a of assets)
      while (
        cursors[a.id] < histories[a.id].length &&
        histories[a.id][cursors[a.id]].date < date
      )
        cursors[a.id]++;
    let flow = 0;
    const month = date.slice(0, 7);
    if (month !== lastMonth) {
      const prior = Object.fromEntries(
        assets.map((a) => [a.id, histories[a.id].slice(0, cursors[a.id])]),
      );
      const minimum = req.warmupTradingDays ?? 1;
      if (assets.some((a) => prior[a.id].length < minimum))
        throw err(
          "INSUFFICIENT_HISTORY",
          `Necesitas ${minimum} sesiones anteriores al inicio en cada activo.`,
        );
      const signalCutoff = assets
        .map((a) => prior[a.id].at(-1)?.date)
        .sort()[0];
      if (!signalCutoff)
        throw err(
          "INSUFFICIENT_HISTORY",
          "Faltan precios anteriores a la compra.",
        );
      const known = Object.fromEntries(
        assets.map((a) => [
          a.id,
          prior[a.id].filter((p) => p.date <= signalCutoff),
        ]),
      );
      const portfolio = buildPortfolioSnapshot(
        signalCutoff,
        assets.map((a) => ({
          assetId: a.id,
          value: shares[a.id] * (known[a.id].at(-1)?.close ?? 0),
        })),
      );
      let allocations;
      if (req.strategy === "targetDca")
        allocations = allocateTargetDca(assets, req.monthlyContribution);
      else if (req.strategy === "contributionRebalance")
        allocations = allocateContributionRebalance(
          assets,
          portfolio,
          req.monthlyContribution,
        );
      else {
        const useMacro =
          req.strategy === "smartDcaMacro" ||
          req.smartDcaPolicy.useMacro === true;
        const macro = useMacro
          ? macroAt(req.macroHistories, signalCutoff, { requireVintage: true })
          : null;
        if (useMacro && !macro)
          throw err(
            "MISSING_VINTAGE_MACRO",
            "Falta macro con fecha de publicación verificable para " +
              signalCutoff +
              ". El ensayo macro no usa series revisadas como datos del pasado.",
          );
        allocations = allocateSmartDca({
          contribution: req.monthlyContribution,
          assets,
          portfolio,
          indicators: assets.map((a) =>
            indicatorSnapshot(a.id, known[a.id], { macro: macro?.score }),
          ),
          policy: { ...req.smartDcaPolicy, useMacro },
        }).allocations;
      }
      for (const a of assets)
        shares[a.id] += (allocations[a.id] || 0) / maps[a.id].get(date);
      flow = req.monthlyContribution;
      externalFlows.push({ date, amount: flow });
      ledger.push({
        executionDate: date,
        signalCutoff,
        allocations,
        executionPrices: Object.fromEntries(
          assets.map((a) => [a.id, maps[a.id].get(date)]),
        ),
      });
      lastMonth = month;
    }
    observations.push({
      date,
      value: assets.reduce(
        (s, a) => s + shares[a.id] * maps[a.id].get(date),
        0,
      ),
      externalFlow: flow,
    });
  }
  const terminalValue = observations.at(-1).value,
    totalContributed = externalFlows.reduce((s, x) => s + x.amount, 0);
  return {
    ledger,
    externalFlows,
    observations,
    initialValue,
    startDate: dates[0],
    endDate: dates.at(-1),
    totalContributed,
    terminalValue,
    marketGain: terminalValue - initialValue - totalContributed,
    terminalShares: shares,
    metrics: backtestMetrics(observations, initialValue, req.startDate),
  };
}
