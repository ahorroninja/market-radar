const ALLOWED_ORIGINS = new Set([
  'https://ahorroninja.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://ahorroninja.github.io';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=900'
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const headers = cors(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });

    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'market-radar-yahoo-proxy' }, { headers });
    if (url.pathname !== '/chart') return Response.json({ error: 'Not found' }, { status: 404, headers });

    const symbol = (url.searchParams.get('symbol') || '').trim();
    if (!/^[A-Za-z0-9.^=_-]{1,30}$/.test(symbol)) return Response.json({ error: 'Invalid symbol' }, { status: 400, headers });

    const period1 = url.searchParams.get('period1') || '0';
    const period2 = url.searchParams.get('period2') || Math.floor(Date.now()/1000).toString();
    const yahoo = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${encodeURIComponent(period1)}&period2=${encodeURIComponent(period2)}&interval=1d&events=div%2Csplits&includeAdjustedClose=true`;

    try {
      const r = await fetch(yahoo, { headers: { 'User-Agent': 'Mozilla/5.0 MarketRadar/1.0', 'Accept': 'application/json' }, cf: { cacheTtl: 900, cacheEverything: true } });
      const text = await r.text();
      return new Response(text, { status: r.status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
    } catch (e) {
      return Response.json({ error: 'Yahoo upstream failed', detail: String(e) }, { status: 502, headers });
    }
  }
};