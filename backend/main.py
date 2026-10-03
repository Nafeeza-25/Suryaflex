import math
import os
from typing import Literal

import pandapower as pp
import pandapower.networks as pn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="SuryaFlex Pandapower AC Grid Engine", version="2.0.0")
cors_origins = [origin.strip() for origin in os.getenv("CORS_ALLOW_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
cors_origin_regex = os.getenv("CORS_ALLOW_ORIGIN_REGEX", r"https://[a-z0-9-]+\.vercel\.app")
app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_origin_regex=cors_origin_regex,
                   allow_credentials=False, allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["Content-Type"])


class SimulationState(BaseModel):
    hour: float = 13.0
    cloudCover: float = 8.0
    demandMultiplier: float = 1.0
    solarPenetration: float = 80.0
    visibility: float = 95.0
    fairness: bool = False
    mode: Literal["static", "suryaflex"] = "suryaflex"
    scenario: Literal["headroom", "stress"] = "headroom"


profiles = ["small", "working", "remote", "ac"]
capacities = [3.0, 5.0, 5.0, 6.0, 8.0, 8.0, 10.0, 10.0, 12.0, 6.0]
limits = [3.0, 4.0, 4.0, 4.5, 5.0, 5.0, 5.0, 5.0, 5.0, 4.0]
# Bus 0 is the upstream 20 kV source; R1-R18 form the residential LV section.
# Original CIGRE residential demands are cleared and replaced by the household model.
RESIDENTIAL_BUS_NAMES = ["Bus 0"] + [f"Bus R{i}" for i in range(19)]
RESIDENTIAL_LOAD_BUSES = [1, 11, 15, 16, 17, 18]
# Kept as a compatibility name for existing model-inspection tooling.
CIGRE_LOAD_BUSES = RESIDENTIAL_LOAD_BUSES
STATIC_EXPORT_LIMIT_KW = 1.0
# Both benchmark cases retain the same plausible 3-12 kW household systems.
# Scenario B reaches limits through 100% PV penetration, clear sky, and lower demand.
STRESS_PV_CAPACITY_SCALE = 1.0
house_definitions = []
for i in range(100):
    house_definitions.append({
        "id": f"H{i + 1:02d}", "pvCapacity": capacities[i % len(capacities)],
        "profile": profiles[i % len(profiles)], "sensitivity": round(0.005 + i * 0.00045, 4),
        "fixedLimit": STATIC_EXPORT_LIMIT_KW, "bus_index": i % len(RESIDENTIAL_LOAD_BUSES),
    })


def solar_factor(hour: float, cloud: float) -> float:
    return max(0.0, math.sin(((hour - 6.0) / 12.0) * math.pi)) * (1.0 - cloud / 125.0)


def base_load(profile: str, hour: float) -> float:
    morning = math.exp(-((hour - 7.5) ** 2) / 3.0)
    evening = math.exp(-((hour - 19.0) ** 2) / 5.0)
    afternoon = math.exp(-((hour - 14.0) ** 2) / 7.0)
    if profile == "working": return 1.05 + 1.1 * morning + 1.85 * evening + 0.25 * afternoon
    if profile == "remote": return 1.25 + 0.45 * morning + 0.7 * afternoon + 1.35 * evening
    if profile == "ac": return 1.45 + 0.35 * morning + 2.0 * afternoon + 1.7 * evening
    return 0.65 + 0.55 * morning + 0.85 * evening + 0.12 * afternoon


def build_cigre_network():
    original = pn.create_cigre_network_lv()
    keep = original.bus.index[original.bus.name.isin(RESIDENTIAL_BUS_NAMES)].tolist()
    net = pp.toolbox.select_subnet(original, keep, include_switch_buses=True, keep_everything_else=False)
    # Keep original CIGRE electrical elements/parameters and discard all base loads.
    net.load.drop(net.load.index, inplace=True)
    return net


def _run_ac(net):
    try:
        pp.runpp(net, algorithm="nr", max_iteration=50, init="auto")
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Pandapower AC solve failed: {exc}") from exc
    if not net.converged:
        raise HTTPException(status_code=503, detail="Pandapower AC power flow did not converge")
    for table, column in [(net.res_bus, "vm_pu"), (net.res_line, "loading_percent"), (net.res_trafo, "loading_percent")]:
        if not table.empty and not all(math.isfinite(float(value)) for value in table[column]):
            raise HTTPException(status_code=503, detail="Pandapower AC power flow returned non-finite results")


def _make_net(state, houses, exports):
    net = build_cigre_network()
    loads = {bus: 0.0 for bus in RESIDENTIAL_LOAD_BUSES}
    generation = {bus: 0.0 for bus in RESIDENTIAL_LOAD_BUSES}
    for i, house in enumerate(houses):
        bus = RESIDENTIAL_LOAD_BUSES[house["bus_index"]]
        loads[bus] += house["load"]
        # PV sgen includes self-consumed generation and allowed export. Gross demand
        # stays on pp.create_load, so net import/export is represented exactly once.
        generation[bus] += house["selfConsumed"] + exports[i]
    q_ratio = math.tan(math.acos(0.95))
    for bus in RESIDENTIAL_LOAD_BUSES:
        p_mw = loads[bus] / 1000.0
        pp.create_load(net, bus=bus, p_mw=p_mw, q_mvar=p_mw * q_ratio, name=f"Residential demand R{bus}")
        pp.create_sgen(net, bus=bus, p_mw=generation[bus] / 1000.0, q_mvar=0.0, name=f"Residential PV R{bus}")
    return net


def _metrics(net):
    buses = [{"bus": int(i), "name": str(net.bus.at[i, "name"]), "voltage": float(net.res_bus.at[i, "vm_pu"])} for i in net.res_bus.index]
    lines = [{"line": int(i), "loading": float(net.res_line.at[i, "loading_percent"])} for i in net.res_line.index]
    trafos = [{"transformer": int(i), "loading": float(net.res_trafo.at[i, "loading_percent"])} for i in net.res_trafo.index]
    vmax = max(x["voltage"] for x in buses); vmin = min(x["voltage"] for x in buses)
    max_line = max((x["loading"] for x in lines), default=0.0); max_trafo = max((x["loading"] for x in trafos), default=0.0)
    vbad = [x["bus"] for x in buses if x["voltage"] > 1.05 or x["voltage"] < 0.95]
    lbad = [x["line"] for x in lines if x["loading"] > 100.0]
    tbad = [x["transformer"] for x in trafos if x["loading"] > 100.0]
    violations = [{"kind": "voltage", "bus": b} for b in vbad] + [{"kind": "line_loading", "line": l} for l in lbad] + [{"kind": "transformer_loading", "transformer": t} for t in tbad]
    safe = not violations
    warning = vmax >= 1.043 or vmin <= 0.957 or max_line >= 88 or max_trafo >= 88
    return {"maxVoltage": vmax, "minVoltage": vmin, "transformerLoading": max_trafo, "maxLineLoading": max_line,
            "violations": violations, "voltageViolationBuses": vbad, "lineViolationIndices": lbad,
            "transformerViolationIndices": tbad, "gridState": "violation" if not safe else "warning" if warning else "safe",
            "busVoltages": buses, "lineLoadings": lines, "transformerLoadings": trafos}


def run_pandapower_simulation(state: SimulationState, dump_debug: bool = False):
    is_night = state.hour >= 19.0 or state.hour < 6.0
    penetration = max(0.0, min(100.0, state.solarPenetration))
    active_pv_count = int(round(100 * penetration / 100.0))
    pv_scale = STRESS_PV_CAPACITY_SCALE if state.scenario == "stress" else 1.0
    houses = []
    for idx, h in enumerate(house_definitions):
        has_pv = not is_night and idx < active_pv_count
        pv_dc = h["pvCapacity"] * pv_scale * solar_factor(state.hour, state.cloudCover) if has_pv else 0.0
        pv_ac = pv_dc * 0.97
        load = base_load(h["profile"], state.hour) * max(0.0, state.demandMultiplier)
        self_consumed = min(load, pv_ac)
        houses.append({**h, "busName": f"Bus R{[1,11,15,16,17,18][h['bus_index']]}", "generationDc": pv_dc,
                       "generationAc": pv_ac, "load": load, "surplus": max(0.0, pv_ac-load), "selfConsumed": self_consumed})
    # Scenario B's static baseline permits the full requested export to expose
    # the stressed feeder; Scenario A compares against the documented 1 kW cap.
    requests = ([h["surplus"] for h in houses] if state.mode == "suryaflex" or state.scenario == "stress"
                else [min(h["surplus"], STATIC_EXPORT_LIMIT_KW) for h in houses])

    def solve(exports):
        net = _make_net(state, houses, exports)
        _run_ac(net)
        return net, _metrics(net)

    exports = list(requests)
    net, metrics = solve(exports)
    trace = [{"iteration": 0, "exportKW": sum(exports), "maxVoltage": metrics["maxVoltage"], "minVoltage": metrics["minVoltage"], "transformerLoading": metrics["transformerLoading"], "maxLineLoading": metrics["maxLineLoading"], "safe": not metrics["violations"]}]
    controller = {"converged": True, "outcome": "static_limit" if state.mode == "static" else "full_export_safe", "iterations": 0, "trace": trace}
    if state.mode == "suryaflex" and metrics["violations"]:
        zero_net, zero_metrics = solve([0.0] * len(houses))
        if zero_metrics["violations"]:
            net, metrics = zero_net, zero_metrics
            exports = [0.0] * len(houses)
            controller.update({"converged": False, "outcome": "infeasible_at_zero_export", "iterations": 1})
            trace.append({"iteration": 1, "exportKW": 0.0, "maxVoltage": metrics["maxVoltage"], "minVoltage": metrics["minVoltage"], "transformerLoading": metrics["transformerLoading"], "maxLineLoading": metrics["maxLineLoading"], "safe": False})
        else:
            low, high = 0.0, 1.0
            best_net, best_metrics, best_exports = zero_net, zero_metrics, [0.0] * len(houses)
            for iteration in range(1, 15):
                factor = (low + high) / 2.0
                candidate = [requests[i] * factor if state.fairness else requests[i] * factor / (1.0 + houses[i]["sensitivity"] * 6.0) for i in range(len(houses))]
                candidate_net, candidate_metrics = solve(candidate)
                ok = not candidate_metrics["violations"]
                trace.append({"iteration": iteration, "exportKW": sum(candidate), "maxVoltage": candidate_metrics["maxVoltage"], "minVoltage": candidate_metrics["minVoltage"], "transformerLoading": candidate_metrics["transformerLoading"], "maxLineLoading": candidate_metrics["maxLineLoading"], "safe": ok})
                if ok:
                    low = factor; best_net, best_metrics, best_exports = candidate_net, candidate_metrics, candidate
                else: high = factor
            net, metrics, exports = best_net, best_metrics, best_exports
            controller.update({"outcome": "safe_dynamic_allocation", "iterations": len(trace)-1})

    potential_surplus = sum(h["surplus"] for h in houses)
    total_export = sum(exports)
    total_load = sum(h["load"] for h in houses)
    total_generation = sum(h["generationAc"] for h in houses)
    total_dc = sum(h["generationDc"] for h in houses)
    total_curtail = potential_surplus - total_export
    curtailed = [max(0.0, h["surplus"] - exports[i]) for i, h in enumerate(houses)]
    curtail_fracs = [curtailed[i]/h["surplus"] for i, h in enumerate(houses) if h["surplus"] > 1e-9]
    mean_frac = sum(curtail_fracs)/len(curtail_fracs) if curtail_fracs else 0.0
    inequality = math.sqrt(sum((x-mean_frac)**2 for x in curtail_fracs)/len(curtail_fracs)) if curtail_fracs else 0.0
    results = []
    static_policy_reason = ("Full available PV surplus permitted for high-PV/low-load stress baseline"
                            if state.scenario == "stress" else "Fixed 1.0 kW per-house static export limit")
    for i, h in enumerate(houses):
        results.append({**h, "generation": h["generationAc"], "allowedExport": exports[i],
                        "actualImport": max(0.0, h["load"]-h["generationAc"]),
                        "curtailment": curtailed[i], "confidence": state.visibility,
                        "reason": "AC Power-Flow validated export limit" if state.mode == "suryaflex" else static_policy_reason})
    q_load = total_load / 1000.0 * math.tan(math.acos(0.95))
    # sgen is PV self-consumption plus exports, which balances gross load plus upstream exchange.
    result = {"houses": results, "totalGenerationDc": total_dc, "totalGeneration": total_generation,
              "totalLoad": total_load, "totalExport": total_export, "totalCurtailment": total_curtail,
              "potentialSurplus": potential_surplus, "maxVoltage": metrics["maxVoltage"], "minVoltage": metrics["minVoltage"],
              "transformerLoading": metrics["transformerLoading"], "maxLineLoading": metrics["maxLineLoading"],
              "violations": len(metrics["violations"]), "violationDetails": metrics["violations"],
              "voltageViolationBuses": metrics["voltageViolationBuses"], "lineViolationIndices": metrics["lineViolationIndices"],
              "transformerViolationIndices": metrics["transformerViolationIndices"],
              "reversePower": max(0.0, -float(net.res_ext_grid.p_mw.sum()) * 1000.0),
              "gridImport": max(0.0, float(net.res_ext_grid.p_mw.sum()) * 1000.0), "gridState": metrics["gridState"],
              "failSafe": False, "inequality": inequality * 100.0, "engineSource": "PANDAPOWER_AC",
              "busVoltages": metrics["busVoltages"], "lineLoadings": metrics["lineLoadings"],
              "transformerLoadings": metrics["transformerLoadings"], "controller": controller,
              "electricalBalance": {"loadMW": total_load/1000.0, "loadMVAR": q_load,
                                    "sgenMW": (sum(h["selfConsumed"] for h in houses)+total_export)/1000.0,
                                    "sgenMVAR": 0.0, "unitConvention": "API kW; Pandapower MW/MVAr; kW / 1000"},
              "scenario": state.scenario, "assumptions": {"pvCapacityScale": pv_scale, "solarPenetrationPct": penetration,
              "cloudCoverPct": state.cloudCover, "demandMultiplier": state.demandMultiplier,
              "staticExportLimitKWPerHouse": STATIC_EXPORT_LIMIT_KW,
              "stressStaticPolicy": "full available solar surplus permitted" if state.scenario == "stress" else None, "householdLoadPF": 0.95,
              "pvInverterPF": 1.0, "originalCigreLoads": "removed; replaced by 100 mapped residential household loads"}}
    return result


@app.get("/api/health")
def health_check():
    return {"status": "ok", "engine": "pandapower", "engineSource": "PANDAPOWER_AC", "pandapower_version": pp.__version__,
            "network": "CIGRE LV residential feeder (20 buses, 17 lines, 1 transformer, 100 households)",
            "residentialLoadBuses": ["Bus R1", "Bus R11", "Bus R15", "Bus R16", "Bus R17", "Bus R18"]}


@app.post("/api/simulate")
def simulate(state: SimulationState):
    return run_pandapower_simulation(state)


@app.post("/api/compare")
def compare(state: SimulationState):
    static_state = state.model_copy(update={"mode": "static"})
    flex_state = state.model_copy(update={"mode": "suryaflex"})
    return {"static": run_pandapower_simulation(static_state), "flex": run_pandapower_simulation(flex_state), "scenario": state.scenario}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
