import test from "node:test";
import assert from "node:assert/strict";
import worker from "../../worker/src/index.js";
test("worker health identifies the new Yahoo + FRED runtime", async () => {
  const r = await worker.fetch(new Request("https://example.test/health"));
  const j = await r.json();
  assert.equal(j.version, "3.0.4");
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
        { error_message: "The api_key SECRET is not registered." },
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
      assert.equal(
        new URL(url).searchParams.get("realtime_start"),
        "1776-07-04",
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
    assert.equal(calls, 2);
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
    });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
