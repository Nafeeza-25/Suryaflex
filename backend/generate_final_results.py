"""Regenerate the checked-in competition benchmark summaries from AC solves."""
import json
from pathlib import Path

from main import SimulationState, run_pandapower_simulation


SCENARIOS = {
    "headroom": {"hour": 13, "solarPenetration": 80, "cloudCover": 8, "demandMultiplier": 1.0},
    "stress": {"hour": 13, "solarPenetration": 100, "cloudCover": 0, "demandMultiplier": 0.6},
}


def summary(result):
    curtailed = [float(h["curtailment"]) for h in result["houses"]]
    rates = [float(h["curtailment"]) / float(h["surplus"]) for h in result["houses"] if h["surplus"] > 1e-9]
    return {
        "pv_generation_kw": result["totalGeneration"],
        "household_demand_kw": result["totalLoad"],
        "potential_solar_surplus_kw": result["potentialSurplus"],
        "solar_exported_kw": result["totalExport"],
        "solar_curtailed_kw": result["totalCurtailment"],
        "max_voltage_pu": result["maxVoltage"],
        "min_voltage_pu": result["minVoltage"],
        "max_transformer_loading_pct": result["transformerLoading"],
        "max_line_loading_pct": result["maxLineLoading"],
        "constraint_violations": result["violationDetails"],
        "households_curtailed": sum(v > 1e-6 for v in curtailed),
        "average_curtailment_kw_per_household": sum(curtailed) / 100,
        "worst_household_curtailment_kw": max(curtailed, default=0.0),
        "mean_curtailed_surplus_fraction": sum(rates) / len(rates) if rates else 0.0,
        "curtailment_inequality_stddev_percentage_points": result["inequality"],
        "reverse_power_kw": result["reversePower"],
        "grid_import_kw": result["gridImport"],
        "grid_state": result["gridState"],
        "controller": result["controller"],
        "raw_ac_tables": {
            "bus_voltages": result["busVoltages"],
            "transformer_loadings": result["transformerLoadings"],
            "line_loadings": result["lineLoadings"],
        },
    }


def build_scenario(name, params):
    state = SimulationState(scenario=name, mode="static", **params)
    static = summary(run_pandapower_simulation(state))
    flex = summary(run_pandapower_simulation(state.model_copy(update={"mode": "suryaflex"})))
    static_curtail = static["solar_curtailed_kw"]
    flex_curtail = flex["solar_curtailed_kw"]
    static_export = static["solar_exported_kw"]
    return {
        "scenario": name,
        "description": "Available-grid-headroom comparison" if name == "headroom" else "High-PV / low-load stress test",
        "assumptions": {
            **params,
            "pv_capacity_scale": 1.0,
            "pv_inverter_pf": 1.0,
            "household_load_pf": 0.95,
            "headroom_static_policy": "fixed 1.0 kW export cap per home" if name == "headroom" else None,
            "stress_static_policy": "full available PV surplus permitted" if name == "stress" else None,
            "original_cigre_loads": "removed; replaced with aggregated gross demand for 100 homes on six residential load buses",
            "kW_to_pandapower_mw": "divide by 1000",
        },
        "static": static,
        "suryaflex": flex,
        "additional_export_enabled_pct": ((flex["solar_exported_kw"] - static_export) / static_export * 100) if static_export else None,
        "curtailment_reduction_pct": ((static_curtail - flex_curtail) / static_curtail * 100) if static_curtail else None,
        "percentage_formulas": {
            "additional_export_enabled_pct": "(SuryaFlex export - Static export) / Static export * 100",
            "curtailment_reduction_pct": "(Static curtailment - SuryaFlex curtailment) / Static curtailment * 100",
        },
        "provenance": "Every grid voltage and loading value is from a converged pandapower AC solve (net.res_bus, net.res_trafo, net.res_line).",
    }


if __name__ == "__main__":
    output_dir = Path(__file__).parent
    for name, params in SCENARIOS.items():
        result = build_scenario(name, params)
        target = output_dir / f"final_scenario_{name}.json"
        target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {target}")
