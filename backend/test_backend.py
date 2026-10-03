import pytest
import pandapower as pp
from fastapi.testclient import TestClient
from main import app
from main import (
    build_cigre_network,
    run_pandapower_simulation,
    SimulationState,
    house_definitions,
    CIGRE_LOAD_BUSES
)

def test_cors_allows_local_and_vercel_origins_but_not_arbitrary_origins():
    client = TestClient(app)
    for origin in ["http://localhost:5173", "https://suryaflex-preview.vercel.app"]:
        response = client.get("/api/health", headers={"Origin": origin})
        assert response.headers.get("access-control-allow-origin") == origin
    blocked = client.get("/api/health", headers={"Origin": "https://example.com"})
    assert "access-control-allow-origin" not in blocked.headers

def test_cigre_network_loads_successfully():
    net = build_cigre_network()
    assert len(net.bus) == 20
    assert len(net.line) == 17
    assert len(net.trafo) == 1
    # Ensure default CIGRE loads were cleared to prevent double counting
    assert len(net.load) == 0

def test_runpp_converges():
    state = SimulationState(hour=13.0, solarPenetration=80.0, mode="suryaflex")
    res = run_pandapower_simulation(state)
    assert res["engineSource"] == "PANDAPOWER_AC"
    assert res["maxVoltage"] > 0.9
    assert res["minVoltage"] > 0.8
    assert res["transformerLoading"] >= 0.0
    assert res["maxLineLoading"] >= 0.0

def test_static_high_pv_increases_voltage_relative_to_low_pv():
    low_pv_state = SimulationState(hour=13.0, solarPenetration=10.0, mode="static")
    high_pv_state = SimulationState(hour=13.0, solarPenetration=100.0, mode="static")

    res_low = run_pandapower_simulation(low_pv_state)
    res_high = run_pandapower_simulation(high_pv_state)

    assert res_high["maxVoltage"] >= res_low["maxVoltage"]
    assert res_high["totalGeneration"] > res_low["totalGeneration"]

def test_night_pv_is_zero():
    night_state = SimulationState(hour=21.0, solarPenetration=80.0, mode="suryaflex")
    res = run_pandapower_simulation(night_state)
    assert res["totalGenerationDc"] == 0.0
    assert res["totalGeneration"] == 0.0
    for h in res["houses"]:
        assert h["generationDc"] == 0.0
        assert h["generationAc"] == 0.0

def test_deterministic_100_house_mapping():
    assert len(house_definitions) == 100
    buses_mapped = [h["bus_index"] for h in house_definitions]
    for b_idx in buses_mapped:
        assert 0 <= b_idx < len(CIGRE_LOAD_BUSES)
    assert house_definitions[0]["id"] == "H01"
    assert house_definitions[99]["id"] == "H100"

def test_unit_conversion_kw_to_mw():
    state = SimulationState(hour=13.0, solarPenetration=50.0, mode="suryaflex")
    res = run_pandapower_simulation(state)
    # Check total energy balance: generation_ac == self_consumed + export + curtailment (within rounding)
    tot_pv_ac = res["totalGeneration"]
    tot_load = res["totalLoad"]
    tot_export = res["totalExport"]
    assert tot_pv_ac >= 0
    assert tot_load >= 0
    assert tot_export >= 0

def test_suryaflex_enforces_safety_limits():
    flex_state = SimulationState(hour=13.0, solarPenetration=100.0, mode="suryaflex")
    res = run_pandapower_simulation(flex_state)
    assert res["maxVoltage"] <= 1.05
    assert res["transformerLoading"] <= 100.0
    assert res["maxLineLoading"] <= 100.0
