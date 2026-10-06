import test from "node:test";
import assert from "node:assert/strict";
import { indicatorSnapshot, seriesStatus } from "../../src/core/radar.js";
import { convertToEuro } from "../../src/data/provider.js";
import { backtestMetrics, xirr } from "../../src/core/metrics.js";
import {
  allocateContributionRebalance,
  runBacktest,
} from "../../src/core/backtest.js";
import {
  createBackup,
  restoreBackup,
  migrateLegacyState,
} from "../../src/storage/backup.js";
import { freshSettings } from "../../src/domain/defaults.js";
import { validateSettings } from "../../src/domain/settings.js";
const asset = (id, w) => ({ id, enabled: true, targetWeight: w });
test("technical data cannot masquerade as full valuation/macro opportunity score", () => {
  const points = Array.from({ length: 260 }, (_, i) => ({
    date: `day${i}`,
    close: 100 + i,
  }));
  const r = indicatorSnapshot("a", points);
  assert.equal(r.score, null);
  assert.equal(r.coverage, 0.2);
  assert.equal(r.valuation, null);
  assert.equal(r.trend, 100);
});
test("GBP pence conversion uses only current or prior dated exchange observations", () => {
  const r = convertToEuro(
    {
      currency: "GBp",
      points: [
        { date: "2026-01-02", close: 10000 },
        { date: "2026-01-05", close: 11000 },
      ],
    },
    {
      symbol: "EURGBP=X",
      points: [
        { date: "2026-01-01", close: 0.8 },
        { date: "2026-01-05", close: 1 },
        { date: "2026-01-06", close: 0.1 },
      ],
    },
  );
  assert.deepEqual(
    r.points.map((p) => p.close),
    [125, 110],
  );
  assert.equal(r.currency, "EUR");
});
test("conversion rejects stale FX rather than inventing prices", () => {
  assert.throws(
    () =>
      convertToEuro(
        { currency: "USD", points: [{ date: "2026-01-20", close: 100 }] },
        { points: [{ date: "2026-01-01", close: 1 }] },
      ),
    (e) => e.code === "MISSING_FX",
  );
});
test("flat prices and external flows yield zero TWR XIRR and drawdown", () => {
  const r = backtestMetrics(
    [
      { date: "2025-01-01", value: 1000, externalFlow: 1000 },
      { date: "2025-02-01", value: 2000, externalFlow: 1000 },
      { date: "2026-01-01", value: 2000, externalFlow: 0 },
    ],
    0,
    "2025-01-01",
  );
  assert.equal(r.twr, 0);
  assert.equal(r.maxDrawdown, 0);
  assert.ok(Math.abs(r.xirr) < 1e-8);
});
test("a contribution cannot hide a market loss from unitized drawdown", () => {
  const r = backtestMetrics(
    [
      { date: "2025-01-01", value: 1000, externalFlow: 1000 },
      { date: "2025-02-01", value: 1900, externalFlow: 1000 },
    ],
    0,
    "2025-01-01",
  );
  assert.ok(Math.abs(r.maxDrawdown + 0.1) < 1e-9);
  assert.ok(Math.abs(r.twr + 0.1) < 1e-9);
});
test("XIRR annual return has a hand-verifiable doubling fixture", () => {
  const r = xirr([
    { date: "2024-01-01", amount: -1000 },
    { date: "2025-01-01", amount: 2000 },
  ]);
  assert.ok(Math.abs(r - (2 ** (365.25 / 366) - 1)) < 1e-8);
});
test("rebalance with new money never sells overweight holdings", () => {
  assert.deepEqual(
    allocateContributionRebalance(
      [asset("a", 0.5), asset("b", 0.5)],
      {
        totalValue: 1000,
        holdings: [
          { assetId: "a", value: 1000 },
          { assetId: "b", value: 0 },
        ],
      },
      100,
    ),
    { a: 0, b: 100 },
  );
});
test("all three strategies see identical dates and contributed amounts", () => {
  const histories = {
    a: [
      { date: "2025-12-31", close: 100 },
      { date: "2026-01-02", close: 100 },
      { date: "2026-02-02", close: 80 },
    ],
    b: [
      { date: "2025-12-31", close: 100 },
      { date: "2026-01-02", close: 100 },
      { date: "2026-02-02", close: 100 },
    ],
  };
  const req = {
    assets: [asset("a", 0.5), asset("b", 0.5)],
    histories,
    startDate: "2026-01-01",
    endDate: "2026-02-28",
    monthlyContribution: 1000,
    smartDcaPolicy: freshSettings().smartDcaPolicy,
  };
  const results = ["targetDca", "contributionRebalance", "smartDca"].map(
    (strategy) => runBacktest({ ...req, strategy }),
  );
  assert.deepEqual(
    results.map((r) => r.totalContributed),
    [2000, 2000, 2000],
  );
  assert.deepEqual(results[0].externalFlows, results[2].externalFlows);
  for (const r of results)
    assert.ok(r.ledger.every((l) => l.signalCutoff < l.executionDate));
});
test("backup strips nested credentials unless the user explicitly exports them", () => {
  const settings = freshSettings();
  settings.credentials = { fredKey: "secret", eodKey: "secret" };
  const b = createBackup({ settings, marketCache: {} });
  assert.ok(!JSON.stringify(b.settings).includes("secret"));
  assert.equal(
    createBackup({ settings, marketCache: {} }, { includeSecrets: true })
      .settings.credentials.fredKey,
    "secret",
  );
});
test("bad weights, duplicate IDs and invalid holdings reject without changing state", () => {
  const settings = freshSettings(),
    original = structuredClone(settings);
  const b = createBackup({ settings, marketCache: {} });
  b.settings.assets[1].id = b.settings.assets[0].id;
  assert.throws(
    () => restoreBackup(b, { settings }),
    (e) => e.code === "INVALID_BACKUP",
  );
  assert.deepEqual(settings, original);
  settings.holdings.a = -10;
  assert.throws(() => validateSettings(settings));
});
test("legacy zero contribution and actual positions are preserved; contaminated history is not reused", () => {
  const r = migrateLegacyState({
    monthly: 0,
    reserve: 6755,
    portfolio: { IE000ZYRH0Q7: 5665 },
    data: { broken: [] },
  });
  assert.equal(r.settings.monthlyContribution, 0);
  assert.equal(r.settings.reserve, 6755);
  assert.equal(r.settings.holdings.world, 5665);
  assert.deepEqual(r.marketCache, {});
});
test("five-day freshness gate allows weekends but blocks old series", () => {
  const points = [{ date: "2026-10-02", close: 100 }];
  assert.equal(
    seriesStatus({ points, asOf: "2026-10-02" }, Date.parse("2026-10-05"))
      .usable,
    true,
  );
  assert.equal(
    seriesStatus({ points, asOf: "2026-09-20" }, Date.parse("2026-10-05"))
      .usable,
    false,
  );
});

test("drawdown uses the last 252 sessions, not a distant all-time peak", async () => {
  const { drawdown } = await import("../../src/core/indicators.js");
  const points = Array.from({ length: 300 }, (_, i) => ({
    date: String(i),
    close: i === 0 ? 1000 : 100,
  }));
  assert.equal(drawdown(points), 0);
});
test("Wilder RSI matches the published 14-period calculation fixture", async () => {
  const { rsi } = await import("../../src/core/radar.js");
  const prices = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
    46.03, 45.61, 46.28, 46.28,
  ];
  assert.ok(
    Math.abs(rsi(prices.map((close) => ({ close }))) - 70.46413502109705) <
      1e-8,
  );
  assert.equal(rsi(Array.from({ length: 20 }, () => ({ close: 100 }))), 50);
});
test("macro point-in-time rejects future publications and revised-only histories", async () => {
  const { macroAt, MACRO_IDS } = await import("../../src/core/macro.js");
  const histories = Object.fromEntries(
    MACRO_IDS.map((id) => [
      id,
      {
        basis: "vintage",
        points: [
          {
            date: "2026-01-02",
            availableFrom: "2026-01-05",
            availableUntil: "9999-12-31",
            value: id === "VIXCLS" ? 20 : id === "BAMLH0A0HYM2" ? 4 : 0,
          },
        ],
      },
    ]),
  );
  assert.equal(
    macroAt(histories, "2026-01-04", { requireVintage: true }),
    null,
  );
  assert.equal(
    macroAt(histories, "2026-01-05", { requireVintage: true }).score,
    51,
  );
  histories.NFCI.basis = "revised";
  assert.equal(
    macroAt(histories, "2026-01-05", { requireVintage: true }),
    null,
  );
});
test("rolling only counts complete calendar windows and labels overlap", async () => {
  const { rollingComparison } = await import("../../src/core/rolling.js");
  const points = Array.from({ length: 1500 }, (_, i) => {
    const d = new Date("2020-01-01");
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), close: 100 };
  });
  const r = rollingComparison(
    {
      assets: [asset("a", 1)],
      histories: { a: points },
      startDate: "2021-01-01",
      endDate: "2023-07-01",
      monthlyContribution: 100,
      smartDcaPolicy: freshSettings().smartDcaPolicy,
      warmupTradingDays: 252,
    },
    2,
    12,
  );
  assert.equal(r.n, 1);
  assert.equal(r.insufficient, true);
  assert.equal(r.overlapping, true);
  assert.ok(Math.abs(r.median) < 1e-8);
});
test("provider never mixes unadjusted prices into a partly adjusted series", async () => {
  const { parseYahooChart } = await import("../../src/data/provider.js");
  const r = parseYahooChart("a", {
    chart: {
      result: [
        {
          timestamp: [1704067200, 1704153600],
          indicators: {
            quote: [{ close: [100, 50] }],
            adjclose: [{ adjclose: [50, null] }],
          },
        },
      ],
    },
  });
  assert.equal(r.points.length, 1);
  assert.equal(r.points[0].close, 50);
});
test("an unfinished trading session is excluded from EOD indicators", async () => {
  const { parseYahooChart } = await import("../../src/data/provider.js");
  const now = Date.now() / 1000;
  const r = parseYahooChart("a", {
    chart: {
      result: [
        {
          meta: {
            currentTradingPeriod: {
              regular: { start: now - 200, end: now + 200 },
            },
          },
          timestamp: [now - 86400, now - 100],
          indicators: { quote: [{ close: [100, 150] }] },
        },
      ],
    },
  });
  assert.equal(r.points.length, 1);
  assert.equal(r.points[0].close, 100);
});
