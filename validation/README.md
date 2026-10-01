# Market Radar V2.6 validation

This directory is deliberately isolated from the production PWA.

## Gate before production

`node validation/backtest-validation.js` must pass before any V2.6 backtest code is merged into `main`.

The tests cover cash conservation, TWR/XIRR sanity, drawdown, identical-asset invariance, neutral-macro invariance, no price look-ahead, and rolling-window sample size.

## Strategies

- DCA: invest each monthly contribution at target weights.
- REBALANCE: use contributions only to fill target-weight deficits; never sell.
- MR_TECH: allocate contributions using only technical information available on or before the decision date plus underweighting.
- MR_MACRO: same as MR_TECH with a macro score supplied by `macroAt(date)`.

## Important limitations

Passing deterministic tests establishes implementation sanity, not predictive power. Historical FRED observations are revised data unless ALFRED vintages are used. A strategy is not considered validated merely because it beats DCA in one historical period. Production evaluation should report rolling 1Y/2Y/3Y windows, win rate, median excess annualized TWR, P10/P90, best/worst window, and sample count.
