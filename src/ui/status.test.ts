import { describe, expect, it } from 'vitest'
import { displayStatus, displayedModeResults, voltageProfile } from './status'
import { acPair } from '../engine/ac-fixture'

describe('operator display status', () => {
  it('selects both actual backend results by identity without synthesizing an inactive mode', () => {
    const pair = acPair()
    const shown = displayedModeResults(pair)
    expect(shown.static).toBe(pair.static)
    expect(shown.suryaflex).toBe(pair.flex)
    expect(displayStatus(shown.static).label).toBe('VIOLATION')
    expect(displayStatus(shown.suryaflex).label).toBe('SAFE')
  })
  it('preserves violation status rather than inferring safety from voltage alone', () => {
    const result = { ...acPair().flex, maxVoltage: 1, gridState: 'violation' as const }
    expect(displayStatus(result).label).toBe('VIOLATION')
  })
  it('joins AC voltage measurements by bus index regardless of array order', () => {
    const pair = acPair()
    pair.flex.busVoltages = [{ bus: 1, name: 'Feeder', voltage: 1.027 }, { bus: 0, name: 'Grid', voltage: 1.001 }]
    expect(voltageProfile(pair)).toEqual([
      { bus: 0, name: 'Grid', staticVoltage: 1, suryaflexVoltage: 1.001 },
      { bus: 1, name: 'Feeder', staticVoltage: 1.032, suryaflexVoltage: 1.027 },
    ])
  })
})

