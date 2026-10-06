import test from "node:test";
import assert from "node:assert/strict";
import worker from "../../worker/src/index.js";
test("worker health identifies the new Yahoo + FRED runtime", async () => {
  const r = await worker.fetch(new Request("https://example.test/health"));
  const j = await r.json();
  assert.equal(j.version, "3.0.7");
  assert.equal(j.macro, true);
});
test("worker CORS permits the existing site to request macro without exposing keys in a URL", async () => {
  const r = await worker.fetch(
    new Request("https://example.test/macro", {
      method: "OPTIONS",
      headers: { Origin: "https://ahorroninja.github.io" },
    }),
  );
  assert.equal(r.status, 204);
  assert.equal(
    r.headers.get("access-control-allow-origin"),
    "https://ahorroninja.github.io",
  );
  assert.match(r.headers.get("access-control-allow-methods"), /POST/);
});
test("worker rejects unapproved macro series without an upstream request", async () => {
  const r = await worker.fetch(
    new Request("https://example.test/macro", {
      method: "POST",
      body: JSON.stringify({ seriesId: "OTHER" }),
    }),
  );
  assert.equal(r.status, 400);
});
test("worker retains vintage dates and never echoes the API key", async () => {
  const original = globalThis.fetch,
    apiKey = "a".repeat(32);
  try {
    globalThis.fetch = async () =>
      Response.json({
        count: 1,
        observations: [
          {
            date: "2020-01-01",
            value: "20",
            realtime_start: "2020-01-03",
            realtime_end: "9999-12-31",
          },
        ],
      });
    const r = await worker.fetch(
      new Request("https://example.test/macro", {
        method: "POST",
        body: JSON.stringify({ seriesId: "VIXCLS", apiKey }),
      }),
    );
    const text = await r.text();
    assert.ok(!text.includes(apiKey));
    const j = JSON.parse(text);
    assert.equal(j.basis, "vintage");
    assert.equal(j.points[0].availableFrom, "2020-01-03");
    assert.equal(r.headers.get("cache-control"), "no-store");
  } finally {
    globalThis.fetch = original;
  }
});
test("FRED rejects credentials without leaking its error body", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return Response.json(
        {
          error_message:
            "The api_key aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa is not registered. https://provider.test/?api_key=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        { status: 400 },
      );
    };
    const r = await worker.fetch(
      new Request("https://example.test/macro", {
        method: "POST",
        body: JSON.stringify({ seriesId: "VIXCLS", apiKey: "a".repeat(32) }),
      }),
    );
    assert.equal(r.status, 422);
    assert.deepEqual(await r.json(), {
      error: "FRED_KEY_REJECTED",
      upstreamStatus: 400,
      detail: "The api_key [redacted] is not registered. [URL removed]",
    });
    assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test("FRED transient errors get one bounded retry and preserve vintage semantics", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      assert.ok(options.signal);
      assert.match(
        new URL(url).searchParams.get("realtime_start"),
        /^20\d{2}-01-01$/,
      );
      return ++calls === 1
        ? new Response("Unavailable", { status: 503 })
        : Response.json({
            count: 1,
            observations: [
              {
                date: "2026-10-01",
                value: "20",
                realtime_start: "2026-10-02",
                realtime_end: "9999-12-31",
              },
            ],
          });
    };
    const r = await worker.fetch(
      new Request("https://example.test/macro", {
        method: "POST",
        body: JSON.stringify({ seriesId: "VIXCLS", apiKey: "a".repeat(32) }),
      }),
    );
    assert.equal(r.status, 200);
    assert.equal(
      calls,
      Math.floor((new Date().getUTCFullYear() - 2000) / 5) + 2,
    );
    assert.equal((await r.json()).basis, "vintage");
  } finally {
    globalThis.fetch = original;
  }
});
test("FRED exhausted rate limits are explicit and never silently replaced by revised data", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls++;
      return new Response("limited", { status: 429 });
    };
    const r = await worker.fetch(
      new Request("https://example.test/macro", {
        method: "POST",
        body: JSON.stringify({ seriesId: "NFCI", apiKey: "a".repeat(32) }),
      }),
    );
    assert.equal(r.status, 502);
    assert.deepEqual(await r.json(), {
      error: "FRED_RATE_LIMIT",
      upstreamStatus: 429,
      detail: "",
    });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test("vintage windows respect the 2000-date cap, paginate within each window and preserve availability", async () => {
  const original = globalThis.fetch,
    requests = [];
  try {
    globalThis.fetch = async (url) => {
      const q = new URL(url).searchParams,
        start = q.get("realtime_start"),
        end = q.get("realtime_end"),
        offset = Number(q.get("offset"));
      requests.push({ start, end, offset });
      assert.ok((Date.parse(end) - Date.parse(start)) / 86400000 + 1 < 2000);
      const paginated = start === "2000-01-01";
      return Response.json({
        count: paginated ? 2 : 1,
        observations: [
          {
            date: start,
            value: String(offset + 20),
            realtime_start: offset ? "2000-01-03" : start,
            realtime_end: end,
          },
        ],
      });
    };
    const r = await worker.fetch(
      new Request("https://example.test/macro", {
        method: "POST",
        body: JSON.stringify({ seriesId: "VIXCLS", apiKey: "a".repeat(32) }),
      }),
    );
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.deepEqual(requests.slice(0, 3), [
      { start: "2000-01-01", end: "2004-12-31", offset: 0 },
      { start: "2000-01-01", end: "2004-12-31", offset: 1 },
      { start: "2005-01-01", end: "2009-12-31", offset: 0 },
    ]);
    assert.equal(j.points.length, requests.length);
    assert.equal(j.points[1].availableFrom, "2000-01-03");
    assert.equal(j.points[1].availableUntil, "2004-12-31");
    assert.equal(requests.at(-1).end, new Date().toISOString().slice(0, 10));
    const windows = requests.filter((x) => x.offset === 0);
    for (let i = 1; i < windows.length; i++)
      assert.equal(
        Date.parse(windows[i].start) - Date.parse(windows[i - 1].end),
        86400000,
      );
  } finally {
    globalThis.fetch = original;
  }
});
test("pre-archive ALFRED windows are skipped, but other 400 failures remain fatal", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const q = new URL(url).searchParams;
      if (q.get("realtime_start") < "2010-01-01")
        return Response.json(
          {
            error_message:
              "Bad Request. The series does not exist in ALFRED but may exist in FRED.",
          },
          { status: 400 },
        );
      return Response.json({
        count: 1,
        observations: [
          {
            date: "2010-01-01",
            value: "20",
            realtime_start: q.get("realtime_start"),
            realtime_end: q.get("realtime_end"),
          },
        ],
      });
    };
    const request = () =>
      new Request("https://example.test/macro", {
        method: "POST",
        body: JSON.stringify({ seriesId: "VIXCLS", apiKey: "a".repeat(32) }),
      });
    const r = await worker.fetch(request());
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.points[0].availableFrom, "2010-01-01");
    assert.equal(j.basis, "vintage");
    globalThis.fetch = async () =>
      Response.json(
        { error_message: "Bad Request. Invalid limit." },
        { status: 400 },
      );
    assert.equal((await worker.fetch(request())).status, 502);
    globalThis.fetch = async () =>
      Response.json(
        {
          error_message:
            "Bad Request. The series does not exist in ALFRED but may exist in FRED.",
        },
        { status: 400 },
      );
    const missing = await worker.fetch(request());
    assert.equal(missing.status, 502);
    assert.equal((await missing.json()).error, "FRED_VINTAGE_UNAVAILABLE");
  } finally {
    globalThis.fetch = original;
  }
});
