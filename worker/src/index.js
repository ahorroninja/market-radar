const ALLOWED_ORIGINS = new Set([
  "https://ahorroninja.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://ahorroninja.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=900",
  };
}

async function fredFetch(url, options = {}) {
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(12000),
      });
      if (response.status !== 429 && response.status < 500) return response;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  return response;
}

async function fredFailure(response, headers, apiKey = "") {
  // Return only the provider error message, with credentials and URLs removed.
  let message = "";
  try {
    message = (await response.json()).error_message || "";
  } catch {}
  const detail = String(message)
    .replaceAll(apiKey || "__NO_CREDENTIAL__", "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[URL removed]")
    .replace(/[a-zA-Z0-9_-]{24,}/g, "[redacted]")
    .replace(/[\x00-\x1f\x7f]/g, " ")
    .slice(0, 240);
  const keyRejected = /api[_ ]?key|registered|not valid.*key/i.test(message);
  const code = keyRejected
    ? "FRED_KEY_REJECTED"
    : response.status === 429
      ? "FRED_RATE_LIMIT"
      : response.status >= 500
        ? "FRED_TEMPORARY"
        : "FRED_REQUEST_REJECTED";
  return Response.json(
    { error: code, upstreamStatus: response.status, detail },
    {
      status: keyRejected ? 422 : 502,
      headers: { ...headers, "Cache-Control": "no-store" },
    },
  );
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin);
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "GET" && request.method !== "POST")
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers },
      );

    const url = new URL(request.url);
    if (url.pathname === "/health")
      return Response.json(
        {
          ok: true,
          service: "market-radar-yahoo-proxy",
          version: "3.0.6",
          macro: true,
        },
        { headers },
      );
    if (url.pathname === "/macro" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON" },
          { status: 400, headers },
        );
      }
      if (!["VIXCLS", "BAMLH0A0HYM2", "T10Y2Y", "NFCI"].includes(body.seriesId))
        return Response.json(
          { error: "Unknown series" },
          { status: 400, headers },
        );
      try {
        if (body.apiKey) {
          if (!/^[a-zA-Z0-9]{32}$/.test(body.apiKey))
            return Response.json(
              { error: "Invalid API key format" },
              { status: 400, headers },
            );
          const points = [];
          const today = new Date().toISOString().slice(0, 10);
          // JSON allows at most 2000 vintage dates, independently of row pagination.
          // Five calendar years contain fewer than 2000 possible daily vintages.
          for (let year = 2000; year <= Number(today.slice(0, 4)); year += 5) {
            const realtimeStart = `${year}-01-01`;
            const realtimeEnd =
              `${year + 4}-12-31` < today ? `${year + 4}-12-31` : today;
            let offset = 0,
              count = Infinity;
            while (offset < count) {
              const params = new URLSearchParams({
                series_id: body.seriesId,
                api_key: body.apiKey,
                file_type: "json",
                observation_start: "2000-01-01",
                realtime_start: realtimeStart,
                realtime_end: realtimeEnd,
                output_type: "1",
                limit: "100000",
                offset: String(offset),
              });
              const res = await fredFetch(
                "https://api.stlouisfed.org/fred/series/observations?" + params,
                { headers: { Accept: "application/json" } },
              );
              if (!res.ok) return fredFailure(res, headers, body.apiKey);
              const data = await res.json();
              count = Number(data.count);
              const rows = data.observations;
              if (
                !Number.isFinite(count) ||
                !Array.isArray(rows) ||
                (!rows.length && offset < count)
              )
                throw new Error("Incomplete FRED response");
              for (const p of rows) {
                if (p.value !== "." && Number.isFinite(Number(p.value)))
                  points.push({
                    date: p.date,
                    value: Number(p.value),
                    availableFrom: p.realtime_start,
                    availableUntil: p.realtime_end,
                  });
              }
              offset += rows.length;
            }
          }
          return Response.json(
            { seriesId: body.seriesId, basis: "vintage", points },
            { headers: { ...headers, "Cache-Control": "no-store" } },
          );
        }
        const res = await fredFetch(
          "https://fred.stlouisfed.org/graph/fredgraph.csv?id=" +
            body.seriesId +
            "&cosd=2000-01-01",
        );
        if (!res.ok) return fredFailure(res, headers);
        const text = await res.text(),
          lines = text.trim().split(/\r?\n/);
        if (!lines[0].includes(body.seriesId)) throw new Error("Invalid CSV");
        const points = lines.slice(1).flatMap((line) => {
          const [date, value] = line.split(",");
          return /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            value !== "" &&
            value !== "." &&
            Number.isFinite(Number(value))
            ? [{ date, value: Number(value), availableFrom: date }]
            : [];
        });
        return Response.json(
          { seriesId: body.seriesId, basis: "revised", points },
          { headers },
        );
      } catch {
        return Response.json(
          { error: "FRED_TEMPORARY" },
          { status: 502, headers: { ...headers, "Cache-Control": "no-store" } },
        );
      }
    }
    if (request.method !== "GET")
      return Response.json(
        { error: "Method not allowed" },
        { status: 405, headers },
      );
    if (url.pathname !== "/chart")
      return Response.json({ error: "Not found" }, { status: 404, headers });

    const symbol = (url.searchParams.get("symbol") || "").trim();
    if (!/^[A-Za-z0-9.^=_-]{1,30}$/.test(symbol))
      return Response.json(
        { error: "Invalid symbol" },
        { status: 400, headers },
      );

    const period1 = url.searchParams.get("period1") || "0";
    const period2 =
      url.searchParams.get("period2") ||
      Math.floor(Date.now() / 1000).toString();
    const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${encodeURIComponent(period1)}&period2=${encodeURIComponent(period2)}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;

    try {
      const r = await fetch(yahoo, {
        headers: {
          "User-Agent": "Mozilla/5.0 MarketRadar/1.0",
          Accept: "application/json",
        },
        cf: { cacheTtl: 900, cacheEverything: true },
      });
      const text = await r.text();
      return new Response(text, {
        status: r.status,
        headers: {
          ...headers,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    } catch (e) {
      return Response.json(
        { error: "Yahoo upstream failed", detail: String(e) },
        { status: 502, headers },
      );
    }
  },
};
