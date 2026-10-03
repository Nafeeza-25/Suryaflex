// SURYAFLEX_TEST_FIX_V3 — async-safe tests for keep-last-result behavior
// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App, { useAcComparison } from './App'
import { createSimulationState, type SimulationState } from './engine/simulation'
import { acPair } from './engine/ac-fixture'

let root: Root
let container: HTMLDivElement

const flushPromises = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  window.localStorage.clear()
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function Harness({ state }: { state: SimulationState }) {
  const { comparison, error, loading } = useAcComparison(state)
  return (
    <div>
      {comparison
        ? `${comparison.flex.totalExport}${loading ? ' LOADING' : ''}`
        : error
          ? 'ENGINE OFFLINE'
          : 'RECALCULATING'}
    </div>
  )
}

describe('current-state AC results', () => {
  it('keeps the last valid pair visible while a changed control state is recalculating', async () => {
    const first = acPair()
    first.flex.totalExport = 123.456

    const second = acPair()
    second.flex.totalExport = 55.555

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => first })
      .mockResolvedValueOnce({ ok: true, json: async () => second })

    vi.stubGlobal('fetch', fetchMock)

    const state = createSimulationState()

    await act(async () => {
      root.render(<Harness state={state} />)
    })
    await act(flushPromises)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('123.456')

    await act(async () => {
      root.render(<Harness state={{ ...state, hour: 14 }} />)
    })

    // The previous AC result remains visible instead of the dashboard disappearing.
    expect(container.textContent).toContain('123.456')
    expect(container.textContent).toContain('LOADING')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(250)
      await flushPromises()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('55.555')
  })

  it('debounces rapid control changes so only the settled state is requested', async () => {
    const first = acPair()
    const latest = acPair()
    latest.flex.totalExport = 77.777

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => first })
      .mockResolvedValueOnce({ ok: true, json: async () => latest })

    vi.stubGlobal('fetch', fetchMock)

    const state = createSimulationState()

    await act(async () => {
      root.render(<Harness state={state} />)
    })
    await act(flushPromises)

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => root.render(<Harness state={{ ...state, hour: 14 }} />))
    await act(async () => root.render(<Harness state={{ ...state, hour: 15 }} />))
    await act(async () => root.render(<Harness state={{ ...state, hour: 16 }} />))

    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(250)
      await flushPromises()
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('77.777')
  })

  it('shows offline explicitly when the first AC request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')))

    await act(async () => {
      root.render(<App />)
    })
    await act(flushPromises)

    expect(container.textContent).toContain('ENGINE OFFLINE')
    expect(container.textContent).not.toContain('MOCK')
    expect(container.querySelector('[aria-label="Time of day"]')).not.toBeNull()
  })
})
