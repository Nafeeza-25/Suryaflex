# Real residential AC validation plan

User specification: final UI frozen; real pandapower backend, deterministic CIGRE residential mapping, honest headroom and stress benchmarks, no mock fallback during validation.

Implementation uses existing FastAPI and pandapower architecture.

1. Start existing runtime and verify health; record current full-network mapping before replacing it.
2. Extract only residential R buses plus the original upstream supply, residential transformer, lines and supply switch. Preserve original indices and electrical parameter values; remove original loads and replace them with exactly 100 deterministic household loads/PV generators.
3. Model household gross load at PF=0.95 lagging and actual inverter generation (self-consumption + permitted export), PF=1.0. Keep internal kW values unrounded until presentation; convert once to MW/MVAr. Never inject export alone against gross load.
4. Run AC for all requests. On constraints (including undervoltage), use validated zero-export feasibility and bounded bisection on export envelopes, with proportional fairness or voltage-distance weighting. Return final res_bus/res_trafo/res_line tables, convergence and controller exhaustion honestly.
5. Document and run fixed Scenario A (conservative 1 kW export cap, existing PV capacities) and Scenario B (full static surplus, realistic uniformly scaled rooftop PV, low demand). Determine stress sizing by an AC scan, recording the tested assumptions, not modifying network limits/ratings.
6. Add /api/compare returning both real modes and bus profiles; wire the frozen frontend with abort/stale handling and explicit offline/loading states. Keep any synthetic 24-hour chart explicitly illustrative.
7. Produce final_scenario_headroom.json and final_scenario_stress.json, then run backend tests, frontend tests, TypeScript/build and browser online/offline/night checks plus four required scenario screenshots.

Risks to test: solver non-convergence must not become a safe result; full vs export-only injection; original load double counting; lower-voltage constraint and inability to repair it by export curtailment; final fairness allocation must be revalidated; stale frontend request must never overwrite current state.

No new visual design, product features, presentation deck or invented solver benefit.
