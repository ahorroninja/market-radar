export function executionAssumptions(input = {}) {
  const a = {
    initialCash: 0,
    cashAnnualRate: 0,
    feeRate: 0,
    fixedFee: 0,
    slippageRate: 0,
    reserveMode: "immediate",
    ...input,
  };
  if (
    ![
      a.initialCash,
      a.cashAnnualRate,
      a.feeRate,
      a.fixedFee,
      a.slippageRate,
    ].every((x) => Number.isFinite(x) && x >= 0) ||
    !Number.isInteger(a.initialCash) ||
    a.cashAnnualRate > 0.2 ||
    a.feeRate > 0.1 ||
    a.slippageRate > 0.1 ||
    !["immediate", "ladder"].includes(a.reserveMode)
  ) {
    const e = new Error("Hipótesis de costes o reserva inválidas.");
    e.code = "INVALID_ASSUMPTIONS";
    throw e;
  }
  return a;
}
export function executeBudget(gross, assumptions) {
  if (!Number.isFinite(gross) || gross < 0)
    throw new Error("Presupuesto inválido.");
  if (gross <= assumptions.fixedFee) return { spent: 0, invested: 0, cost: 0 };
  const invested =
    (gross - assumptions.fixedFee) /
    (1 + assumptions.feeRate + assumptions.slippageRate);
  return { spent: gross, invested, cost: gross - invested };
}
