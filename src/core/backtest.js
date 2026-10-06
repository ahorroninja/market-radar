import { macroAt } from "./macro.js";
import { allocateSmartDca, roundWholeEuros } from "./smart-dca.js";
import { indicatorSnapshot } from "./radar.js";
import { drawdown } from "./indicators.js";
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
  const assumptions = {
    initialCash: 0,
    cashAnnualRate: 0,
    feeRate: 0,
    fixedFee: 0,
    slippageRate: 0,
    reserveMode: "immediate",
    ...req.assumptions,
  };
  if (
    ![
      assumptions.initialCash,
      assumptions.cashAnnualRate,
      assumptions.feeRate,
      assumptions.fixedFee,
      assumptions.slippageRate,
    ].every((x) => Number.isFinite(x) && x >= 0) ||
    !Number.isInteger(assumptions.initialCash) ||
    assumptions.cashAnnualRate > 0.2 ||
    assumptions.feeRate > 0.1 ||
    assumptions.slippageRate > 0.1 ||
    !["immediate", "ladder"].includes(assumptions.reserveMode)
  )
    throw err(
      "INVALID_ASSUMPTIONS",
      "Hipótesis de costes o reserva inválidas.",
    );
  let cash = assumptions.initialCash,
    initialValue = cash,
    costs = 0,
    releasedFraction = 0,
    previousDate = req.startDate;
  const expiry = new Date(req.startDate + "T00:00:00Z");
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  const reserveExpiry = expiry.toISOString().slice(0, 10);
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
    const elapsedDays =
      (Date.parse(date) - Date.parse(previousDate)) / 86400000;
    cash *= (1 + assumptions.cashAnnualRate) ** (elapsedDays / 365.25);
    previousDate = date;
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
      flow = req.monthlyContribution;
      cash += flow;
      const totalWeight = assets.reduce((s, a) => s + a.targetWeight, 0);
      const weightedDrawdown =
        assets.reduce(
          (s, a) => s + a.targetWeight * (drawdown(known[a.id]) ?? 0),
          0,
        ) / totalWeight;
      // Research rule fixed before evaluation: cumulative 25/50/100% at
      // weighted drawdowns 10/20/30%, all residual after 12 months. No refill.
      const fraction =
        assumptions.reserveMode === "immediate" || date >= reserveExpiry
          ? 1
          : weightedDrawdown <= -0.3 + 1e-12
            ? 1
            : weightedDrawdown <= -0.2 + 1e-12
              ? 0.5
              : weightedDrawdown <= -0.1 + 1e-12
                ? 0.25
                : 0;
      const release =
        Math.max(0, fraction - releasedFraction) * assumptions.initialCash;
      releasedFraction = Math.max(releasedFraction, fraction);
      const budget = Math.floor(
        Math.min(cash, fraction === 1 ? cash : flow + release),
      );
      let allocations;
      if (req.strategy === "targetDca")
        allocations = allocateTargetDca(assets, budget);
      else if (req.strategy === "contributionRebalance")
        allocations = allocateContributionRebalance(assets, portfolio, budget);
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
          contribution: budget,
          assets,
          portfolio,
          indicators: assets.map((a) =>
            indicatorSnapshot(a.id, known[a.id], { macro: macro?.score }),
          ),
          policy: { ...req.smartDcaPolicy, useMacro },
        }).allocations;
      }
      const invested = {},
        orderCosts = {};
      for (const a of assets) {
        const gross = allocations[a.id] || 0;
        if (gross <= assumptions.fixedFee) {
          invested[a.id] = 0;
          orderCosts[a.id] = 0;
          continue;
        }
        const net =
          (gross - assumptions.fixedFee) /
          (1 + assumptions.feeRate + assumptions.slippageRate);
        const expense = gross - net;
        shares[a.id] += net / maps[a.id].get(date);
        cash -= gross;
        costs += expense;
        invested[a.id] = net;
        orderCosts[a.id] = expense;
      }
      externalFlows.push({ date, amount: flow });
      ledger.push({
        executionDate: date,
        signalCutoff,
        allocations,
        invested,
        orderCosts,
        cashRemaining: cash,
        reserveReleasedFraction: releasedFraction,
        executionPrices: Object.fromEntries(
          assets.map((a) => [a.id, maps[a.id].get(date)]),
        ),
      });
      lastMonth = month;
    }
    observations.push({
      date,
      value:
        cash +
        assets.reduce((s, a) => s + shares[a.id] * maps[a.id].get(date), 0),
      externalFlow: flow,
      cash,
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
    terminalCash: cash,
    costs,
    assumptions,
    metrics: backtestMetrics(observations, initialValue, req.startDate),
  };
}
