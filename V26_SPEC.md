# Market Radar V2.6 — frozen specification

## Goal
V2.6 recommends how to distribute each new monthly contribution. It never sells. The recommendation and backtest MUST use the same `MR26.smartDcaAllocation` function and the same parameters.

## Live Comprar
- Monthly contribution comes from `state.monthly` (fallback 1000 only when missing/invalid, not when explicitly zero).
- Eligible asset requires a positive target and valid contemporaneous drawdown data.
- Target weights are the anchor.
- Drawdown increases new-money allocation; underweight is a secondary tilt.
- Per-asset allocation cap: 40% of that month's contribution.
- Allocations must be non-negative and sum exactly to the contribution to cent precision.
- No selling or implicit rebalancing of existing holdings.

## Backtest timing contract
For every monthly decision date `t`:
1. Signal/information set is built ONLY from observations strictly before `t`.
2. The allocation is decided from that prior information set.
3. The contribution is invested at the price observed at `t`.
4. Only after execution may the `t` observation enter history for future decisions.
This prevents same-close look-ahead.

## Backtest comparators
- Target DCA: new contribution distributed by target weights.
- Contribution rebalance: new money goes toward underweights only; never sells.
- Smart DCA V2.6: exact production allocator and parameters.
All strategies receive identical external cash on identical dates.

## Metrics
- Contributions are external cash flows, never investment return.
- Report terminal value, gain over contributions, annualized TWR, XIRR, max drawdown, volatility and Sharpe.
- Flat prices with contributions must have zero investment return.

## Rolling validation
- A rolling window is valid only if the complete requested history exists.
- Overlapping windows must be labelled `overlapping rolling windows`, never independent samples.
- Win counts are descriptive, not statistical proof.
- Fewer than 5 windows: explicitly show insufficient sample.

## Release gate
No merge to `main` unless all are true:
- syntax checks pass;
- allocator unit/adversarial tests pass;
- contribution conservation and cap tests pass;
- no-look-ahead test changes future prices without changing today's decision;
- same-close test proves today's close is unavailable to today's signal;
- monthly timing tests pass;
- independent metric invariants pass;
- deterministic end-to-end scenarios pass;
- UI smoke test confirms Radar / Comprar / Backtest / Ajustes navigation remains present;
- complete PR diff reviewed after tests are green.
