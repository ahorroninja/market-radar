import test from "node:test";
import assert from "node:assert/strict";
import { runBacktest } from "../../src/core/backtest.js";
import { evaluateResearch } from "../../src/core/research.js";
const asset = { id: "a", name: "A", enabled: true, targetWeight: 1 };
const policy = {
  drawdownStrength: 1,
  underweightStrength: 0.35,
  maxContributionShare: 0.4,
};
function request(overrides = {}) {
  return {
    assets: [asset],
    histories: {
      a: [
        { date: "2019-12-31", close: 100 },
        { date: "2020-01-02", close: 100 },
        { date: "2020-02-03", close: 100 },
        { date: "2021-01-04", close: 100 },
      ],
    },
    startDate: "2020-01-02",
    endDate: "2021-01-04",
    strategy: "targetDca",
    monthlyContribution: 100,
    smartDcaPolicy: policy,
    ...overrides,
  };
}
test("initial reserve is capital, its deployment is not an external contribution", () => {
  const r = runBacktest(request({ assumptions: { initialCash: 1000 } }));
  assert.equal(r.initialValue, 1000);
  assert.equal(r.totalContributed, 300);
  assert.equal(r.terminalValue, 1300);
  assert.equal(r.marketGain, 0);
  assert.equal(r.metrics.twr, 0);
  assert.ok(Math.abs(r.metrics.xirr) < 1e-9);
});
test("costs are charged inside the identical budget and reduce total wealth", () => {
  const r = runBacktest(
    request({ assumptions: { initialCash: 1000, fixedFee: 1, feeRate: 0.01 } }),
  );
  assert.ok(Math.abs(r.terminalValue - (1300 - r.costs)) < 1e-9);
  assert.equal(r.terminalCash, 0);
  assert.ok(r.metrics.twr < 0);
  assert.equal(r.ledger[0].allocations.a, 1100);
});
test("first-purchase costs count in unitized return even with zero starting capital", () => {
  const r = runBacktest(
    request({ endDate: "2020-01-02", assumptions: { fixedFee: 1 } }),
  );
  assert.equal(r.terminalValue, 99);
  assert.ok(Math.abs(r.metrics.twr + 0.01) < 1e-12);
  assert.ok(Math.abs(r.metrics.maxDrawdown + 0.01) < 1e-12);
});
test("unaffordable orders stay in cash instead of generating negative shares", () => {
  const r = runBacktest(
    request({
      endDate: "2020-02-03",
      monthlyContribution: 1,
      assumptions: { fixedFee: 2 },
    }),
  );
  assert.equal(r.terminalCash, 2);
  assert.equal(r.terminalShares.a, 0);
  assert.equal(r.costs, 0);
});
test("ladder earns cash interest and releases residue at expiry without double-counting flows", () => {
  const r = runBacktest(
    request({
      monthlyContribution: 0,
      assumptions: {
        initialCash: 1000,
        reserveMode: "ladder",
        cashAnnualRate: 0.02,
      },
    }),
  );
  assert.equal(r.ledger[0].allocations.a, 0);
  assert.equal(r.ledger.at(-1).reserveReleasedFraction, 1);
  assert.ok(r.terminalValue > 1019 && r.terminalValue < 1021);
  assert.equal(r.totalContributed, 0);
});
test("execution-day crash cannot release reserve on that day", () => {
  const r = runBacktest(
    request({
      monthlyContribution: 0,
      endDate: "2020-02-03",
      histories: {
        a: [
          { date: "2019-12-31", close: 100 },
          { date: "2020-01-02", close: 60 },
          { date: "2020-02-03", close: 60 },
        ],
      },
      assumptions: { initialCash: 1000, reserveMode: "ladder" },
    }),
  );
  assert.equal(r.ledger[0].allocations.a, 0);
  assert.equal(r.ledger[1].allocations.a, 1000);
  assert.equal(r.initialValue, 1000);
  assert.equal(r.totalContributed, 0);
});
test("invalid execution assumptions fail explicitly", () => {
  for (const assumptions of [
    { feeRate: -1 },
    { cashAnnualRate: NaN },
    { initialCash: 1.5 },
    { reserveMode: "optimized" },
  ])
    assert.throws(() => runBacktest(request({ assumptions })), {
      code: "INVALID_ASSUMPTIONS",
    });
});
test("reserve thresholds release cumulative tranches once, including exact 10%", () => {
  const r = runBacktest(
    request({
      monthlyContribution: 0,
      endDate: "2020-04-01",
      histories: {
        a: [
          { date: "2019-12-31", close: 100 },
          { date: "2020-01-02", close: 90 },
          { date: "2020-02-03", close: 90 },
          { date: "2020-03-02", close: 80 },
          { date: "2020-04-01", close: 80 },
        ],
      },
      assumptions: { initialCash: 1000, reserveMode: "ladder" },
    }),
  );
  assert.deepEqual(
    r.ledger.map((l) => l.allocations.a),
    [0, 250, 0, 250],
  );
  assert.equal(r.terminalCash, 500);
});
test("research records every candidate and identical available capital without claiming proof", () => {
  const r = evaluateResearch(request({ assumptions: { initialCash: 1000 } }));
  assert.equal(r.results.length, 9);
  assert.ok(
    r.results.every(
      (x) =>
        x.result.initialValue === 1000 && x.result.totalContributed === 300,
    ),
  );
  assert.equal(r.insufficient, true);
  assert.match(r.conclusion, /no demostrada/);
});
