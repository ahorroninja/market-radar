import fs from "node:fs";
import crypto from "node:crypto";
import { evaluateResearch } from "../src/core/research.js";
import { freshSettings } from "../src/domain/defaults.js";
const [input, destination = "docs/RESEARCH_RESULTS.json"] =
  process.argv.slice(2);
if (!input)
  throw new Error(
    "Uso: node scripts/evaluate-research.mjs backup.json [salida.json]",
  );
const data = JSON.parse(fs.readFileSync(input, "utf8"));
const cache = data.marketCache;
if (!cache)
  throw new Error("Se requiere un backup V3 con históricos Yahoo en EUR.");
const settings = freshSettings(); // Never use private credentials, holdings or settings in the report.
const universes = [
  { id: "core4", ids: ["world", "sp500", "value", "em-value"] },
  { id: "long3", ids: ["world", "sp500", "value"] },
];
const output = {
  protocol: "allocation-reserve-1",
  generatedAt: new Date().toISOString(),
  dataHash: crypto
    .createHash("sha256")
    .update(
      JSON.stringify(
        Object.fromEntries(
          [...new Set(universes.flatMap((x) => x.ids))].map((id) => [
            id,
            cache[id].points,
          ]),
        ),
      ),
    )
    .digest("hex"),
  source:
    "Yahoo Finance adjusted daily closes, converted to EUR; input snapshot identified by SHA-256",
  warning:
    "Retrospective study. Current selected ETFs, adjusted history and overlapping windows. No demonstrated future advantage.",
  scenarios: [],
};
for (const universe of universes) {
  const assets = settings.assets.filter((a) => universe.ids.includes(a.id));
  if (
    assets.some(
      (a) =>
        cache[a.id].currency !== "EUR" ||
        cache[a.id].symbol !== a.symbols.yahoo,
    )
  )
    throw new Error("Símbolos o divisa no trazables.");
  const histories = Object.fromEntries(
    assets.map((a) => [a.id, cache[a.id].points]),
  );
  const startDate = assets
    .map((a) => histories[a.id][252]?.date)
    .sort()
    .at(-1);
  const endDate = assets.map((a) => histories[a.id].at(-1)?.date).sort()[0];
  for (const scenario of [
    {
      id: "net-reserve",
      initialCash: 6000,
      fixedFee: 1,
      feeRate: 0.0005,
      slippageRate: 0.0005,
      cashAnnualRate: 0.02,
    },
    {
      id: "gross-no-reserve",
      initialCash: 0,
      fixedFee: 0,
      feeRate: 0,
      slippageRate: 0,
      cashAnnualRate: 0,
    },
  ]) {
    const req = {
      assets,
      histories,
      startDate,
      endDate,
      monthlyContribution: 1000,
      warmupTradingDays: 252,
      smartDcaPolicy: settings.smartDcaPolicy,
      assumptions: scenario,
    };
    const study = evaluateResearch(req);
    const reference = study.results[0].result.terminalValue;
    output.scenarios.push({
      universe: universe.id,
      assets: assets.map((a) => ({
        id: a.id,
        symbol: a.symbols.yahoo,
        weight: a.targetWeight,
      })),
      assumptions: scenario,
      startDate,
      endDate,
      blocks: study.blocks,
      windows: study.windows,
      insufficient: study.insufficient,
      results: study.results.map(({ result, ...candidate }) => ({
        ...candidate,
        initialValue: result.initialValue,
        totalContributed: result.totalContributed,
        terminalValue: result.terminalValue,
        deltaWealth: result.terminalValue - reference,
        costs: result.costs,
        terminalCash: result.terminalCash,
        metrics: result.metrics,
      })),
    });
    console.log(
      universe.id,
      scenario.id,
      startDate,
      endDate,
      "windows",
      study.windows.length,
    );
    for (const row of output.scenarios.at(-1).results)
      console.log(
        row.id,
        "delta EUR",
        row.deltaWealth.toFixed(2),
        "XIRR",
        row.metrics.xirr?.toFixed(4),
      );
  }
}
fs.writeFileSync(destination, JSON.stringify(output, null, 2) + "\n");
