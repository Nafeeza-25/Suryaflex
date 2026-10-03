export type Mode = 'static' | 'suryaflex'
export type Profile = 'working' | 'remote' | 'ac' | 'small'

export interface SimulationState {
  hour: number; cloudCover: number; demandMultiplier: number; solarPenetration: number;
  visibility: number; fairness: boolean; mode: Mode; scenario?: 'headroom' | 'stress'
}
export interface HouseDefinition { id: string; pvCapacity: number; profile: Profile; sensitivity: number; fixedLimit: number }
export interface HouseResult extends HouseDefinition {
  generationDc: number; generationAc: number; generation: number; load: number; surplus: number; allowedExport: number;
  actualImport: number; selfConsumed: number; curtailment: number; confidence: number; reason: string
}
export interface GridEvaluation {
  houses: HouseResult[]; totalGenerationDc: number; totalGeneration: number; totalLoad: number; totalExport: number; totalCurtailment: number;
  maxVoltage: number; minVoltage: number; transformerLoading: number; maxLineLoading: number; violations: number;
  voltageViolationBuses?: number[]; lineViolationIndices?: number[]; transformerViolationIndices?: number[];
  reversePower: number; gridState: 'safe' | 'warning' | 'violation'; failSafe: boolean; inequality: number;
  engineSource: 'PANDAPOWER_AC' | 'MOCK_FALLBACK'
  busVoltages?: { bus: number; name: string; voltage: number }[];
  lineLoadings?: { line: number; loading: number }[];
  transformerLoadings?: { transformer: number; loading: number }[];
  potentialSurplus?: number;
  scenario?: string;
}

export interface GridComparison { static: GridEvaluation; flex: GridEvaluation; scenario: string }

export interface GridEngine { evaluate(state: SimulationState): GridEvaluation }

const profiles: Profile[] = ['small', 'working', 'remote', 'ac']
const capacities = [3, 5, 5, 6, 8, 8, 10, 10, 12, 6]
const limits = [3, 4, 4, 4.5, 5, 5, 5, 5, 5, 4]

// Exactly 100 simulated households deterministically
export const houses: HouseDefinition[] = Array.from({ length: 100 }, (_, i) => {
  const num = i + 1
  const id = `H${String(num).padStart(2, '0')}`
  const profile = profiles[i % profiles.length]
  const pvCapacity = capacities[i % capacities.length]
  const fixedLimit = 1
  const sensitivity = Number((0.005 + i * 0.00045).toFixed(4))
  return { id, pvCapacity, profile, sensitivity, fixedLimit }
})

export function createSimulationState(partial: Partial<SimulationState> = {}): SimulationState {
  return { hour: 13, cloudCover: 8, demandMultiplier: 1, solarPenetration: 80, visibility: 95, fairness: false, mode: 'suryaflex', scenario: 'headroom', ...partial }
}
export const fmt = (value: number, digits = 1) => Number(value.toFixed(digits))

function solarFactor(hour: number, cloud: number) {
  const daylight = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI))
  return daylight * (1 - cloud / 125)
}
function baseLoad(profile: Profile, hour: number) {
  const morning = Math.exp(-((hour - 7.5) ** 2) / 3)
  const evening = Math.exp(-((hour - 19) ** 2) / 5)
  const afternoon = Math.exp(-((hour - 14) ** 2) / 7)
  if (profile === 'working') return 1.05 + 1.1 * morning + 1.85 * evening + 0.25 * afternoon
  if (profile === 'remote') return 1.25 + 0.45 * morning + 0.7 * afternoon + 1.35 * evening
  if (profile === 'ac') return 1.45 + 0.35 * morning + 2.0 * afternoon + 1.7 * evening
  return 0.65 + 0.55 * morning + 0.85 * evening + 0.12 * afternoon
}
function activePv(index: number, penetration: number) {
  return index < Math.round(houses.length * penetration / 100)
}
function variance(values: number[]) {
  if (!values.length) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
}

export class MockGridEngine implements GridEngine {
  evaluate(state: SimulationState): GridEvaluation {
    const isNight = state.hour >= 19 || state.hour < 6

    const initial = houses.map((house, index) => {
      const pvDc = (!isNight && activePv(index, state.solarPenetration))
        ? house.pvCapacity * solarFactor(state.hour, state.cloudCover)
        : 0
      const pvAc = pvDc * 0.97 // 97% inverter efficiency
      const load = baseLoad(house.profile, state.hour) * state.demandMultiplier
      const surplus = Math.max(0, pvAc - load)
      const selfConsumed = Math.min(load, pvAc)
      return { ...house, generationDc: pvDc, generationAc: pvAc, generation: pvAc, load, surplus, selfConsumed }
    })

    const potentialSurplus = initial.reduce((sum, h) => sum + h.surplus, 0)
    const margin = state.visibility < 50 ? 0.45 : 0.68 + state.visibility / 400
    const safeCapacityThreshold = 145.0 // kW feeder capacity threshold for 100 houses

    const requested = state.mode === 'static'
      ? initial.map((h) => Math.min(h.surplus, h.fixedLimit))
      : initial.map((h) => h.surplus)

    const requestedTotal = requested.reduce((a, b) => a + b, 0)
    const baseCap = safeCapacityThreshold * margin
    const weightedCap = Math.min(requestedTotal, baseCap)

    const allocation = requested.map((request, index) => {
      if (state.mode === 'static') return request
      if (state.visibility < 50) return Math.min(request, initial[index].fixedLimit * 0.2)
      const burden = 1 + initial[index].sensitivity * 12
      return (request * weightedCap) / Math.max(requestedTotal, 1) / burden
    })

    if (state.mode === 'suryaflex' && state.fairness) {
      const targetCurtail = (requestedTotal - weightedCap) / Math.max(requestedTotal, 1)
      for (let i = 0; i < allocation.length; i++) {
        allocation[i] = Math.min(requested[i], requested[i] * (1 - targetCurtail * 1.05))
      }
    }

    const totalExported = allocation.reduce((a, b) => a + b, 0)
    const totalDcGen = initial.reduce((a, h) => a + h.generationDc, 0)
    const totalAcGen = initial.reduce((a, h) => a + h.generationAc, 0)
    const totalLoadSum = initial.reduce((a, h) => a + h.load, 0)
    const totalCurtail = potentialSurplus - totalExported

    // Voltage physics formulation for 100-bus distribution feeder
    const maxVoltage = state.mode === 'static'
      ? 1.00 + (totalExported * 0.00038) + Math.max(0, state.solarPenetration - 60) * 0.00032
      : 0.995 + (totalExported * 0.00022) + Math.max(0, state.solarPenetration - 75) * 0.00015

    const minVoltage = Math.max(0.95, 1.00 - (totalLoadSum * 0.00018))
    const netLoad = totalLoadSum - totalExported
    const transformerLoading = state.mode === 'static'
      ? Math.max(10, Math.min(145, (Math.abs(netLoad) / 110) * 100 + (totalExported > 120 ? 35 : 0)))
      : Math.max(10, Math.min(92, (Math.abs(netLoad) / 110) * 100))

    const isViolation = maxVoltage > 1.05 || transformerLoading > 100
    const isWarning = maxVoltage > 1.043 || transformerLoading > 88

    const results: HouseResult[] = initial.map((house, index) => {
      const allowed = allocation[index]
      const actualImport = Math.max(0, house.load - house.generationAc)
      const curtailment = Math.max(0, house.surplus - allowed)
      return {
        ...house,
        generationDc: fmt(house.generationDc),
        generationAc: fmt(house.generationAc),
        generation: fmt(house.generationAc),
        load: fmt(house.load),
        surplus: fmt(house.surplus),
        selfConsumed: fmt(house.selfConsumed),
        allowedExport: fmt(allowed),
        actualImport: fmt(actualImport),
        curtailment: fmt(curtailment),
        confidence: state.visibility,
        reason: state.visibility < 50 ? 'Fail-safe export cap' : allowed < house.surplus ? (state.fairness ? 'Fair allocation applied' : 'Voltage sensitivity margin') : 'Full surplus approved'
      }
    })

    const curtailedPercents = results.filter((h) => h.surplus > 0).map((h) => h.curtailment / h.surplus)

    return {
      houses: results,
      totalGenerationDc: fmt(totalDcGen),
      totalGeneration: fmt(totalAcGen),
      totalLoad: fmt(totalLoadSum),
      totalExport: fmt(totalExported),
      totalCurtailment: fmt(totalCurtail),
      maxVoltage: fmt(maxVoltage, 3),
      minVoltage: fmt(minVoltage, 3),
      transformerLoading: fmt(transformerLoading),
      maxLineLoading: fmt(transformerLoading * 0.4),
      violations: isViolation ? Math.ceil(Math.max(0, maxVoltage - 1.05) * 100 + 1) : 0,
      voltageViolationBuses: [],
      lineViolationIndices: [],
      transformerViolationIndices: [],
      reversePower: fmt(Math.max(0, totalExported - totalLoadSum * 0.45)),
      gridState: isViolation ? 'violation' : isWarning ? 'warning' : 'safe',
      failSafe: state.visibility < 50,
      inequality: fmt(variance(curtailedPercents) * 100),
      engineSource: 'MOCK_FALLBACK'
    }
  }
}

export class PandapowerGridEngine implements GridEngine {
  evaluate(state: SimulationState): GridEvaluation {
    void state
    throw new Error('Synchronous AC evaluation is unavailable; request results from the Pandapower API.')
  }
}

const mockEngine = new MockGridEngine()
export const engine = new PandapowerGridEngine()

export function buildEvaluation(state: SimulationState): GridEvaluation { 
  return mockEngine.evaluate(state) 
}

function assertAcEvaluation(value: unknown): asserts value is GridEvaluation {
  const result = value as GridEvaluation | null
  const metrics = ['totalGenerationDc', 'totalGeneration', 'totalLoad', 'totalExport', 'totalCurtailment', 'maxVoltage', 'minVoltage', 'transformerLoading', 'maxLineLoading', 'violations', 'reversePower', 'inequality'] as const
  if (!result || result.engineSource !== 'PANDAPOWER_AC' ||
      !['safe', 'warning', 'violation'].includes(result.gridState) ||
      metrics.some(key => !Number.isFinite(result[key])) ||
      !Array.isArray(result.houses) || result.houses.length !== 100 ||
      result.houses.some(h => !h.id || ['generationDc', 'generationAc', 'load', 'surplus', 'allowedExport', 'actualImport', 'selfConsumed', 'curtailment'].some(key => !Number.isFinite(h[key as keyof HouseResult]))) ||
      !Array.isArray(result.busVoltages) || !result.busVoltages.length ||
      result.busVoltages.some(bus => !Number.isFinite(bus.bus) || typeof bus.name !== 'string' || !Number.isFinite(bus.voltage))) {
    throw new Error('The engine returned incomplete or non-AC results')
  }
}

// Live data always requires the AC engine. The fallback flag cannot replace a failed solve.
export async function fetchPandapowerComparison(state: SimulationState, signal?: AbortSignal): Promise<GridComparison> {
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '')
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timeoutId = setTimeout(abort, 60000)
  try {
    const response = await fetch(`${apiBaseUrl}/api/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
      signal: controller.signal
    })
    if (!response.ok) throw new Error(`AC engine request failed (${response.status})`)
    const data = await response.json() as GridComparison
    if (controller.signal.aborted) throw new DOMException('Request aborted', 'AbortError')
    assertAcEvaluation(data.static)
    assertAcEvaluation(data.flex)
    if (data.scenario !== (state.scenario ?? 'headroom')) throw new Error('AC engine returned a different scenario')
    return data
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abort)
  }
}

export async function fetchPandapowerEvaluation(state: SimulationState, signal?: AbortSignal): Promise<GridEvaluation> {
  const pair = await fetchPandapowerComparison(state, signal)
  return state.mode === 'static' ? pair.static : pair.flex
}


export function compareModes(state: SimulationState) {
  return {
    static: buildEvaluation({ ...state, mode: 'static' }),
    flex: buildEvaluation({ ...state, mode: 'suryaflex' })
  }
}

export function daySeries(state: SimulationState) {
  return Array.from({ length: 96 }, (_, step) => {
    const hour = step / 4
    const staticResult = buildEvaluation({ ...state, hour, mode: 'static' })
    const flex = buildEvaluation({ ...state, hour, mode: 'suryaflex' })
    return {
      hour,
      time: `${String(Math.floor(hour)).padStart(2, '0')}:${String((hour % 1) * 60).padStart(2, '0')}`,
      pv: flex.totalGeneration,
      load: flex.totalLoad,
      export: flex.totalExport,
      voltage: flex.maxVoltage,
      transformer: flex.transformerLoading,
      curtailed: flex.totalCurtailment,
      staticCurtailed: staticResult.totalCurtailment
    }
  })
}

