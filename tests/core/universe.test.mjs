import test from "node:test";
import assert from "node:assert/strict";
import { longHistoryUniverse } from "../../src/core/universe.js";
test("long-history selection requires strictly more than five useful years after warmup", () => {
  const assets = ["old", "exact", "recent", "missing"].map((id) => ({ id }));
  const points = (first) => [
    ...Array.from({ length: 252 }, () => ({ date: "2010-01-01" })),
    { date: first },
    { date: "2026-10-02" },
  ];
  const histories = {
    old: points("2021-10-01"),
    exact: points("2021-10-02"),
    recent: points("2023-01-01"),
  };
  assert.deepEqual(
    longHistoryUniverse(assets, histories).map((a) => a.id),
    ["old"],
  );
  assert.equal(assets.length, 4);
});
