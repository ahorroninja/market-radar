# Market Radar V2.6 — release specification

## Goal
V2.6 recommends how to distribute each positive monthly contribution. It never sells. Live Comprar and the backtest MUST use the same `MR26.smartDcaAllocation` function and parameters.

## Live Comprar
- Monthly contribution comes from `state.monthly`; missing, non-finite or non-positive values fall back to 1000 € (matching the existing app state contract).
- Eligible asset requires a positive target and valid drawdown data.
- Target weights are the anchor; drawdown increases new-money allocation; underweight is a secondary tilt.
- Per-asset allocation cap is 40% of that month's contribution.
- Because exact cash conservation and a 40% cap are mathematically incompatible with fewer than 3 eligible assets, Comprar must refuse to calculate and ask for refreshed data in that case.
- Allocations are non-negative and sum exactly to the contribution to cent precision.
- No selling or implicit rebalancing of existing holdings.

## Backtest timing contract
For every monthly decision date `t`:
1. Signal and portfolio weights are built ONLY from observations strictly before `t`.
2. The allocation is decided from that prior information set.
3. The contribution is invested at the price observed at `t`.
4. Only after execution may the `t` observation enter history for future decisions.
5. A backtest/rolling window receives up to 252 prior common sessions as signal warmup; warmup prices create no holdings, contributions or returns.
This prevents same-close look-ahead and avoids throwing away most of a short rolling window as indicator warmup.

## Backtest comparators
- Target DCA: new contribution distributed by normalized target weights.
- Contribution rebalance: new money goes toward underweights only; never sells.
- Smart DCA V2.6: exact production allocator and parameters.
All strategies receive identical external cash on identical dates.

## Metrics
- Contributions are external cash flows, never investment return.
- Report terminal value, gain over contributions, annualized TWR, XIRR, max drawdown, volatility and Sharpe.
- Flat prices with contributions must have zero investment return.

## Rolling validation
- A rolling window is valid only if the complete requested investment window exists and sufficient prior signal warmup is available.
- Overlapping windows must be labelled overlapping/descriptive, never independent samples.
- Win counts are descriptive, not statistical proof.
- Fewer than 5 windows: explicitly show insufficient sample.

## Release gate
No merge to `main` unless all are true:
- syntax checks pass;
- allocator unit/adversarial tests pass;
- contribution conservation, cent rounding, invalid-input and 40% cap tests pass;
- no-look-ahead and same-close tests pass;
- rolling windows use pre-window warmup without investing during warmup;
- monthly timing tests pass;
- metric invariants pass;
- deterministic end-to-end scenarios pass;
- partial live data fails safely rather than violating the cap;
- Radar / Comprar / Backtest / Ajustes navigation remains present;
- complete PR diff is reviewed after tests are green.
