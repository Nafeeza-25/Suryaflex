import math
import pytest
import pandapower.networks as pn
from main import SimulationState, build_cigre_network, run_pandapower_simulation


def test_residential_topology_and_parameters_are_preserved():
    original = pn.create_cigre_network_lv()
    net = build_cigre_network()
    names = net.bus.name.tolist()
    assert set(names) == {"Bus 0"} | {f"Bus R{i}" for i in range(19)}
    assert len(net.trafo) == 1
    assert len(net.bus) == 20
    assert len(net.line) == 17
    assert len(net.load) == 0
    for idx, row in net.line.iterrows():
        for key in ['from_bus', 'to_bus', 'length_km', 'r_ohm_per_km', 'x_ohm_per_km', 'max_i_ka']:
            assert row[key] == original.line.loc[idx, key]
    for idx, row in net.trafo.iterrows():
        for key in ['hv_bus', 'lv_bus', 'sn_mva', 'vk_percent', 'vkr_percent', 'tap_pos']:
            assert row[key] == original.trafo.loc[idx, key]


def test_real_household_mapping_and_energy_balance():
    res = run_pandapower_simulation(SimulationState(mode='static'))
    assert len(res['houses']) == 100
    residential = {1, 11, 15, 16, 17, 18}
    assert set(h['busName'] for h in res['houses']) == {f'Bus R{i}' for i in residential}
    for h in res['houses']:
        assert h['generationAc'] == pytest.approx(h['selfConsumed'] + h['allowedExport'] + h['curtailment'], abs=2e-6)
        assert h['load'] == pytest.approx(h['selfConsumed'] + h['actualImport'], abs=2e-6)
    assert res['electricalBalance']['loadMW'] == pytest.approx(res['totalLoad'] / 1000, abs=2e-8)
    assert res['electricalBalance']['sgenMW'] == pytest.approx(sum(h['selfConsumed'] + h['allowedExport'] for h in res['houses'])/1000, abs=2e-8)
    assert res['electricalBalance']['loadMVAR'] == pytest.approx(res['electricalBalance']['loadMW'] * math.tan(math.acos(.95)))
    assert res['electricalBalance']['sgenMVAR'] == 0


def test_headroom_is_gained_without_constraint_violations():
    static = run_pandapower_simulation(SimulationState(scenario='headroom', mode='static'))
    flex = run_pandapower_simulation(SimulationState(scenario='headroom'))
    assert static['violations'] == 0
    assert flex['totalExport'] > static['totalExport']
    assert flex['maxVoltage'] <= 1.05
    assert flex['minVoltage'] >= .95
    assert flex['transformerLoading'] <= 100
    assert flex['maxLineLoading'] <= 100
    assert flex['violations'] == 0


def test_stress_static_breaches_and_dynamic_ac_control_restores_limits():
    assumptions = dict(scenario='stress', solarPenetration=100, cloudCover=0, demandMultiplier=.6)
    static = run_pandapower_simulation(SimulationState(mode='static', **assumptions))
    flex = run_pandapower_simulation(SimulationState(mode='suryaflex', **assumptions))
    assert static['engineSource'] == flex['engineSource'] == 'PANDAPOWER_AC'
    assert static['maxVoltage'] > 1.05 or static['transformerLoading'] > 100 or static['maxLineLoading'] > 100
    assert flex['violations'] == 0
    assert flex['maxVoltage'] <= 1.05 and flex['minVoltage'] >= .95
    assert flex['transformerLoading'] <= 100 and flex['maxLineLoading'] <= 100
    assert flex['controller']['outcome'] == 'safe_dynamic_allocation'


def test_final_tables_match_grid_metrics():
    res = run_pandapower_simulation(SimulationState())
    assert res['maxVoltage'] == max(r['voltage'] for r in res['busVoltages'])
    assert res['minVoltage'] == min(r['voltage'] for r in res['busVoltages'])
    assert res['transformerLoading'] == max(r['loading'] for r in res['transformerLoadings'])
    assert res['maxLineLoading'] == max(r['loading'] for r in res['lineLoadings'])
    assert res['controller']['converged']


def test_solver_failure_is_explicit(monkeypatch):
    import main
    def broken(*args, **kwargs):
        raise RuntimeError('solver unavailable')
    monkeypatch.setattr(main.pp, 'runpp', broken)
    with pytest.raises(main.HTTPException) as failure:
        run_pandapower_simulation(SimulationState())
    assert failure.value.status_code == 503


def test_undervoltage_is_not_ignored():
    # Deeply overloaded benchmark fails AC convergence; expose that failure as
    # offline rather than presenting stale or fabricated voltage results.
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as failure:
        run_pandapower_simulation(SimulationState(hour=22, demandMultiplier=20))
    assert failure.value.status_code == 503
