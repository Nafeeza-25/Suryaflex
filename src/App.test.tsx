// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { useAcComparison } from './App'
import { createSimulationState, type SimulationState } from './engine/simulation'
import { acPair } from './engine/ac-fixture'

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function Harness({ state }: { state: SimulationState }) {
  const { comparison, error } = useAcComparison(state)
  return <div>{comparison ? `${comparison.flex.totalExport}` : error ? 'ENGINE OFFLINE' : 'RECALCULATING'}</div>
}

describe('current-state AC results', () => {
  it('clears the displayed pair immediately when controls change and ignores late requests', async () => {
    const resolve: ((value: unknown) => void)[] = []
    const signals: AbortSignal[] = []
    vi.stubGlobal('fetch', vi.fn((_url, options) => {
      signals.push(options.signal)
      return new Promise(done => resolve.push(done))
    }))
    const state = createSimulationState()
    await act(async () => root.render(<Harness state={state} />))
    const first = acPair()
    first.flex.totalExport = 123.456
    await act(async () => resolve[0]({ ok: true, json: async () => first }))
    expect(container.textContent).toBe('123.456')
    await act(async () => root.render(<Harness state={{ ...state, hour: 14 }} />))
    expect(container.textContent).toBe('RECALCULATING')
    await act(async () => root.render(<Harness state={{ ...state, hour: 15 }} />))
    expect(signals[1].aborted).toBe(true)
    const latest = acPair()
    latest.flex.totalExport = 55.555
    await act(async () => resolve[2]({ ok: true, json: async () => latest }))
    expect(container.textContent).toBe('55.555')
    await act(async () => resolve[1]({ ok: true, json: async () => first }))
    expect(container.textContent).toBe('55.555')
  })
  it('clears previous successful results after a failed recalculation', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => acPair() })
      .mockRejectedValueOnce(new Error('connection refused')))
    const state = createSimulationState()
    await act(async () => root.render(<Harness state={state} />))
    expect(container.textContent).not.toBe('ENGINE OFFLINE')
    await act(async () => root.render(<Harness state={{ ...state, hour: 14 }} />))
    expect(container.textContent).toBe('ENGINE OFFLINE')
  })
  it('shows offline explicitly in the full interface without fabricated engineering numbers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))
    await act(async () => root.render(<App />))
    expect(container.textContent).toContain('ENGINE OFFLINE')
    expect(container.textContent).not.toContain('MOCK')
    expect(container.textContent).not.toContain(' kW')
    expect(container.textContent).not.toContain('1.050 pu')
    expect(container.querySelector('[aria-label="Time of day"]')).not.toBeNull()
  })
})
