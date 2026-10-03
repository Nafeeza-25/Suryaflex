# SuryaFlex Pandapower AC Validation

## Engine and network

- Engine: Pandapower 3.5.5, Newton-Raphson AC load flow, `max_iteration=50`.
- API: FastAPI; `GET /api/health`, `POST /api/simulate`, and `POST /api/compare`.
- Feeder: CIGRE LV residential subnetwork with 20 buses, 17 lines, one transformer, and the original electrical element parameters retained.
- Household mapping: 100 deterministic modeled homes distributed across Bus R1, R11, R15, R16, R17, and R18. Original CIGRE loads are removed and replaced with aggregated household loads and PV injections.
- Solver metrics are read from the converged `net.res_bus`, `net.res_line`, and `net.res_trafo` result tables. AC solver exceptions, non-convergence, and non-finite results return HTTP 503.

## Electrical assumptions and controller

- Household PV DC capacities repeat the modeled 3–12 kW set; AC production applies the existing solar profile and 0.97 inverter efficiency.
- Household demand uses deterministic residential profiles and a 0.95 lagging power factor. PV operates at unity power factor.
- Household kW values are converted to Pandapower MW/MVAr by dividing by 1000. Gross load remains a load element; self-consumed PV plus allowed export is represented as generation.
- Hard operating limits: bus voltage 0.950–1.050 pu, line loading ≤100%, transformer loading ≤100%. The UI may show WARNING near a limit while there are no hard-limit violations.
- Scenario A Static uses the fixed 1.0 kW per-home export cap. Scenario B Static is an intentionally unmanaged stress baseline that permits the full available PV surplus. SuryaFlex tests AC feasibility while allocating household export limits.

## Reproduced competition scenarios

Settings and results below come from `final_scenario_headroom.json` and `final_scenario_stress.json`. Power values are kW; loading values are percent. The household PV generation and demand totals are shared by both modes in each scenario.

### Scenario A — Available headroom

Settings: 13:00, 80% PV penetration, 8% cloud cover (92% solar intensity in the UI), and 1.0× demand.

| Mode | PV generation | Demand | Export | Curtailed | Vmax (pu) | Vmin (pu) | Transformer | Max line | Violations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Static | 512.158292 | 176.642759 | 79.092436 | 291.751649 | 1.002689 | 0.996527 | 12.174991% | 8.786543% | 0 |
| SuryaFlex | 512.158292 | 176.642759 | 250.914658 | 119.929426 | 1.049996 | 0.998851 | 34.021292% | 24.552753% | 0 |

SuryaFlex enables 217.242% more export and reduces curtailment by 58.893% versus this fixed-cap baseline. Its maximum voltage rounds to 1.050 pu in the UI and is within the configured limit; the UI labels it `WITHIN CONFIGURED LIMIT`.

### Scenario B — High-PV / low-load stress

Settings: 13:00, 100% PV penetration, 0% cloud cover (100% solar intensity in the UI), and 0.6× demand.

| Mode | PV generation | Demand | Export | Curtailed | Vmax (pu) | Vmin (pu) | Transformer | Max line | Violations |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Static / unmanaged baseline | 683.972078 | 105.985655 | 577.986422 | 0.000000 | 1.150061 | 1.000000 | 85.346858% | 61.593789% | 13 |
| SuryaFlex | 683.972078 | 105.985655 | 187.270415 | 390.716008 | 1.049999 | 1.000000 | 30.115432% | 21.733941% | 0 |

All 13 baseline violations are bus overvoltages. SuryaFlex is within the configured hard limits, with maximum voltage close to the upper bound.

## Known limitations

- At 22:00 with no PV generation and household demand at 1.0×, the converged AC case reached a minimum voltage of 0.948 pu, below the configured 0.950 pu lower limit. The UI reports a voltage violation; this modeled low-voltage condition requires engineering review.
- The network uses a balanced single-phase equivalent. Three-phase unbalance, temperature-dependent line impedance, and dynamic line ratings are not represented.
- The 24-hour replay is an illustrative profile; competition scenario comparison values come from independent Pandapower AC solves.

## Frontend engine behavior

The default Live Simulation requests and validates both modes from `/api/compare` and displays `AC ENGINE: PANDAPOWER` only for `PANDAPOWER_AC` results. API failures or invalid data display `ENGINE OFFLINE`; the live page does not fall back to mock results. CORS is restricted to local development origins and the configured Vercel-origin pattern.
