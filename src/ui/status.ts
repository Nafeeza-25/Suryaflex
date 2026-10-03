import { type GridComparison, type GridEvaluation } from '../engine/simulation'

// Presentation only: safety is supplied by the engine, never recomputed here.
export function displayStatus(result: Pick<GridEvaluation, 'gridState'>) {
  const statuses = {
    safe: { label: 'SAFE', title: 'Safe Operation', detail: 'All parameters within limits' },
    warning: { label: 'WARNING', title: 'Grid Warning', detail: 'A grid parameter is approaching its limit' },
    violation: { label: 'VIOLATION', title: 'Grid Violation', detail: 'A safety threshold has been exceeded' },
  }
  return { ...statuses[result.gridState], tone: result.gridState }
}

export function displayedModeResults(pair: GridComparison) {
  return {
    static: pair.static,
    suryaflex: pair.flex,
  }
}

export function voltageProfile(pair: GridComparison) {
  const flex = new Map(pair.flex.busVoltages?.map(bus => [bus.bus, bus]))
  return (pair.static.busVoltages ?? []).map(bus => ({
    bus: bus.bus,
    name: bus.name,
    staticVoltage: bus.voltage,
    suryaflexVoltage: flex.get(bus.bus)?.voltage ?? null,
  })).sort((a, b) => a.bus - b.bus)
}
