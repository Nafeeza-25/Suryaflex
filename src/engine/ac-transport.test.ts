import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSimulationState, fetchPandapowerComparison } from './simulation'
import { acPair } from './ac-fixture'


afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('live AC comparison transport', () => {
  it('posts one control state and returns the complete AC pair unchanged', async () => {
    const pair = acPair()
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => pair })
    vi.stubGlobal('fetch', request)
    const state = createSimulationState()
    expect(await fetchPandapowerComparison(state)).toBe(pair)
    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0][0]).toBe('http://localhost:8000/api/compare')
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual(state)
  })
  it('uses the configured API origin and removes a trailing slash', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://suryaflex-api.onrender.com/')
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => acPair() })
    vi.stubGlobal('fetch', request)
    await fetchPandapowerComparison(createSimulationState())
    expect(request.mock.calls[0][0]).toBe('https://suryaflex-api.onrender.com/api/compare')
  })
  it.each(['false', 'true'])('rejects failed solves without fallback even with fallback flag %s', async flag => {
    vi.stubEnv('VITE_ALLOW_MOCK_FALLBACK', flag)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(fetchPandapowerComparison(createSimulationState())).rejects.toThrow('503')
  })
  it('rejects a non-AC pair', async () => {
    const pair = acPair()
    pair.static.engineSource = 'MOCK_FALLBACK'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => pair }))
    await expect(fetchPandapowerComparison(createSimulationState())).rejects.toThrow('non-AC')
  })
  it('rejects missing bus measurements, nonfinite metrics and mismatched scenarios', async () => {
    for (const patch of [{ busVoltages: [] }, { maxVoltage: NaN }]) {
      const pair = acPair()
      Object.assign(pair.flex, patch)
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => pair }))
      await expect(fetchPandapowerComparison(createSimulationState())).rejects.toThrow('incomplete')
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...acPair(), scenario: 'stress' }) }))
    await expect(fetchPandapowerComparison(createSimulationState())).rejects.toThrow('different scenario')
  })
  it('propagates cancellation and rejects an aborted response even when fetch resolves', async () => {
    const controller = new AbortController()
    let finish!: (value: unknown) => void
    const request = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve }))
    vi.stubGlobal('fetch', request)
    const pending = fetchPandapowerComparison(createSimulationState(), controller.signal)
    controller.abort()
    expect(request.mock.calls[0][1].signal.aborted).toBe(true)
    finish({ ok: true, json: async () => acPair() })
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})

