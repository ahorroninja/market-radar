import {
  allocateTargetDca,
  allocateContributionRebalance,
} from "./backtest.js";
import { executionAssumptions, executeBudget } from "./execution.js";
import { buildPortfolioSnapshot } from "./portfolio.js";
export const PROSPECTIVE_PROTOCOL = "paper-dca-rebalance-1";
const strategies = ["targetDca", "contributionRebalance"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export function decisionDate(now) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(
    new Date(now),
  );
}
function fail(message) {
  throw new Error(message);
}
function historiesFor(journal, cache) {
  return Object.fromEntries(
    journal.assets.map((a) => {
      const s = cache[a.id];
      if (
        !s ||
        s.currency !== "EUR" ||
        s.symbol !== a.symbols.yahoo ||
        !s.points?.length
      )
        fail(
          "Faltan precios EUR del símbolo fijado en el seguimiento: " + a.name,
        );
      return [a.id, s.points];
    }),
  );
}
function datesFor(journal, histories) {
  const sets = journal.assets.map(
    (a) => new Set(histories[a.id].map((p) => p.date)),
  );
  return [...sets[0]].filter((d) => sets.every((s) => s.has(d))).sort();
}
function priceAt(histories, id, date) {
  const p = histories[id].find((p) => p.date === date)?.close;
  if (!Number.isFinite(p) || p <= 0) fail("Falta un cierre común trazable.");
  return p;
}
function accrue(cash, from, to, rate) {
  return (
    cash *
    (1 + rate) **
      (Math.max(0, Date.parse(to) - Date.parse(from)) / 86400000 / 365.25)
  );
}
function bookAt(journal, histories, priceDate, strategy) {
  let cash = journal.config.initialCash,
    costs = 0,
    totalContributed = 0,
    previous = decisionDate(journal.createdAt),
    revisions = 0;
  const shares = Object.fromEntries(journal.assets.map((a) => [a.id, 0]));
  for (const d of journal.decisions.filter(
    (d) => d.executionDate && d.executionDate <= priceDate,
  )) {
    cash = accrue(
      cash,
      previous,
      d.executionDate,
      journal.config.cashAnnualRate,
    );
    cash += journal.monthlyContribution;
    totalContributed += journal.monthlyContribution;
    for (const a of journal.assets) {
      const fill = executeBudget(
        d.allocations[strategy][a.id] || 0,
        journal.config,
      );
      const currentBasis = priceAt(histories, a.id, d.executionDate);
      if (Math.abs(currentBasis / d.executionPrices[a.id] - 1) > 1e-8)
        revisions++;
      // Return-total units are rebased to today's homogeneous adjusted series.
      // Monetary orders and their decision inputs remain unchanged.
      shares[a.id] += fill.invested / currentBasis;
      cash -= fill.spent;
      costs += fill.cost;
    }
    if (cash < -1e-6)
      fail("El presupuesto virtual excede el efectivo disponible.");
    previous = d.executionDate;
  }
  cash = accrue(cash, previous, priceDate, journal.config.cashAnnualRate);
  const holdings = journal.assets.map((a) => ({
    assetId: a.id,
    value: shares[a.id] * priceAt(histories, a.id, priceDate),
  }));
  const portfolio = buildPortfolioSnapshot(priceDate, holdings);
  return {
    portfolio,
    cash,
    costs,
    totalContributed,
    value: portfolio.totalValue + cash,
    revisions,
  };
}
export function validateProspective(j) {
  if (j == null) return;
  if (
    j.protocol !== PROSPECTIVE_PROTOCOL ||
    !Number.isFinite(Date.parse(j.createdAt)) ||
    !Array.isArray(j.assets) ||
    !j.assets.length ||
    !Array.isArray(j.decisions) ||
    !Number.isInteger(j.monthlyContribution) ||
    j.monthlyContribution < 0 ||
    new Set(j.assets.map((a) => a.id)).size !== j.assets.length ||
    j.assets.some(
      (a) =>
        !a.id ||
        !a.symbols?.yahoo ||
        !Number.isFinite(a.targetWeight) ||
        !(a.targetWeight > 0),
    )
  )
    fail("Seguimiento virtual inválido.");
  const checked = executionAssumptions(j.config);
  if (
    !j.config ||
    j.config.reserveMode !== "immediate" ||
    [
      "initialCash",
      "cashAnnualRate",
      "feeRate",
      "fixedFee",
      "slippageRate",
    ].some((k) => j.config[k] !== checked[k])
  )
    fail("Configuración fijada del seguimiento inválida.");
  let last = "",
    pending = false;
  for (const d of j.decisions) {
    if (
      !datePattern.test(d.decisionDate) ||
      !datePattern.test(d.signalCutoff) ||
      decisionDate(d.createdAt) !== d.decisionDate ||
      d.signalCutoff > d.decisionDate ||
      d.decisionDate.slice(0, 7) <= last ||
      pending ||
      Date.parse(d.createdAt) < Date.parse(j.createdAt) ||
      (d.executionDate &&
        (!datePattern.test(d.executionDate) ||
          d.executionDate <= d.decisionDate ||
          !Number.isFinite(Date.parse(d.observedAt)) ||
          decisionDate(d.observedAt) < d.executionDate))
    )
      fail("Fechas del seguimiento inválidas o retrospectivas.");
    for (const a of j.assets) {
      if (
        !Number.isFinite(d.signalPrices?.[a.id]) ||
        !(d.signalPrices[a.id] > 0) ||
        (d.executionDate &&
          (!Number.isFinite(d.executionPrices?.[a.id]) ||
            !(d.executionPrices[a.id] > 0)))
      )
        fail("Precios del registro inválidos.");
      for (const s of strategies)
        if (
          !Number.isInteger(d.allocations?.[s]?.[a.id]) ||
          d.allocations[s][a.id] < 0
        )
          fail("Reparto del registro inválido.");
    }
    last = d.decisionDate.slice(0, 7);
    pending = !d.executionDate;
  }
}
function appendDecision(j, cache, now) {
  const date = decisionDate(now),
    histories = historiesFor(j, cache);
  const cutoff = datesFor(j, histories)
    .filter((d) => d <= date)
    .at(-1);
  if (!cutoff || Date.parse(date) - Date.parse(cutoff) > 7 * 86400000)
    fail(
      "Actualiza precios: el seguimiento exige un cierre común de los últimos siete días.",
    );
  if (j.decisions.some((d) => !d.executionDate)) return j;
  if (j.decisions.some((d) => d.decisionDate.slice(0, 7) === date.slice(0, 7)))
    return j;
  const allocations = {};
  for (const strategy of strategies) {
    const b = bookAt(j, histories, cutoff, strategy);
    const cashFrom =
      cutoff < decisionDate(j.createdAt) ? decisionDate(j.createdAt) : cutoff;
    const availableCash = accrue(
      b.cash,
      cashFrom,
      date,
      j.config.cashAnnualRate,
    );
    const budget = Math.floor(availableCash + j.monthlyContribution + 1e-9);
    allocations[strategy] =
      strategy === "targetDca"
        ? allocateTargetDca(j.assets, budget)
        : allocateContributionRebalance(j.assets, b.portfolio, budget);
  }
  j.decisions.push({
    createdAt: now,
    decisionDate: date,
    signalCutoff: cutoff,
    signalPrices: Object.fromEntries(
      j.assets.map((a) => [a.id, priceAt(histories, a.id, cutoff)]),
    ),
    allocations,
    executionDate: null,
  });
  return j;
}
export function startProspective({
  assets,
  cache,
  monthlyContribution,
  assumptions,
  version,
  now = new Date().toISOString(),
}) {
  const j = {
    protocol: PROSPECTIVE_PROTOCOL,
    createdAt: now,
    appVersion: version,
    assets: structuredClone(assets),
    monthlyContribution,
    config: executionAssumptions({ ...assumptions, reserveMode: "immediate" }),
    decisions: [],
  };
  validateProspective(j);
  appendDecision(j, cache, now);
  validateProspective(j);
  return j;
}
export function advanceProspective(
  journal,
  cache,
  now = new Date().toISOString(),
) {
  validateProspective(journal);
  const j = structuredClone(journal),
    histories = historiesFor(j, cache),
    today = decisionDate(now);
  const dates = datesFor(j, histories).filter((d) => d <= today);
  for (const d of j.decisions.filter((d) => !d.executionDate)) {
    const date = dates.find((date) => date > d.decisionDate);
    if (date) {
      d.executionDate = date;
      d.observedAt = now;
      d.executionPrices = Object.fromEntries(
        j.assets.map((a) => [a.id, priceAt(histories, a.id, date)]),
      );
    }
  }
  try {
    appendDecision(j, cache, now);
    j.notice = null;
  } catch (e) {
    j.notice = e.message;
  }
  validateProspective(j);
  return j;
}
export function prospectiveStatus(
  journal,
  cache,
  now = new Date().toISOString(),
) {
  validateProspective(journal);
  const histories = historiesFor(journal, cache),
    date = datesFor(journal, histories)
      .filter((d) => d <= decisionDate(now))
      .at(-1);
  if (!date) fail("Sin precios comunes para valorar el seguimiento.");
  const monthIndex = (d) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7));
  const skipped = journal.decisions.length
    ? monthIndex(journal.decisions.at(-1).decisionDate) -
      monthIndex(journal.decisions[0].decisionDate) +
      1 -
      journal.decisions.length
    : 0;
  return {
    priceDate: date,
    skipped,
    results: Object.fromEntries(
      strategies.map((s) => [s, bookAt(journal, histories, date, s)]),
    ),
    completed: journal.decisions.filter((d) => d.executionDate).length,
    pending: journal.decisions.filter((d) => !d.executionDate).length,
  };
}
