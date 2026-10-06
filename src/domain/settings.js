export function validateSettings(s) {
  const fail = (m) => {
    const e = new Error(m);
    e.code = "INVALID_SETTINGS";
    throw e;
  };
  if (
    !s ||
    !Number.isInteger(s.monthlyContribution) ||
    s.monthlyContribution < 0
  )
    fail(
      "La aportación debe ser un número entero de euros, igual o superior a 0.",
    );
  if (!Array.isArray(s.assets) || !s.assets.length)
    fail("Añade al menos un activo.");
  const ids = new Set();
  let weight = 0;
  for (const a of s.assets) {
    if (
      !a ||
      typeof a.id !== "string" ||
      !a.id ||
      ids.has(a.id) ||
      typeof a.enabled !== "boolean" ||
      !Number.isFinite(a.targetWeight) ||
      a.targetWeight < 0 ||
      a.targetWeight > 1
    )
      fail("Los activos deben tener IDs únicos y pesos válidos.");
    ids.add(a.id);
    if (a.enabled) weight += a.targetWeight;
  }
  if (Math.abs(weight - 1) > 1e-6)
    fail("Los pesos de los activos activos deben sumar 100%.");
  for (const v of Object.values(s.holdings || {}))
    if (!Number.isFinite(v) || v < 0)
      fail("Los valores de cartera deben ser positivos o cero.");
  if (
    s.reserve !== undefined &&
    (!Number.isInteger(s.reserve) || s.reserve < 0)
  )
    fail("La reserva debe ser un número entero de euros, positivo o cero.");
  if (s.smartDcaPolicy) {
    const p = s.smartDcaPolicy;
    if (
      ![
        p.drawdownStrength,
        p.underweightStrength,
        p.maxContributionShare,
      ].every(Number.isFinite) ||
      p.drawdownStrength < 0 ||
      p.underweightStrength < 0 ||
      p.maxContributionShare < 0 ||
      p.maxContributionShare > 1
    )
      fail("Los ajustes Smart DCA no son válidos.");
  }
  if (
    s.smartDcaPolicy?.macroStrength !== undefined &&
    (!Number.isFinite(s.smartDcaPolicy.macroStrength) ||
      s.smartDcaPolicy.macroStrength < 0 ||
      s.smartDcaPolicy.macroStrength > 1)
  )
    fail("Intensidad macro inválida.");
  if (s.dataProvider?.baseUrl) {
    let u;
    try {
      u = new URL(s.dataProvider.baseUrl);
    } catch {
      fail("Introduce una URL válida para el servicio de precios.");
    }
    if (!["https:", "http:"].includes(u.protocol))
      fail("El servicio debe usar HTTP o HTTPS.");
  }
  return s;
}
