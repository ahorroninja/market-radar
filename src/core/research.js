import { runBacktest } from "./backtest.js";

// Fixed candidate set; no optimizer, no hidden selection of the winner.
export const RESEARCH_PROTOCOL = "allocation-reserve-1";
export function researchCandidates(policy) {
  const base = { ...policy, useMacro: false };
  return [
    { id: "dca", label: "DCA objetivo", strategy: "targetDca" },
    {
      id: "rebalance",
      label: "Rebalanceo por aportaciones",
      strategy: "contributionRebalance",
    },
    {
      id: "draw",
      label: "Sólo caída",
      strategy: "smartDca",
      policy: { ...base, drawdownStrength: 1, underweightStrength: 0 },
    },
    {
      id: "under",
      label: "Sólo infraponderación",
      strategy: "smartDca",
      policy: { ...base, drawdownStrength: 0, underweightStrength: 0.35 },
    },
    {
      id: "smart",
      label: "Smart DCA configurado",
      strategy: "smartDca",
      policy: base,
    },
    {
      id: "weak",
      label: "Caída suave (0,5)",
      strategy: "smartDca",
      policy: { ...base, drawdownStrength: 0.5 },
    },
    {
      id: "strong",
      label: "Caída intensa (2)",
      strategy: "smartDca",
      policy: { ...base, drawdownStrength: 2 },
    },
    {
      id: "reserveDca",
      label: "DCA + reserva escalonada",
      strategy: "targetDca",
      reserveMode: "ladder",
    },
    {
      id: "reserveSmart",
      label: "Smart + reserva escalonada",
      strategy: "smartDca",
      policy: base,
      reserveMode: "ladder",
    },
  ];
}
export function evaluateResearch(req) {
  const candidates = researchCandidates(req.smartDcaPolicy);
  const simulate = (
    candidate,
    startDate = req.startDate,
    endDate = req.endDate,
  ) =>
    runBacktest({
      ...req,
      startDate,
      endDate,
      initialHoldings: {},
      strategy: candidate.strategy,
      smartDcaPolicy: candidate.policy || {
        ...req.smartDcaPolicy,
        useMacro: false,
      },
      assumptions: {
        ...req.assumptions,
        reserveMode: candidate.reserveMode || "immediate",
      },
    });
  const first = simulate(candidates[0]);
  const results = candidates.map((candidate, i) => ({
    ...candidate,
    result: i ? simulate(candidate) : first,
  }));
  const midpoint = new Date(
    (Date.parse(first.startDate) + Date.parse(first.endDate)) / 2,
  );
  const splitDate = midpoint.toISOString().slice(0, 10);
  const before = new Date(splitDate + "T00:00:00Z");
  before.setUTCDate(before.getUTCDate() - 1);
  const periods = [
    {
      label: "Primer bloque temporal",
      startDate: first.startDate,
      endDate: before.toISOString().slice(0, 10),
    },
    {
      label: "Segundo bloque temporal",
      startDate: splitDate,
      endDate: first.endDate,
    },
  ].filter(
    (p) => Date.parse(p.endDate) - Date.parse(p.startDate) >= 365.25 * 86400000,
  );
  const blocks = periods.map((p) => {
    const baseline = simulate(candidates[0], p.startDate, p.endDate);
    return {
      ...p,
      results: candidates.map((c) => ({
        id: c.id,
        deltaWealth:
          simulate(c, p.startDate, p.endDate).terminalValue -
          baseline.terminalValue,
      })),
    };
  });
  const windows = [];
  let cursor = new Date(first.startDate + "T00:00:00Z");
  while (true) {
    const finish = new Date(cursor);
    finish.setUTCFullYear(finish.getUTCFullYear() + 3);
    finish.setUTCDate(finish.getUTCDate() - 1);
    const startDate = cursor.toISOString().slice(0, 10),
      endDate = finish.toISOString().slice(0, 10);
    if (endDate > first.endDate) break;
    const baseline = simulate(candidates[0], startDate, endDate);
    windows.push({
      startDate,
      endDate,
      deltas: Object.fromEntries(
        candidates.map((c) => [
          c.id,
          simulate(c, startDate, endDate).terminalValue -
            baseline.terminalValue,
        ]),
      ),
    });
    cursor.setUTCFullYear(cursor.getUTCFullYear() + 1);
    if (windows.length >= 100) break;
  }
  return {
    protocol: RESEARCH_PROTOCOL,
    results,
    blocks,
    windows,
    insufficient: windows.length < 5,
    conclusion:
      "Ventaja futura no demostrada. Comparación retrospectiva; los bloques temporales no son datos desconocidos y las ventanas se solapan.",
  };
}
