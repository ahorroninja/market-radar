import test from "node:test";
import assert from "node:assert/strict";
import {
  startProspective,
  advanceProspective,
  prospectiveStatus,
  decisionDate,
} from "../../src/core/prospective.js";
import { createBackup, restoreBackup } from "../../src/storage/backup.js";
import { freshSettings } from "../../src/domain/defaults.js";
const assets = ["a", "b"].map((id) => ({
  id,
  name: id,
  enabled: true,
  targetWeight: 0.5,
  symbols: { yahoo: id + ".L" },
}));
function cache(rows) {
  return Object.fromEntries(
    assets.map((a, i) => [
      a.id,
      {
        assetId: a.id,
        source: "yahoo",
        currency: "EUR",
        symbol: a.symbols.yahoo,
        points: rows.map(([date, ...prices]) => ({ date, close: prices[i] })),
        asOf: rows.at(-1)[0],
      },
    ]),
  );
}
const initial = cache([
  ["2026-01-01", 100, 100],
  ["2026-01-02", 100, 100],
]);
const firstFill = cache([
  ["2026-01-01", 100, 100],
  ["2026-01-02", 100, 100],
  ["2026-01-05", 100, 100],
  ["2026-01-06", 200, 100],
]);
const now = "2026-01-02T20:00:00Z";
function start(overrides = {}) {
  return startProspective({
    assets,
    cache: initial,
    monthlyContribution: 1000,
    assumptions: {},
    version: "test",
    now,
    ...overrides,
  });
}
test("prospective registration cannot execute at an already-known or same-day close", () => {
  const j = start();
  assert.equal(j.decisions[0].signalCutoff, "2026-01-02");
  assert.equal(j.decisions[0].executionDate, null);
  assert.equal(
    advanceProspective(j, initial, now).decisions[0].executionDate,
    null,
  );
  assert.equal(
    advanceProspective(j, firstFill, "2026-01-05T20:00:00Z").decisions[0]
      .executionDate,
    "2026-01-05",
  );
});
test("both strategies have equal external capital and preserved decisions on repeated updates", () => {
  const j = advanceProspective(start(), firstFill, "2026-01-06T20:00:00Z");
  const s = prospectiveStatus(j, firstFill, "2026-01-06T20:00:00Z");
  assert.equal(s.results.targetDca.totalContributed, 1000);
  assert.equal(s.results.contributionRebalance.totalContributed, 1000);
  assert.equal(s.results.targetDca.value, 1500);
  assert.deepEqual(advanceProspective(j, firstFill, "2026-01-06T21:00:00Z"), j);
});
test("next-month rebalance uses its own known virtual portfolio and ignores execution-day crash", () => {
  const feb = cache([
    ...firstFill.a.points.map((p, i) => [
      p.date,
      p.close,
      firstFill.b.points[i].close,
    ]),
    ["2026-02-02", 200, 100],
  ]);
  const j = advanceProspective(start(), feb, "2026-02-02T20:00:00Z");
  assert.deepEqual(j.decisions[1].allocations.targetDca, { a: 500, b: 500 });
  assert.deepEqual(j.decisions[1].allocations.contributionRebalance, {
    a: 250,
    b: 750,
  });
  const crashed = cache([
    ...feb.a.points.map((p, i) => [p.date, p.close, feb.b.points[i].close]),
    ["2026-02-03", 50, 100],
  ]);
  const settled = advanceProspective(j, crashed, "2026-02-03T20:00:00Z");
  assert.deepEqual(
    settled.decisions[1].allocations,
    j.decisions[1].allocations,
  );
  assert.equal(settled.decisions[1].executionDate, "2026-02-03");
});
test("missed months are not retrospectively backfilled", () => {
  const march = cache([
    ...firstFill.a.points.map((p, i) => [
      p.date,
      p.close,
      firstFill.b.points[i].close,
    ]),
    ["2026-03-02", 200, 100],
  ]);
  const j = advanceProspective(start(), march, "2026-03-02T20:00:00Z");
  assert.deepEqual(
    j.decisions.map((d) => d.decisionDate.slice(0, 7)),
    ["2026-01", "2026-03"],
  );
  assert.equal(prospectiveStatus(j, march, "2026-03-02T20:00:00Z").skipped, 1);
});
test("rules are cloned and stale or changed-symbol data fail explicitly", () => {
  const originals = structuredClone(assets),
    j = start({ assets: originals });
  originals[0].targetWeight = 0.9;
  assert.equal(j.assets[0].targetWeight, 0.5);
  assert.throws(
    () => start({ now: "2026-02-02T20:00:00Z" }),
    /Actualiza precios/,
  );
  assert.throws(
    () =>
      advanceProspective(
        j,
        { ...firstFill, a: { ...firstFill.a, symbol: "OTHER" } },
        "2026-01-06T20:00:00Z",
      ),
    /símbolo fijado/,
  );
});
test("costs remain inside budgets and cash interest is included", () => {
  const flat = cache([
    ["2026-01-01", 100, 100],
    ["2026-01-02", 100, 100],
    ["2026-01-05", 100, 100],
  ]);
  const j = advanceProspective(
    start({
      assumptions: { initialCash: 1000, fixedFee: 1, cashAnnualRate: 0.02 },
    }),
    flat,
    "2026-01-05T20:00:00Z",
  );
  const s = prospectiveStatus(j, flat, "2026-01-05T20:00:00Z");
  for (const r of Object.values(s.results)) {
    assert.equal(r.costs, 2);
    assert.ok(r.value > 1998 && r.value < 1999);
    assert.equal(r.totalContributed, 1000);
  }
});
test("homogeneous adjusted-price rebasing keeps recorded decisions and reports revisions", () => {
  const j = advanceProspective(start(), firstFill, "2026-01-06T20:00:00Z");
  const split = structuredClone(firstFill);
  for (const s of Object.values(split)) for (const p of s.points) p.close /= 2;
  const status = prospectiveStatus(j, split, "2026-01-06T20:00:00Z");
  assert.equal(status.results.targetDca.value, 1500);
  assert.ok(status.results.targetDca.revisions > 0);
  assert.equal(j.decisions[0].executionPrices.a, 100);
});
test("journal backup round-trips and invalid retrospective execution does not change current state", () => {
  const state = {
    settings: freshSettings(),
    marketCache: initial,
    paperJournal: start(),
  };
  const envelope = createBackup(state);
  assert.deepEqual(
    restoreBackup(envelope, state).paperJournal,
    state.paperJournal,
  );
  const bad = structuredClone(envelope);
  bad.paperJournal.decisions[0].executionDate = "2026-01-02";
  assert.throws(() => restoreBackup(bad, state), /retrospectivas/);
  assert.equal(state.paperJournal.decisions[0].executionDate, null);
});
test("decision calendar uses Madrid including UTC-day boundary", () => {
  assert.equal(decisionDate("2026-01-02T23:30:00Z"), "2026-01-03");
});
test("an old pending execution is preserved even if prices are too stale for a new decision", () => {
  const j = advanceProspective(start(), firstFill, "2026-02-02T20:00:00Z");
  assert.equal(j.decisions[0].executionDate, "2026-01-05");
  assert.equal(j.decisions.length, 1);
  assert.match(j.notice, /Actualiza precios/);
});
