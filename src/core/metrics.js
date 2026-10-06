function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}

export function timeWeightedReturn(observations) {
  if (!Array.isArray(observations) || observations.length < 2) return null;
  let growth = 1;
  for (let i = 1; i < observations.length; i++) {
    const prev = observations[i - 1],
      cur = observations[i];
    const flow = finite(cur.externalFlow) ? cur.externalFlow : 0;
    if (
      !finite(prev.value) ||
      !finite(cur.value) ||
      prev.value < 0 ||
      cur.value < 0
    )
      return null;
    const capital = prev.value + flow;
    if (capital <= 0) return null;
    growth *= cur.value / capital;
  }
  return growth - 1;
}

export function maxDrawdown(observations) {
  if (!Array.isArray(observations) || !observations.length) return null;
  let peak = -Infinity,
    worst = 0;
  for (const x of observations) {
    const v = typeof x === "number" ? x : x?.value;
    if (!finite(v) || v < 0) return null;
    peak = Math.max(peak, v);
    if (peak > 0) worst = Math.min(worst, v / peak - 1);
  }
  return worst;
}

export function annualizedVolatility(returns, periodsPerYear = 12) {
  if (
    !Array.isArray(returns) ||
    !returns.length ||
    !returns.every(finite) ||
    !finite(periodsPerYear) ||
    periodsPerYear <= 0
  )
    return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(periodsPerYear);
}

export function sharpeRatio(returns, riskFreeAnnual = 0, periodsPerYear = 12) {
  const vol = annualizedVolatility(returns, periodsPerYear);
  if (vol === null || vol === 0 || !finite(riskFreeAnnual)) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const annualReturn = mean * periodsPerYear;
  return (annualReturn - riskFreeAnnual) / vol;
}

export function xirr(flows) {
  if (
    !Array.isArray(flows) ||
    flows.length < 2 ||
    !flows.every(
      (f) => finite(f.amount) && Number.isFinite(Date.parse(f.date)),
    ) ||
    !flows.some((f) => f.amount < 0) ||
    !flows.some((f) => f.amount > 0)
  )
    return null;
  const start = Math.min(...flows.map((f) => Date.parse(f.date))),
    terms = flows.map((f) => ({
      ...f,
      years: (Date.parse(f.date) - start) / 86400000 / 365.25,
    }));
  if (!terms.some((f) => f.years > 0)) return null;
  const npv = (r) =>
    terms.reduce((s, f) => s + f.amount / (1 + r) ** f.years, 0);
  let lo = -0.999999,
    hi = 1,
    a = npv(lo),
    b = npv(hi);
  while (a * b > 0 && hi < 1e6) {
    hi *= 2;
    b = npv(hi);
  }
  if (!Number.isFinite(a) || !Number.isFinite(b) || a * b > 0) return null;
  for (let i = 0; i < 180; i++) {
    const mid = (lo + hi) / 2,
      n = npv(mid);
    if (Math.abs(n) < 1e-8) return mid;
    if (a * n > 0) {
      lo = mid;
      a = n;
    } else hi = mid;
  }
  return (lo + hi) / 2;
}
export function backtestMetrics(observations, initialValue, startDate) {
  let previous = initialValue,
    growth = 1;
  const returns = [],
    unitValues = [1];
  for (const p of observations) {
    const beforeFlow = p.value - (p.externalFlow || 0);
    if (previous > 0) {
      const r = beforeFlow / previous - 1;
      returns.push(r);
      growth *= 1 + r;
      unitValues.push(growth);
    } else if (p.externalFlow > 0) {
      // First purchase expenses matter even when there was no initial capital.
      const r = p.value / p.externalFlow - 1;
      growth *= 1 + r;
      returns.push(r);
      unitValues.push(growth);
    }
    previous = p.value;
  }
  const end = observations.at(-1),
    years = end
      ? (Date.parse(end.date) - Date.parse(startDate)) / 86400000 / 365.25
      : 0;
  const cashflows = [
    ...(initialValue > 0 ? [{ date: startDate, amount: -initialValue }] : []),
    ...observations
      .filter((p) => p.externalFlow > 0)
      .map((p) => ({ date: p.date, amount: -p.externalFlow })),
    ...(end ? [{ date: end.date, amount: end.value }] : []),
  ];
  return {
    twr: returns.length ? growth - 1 : null,
    annualizedTwr:
      returns.length && years > 0 ? growth ** (1 / years) - 1 : null,
    xirr: xirr(cashflows),
    maxDrawdown: returns.length ? maxDrawdown(unitValues) : null,
    volatility: returns.length > 1 ? annualizedVolatility(returns, 252) : null,
    sharpe: returns.length > 1 ? sharpeRatio(returns, 0, 252) : null,
  };
}
