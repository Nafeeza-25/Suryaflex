import { describe, expect, it } from 'vitest'
import { buildEvaluation, createSimulationState, houses } from './simulation'

describe('SuryaFlex simulation engine & 100-household grid physics', () => {
  it('A. Noon + low PV penetration is safe', () => {
    const res = buildEvaluation(createSimulationState({ hour: 13, solarPenetration: 30 }))
    expect(res.gridState).toBe('safe')
    expect(res.maxVoltage).toBeLessThanOrEqual(1.05)
  })

  it('B. Noon + high PV penetration + low demand causes stress in STATIC MODE', () => {
    const staticRes = buildEvaluation(createSimulationState({ hour: 13, solarPenetration: 100, cloudCover: 0, demandMultiplier: 0.7, mode: 'static' }))
    expect(staticRes.maxVoltage).toBeGreaterThan(1.05)
    expect(staticRes.gridState).toBe('violation')
  })

  it('C. Same high-PV scenario in SURYAFLEX MODE adapts export limits safely', () => {
    const flexRes = buildEvaluation(createSimulationState({ hour: 13, solarPenetration: 100, cloudCover: 0, demandMultiplier: 0.7, mode: 'suryaflex' }))
    expect(flexRes.maxVoltage).toBeLessThanOrEqual(1.05)
    expect(flexRes.gridState).toBe('safe')
  })

  it('D. Heavy cloud cover reduces PV generation', () => {
    const sunny = buildEvaluation(createSimulationState({ hour: 13, cloudCover: 5 }))
    const cloudy = buildEvaluation(createSimulationState({ hour: 13, cloudCover: 80 }))
    expect(cloudy.totalGeneration).toBeLessThan(sunny.totalGeneration)
  })

  it('E. Higher house demand decreases available surplus', () => {
    const normal = buildEvaluation(createSimulationState({ hour: 13, demandMultiplier: 1.0 }))
    const highDemand = buildEvaluation(createSimulationState({ hour: 13, demandMultiplier: 1.5 }))
    const normalSurplus = normal.houses.reduce((s, h) => s + h.surplus, 0)
    const highSurplus = highDemand.houses.reduce((s, h) => s + h.surplus, 0)
    expect(highSurplus).toBeLessThan(normalSurplus)
  })

  it('F. Night behavior (PV = 0, grid import > 0)', () => {
    const night = buildEvaluation(createSimulationState({ hour: 22 }))
    expect(night.totalGeneration).toBe(0)
    expect(night.houses.every((h) => h.generation === 0)).toBe(true)
    expect(night.houses.every((h) => h.actualImport > 0)).toBe(true)
  })

  it('G. Low telemetry visibility applies conservative fail-safe export caps', () => {
    const clear = buildEvaluation(createSimulationState({ hour: 13, visibility: 98, mode: 'suryaflex' }))
    const poor = buildEvaluation(createSimulationState({ hour: 13, visibility: 30, mode: 'suryaflex' }))
    expect(poor.totalExport).toBeLessThan(clear.totalExport)
    expect(poor.failSafe).toBe(true)
  })

  it('H. Fairness toggle balances curtailment across households', () => {
    const unfair = buildEvaluation(createSimulationState({ hour: 13, solarPenetration: 100, fairness: false, mode: 'suryaflex' }))
    const fair = buildEvaluation(createSimulationState({ hour: 13, solarPenetration: 100, fairness: true, mode: 'suryaflex' }))
    expect(fair.inequality).toBeLessThanOrEqual(unfair.inequality + 0.1)
  })

  it('I. Grid metrics aggregate all 100 simulated households', () => {
    expect(houses.length).toBe(100)
    const res = buildEvaluation(createSimulationState({ hour: 13 }))
    expect(res.houses.length).toBe(100)
    const sumAc = res.houses.reduce((acc, h) => acc + h.generationAc, 0)
    expect(Math.abs(res.totalGeneration - sumAc)).toBeLessThan(1.0)
  })

  it('J. Reconciles exact energy-balance per household (PV_AC = SelfConsumed + Export + Curtailment)', () => {
    const res = buildEvaluation(createSimulationState({ hour: 13, solarPenetration: 80 }))
    res.houses.forEach((h) => {
      // PV_AC = SelfConsumed + Export + Curtailment
      const pvAcCalc = Number((h.selfConsumed + h.allowedExport + h.curtailment).toFixed(1))
      expect(Math.abs(h.generationAc - pvAcCalc)).toBeLessThan(0.2)

      // Demand = SelfConsumed + Import
      const demandCalc = Number((h.selfConsumed + h.actualImport).toFixed(1))
      expect(Math.abs(h.load - demandCalc)).toBeLessThan(0.2)
    })
  })
})
