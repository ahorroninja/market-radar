# Market Radar V2.6 validation snapshot

Dataset: user export dated 2026-09-30. Core universe: MSCI World 25, S&P 500 5, World Value 15, EM Value 10. Monthly contribution: EUR 1,000. Macro fixed neutral for the V2.5 comparator because the export contains no historical macro series.

Independent reconstruction (not the production backtest):

| Start | Contributions | DCA target | V2.5 allocation logic | V2.6 Smart DCA |
|---|---:|---:|---:|---:|
| 2023-10 | 36,000 | 53,586.76 | 54,114.07 | 54,334.18 |
| 2021-10 | 60,000 | 103,052.32 | 104,368.20 | 104,752.03 |
| 2019-01 | 93,000 | 185,615.42 | 188,112.30 | 188,348.74 |

Candidate parameters: drawdownStrength=1.0, underweightStrength=0.35, maxAssetShare=0.40.

Interpretation: V2.6 beats both target DCA and the reconstructed V2.5 allocation in these three endpoint tests, but the edge is modest. This is evidence for continued validation, not proof of persistent alpha. Production main remains unchanged.

Required invariants before merge:
- exactly one contribution per calendar month;
- cash never negative beyond rounding tolerance;
- allocations sum exactly to the monthly contribution;
- no sales;
- no future observations in a signal;
- unavailable/new assets receive no allocation before their first valid history;
- concentration cap is respected.
