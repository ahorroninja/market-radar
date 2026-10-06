function domainError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}
function finite(n) {
  return typeof n === "number" && Number.isFinite(n);
}
function sortedEntries(obj) {
  return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
}

export function roundWholeEuros(raw, total) {
  if (!Number.isInteger(total) || total < 0)
    throw domainError(
      "INVALID_CONTRIBUTION",
      "Contribution must be a non-negative whole number of euros",
    );
  const rows = sortedEntries(raw).map(([id, value]) => {
    if (!finite(value) || value < 0)
      throw domainError(
        "INVALID_ALLOCATION",
        "Raw allocation must be finite and non-negative",
      );
    const floor = Math.floor(value);
    return { id, value, floor, remainder: value - floor };
  });
  const floors = rows.reduce((s, r) => s + r.floor, 0);
  let left = total - floors;
  if (left < 0)
    throw domainError(
      "ROUNDING_OVERFLOW",
      "Raw allocations exceed contribution",
    );
  const order = [...rows].sort(
    (a, b) => b.remainder - a.remainder || a.id.localeCompare(b.id),
  );
  const out = Object.fromEntries(rows.map((r) => [r.id, r.floor]));
  for (let i = 0; i < left; i++) out[order[i % order.length].id]++;
  return Object.fromEntries(sortedEntries(out));
}

function validate(req) {
  if (!req || !Number.isInteger(req.contribution) || req.contribution < 0)
    throw domainError(
      "INVALID_CONTRIBUTION",
      "Contribution must be a non-negative whole number of euros",
    );
  if (!Array.isArray(req.assets) || !req.assets.length)
    throw domainError("INVALID_ASSETS", "Assets are required");
  if (
    !req.policy ||
    ![
      req.policy.drawdownStrength,
      req.policy.underweightStrength,
      req.policy.maxContributionShare,
    ].every(finite)
  )
    throw domainError("INVALID_POLICY", "Smart DCA policy is invalid");
  if (
    req.policy.drawdownStrength < 0 ||
    req.policy.underweightStrength < 0 ||
    req.policy.maxContributionShare < 0 ||
    req.policy.maxContributionShare > 1
  )
    throw domainError("INVALID_POLICY", "Smart DCA policy is out of range");
}

// Strategic target is never capped. maxContributionShare limits only tactical overweight
// above target. If the configured tactical room cannot absorb all tactical redistribution,
// the unused room remains with the strategic target rather than violating the target itself.
function applyTacticalCaps(rawWeights, targets, tacticalCap) {
  const ids = Object.keys(rawWeights).sort();
  const upper = Object.fromEntries(
    ids.map((id) => [id, Math.min(1, targets[id] + tacticalCap)]),
  );
  const weights = { ...rawWeights };
  let excess = 0;
  for (const id of ids) {
    if (weights[id] > upper[id]) {
      excess += weights[id] - upper[id];
      weights[id] = upper[id];
    }
  }
  for (let guard = 0; excess > 1e-12 && guard < ids.length * 2; guard++) {
    const receivers = ids.filter((id) => weights[id] < upper[id] - 1e-12);
    if (!receivers.length) break;
    const capacity = receivers.reduce(
      (s, id) => s + upper[id] - weights[id],
      0,
    );
    if (capacity <= 1e-12) break;
    const moved = Math.min(excess, capacity);
    for (const id of receivers) {
      const room = upper[id] - weights[id];
      weights[id] += (moved * room) / capacity;
    }
    excess -= moved;
  }
  if (excess > 1e-9)
    throw domainError(
      "TACTICAL_CAP_INFEASIBLE",
      "Tactical cap cannot conserve allocation",
    );
  return weights;
}

export function allocateSmartDca(req) {
  validate(req);
  const assets = [...req.assets].sort((a, b) => a.id.localeCompare(b.id));
  const indicators = new Map((req.indicators || []).map((x) => [x.assetId, x]));
  const holdingValues = new Map(
    (req.portfolio?.holdings || []).map((x) => [
      x.assetId,
      finite(x.value) && x.value >= 0 ? x.value : 0,
    ]),
  );
  const eligible = assets.filter(
    (a) =>
      a.enabled &&
      finite(a.targetWeight) &&
      a.targetWeight > 0 &&
      finite(indicators.get(a.id)?.drawdown) &&
      !(indicators.get(a.id)?.missing || []).includes("drawdown"),
  );
  if (req.contribution === 0)
    return {
      contribution: 0,
      allocations: Object.fromEntries(eligible.map((a) => [a.id, 0])),
      eligibleAssetIds: eligible.map((a) => a.id),
      tacticalCap: req.policy.maxContributionShare,
      diagnostics: {
        targetComponent: {},
        drawdownComponent: {},
        underweightComponent: {},
        warnings: [],
      },
    };
  if (!eligible.length)
    throw domainError(
      "NO_ELIGIBLE_ASSETS",
      "No enabled asset has the required signal data",
    );
  const targetSum = eligible.reduce((s, a) => s + a.targetWeight, 0);
  const totalPortfolio = [...holdingValues.values()].reduce((a, b) => a + b, 0);
  const targetComponent = {},
    drawdownComponent = {},
    underweightComponent = {},
    scores = {};
  for (const a of eligible) {
    const target = a.targetWeight / targetSum;
    const dd = indicators.get(a.id).drawdown;
    const macro = indicators.get(a.id).macro;
    const macroTilt =
      req.policy.useMacro && Number.isFinite(macro)
        ? Math.max(
            0,
            1 + ((req.policy.macroStrength ?? 0.5) * (macro - 50)) / 50,
          )
        : 1;
    const drawdown = Math.max(0, -dd) * macroTilt;
    const currentWeight =
      totalPortfolio > 0
        ? (holdingValues.get(a.id) || 0) / totalPortfolio
        : target;
    const underweight = Math.max(0, target - currentWeight);
    targetComponent[a.id] = target;
    drawdownComponent[a.id] = drawdown;
    underweightComponent[a.id] = underweight;
    scores[a.id] =
      target *
      (1 +
        req.policy.drawdownStrength * drawdown +
        req.policy.underweightStrength *
          (target > 0 ? underweight / target : 0));
  }
  const scoreSum = Object.values(scores).reduce((a, b) => a + b, 0);
  const rawWeights = Object.fromEntries(
    Object.entries(scores).map(([id, s]) => [id, s / scoreSum]),
  );
  const weights = applyTacticalCaps(
    rawWeights,
    targetComponent,
    req.policy.maxContributionShare,
  );
  const raw = Object.fromEntries(
    Object.entries(weights).map(([id, w]) => [id, w * req.contribution]),
  );
  const allocations = roundWholeEuros(raw, req.contribution);
  return {
    contribution: req.contribution,
    allocations,
    eligibleAssetIds: eligible.map((a) => a.id),
    tacticalCap: req.policy.maxContributionShare,
    diagnostics: {
      targetComponent,
      drawdownComponent,
      underweightComponent,
      warnings: [],
    },
  };
}
