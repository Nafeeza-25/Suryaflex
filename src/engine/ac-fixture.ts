import { buildEvaluation, createSimulationState, type GridComparison } from './simulation'

// Deterministic transport fixture only; never imported by the live application.
export function acPair(): GridComparison {
  const value = { ...buildEvaluation(createSimulationState()), engineSource: 'PANDAPOWER_AC' as const, busVoltages: [{ bus: 0, name: 'Grid', voltage: 1 }, { bus: 1, name: 'Feeder', voltage: 1.032 }] }
  return { static: { ...value, maxVoltage: 1.061, gridState: 'violation' }, flex: { ...value, maxVoltage: 1.032, gridState: 'safe' }, scenario: 'headroom' }
}
