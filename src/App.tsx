// SURYAFLEX_NEIGHBOURHOOD_LAYOUT_FIX — reduced empty space around representative houses
// SURYAFLEX_FIX_V3 — keep last AC result + immediate first request + debounced updates
import { useEffect, useMemo, useRef, useState } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { Activity, AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CheckCircle, ChevronRight, Cloud, Cpu, Eye, Gauge, HelpCircle, Home, Info, Moon, Network, Play, RotateCcw, ShieldCheck, Sparkles, Sun, Zap, RefreshCw, BarChart2, Layers, FileText, Settings, Leaf, Wind } from 'lucide-react'

import { Area, AreaChart, Bar, BarChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { displayStatus, displayedModeResults, voltageProfile } from './ui/status'

import { buildEvaluation, createSimulationState, daySeries, fetchPandapowerComparison, fmt, houses as houseDefinitions, type GridComparison, type GridEvaluation, type HouseResult, type Mode, type SimulationState } from './engine/simulation'



type Page = 'Live Simulation' | '24-Hour Replay' | 'Scenario Controls' | 'Grid Analytics' | 'Compare Modes' | 'House Details' | 'Reports' | 'Settings'



const scenarios = [

  ['SCENARIO A — HEADROOM', { scenario: 'headroom', hour: 13, solarPenetration: 80, cloudCover: 8, demandMultiplier: 1, visibility: 95 }],

  ['SCENARIO B — STRESS', { scenario: 'stress', hour: 13, solarPenetration: 100, cloudCover: 0, demandMultiplier: .6, visibility: 95 }],

  ['CLOUDY DAY', { scenario: 'headroom', hour: 13, solarPenetration: 80, cloudCover: 68, demandMultiplier: 1, visibility: 90 }],

  ['HIGH EVENING DEMAND', { scenario: 'headroom', hour: 19, solarPenetration: 80, cloudCover: 20, demandMultiplier: 1.45, visibility: 95 }],

  ['LOW GRID VISIBILITY', { scenario: 'headroom', hour: 13, solarPenetration: 90, cloudCover: 5, demandMultiplier: .8, visibility: 35 }],

  ['EDGE-OF-FEEDER STRESS', { scenario: 'stress', hour: 13, solarPenetration: 100, cloudCover: 0, demandMultiplier: .65, visibility: 88 }]

] as const



const num = (value: number, suffix = ' kW') => `${fmt(value)}${suffix}`

const comparisonStatus = (result: GridEvaluation) => result.gridState === 'warning' ? 'WITHIN CONFIGURED LIMIT' : displayStatus(result).label



export function useAcComparison(state: SimulationState) {
  // Mode selects a result from the pair; it does not alter the AC comparison.
  const key = JSON.stringify({ ...state, mode: 'suryaflex' })
  const [comparison, setComparison] = useState<GridComparison | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const hasSuccessfulResult = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let timer: number | undefined
    const cacheKey = `suryaflex:ac:v1:${key}`

    setLoading(true)
    setError(null)

    // Restore an exact previously solved operating point immediately. We still
    // refresh it from Pandapower so the cache never replaces live validation.
    try {
      const cached = window.localStorage.getItem(cacheKey)
      if (cached) {
        setComparison(JSON.parse(cached) as GridComparison)
        hasSuccessfulResult.current = true
      }
    } catch {
      // Storage may be unavailable in private/restricted browser contexts.
    }

    const requestComparison = () => {
      fetchPandapowerComparison(state, controller.signal)
        .then(pair => {
          if (!active || controller.signal.aborted) return
          setComparison(pair)
          setError(null)
          hasSuccessfulResult.current = true
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify(pair))
          } catch {
            // Keep the live result even if the browser refuses local storage.
          }
        })
        .catch(fetchError => {
          if (!active || controller.signal.aborted) return
          if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return
          setError(fetchError instanceof Error ? fetchError.message : 'AC engine unavailable')
        })
        .finally(() => {
          if (active && !controller.signal.aborted) setLoading(false)
        })
    }

    // First load starts immediately. After a successful result exists, later
    // control changes are debounced so slider dragging does not flood Pandapower.
    if (hasSuccessfulResult.current) {
      timer = window.setTimeout(requestComparison, 250)
    } else {
      requestComparison()
    }

    return () => {
      active = false
      if (timer !== undefined) window.clearTimeout(timer)
      controller.abort()
    }
  }, [key])

  // Keep the last valid AC result on screen while the next state is being solved.
  return { comparison, error, loading }
}

export default function App() {

  const [state, setState] = useState<SimulationState>(createSimulationState())

  const [page, setPage] = useState<Page>('Live Simulation')

  const [selectedHouseId, setSelectedHouseId] = useState<string>('H01')

  const [playing, setPlaying] = useState(false)

  const [headerNav, setHeaderNav] = useState<'Simulation' | 'Analytics' | 'Reports' | 'About'>('Simulation')



  const { comparison, error, loading } = useAcComparison(state)

  const evaluation = comparison ? (state.mode === 'static' ? comparison.static : comparison.flex) : null

  const unavailable = error
    ? 'ENGINE OFFLINE'
    : loading
      ? 'RECALCULATING · AC POWER FLOW'
      : 'AC ENGINE READY'

  const status = evaluation
    ? displayStatus(evaluation)
    : {
      tone: 'warning' as const,
      title: unavailable,
      detail: error
        ? 'AC results unavailable — check that the Pandapower backend is running'
        : 'Waiting for the current control state'
    }

  const reduceMotion = useReducedMotion()

  const update = (patch: Partial<SimulationState>) => setState((current) => ({ ...current, ...patch }))



  const selectedHouse = useMemo(() => {

    return evaluation ? evaluation.houses.find(h => h.id === selectedHouseId) || evaluation.houses[0] : null

  }, [evaluation, selectedHouseId])





  return (

    <div className={`app-root ${page === 'Live Simulation' ? 'competition-view' : ''}`}>

      {/* Top Navigation Bar */}

      <header className="ref-topbar">

        <div className="ref-brand">

          <span className="ref-sun-logo"><Sun size={20} /></span>

          <div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

              <span className="ref-brand-title">SuryaFlex</span>

              {evaluation?.engineSource === 'PANDAPOWER_AC' ? (

                <span className="engine-badge pandapower" style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.18)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.5)', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, letterSpacing: '0.03em' }}>

                  <Cpu size={12} /> AC ENGINE: PANDAPOWER

                </span>

              ) : (

                <span className="engine-badge fallback" style={{ fontSize: '11px', background: 'rgba(239, 68, 68, 0.18)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, letterSpacing: '0.03em' }}>

                  <AlertTriangle size={12} /> {unavailable}

                </span>

              )}

            </div>

            <span className="ref-brand-sub">Smart Solar. Stable Grids. Sustainable India.</span>

          </div>

        </div>





        <nav className="ref-header-nav">

          {(['Simulation', 'Analytics', 'Reports', 'About'] as const).map((tab) => (

            <button

              key={tab}

              className={headerNav === tab ? 'active' : ''}

              onClick={() => {

                setHeaderNav(tab)

                if (tab === 'Simulation') setPage('Live Simulation')

                if (tab === 'Analytics') setPage('Grid Analytics')

                if (tab === 'Reports') setPage('Reports')

                if (tab === 'About') setPage('Settings')

              }}

            >

              {tab}

            </button>

          ))}

        </nav>



        <div className="ref-header-right">

          <Leaf size={18} className="text-emerald-400" />

          <div className="text-right">

            <span className="block text-xs font-semibold text-emerald-400 leading-tight">Clean Energy</span>

            <span className="block text-[10px] text-slate-400 leading-tight">Brighter Tomorrow</span>

          </div>

        </div>

      </header>

      {(loading || (error && comparison)) && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: '62px',
            right: '20px',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '360px',
            padding: '8px 12px',
            border: `1px solid ${error ? '#7f2d2d' : '#24506a'}`,
            borderRadius: '7px',
            background: error ? '#2a1116' : '#091a27',
            color: error ? '#fca5a5' : '#b8d7e5',
            boxShadow: '0 10px 30px rgba(0,0,0,.28)',
            fontSize: '11px',
            fontWeight: 600
          }}
        >
          {error ? <AlertTriangle size={14} /> : <RefreshCw size={14} className="animate-spin" />}
          <span>
            {error && comparison
              ? 'Update failed — showing the last valid AC result.'
              : comparison
                ? 'Updating AC power-flow results…'
                : 'Starting Pandapower AC simulation…'}
          </span>
        </div>
      )}

      {/* Main 3-Column Layout Proportions: 14% Sidebar / 64% Main / 22% Right */}

      <div className="ref-main-layout">

        {/* Left Sidebar */}

        <aside className="ref-sidebar-left">

          <div className="ref-nav-list">

            <SidebarItem icon={<Home size={16} />} label="Live Simulation" active={page === 'Live Simulation'} onClick={() => setPage('Live Simulation')} />

            <SidebarItem icon={<Play size={16} />} label="24-Hour Replay" active={page === '24-Hour Replay'} onClick={() => setPage('24-Hour Replay')} />

            <SidebarItem icon={<Zap size={16} />} label="Scenario Controls" active={page === 'Scenario Controls'} onClick={() => setPage('Scenario Controls')} />

            <SidebarItem icon={<BarChart2 size={16} />} label="Grid Analytics" active={page === 'Grid Analytics'} onClick={() => setPage('Grid Analytics')} />

            <SidebarItem icon={<Layers size={16} />} label="Compare Modes" active={page === 'Compare Modes'} onClick={() => setPage('Compare Modes')} />

            <SidebarItem icon={<Gauge size={16} />} label="House Details" active={page === 'House Details'} onClick={() => setPage('House Details')} />

            <SidebarItem icon={<FileText size={16} />} label="Reports" active={page === 'Reports'} onClick={() => setPage('Reports')} />

            <SidebarItem icon={<Settings size={16} />} label="Settings" active={page === 'Settings'} onClick={() => setPage('Settings')} />

          </div>



          <div className="ref-sidebar-quote">

            <Wind size={22} className="quote-wind-icon" />

            <p className="quote-text font-outfit">“More solar.<br />Safer grids.<br />Greener tomorrow.”</p>

          </div>



          <div className="ref-sidebar-footer">

            <span>Version 1.0</span>

            <small>Built for a Cleaner India</small>

          </div>

        </aside>



        {/* Center Main View Area */}

        <main className="ref-main-center">

          <AnimatePresence mode="wait">

            <motion.div key={page} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}>

              {page === 'Live Simulation' && evaluation && comparison && selectedHouse && (

                <LiveSimulationView

                  state={state}

                  evaluation={evaluation}

                  comparison={comparison}

                  update={update}

                  selectedHouse={selectedHouse}

                  setSelectedHouseId={setSelectedHouseId}

                  setPage={setPage}

                />

              )}

              {page === '24-Hour Replay' && <DayPage state={state} update={update} playing={playing} setPlaying={setPlaying} />}

              {page === 'Scenario Controls' && <ScenarioPage state={state} update={update} />}

              {!evaluation && !['24-Hour Replay', 'Scenario Controls', 'Settings'].includes(page) && (
                <section className="ref-panel p-6" role="status" aria-live="polite">
                  <div className="flex items-center gap-3 mb-3">
                    {error ? <AlertTriangle size={22} className="text-red-400" /> : <RefreshCw size={22} className="text-sky-300 animate-spin" />}
                    <h1 className="ref-title">{unavailable}</h1>
                  </div>
                  <p className="ref-subtitle">{status.detail}</p>
                  {!error && (
                    <p className="text-xs text-slate-500 mt-3">
                      The first AC solve can take a moment. After the first result, SuryaFlex keeps the previous dashboard visible while recalculating.
                    </p>
                  )}
                </section>
              )}

              {page === 'Grid Analytics' && evaluation && comparison && <DiscomPage evaluation={evaluation} state={state} comparison={comparison} />}

              {page === 'Compare Modes' && comparison && <ResultsPage comparison={comparison} />}

              {page === 'House Details' && evaluation && <ConsumerPage evaluation={evaluation} selectedId={selectedHouseId} setSelectedId={setSelectedHouseId} />}

              {page === 'Reports' && evaluation && <DecisionPage state={state} evaluation={evaluation} />}

              {page === 'Settings' && <SettingsView state={state} update={update} />}

            </motion.div>

          </AnimatePresence>

        </main>



        {/* Right Sidebar */}

        <aside className="ref-sidebar-right">

          {/* Grid Status Box */}

          <section className="ref-panel grid-status-panel">

            <div className="panel-title-row">

              <ShieldCheck size={16} className="text-emerald-400" />

              <span>Grid Status</span>

            </div>



            <div className={`status-banner ${status.tone}`} role="status" aria-live="polite">

              <div className="status-icon">

                {evaluation?.gridState === 'safe' ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}

              </div>

              <div>

                <b className="status-title">

                  {status.title}

                </b>

                <small className="status-sub">

                  {status.detail}

                </small>

              </div>

            </div>



            {evaluation ? <><div className="primary-grid-metrics">

              <GridMetricRow label="Max voltage" value={`${evaluation.maxVoltage.toFixed(3)} pu`} limit="LIMIT 1.050 pu" highlight={evaluation.maxVoltage > 1.05} />

              <GridMetricRow label="Min voltage" value={`${evaluation.minVoltage.toFixed(3)} pu`} limit="LIMIT 0.950 pu" highlight={evaluation.minVoltage < 0.95} />

              <GridMetricRow label="Transformer loading" value={`${fmt(evaluation.transformerLoading)}%`} limit="LIMIT 100%" highlight={evaluation.transformerLoading > 100} />

              <GridMetricRow label="Max line loading" value={`${fmt(evaluation.maxLineLoading)}%`} limit="LIMIT 100%" highlight={evaluation.maxLineLoading > 100} />

            </div>

              <div className="metric-list secondary-energy-metrics">

                <GridMetricRow label="Total PV generation" value={num(evaluation.totalGeneration)} />

                <GridMetricRow label="Total household demand" value={num(evaluation.totalLoad)} />

                <GridMetricRow label="Total export to grid" value={num(evaluation.totalExport)} />

                <GridMetricRow label="Total curtailed" value={num(evaluation.totalCurtailment)} />

              </div>

            </> : <div className="primary-grid-metrics"><GridMetricRow label="AC power-flow results" value="—" /></div>}

          </section>



          {/* Simulation Controls Box */}

          <section className="ref-panel sim-controls-panel">

            <div className="panel-title-row">

              <Gauge size={16} className="text-emerald-400" />

              <span>Simulation Controls</span>

            </div>



            <div className="sliders-list">

              <RefSlider label="Time of day" value={state.hour} min={6} max={22} suffix=":00" formattedValue={timeLabel(state.hour)} onChange={(hour) => update({ hour })} />

              <RefSlider label="Solar intensity (cloud cover)" value={100 - state.cloudCover} min={10} max={100} suffix="%" onChange={(val) => update({ cloudCover: 100 - val })} />

              <RefSlider label="Household demand multiplier" value={state.demandMultiplier} min={0.6} max={1.6} step={0.05} suffix="x" onChange={(demandMultiplier) => update({ demandMultiplier })} />

              <RefSlider label="Solar penetration" value={state.solarPenetration} min={20} max={100} suffix="%" onChange={(solarPenetration) => update({ solarPenetration })} />

            </div>



            <div className="fairness-row">

              <span>Fairness Allocation</span>

              <button type="button" role="switch" aria-label="Fairness Allocation" aria-checked={state.fairness} className={`toggle ${state.fairness ? 'on' : ''}`} onClick={() => update({ fairness: !state.fairness })}>

                <span aria-hidden="true">{state.fairness ? 'ON' : 'OFF'}</span><i aria-hidden="true" />

              </button>

            </div>

          </section>



          {/* Quick Actions Box */}

          <section className="ref-panel quick-actions-panel">

            <div className="panel-title-row">

              <Zap size={16} className="text-emerald-400" />

              <span>Quick Actions</span>

            </div>



            <div className="actions-grid">

              <button className="btn-primary" onClick={() => update({ hour: (state.hour % 24) + 1 })}>

                <Play size={14} /> Run Simulation

              </button>



              <button className="btn-secondary" onClick={() => update(createSimulationState())}>

                <RotateCcw size={14} /> Reset

              </button>



              <button className="btn-full-replay" onClick={() => setPage('24-Hour Replay')}>

                <BarChart2 size={14} /> 24-Hour Replay

              </button>

            </div>

          </section>

        </aside>

      </div>



      {/* Footer Banner */}

      <footer className="ref-bottom-bar">

        <div className="flex items-center gap-2">

          <Leaf size={14} className="text-emerald-400" />

          <span>Optimizing rooftop solar for a cleaner, stronger and more resilient India.</span>

        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400">

          <span>People</span>

          <span>|</span>

          <span>Planet</span>

          <span>|</span>

          <span>Progress</span>

        </div>

      </footer>

    </div>

  )

}



function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {

  return (

    <button className={`ref-sidebar-item ${active ? 'active' : ''}`} onClick={onClick}>

      <span className="item-icon">{icon}</span>

      <span className="item-label">{label}</span>

    </button>

  )

}



function GridMetricRow({ label, value, limit, highlight }: { label: string; value: string; limit?: string; highlight?: boolean }) {

  return (

    <div className="grid-metric-row">

      <div>

        <span className="metric-name">{label}</span>

        {limit && <small className="metric-limit">{limit}</small>}

      </div>

      <b className={`metric-val ${highlight ? 'danger' : ''}`}>{value}</b>

    </div>

  )

}



function RefSlider({ label, value, min, max, step = 1, suffix, formattedValue, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; formattedValue?: string; onChange: (v: number) => void }) {

  return (

    <div className="ref-slider-item">

      <div className="slider-header">

        <span>{label}</span>

        <b>{formattedValue || `${value}${suffix || ''}`}</b>

      </div>

      <input type="range" aria-label={label} aria-valuetext={formattedValue || `${value}${suffix || ''}`} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />

    </div>

  )

}



function LiveSimulationView({

  state,

  evaluation,

  comparison,

  update,

  selectedHouse,

  setSelectedHouseId,

  setPage

}: {

  state: SimulationState;

  evaluation: GridEvaluation;

  comparison: GridComparison;

  update: (patch: Partial<SimulationState>) => void;

  selectedHouse: HouseResult;

  setSelectedHouseId: (id: string) => void;

  setPage: (p: Page) => void;

}) {

  const modeResults = displayedModeResults(comparison)

  const reducedMotion = useReducedMotion()



  const busVoltageData = useMemo(() => voltageProfile(comparison), [comparison])



  // Show the two actual AC transformer results for the selected operating state.

  const transformerData = useMemo(() => {

    return [{

      operatingPoint: state.scenario === 'stress' ? 'Stress scenario' : 'Headroom scenario',

      staticLoading: comparison.static.transformerLoading,

      suryaflexLoading: comparison.flex.transformerLoading,

    }]

  }, [comparison, state.scenario])



  return (

    <div className="live-sim-container">

      {/* Top Header Section */}

      <div className="ref-page-header">

        <div>

          <div className="flex items-center gap-2 mb-1 whitespace-nowrap">

            <span className="ref-badge-yellow">LIVE SIMULATION</span>

            <span className="ref-badge-dark">100 HOUSEHOLDS SIMULATED</span>

          </div>

          <h1 className="ref-title">Solar that adapts to the grid.</h1>

          <p className="ref-subtitle">Real-time grid-aware export limits for rooftop solar.</p>

        </div>



        <div className="ref-summary-cards-row">

          <SummaryCard icon={<Sun size={18} className="text-amber-400" />} label={timeLabel(state.hour)} sub={state.hour >= 19 || state.hour < 6 ? 'Night · Grid import' : 'Day · Solar export'} />

          <SummaryCard icon={<Cloud size={18} className="text-sky-300" />} label={state.hour >= 19 || state.hour < 6 ? 'Night' : state.cloudCover > 50 ? "Cloudy" : "Sunny"} sub={state.hour >= 19 || state.hour < 6 ? 'Solar generation: 0' : `Solar intensity: ${Math.round(100 - state.cloudCover)}%`} />

          <SummaryCard icon={<Home size={18} className="text-teal-400" />} label="100 Households" sub="(Showing 8)" />

          <SummaryCard icon={<Zap size={18} className="text-emerald-400" />} label={`${fmt(evaluation.totalExport)} kW`} sub="Managed Solar Export" />

        </div>

      </div>



      {/* HERO Neighbourhood View */}

      <section className="ref-panel hero-neighbourhood-panel">

        <div className="neighbourhood-top-bar">

          <div className="flex items-center gap-3">

            <span className="panel-heading">Neighbourhood View</span>

            <div className="ref-legend-row">

              <span className="legend-item"><i className="dot-green" /> Solar export</span>

              <span className="legend-item"><i className="dot-amber" /> Grid import</span>

              <span className="legend-item"><i className="dot-blue" /> Local use</span>

            </div>

          </div>



          <div className="flex items-center gap-3">

            {/* Demo Comparison Callout Badge */}

            <div className="ref-demo-callout-badge">

              <span className={`callout-result ${displayStatus(modeResults.static).tone}`}>{state.scenario === 'stress' ? 'STATIC / UNMANAGED BASELINE' : 'STATIC'} <b>{modeResults.static.maxVoltage.toFixed(3)} pu · {comparisonStatus(modeResults.static)}</b><small>AC POWER FLOW · PANDAPOWER</small></span>

              <span className="callout-sep">|</span>

              <span className={`callout-result ${displayStatus(modeResults.suryaflex).tone}`}>SURYAFLEX <b>{modeResults.suryaflex.maxVoltage.toFixed(3)} pu · {comparisonStatus(modeResults.suryaflex)}</b><small>AC POWER FLOW · PANDAPOWER</small></span>

            </div>



            <div className="ref-mode-toggle-group" role="group" aria-label="Grid access mode">

              <button

                className={`mode-btn flex-btn ${state.mode === 'suryaflex' ? 'active' : ''}`}

                aria-pressed={state.mode === 'suryaflex'}

                onClick={() => update({ mode: 'suryaflex' })}

              >

                {state.mode === 'suryaflex' && <motion.span className="mode-selection" layoutId="active-grid-mode" transition={{ duration: reducedMotion ? 0 : .18 }} />}

                <span>SURYAFLEX</span>

              </button>

              <button

                className={`mode-btn static-btn ${state.mode === 'static' ? 'active' : ''}`}

                aria-pressed={state.mode === 'static'}

                onClick={() => update({ mode: 'static' })}

              >

                {state.mode === 'static' && <motion.span className="mode-selection" layoutId="active-grid-mode" transition={{ duration: reducedMotion ? 0 : .18 }} />}

                <span>STATIC</span>

              </button>

            </div>

          </div>

        </div>



        {/* HERO Illustrated SVG Composite Scene */}

        <NeighbourhoodHeroScene

          evaluation={evaluation}

          state={state}

          selectedHouseId={selectedHouse.id}

          setSelectedHouseId={setSelectedHouseId}

        />

      </section>



      {/* Bottom Split Row: Selected House + Voltage Profile + Transformer Loading */}

      <div className="ref-bottom-split-row">

        {/* Left Box: Selected House Detail Panel */}

        <section className="ref-panel selected-house-panel">

          <div className="panel-title-row">

            <Home size={15} className="text-amber-400" />

            <span>Selected House: {selectedHouse.id}</span>

          </div>



          <SelectedHouseDiagram house={selectedHouse} />



          {/* 4 Summary Cards */}

          <div className="selected-house-cards-grid">

            <MiniSummaryCard label="Available surplus" value={`${selectedHouse.surplus} kW`} type="surplus" />

            <MiniSummaryCard label="Grid-safe limit" value={`${selectedHouse.allowedExport} kW`} type="limit" />

            <MiniSummaryCard label="Exported to grid" value={`${selectedHouse.allowedExport} kW`} type="exported" />

            <MiniSummaryCard label="Curtailed" value={`${selectedHouse.curtailment} kW`} type="curtailed" />

          </div>

        </section>



        {/* Middle Box: Voltage Profile (per bus) Chart */}

        <section className="ref-panel chart-panel">

          <div className="panel-title-row">

            <BarChart2 size={15} className="text-sky-400" />

            <span>Voltage Profile <small>(pu)</small></span>

          </div>



          <div className="chart-provenance">AC POWER FLOW · PANDAPOWER</div>

          <div className="chart-legend-row">

            <span className="legend-dot orange">Static System</span>

            <span className="legend-dot green">SuryaFlex</span>

            <span className="legend-dot blue-dashed">Safe Limit (1.05 pu)</span>

          </div>



          <div className="w-full">

            <ResponsiveContainer width="100%" height={180}>

              <LineChart data={busVoltageData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>

                <XAxis dataKey="bus" stroke="#94aebb" fontSize={11} minTickGap={24} tickFormatter={(bus) => `B${bus}`} />

                <YAxis domain={[0.90, 'auto']} stroke="#94aebb" fontSize={11} tickFormatter={(v) => v.toFixed(2)} width={54} />

                <Tooltip contentStyle={{ background: '#0b1d2c', border: '1px solid #1b3a4e', borderRadius: '6px', fontSize: '11px' }} />

                <Line type="monotone" dataKey="staticVoltage" name="Static System" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={!reducedMotion} />

                <Line type="monotone" dataKey="suryaflexVoltage" name="SuryaFlex" stroke="#2ee9a6" strokeWidth={2} dot={false} isAnimationActive={!reducedMotion} />

                <ReferenceLine y={1.05} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: 'LIMIT 1.050 pu', position: 'insideTopRight', fill: '#7dd3fc', fontSize: 10 }} />

              </LineChart>

            </ResponsiveContainer>

          </div>

        </section>



        {/* Right Box: Transformer Loading Chart */}

        <section className="ref-panel chart-panel">

          <div className="panel-title-row">

            <Activity size={15} className="text-teal-400" />

            <span>Transformer Loading <small>(%)</small></span>

          </div>



          <div className="chart-provenance">AC POWER FLOW · PANDAPOWER</div>

          <div className="chart-legend-row">

            <span className="legend-dot orange">Static System</span>

            <span className="legend-dot green">SuryaFlex</span>

          </div>



          <div className="w-full">

            <ResponsiveContainer width="100%" height={180}>

              <BarChart data={transformerData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>

                <XAxis dataKey="operatingPoint" stroke="#94aebb" fontSize={11} />

                <YAxis domain={[0, 150]} stroke="#94aebb" fontSize={11} ticks={[0, 50, 100, 150]} />

                <Tooltip contentStyle={{ background: '#0b1d2c', border: '1px solid #1b3a4e', borderRadius: '6px', fontSize: '11px' }} />

                <Bar dataKey="staticLoading" name="Static System" fill="#f97316" isAnimationActive={!reducedMotion} />

                <Bar dataKey="suryaflexLoading" name="SuryaFlex" fill="#2ee9a6" isAnimationActive={!reducedMotion} />

                <ReferenceLine y={100} stroke="#38bdf8" strokeDasharray="4 4" label={{ value: 'LIMIT 100%', position: 'insideTopRight', fill: '#7dd3fc', fontSize: 10 }} />

              </BarChart>

            </ResponsiveContainer>

          </div>

        </section>

      </div>

    </div>

  )

}



function SummaryCard({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {

  return (

    <div className="ref-summary-card">

      <div className="card-icon">{icon}</div>

      <div>

        <b className="card-label">{label}</b>

        <span className="card-sub">{sub}</span>

      </div>

    </div>

  )

}



function MiniSummaryCard({ label, value, type }: { label: string; value: string; type: 'surplus' | 'limit' | 'exported' | 'curtailed' }) {

  return (

    <div className={`mini-card ${type}`}>

      <span className="mini-label">{label}</span>

      <b className="mini-val">{value}</b>

    </div>

  )

}



/* HERO Illustrated Composite Neighbourhood Scene matching Screenshot */

function NeighbourhoodHeroScene({
  evaluation,
  state,
  selectedHouseId,
  setSelectedHouseId
}: {
  evaluation: GridEvaluation
  state: SimulationState
  selectedHouseId: string
  setSelectedHouseId: (id: string) => void
}) {
  const night = state.hour >= 19 || state.hour < 6
  const reduceMotion = useReducedMotion()
  const [compactScene, setCompactScene] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const repHouses = evaluation.houses.slice(0, 8)
  const isViolation = evaluation.gridState === 'violation'
  const flowColor = isViolation ? '#ff5252' : night ? '#f4ba47' : '#2ee9a6'

  const desktop = {
    viewBox: '0 0 1440 540',
    feederY: 268,
    roadX: 8,
    roadWidth: 1042,
    busStart: 18,
    busEnd: 1050,
    transformer: { x: 1060, y: 184, width: 136, height: 142 },
    transformerLabel: { x: 1035, y: 334, width: 228 },
    tower: { x: 1282, y: 157, width: 126, height: 194 },
    gridLine: { x1: 1194, x2: 1282, y: 268 },
    houses: repHouses.map((house, idx) => {
      const topRow = idx < 4
      const col = idx % 4
      const cardX = 8 + col * 258
      const cardY = topRow ? 4 : 451
      const houseY = topRow ? 94 : 285
      const cardWidth = 240
      const centerX = cardX + cardWidth / 2
      return {
        house, idx, cardX, cardY, cardWidth,
        houseX: centerX - 105, houseY, houseWidth: 210, houseHeight: 156,
        centerX, serviceY: topRow ? houseY + 156 : houseY, feederY: 268,
      }
    }),
    trees: [
      { x: 239, y: 188 }, { x: 497, y: 188 }, { x: 755, y: 188 }, { x: 1014, y: 188 },
      { x: 239, y: 324 }, { x: 497, y: 324 }, { x: 755, y: 324 }, { x: 1014, y: 324 },
    ],
    mobileRoads: [] as number[],
  }

  const compact = {
    viewBox: '0 0 540 1100',
    feederY: 520,
    roadX: 8,
    roadWidth: 377,
    busStart: 18,
    busEnd: 385,
    transformer: { x: 399, y: 452, width: 126, height: 120 },
    transformerLabel: { x: 390, y: 578, width: 142 },
    tower: { x: 405, y: 672, width: 120, height: 160 },
    gridLine: { x1: 463, x2: 463, y: 646 },
    houses: repHouses.map((house, idx) => {
      const row = Math.floor(idx / 2)
      const col = idx % 2
      const cardX = 8 + col * 189
      const cardY = 7 + row * 270
      const houseY = 100 + row * 270
      const cardWidth = 180
      const centerX = cardX + cardWidth / 2
      return {
        house, idx, cardX, cardY, cardWidth,
        houseX: centerX - 87, houseY, houseWidth: 174, houseHeight: 140,
        centerX, serviceY: houseY + 140, feederY: 250 + row * 270,
      }
    }),
    trees: [
      { x: 180, y: 155 }, { x: 180, y: 425 }, { x: 180, y: 695 }, { x: 180, y: 965 },
    ],
    mobileRoads: [250, 520, 790, 1060],
  }

  useEffect(() => {
    const updateSceneLayout = () => setCompactScene(window.innerWidth < 768)
    window.addEventListener('resize', updateSceneLayout)
    return () => window.removeEventListener('resize', updateSceneLayout)
  }, [])

  const scene = compactScene ? compact : desktop
  const transformerStroke = evaluation.transformerLoading > 100 ? '#ff5252' : '#2d5a73'
  const serviceColor = (house: HouseResult) => isViolation
    ? '#ff5252'
    : night
      ? '#f4ba47'
      : house.allowedExport > 0
        ? '#2ee9a6'
        : '#38bdf8'

  return (
    <div className="hero-scene-container">
      <svg
        viewBox={scene.viewBox}
        className="hero-svg-canvas"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={'Neighbourhood electrical network · ' + (night ? 'grid import' : 'solar export')}
      >
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={night ? '#030c14' : '#061824'} />
            <stop offset="100%" stopColor={night ? '#02070c' : '#041018'} />
          </linearGradient>
          <radialGradient id="houseEdgeFade">
            <stop offset="70%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>
          <mask id="houseAssetMask" maskContentUnits="objectBoundingBox">
            <rect width="1" height="1" fill="url(#houseEdgeFade)" />
          </mask>
          <filter id="glowMint" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="feederGlow" x="-20%" y="-80%" width="140%" height="260%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

      <rect width={compactScene ? 540 : 1440} height={compactScene ? 1100 : 540} fill="url(#bgGrad)" />

        {/* Planted islands fill the natural gaps between houses without a large ground slab. */}
        {scene.houses.map(({ centerX, houseY, houseHeight }, idx) => (
          <ellipse
            key={'yard-' + idx}
            cx={centerX}
            cy={houseY + houseHeight - 5}
            rx={compactScene ? 78 : 92}
            ry={compactScene ? 14 : 16}
            fill="#0b2a32"
            opacity=".62"
          />
        ))}
        <g opacity=".92">
          {scene.trees.map(({ x, y }, idx) => (
            <image key={'tree-' + idx} href="/assets/suryaflex/tree.svg" x={x} y={y} width={compactScene ? 25 : 38} height={compactScene ? 34 : 46} aria-hidden="true" />
          ))}
        </g>

        {/* Mobile has feeder lanes for each house pair; desktop keeps one central road. */}
        {compactScene ? scene.mobileRoads.map((y, idx) => (
          <g key={'road-' + idx}>
            <rect x="8" y={y - 16} width="377" height="32" rx="5" fill="#091a25" stroke="#17384a" strokeWidth="1" />
            <line x1="16" y1={y} x2="385" y2={y} stroke="#1b4155" strokeWidth="2" strokeDasharray="10 8" />
          </g>
        )) : (
          <g>
            <rect x={scene.roadX} y="238" width={scene.roadWidth} height="44" rx="5" fill="#091a25" stroke="#17384a" strokeWidth="1" />
            <line x1="18" y1="268" x2="1050" y2="268" stroke="#1b4155" strokeWidth="2" strokeDasharray="12 9" />
          </g>
        )}

        {/* Feeder trunk, illuminated in the active power-flow color. */}
        {compactScene && <line x1="385" y1="250" x2="385" y2="1060" stroke={flowColor} strokeWidth="4" opacity=".88" />}
        {compactScene ? scene.mobileRoads.map((y, idx) => (
          <g key={'mobile-feeder-' + idx}>
            <line x1="18" y1={y} x2="385" y2={y} stroke={flowColor} strokeWidth="9" strokeLinecap="round" opacity=".2" filter="url(#feederGlow)" />
            <line x1="18" y1={y} x2="385" y2={y} stroke={flowColor} strokeWidth="3.5" strokeLinecap="round" opacity=".94" />
          </g>
        )) : (
          <g>
            <line x1={scene.busStart} y1={scene.feederY} x2={scene.busEnd} y2={scene.feederY} stroke={flowColor} strokeWidth="9" strokeLinecap="round" opacity=".2" filter="url(#feederGlow)" />
            <line x1={scene.busStart} y1={scene.feederY} x2={scene.busEnd} y2={scene.feederY} stroke={flowColor} strokeWidth="4" strokeLinecap="round" opacity=".94" />
            <line x1={scene.busEnd} y1={scene.feederY} x2="1060" y2={scene.feederY} stroke={flowColor} strokeWidth="4" strokeLinecap="round" />
          </g>
        )}

        {/* Every representative house has a visible service drop and matching flow particle. */}
        {scene.houses.map(({ house, centerX, serviceY, feederY }, idx) => (
          <g key={'service-' + house.id}>
            <line
              x1={centerX}
              y1={serviceY}
              x2={centerX}
              y2={feederY}
              stroke={serviceColor(house)}
              strokeWidth="2.5"
              strokeDasharray="5 4"
            />
            {!reduceMotion && (
              <motion.circle
                r="3.5"
                cx={centerX}
                initial={{ cy: night ? feederY : serviceY }}
                animate={{ cy: night ? [feederY, serviceY] : [serviceY, feederY] }}
                fill={serviceColor(house)}
                transition={{ duration: 1.5 + (idx % 3) * 0.15, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </g>
        ))}

        {compactScene ? (
          <g transform="translate(121, 504)">
            <rect width="126" height="28" rx="5" fill="#061622" stroke={flowColor} strokeWidth="1.5" />
            <text x="63" y="18" fill={flowColor} fontSize="13" fontFamily="DM Mono, monospace" fontWeight="700" textAnchor="middle">Feeder Line</text>
          </g>
        ) : (
          <g transform="translate(456, 253)">
            <rect width="146" height="30" rx="6" fill="#061622" stroke={flowColor} strokeWidth="1.5" />
            <text x="73" y="20" fill={flowColor} fontSize="13" fontFamily="DM Mono, monospace" fontWeight="700" textAnchor="middle">Feeder Line</text>
          </g>
        )}

        {!reduceMotion && (compactScene ? scene.mobileRoads.map(y => (
          <motion.circle
            key={'flow-' + y}
            r="4"
            cy={y}
            initial={{ cx: night ? scene.busEnd : scene.busStart }}
            animate={{ cx: night ? [scene.busEnd, scene.busStart] : [scene.busStart, scene.busEnd] }}
            fill={flowColor}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
          />
        )) : (
          <motion.circle
            r="4.5"
            cy={scene.feederY}
            initial={{ cx: night ? 1060 : scene.busStart }}
            animate={{ cx: night ? [1060, scene.busStart] : [scene.busStart, 1060] }}
            fill={flowColor}
            transition={{ duration: 3.4, repeat: Infinity, ease: 'linear' }}
          />
        ))}

        {/* Transformer sits directly beyond the neighbourhood feeder. */}
        {compactScene && <line x1="385" y1="512" x2="399" y2="512" stroke={flowColor} strokeWidth="4" />}
        <image
          href="/assets/suryaflex/transformer.svg"
          x={scene.transformer.x}
          y={scene.transformer.y}
          width={scene.transformer.width}
          height={scene.transformer.height}
          aria-hidden="true"
        />
        {!compactScene && (
          <g>
            <line x1={scene.gridLine.x1} y1={scene.gridLine.y} x2={scene.gridLine.x2} y2={scene.gridLine.y} stroke={flowColor} strokeWidth="8" opacity=".22" filter="url(#feederGlow)" />
            <line x1={scene.gridLine.x1} y1={scene.gridLine.y} x2={scene.gridLine.x2} y2={scene.gridLine.y} stroke={flowColor} strokeWidth="3.5" />
          </g>
        )}
        <rect
          x={scene.transformerLabel.x}
          y={scene.transformerLabel.y}
          width={scene.transformerLabel.width}
          height={compactScene ? 68 : 46}
          rx="5"
          fill="#081c2b"
          stroke={transformerStroke}
          strokeWidth="1.5"
        />
        <text
          x={scene.transformerLabel.x + scene.transformerLabel.width / 2}
          y={scene.transformerLabel.y + (compactScene ? 16 : 18)}
          fill="#e9f2f6"
          fontSize={compactScene ? 11 : 14}
          fontFamily="DM Mono, monospace"
          fontWeight="700"
          textAnchor="middle"
        >{compactScene ? (
          <>
            <tspan x={scene.transformerLabel.x + scene.transformerLabel.width / 2}>Distribution</tspan>
            <tspan x={scene.transformerLabel.x + scene.transformerLabel.width / 2} dy="14">Transformer</tspan>
          </>
        ) : 'Distribution Transformer'}</text>
        <text
          x={scene.transformerLabel.x + scene.transformerLabel.width / 2}
          y={scene.transformerLabel.y + (compactScene ? 56 : 37)}
          fill="#a4bdca"
          fontSize={compactScene ? 11 : 13}
          fontFamily="DM Mono, monospace"
          textAnchor="middle"
        >11 kV / 0.4 kV</text>

        {/* The grid tower follows the transformer; mobile stacks the same path vertically. */}
        {compactScene ? (
          <g>
            <line x1="463" y1="646" x2="463" y2="672" stroke={flowColor} strokeWidth="7" opacity=".2" filter="url(#feederGlow)" />
            <line x1="463" y1="646" x2="463" y2="672" stroke={flowColor} strokeWidth="3.5" />
            <image href="/assets/suryaflex/transmission-tower.svg" x={scene.tower.x} y={scene.tower.y} width={scene.tower.width} height={scene.tower.height} aria-hidden="true" />
            <text x="465" y="852" fill="#38bdf8" fontSize="13" fontFamily="DM Mono, monospace" fontWeight="800" textAnchor="middle">{night ? 'Grid Import' : 'To Grid'}</text>
            {!reduceMotion && (
              <motion.circle
                r="4"
                cx="463"
                initial={{ cy: night ? 672 : 646 }}
                animate={{ cy: night ? [672, 646] : [646, 672] }}
                fill={flowColor}
                transition={{ duration: 2.3, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </g>
        ) : (
          <g>
            <image href="/assets/suryaflex/transmission-tower.svg" x={scene.tower.x} y={scene.tower.y} width={scene.tower.width} height={scene.tower.height} aria-hidden="true" />
            <text x={scene.tower.x + scene.tower.width / 2} y="367" fill="#38bdf8" fontSize="13" fontFamily="DM Mono, monospace" fontWeight="800" textAnchor="middle">{night ? 'Grid Import' : 'To Grid'}</text>
            {!reduceMotion && (
              <motion.circle
                r="4"
                cy={scene.gridLine.y}
                initial={{ cx: night ? scene.gridLine.x2 : scene.gridLine.x1 }}
                animate={{ cx: night ? [scene.gridLine.x2, scene.gridLine.x1] : [scene.gridLine.x1, scene.gridLine.x2] }}
                fill={flowColor}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              />
            )}
          </g>
        )}

        {/* Live house cards remain keyboard and pointer selectable. */}
        {scene.houses.map(({ house, idx, cardX, cardY, cardWidth, houseX, houseY, houseWidth, houseHeight, centerX }) => {
          const isSelected = selectedHouseId === house.id
          const exportColor = night ? '#f4ba47' : isViolation ? '#ff7b72' : '#2ee9a6'
          const cardFont = compactScene ? 15 : 16
          return (
            <g
              key={house.id}
              className="house-interactive-group"
              role="button"
              tabIndex={0}
              aria-label={'Select ' + house.id + ', PV ' + house.generation + ' kilowatts, load ' + house.load + ' kilowatts, export ' + house.allowedExport + ' kilowatts'}
              aria-pressed={isSelected}
              onClick={() => setSelectedHouseId(house.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedHouseId(house.id)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={cardX}
                y={cardY}
                width={cardWidth}
                height={compactScene ? 84 : 86}
                rx="6"
                fill={isSelected ? '#0a2536' : 'rgba(8, 26, 38, 0.96)'}
                stroke={isSelected ? '#2ee9a6' : '#1c3e54'}
                strokeWidth={isSelected ? '2.5' : '1.2'}
                filter={isSelected ? 'url(#glowMint)' : undefined}
              />
              <text x={cardX + 10} y={cardY + 20} fill="#e9f2f6" fontSize={compactScene ? 16 : 19} fontFamily="DM Mono, monospace" fontWeight="700">{house.id}</text>
              <text x={cardX + 10} y={cardY + 37} fill="#8fa9b4" fontSize={cardFont} fontFamily="DM Mono, monospace">PV</text>
              <text x={cardX + cardWidth - 10} y={cardY + 37} fill="#2ee9a6" fontSize={cardFont} fontFamily="DM Mono, monospace" fontWeight="600" textAnchor="end">{night ? '0.0 kW' : fmt(house.generation) + ' kW'}</text>
              <text x={cardX + 10} y={cardY + 54} fill="#8fa9b4" fontSize={cardFont} fontFamily="DM Mono, monospace">Load</text>
              <text x={cardX + cardWidth - 10} y={cardY + 54} fill="#c4d4dc" fontSize={cardFont} fontFamily="DM Mono, monospace" textAnchor="end">{fmt(house.load) + ' kW'}</text>
              <text x={cardX + 10} y={cardY + 71} fill="#8fa9b4" fontSize={cardFont} fontFamily="DM Mono, monospace">Export</text>
              <text x={cardX + cardWidth - 10} y={cardY + 71} fill={exportColor} fontSize={cardFont} fontFamily="DM Mono, monospace" fontWeight="600" textAnchor="end">{night ? '0.0 kW' : fmt(house.allowedExport) + ' kW'}</text>
              <ellipse cx={centerX} cy={houseY + houseHeight - 7} rx={compactScene ? 75 : 88} ry="12" fill="#02090d" opacity=".48" />
              <image
                href={'/assets/suryaflex/house-0' + (idx + 1) + '.jpg'}
                x={houseX}
                y={houseY}
                width={houseWidth}
                height={houseHeight}
                mask="url(#houseAssetMask)"
                aria-hidden="true"
                style={{ mixBlendMode: 'lighten', filter: 'drop-shadow(0 4px 5px rgba(0,0,0,.32))' }}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* SELECTED HOUSE DIAGRAM matching reference screenshot */

function SelectedHouseDiagram({ house }: { house: HouseResult }) {

  const dcGen = fmt(house.generation / 0.97)



  return (

    <div className="selected-house-diagram-container">

      {/* Sun & House Solar Panel Inverter Section */}

      <div className="diagram-left-house">

        <div className="flex items-center justify-center gap-1 mb-1">

          <Sun size={18} className="text-amber-400 animate-pulse" />

          <span className="house-badge">PV Generation {dcGen} kW (DC)</span>

        </div>

        <div className="relative w-[130px] h-[90px] mx-auto block overflow-hidden rounded-lg bg-[#071926] border border-[#1b3a4e]">

          <img src="/assets/suryaflex/house-01.jpg" alt="House" className="w-full h-full object-cover mix-blend-lighten" />

        </div>

        <div className="step-label">Inverter (DC → AC)</div>

      </div>



      {/* House Demand & Appliances Breakdown */}

      <div className="diagram-center-appliances">

        <span className="demand-title">House Demand</span>

        <b className="demand-val">{house.load} kW</b>



        <div className="appliances-row">

          <ApplianceItem label="AC" value="0.8" />

          <ApplianceItem label="Fridge" value="0.6" />

          <ApplianceItem label="Lights" value="0.4" />

          <ApplianceItem label="Fan" value="0.5" />

          <ApplianceItem label="Others" value="0.8" />

        </div>

      </div>



      {/* Smart Meter & Grid Connection */}

      <div className="diagram-right-meter">

        <div className="meter-box">Smart Meter</div>

        <div className="flow-arrow-down">{house.actualImport > 0 && house.allowedExport === 0 ? '↑' : '↓'}</div>

        <div className="grid-box">{house.actualImport > 0 && house.allowedExport === 0 ? 'From Grid' : 'To Grid'}</div>

      </div>

    </div>

  )

}



function ApplianceItem({ label, value }: { label: string; value: string }) {

  return (

    <div className="appliance-item">

      <span className="app-label">{label}</span>

      <b className="app-val">{value}</b>

    </div>

  )

}



/* OTHER SEPARATE PAGES */

function DayPage({ state, update, playing, setPlaying }: { state: SimulationState; update: (patch: Partial<SimulationState>) => void; playing: boolean; setPlaying: (v: boolean) => void }) {

  const data = useMemo(() => daySeries(state), [state])

  useEffect(() => {

    if (!playing) return

    const timer = window.setInterval(() => update({ hour: state.hour >= 23.75 ? 0 : fmt(state.hour + .25, 2) }), 850)

    return () => window.clearInterval(timer)

  }, [playing, state.hour, update])



  return (

    <div className="p-6">

      <div className="flex justify-between items-center mb-6">

        <div>

          <p className="text-amber-400 font-mono text-xs font-semibold">ILLUSTRATIVE PROFILE · 96 INTERVALS · 15-MINUTE RESOLUTION</p>

          <h1 className="text-2xl font-bold text-slate-100">24-Hour Simulation Replay</h1>

        </div>

        <button className="btn-primary" onClick={() => setPlaying(!playing)}>

          <Play size={16} />{playing ? 'Pause Simulation' : 'Simulate Day'}

        </button>

      </div>



      <section className="ref-panel p-6">

        <ResponsiveContainer width="100%" height={360}>

          <AreaChart data={data}>

            <defs>

              <linearGradient id="pv" x1="0" x2="0" y1="0" y2="1">

                <stop offset="0" stopColor="#f4b942" stopOpacity=".55" />

                <stop offset="1" stopColor="#f4b942" stopOpacity="0" />

              </linearGradient>

            </defs>

            <XAxis dataKey="time" interval={15} stroke="#5d7c8a" />

            <YAxis stroke="#5d7c8a" />

            <Tooltip contentStyle={{ background: '#0b1d2c', border: '1px solid #1b3a4e', borderRadius: '6px' }} />

            <Area type="monotone" dataKey="pv" name="Solar PV Generation" stroke="#f4b942" fill="url(#pv)" />

            <Area type="monotone" dataKey="load" name="Household Load" stroke="#55b8ff" fill="none" />

            <Area type="monotone" dataKey="export" name="SuryaFlex Export" stroke="#55d6a5" fill="none" />

          </AreaChart>

        </ResponsiveContainer>

      </section>

    </div>

  )

}



function ScenarioPage({ state, update }: { state: SimulationState; update: (patch: Partial<SimulationState>) => void }) {

  return (

    <div className="p-6">

      <p className="text-amber-400 font-mono text-xs font-semibold">EXPERIMENTAL BENCHMARKS</p>

      <h1 className="text-2xl font-bold text-slate-100 mb-6">Scenario Control Environment</h1>



      <div className="scenario-control-grid">

        {scenarios.map(([name, patch]) => (

          <button className="scenario-card-ref" key={name} onClick={() => update(patch)}>

            <Zap className="text-amber-400 mb-2" size={20} />

            <b>{name}</b>

            <small className="block text-slate-400 text-xs mt-1">Apply scenario state across app</small>

          </button>

        ))}

      </div>

    </div>

  )

}



function DiscomPage({ evaluation, state, comparison }: { evaluation: GridEvaluation; state: SimulationState; comparison: GridComparison }) {
  const profile = voltageProfile(comparison)
  const constrained = evaluation.violations > 0

  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">DISCOM OPERATOR VIEW</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Grid Analytics & Feeder Operations</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="ROOFTOP PV PENETRATION" value={`${state.solarPenetration}%`} />
        <StatTile label="FEEDER DEMAND" value={num(evaluation.totalLoad)} />
        <StatTile label="POTENTIAL PV EXPORT" value={num(evaluation.totalExport + evaluation.totalCurtailment)} />
        <StatTile label="ACTIVE EXPORT" value={num(evaluation.totalExport)} highlight />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <section className="ref-panel p-4">
          <div className="panel-title-row"><Network size={16} className="text-sky-300" /><span>Feeder Voltage Profile</span></div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={profile} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <XAxis dataKey="bus" stroke="#94aebb" fontSize={10} tickFormatter={(bus) => `B${bus}`} />
              <YAxis domain={[0.94, 1.06]} stroke="#94aebb" fontSize={10} width={50} />
              <Tooltip contentStyle={{ background: '#0b1d2c', border: '1px solid #1b3a4e', borderRadius: '6px' }} />
              <ReferenceLine y={1.05} stroke="#38bdf8" strokeDasharray="4 4" />
              <ReferenceLine y={0.95} stroke="#38bdf8" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="staticVoltage" name="Static" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="suryaflexVoltage" name="SuryaFlex" stroke="#2ee9a6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="ref-panel p-4">
          <div className="panel-title-row"><ShieldCheck size={16} className="text-emerald-400" /><span>Operating Limits</span></div>
          <div className="space-y-3">
            <GridMetricRow label="Maximum voltage" value={`${evaluation.maxVoltage.toFixed(4)} pu`} limit="1.050 pu upper limit" highlight={evaluation.maxVoltage > 1.05} />
            <GridMetricRow label="Minimum voltage" value={`${evaluation.minVoltage.toFixed(4)} pu`} limit="0.950 pu lower limit" highlight={evaluation.minVoltage < 0.95} />
            <GridMetricRow label="Transformer loading" value={`${fmt(evaluation.transformerLoading)}%`} limit="100% thermal limit" highlight={evaluation.transformerLoading > 100} />
            <GridMetricRow label="Maximum line loading" value={`${fmt(evaluation.maxLineLoading)}%`} limit="100% thermal limit" highlight={evaluation.maxLineLoading > 100} />
            <GridMetricRow label="Constraint violations" value={`${evaluation.violations}`} highlight={constrained} />
          </div>
          <div className={`status-banner ${constrained ? 'violation' : evaluation.gridState}`} style={{ marginTop: 16, marginBottom: 0 }}>
            {constrained ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
            <div>
              <b className="status-title">{constrained ? 'ACTION REQUIRED' : 'AC SOLUTION VALID'}</b>
              <small className="status-sub">Pandapower result for the current operating point</small>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function ConsumerPage({ evaluation, selectedId, setSelectedId }: { evaluation: GridEvaluation; selectedId: string; setSelectedId: (id: string) => void }) {
  const house = evaluation.houses.find(h => h.id === selectedId) || evaluation.houses[0]

  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">PROSUMER TRANSPARENCY</p>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Consumer House Details — {house.id}</h1>
        <label className="text-xs text-slate-400">
          Select household
          <select
            className="block mt-1 bg-[#091a27] border border-[#1c384a] rounded-md px-3 py-2 text-slate-100"
            value={house.id}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {evaluation.houses.map(item => <option key={item.id} value={item.id}>{item.id}</option>)}
          </select>
        </label>
      </div>

      <section className="ref-panel p-4 mb-4">
        <SelectedHouseDiagram house={house} />
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatTile label="PV GENERATION" value={num(house.generation)} />
        <StatTile label="HOUSE LOAD" value={num(house.load)} />
        <StatTile label="GRID-SAFE EXPORT" value={num(house.allowedExport)} highlight />
        <StatTile label="CURTAILMENT" value={num(house.curtailment)} />
      </div>

      <section className="ref-panel p-4">
        <div className="panel-title-row"><Info size={16} className="text-sky-300" /><span>Allocation explanation</span></div>
        <p className="text-sm text-slate-300 mb-3">{house.reason}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div><span className="text-slate-500 block">Available surplus</span><b className="text-slate-100">{num(house.surplus)}</b></div>
          <div><span className="text-slate-500 block">Self-consumed</span><b className="text-slate-100">{num(house.selfConsumed)}</b></div>
          <div><span className="text-slate-500 block">Grid import</span><b className="text-slate-100">{num(house.actualImport)}</b></div>
          <div><span className="text-slate-500 block">Visibility confidence</span><b className="text-slate-100">{fmt(house.confidence, 0)}%</b></div>
        </div>
      </section>
    </div>
  )
}

function DecisionPage({ state, evaluation }: { state: SimulationState; evaluation: GridEvaluation }) {
  const stages = [
    ['1', 'Read operating state', `${timeLabel(state.hour)} · ${state.solarPenetration}% PV · ${100 - state.cloudCover}% solar intensity`],
    ['2', 'Build household injections', 'Map 100 household loads and PV generation onto the residential feeder.'],
    ['3', 'Run AC power flow', 'Solve bus voltages, line loading and transformer loading with Pandapower.'],
    ['4', 'Check network constraints', 'Apply 0.95–1.05 pu voltage limits and 100% equipment loading limits.'],
    ['5', 'Calculate export headroom', 'Determine whether requested rooftop export can be accepted safely.'],
    ['6', 'Allocate export', state.fairness ? 'Apply fairness-aware proportional allocation.' : 'Apply voltage-sensitivity-aware allocation.'],
    ['7', 'Re-run AC validation', 'Validate the allocated export against the full AC network model.'],
    ['8', 'Publish household limits', `${evaluation.houses.length} household results returned to the interface.`],
  ]

  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">SURYAFLEX CONTROL LOGIC</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">8-Stage Optimization Pipeline Report</h1>

      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        <StatTile label="ENGINE" value={evaluation.engineSource === 'PANDAPOWER_AC' ? 'AC' : 'N/A'} highlight />
        <StatTile label="TOTAL EXPORT" value={num(evaluation.totalExport)} />
        <StatTile label="CURTAILMENT" value={num(evaluation.totalCurtailment)} />
        <StatTile label="VIOLATIONS" value={`${evaluation.violations}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {stages.map(([number, title, detail]) => (
          <section key={number} className="ref-panel p-4">
            <div className="flex items-start gap-3">
              <span className="grid place-items-center w-7 h-7 shrink-0 rounded-full bg-emerald-950 text-emerald-300 font-mono text-xs border border-emerald-800">{number}</span>
              <div>
                <h2 className="font-semibold text-slate-100 mb-1">{title}</h2>
                <p className="text-xs text-slate-400 leading-relaxed">{detail}</p>
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function ResultsPage({ comparison }: { comparison: GridComparison }) {
  const staticResult = comparison.static
  const flexResult = comparison.flex
  const metrics = [
    ['Total export', num(staticResult.totalExport), num(flexResult.totalExport)],
    ['Curtailment', num(staticResult.totalCurtailment), num(flexResult.totalCurtailment)],
    ['Maximum voltage', `${staticResult.maxVoltage.toFixed(4)} pu`, `${flexResult.maxVoltage.toFixed(4)} pu`],
    ['Minimum voltage', `${staticResult.minVoltage.toFixed(4)} pu`, `${flexResult.minVoltage.toFixed(4)} pu`],
    ['Transformer loading', `${fmt(staticResult.transformerLoading)}%`, `${fmt(flexResult.transformerLoading)}%`],
    ['Maximum line loading', `${fmt(staticResult.maxLineLoading)}%`, `${fmt(flexResult.maxLineLoading)}%`],
    ['Constraint violations', `${staticResult.violations}`, `${flexResult.violations}`],
  ]

  const extraExport = flexResult.totalExport - staticResult.totalExport
  const curtailmentReduction = staticResult.totalCurtailment > 0
    ? ((staticResult.totalCurtailment - flexResult.totalCurtailment) / staticResult.totalCurtailment) * 100
    : 0

  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">TECHNICAL EVIDENCE</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Static Caps vs. SuryaFlex Dynamic Envelopes</h1>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <StatTile label="ADDITIONAL EXPORT" value={num(extraExport)} highlight />
        <StatTile label="CURTAILMENT REDUCTION" value={`${fmt(curtailmentReduction)}%`} />
        <StatTile label="SURYAFLEX VIOLATIONS" value={`${flexResult.violations}`} />
      </div>

      <section className="ref-panel p-4 overflow-x-auto">
        <div className="panel-title-row"><Layers size={16} className="text-emerald-400" /><span>AC result comparison</span></div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-700">
              <th className="py-3 pr-4">Metric</th>
              <th className="py-3 px-4">Static</th>
              <th className="py-3 pl-4 text-emerald-300">SuryaFlex</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(([label, staticValue, flexValue]) => (
              <tr key={label} className="border-b border-slate-800 last:border-0">
                <td className="py-3 pr-4 text-slate-400">{label}</td>
                <td className="py-3 px-4 font-mono text-slate-100">{staticValue}</td>
                <td className="py-3 pl-4 font-mono text-emerald-300">{flexValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function SettingsView({ state, update }: { state: SimulationState; update: (patch: Partial<SimulationState>) => void }) {
  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">SYSTEM CONFIGURATION</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">SuryaFlex Settings & Configuration</h1>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="ref-panel p-5">
          <div className="panel-title-row"><Gauge size={16} className="text-emerald-400" /><span>Simulation defaults</span></div>
          <div className="sliders-list">
            <RefSlider label="Time of day" value={state.hour} min={6} max={22} suffix=":00" formattedValue={timeLabel(state.hour)} onChange={(hour) => update({ hour })} />
            <RefSlider label="Solar intensity" value={100 - state.cloudCover} min={10} max={100} suffix="%" onChange={(value) => update({ cloudCover: 100 - value })} />
            <RefSlider label="Demand multiplier" value={state.demandMultiplier} min={0.6} max={1.6} step={0.05} suffix="x" onChange={(demandMultiplier) => update({ demandMultiplier })} />
            <RefSlider label="Solar penetration" value={state.solarPenetration} min={20} max={100} suffix="%" onChange={(solarPenetration) => update({ solarPenetration })} />
          </div>
          <div className="fairness-row">
            <span>Fairness Allocation</span>
            <button type="button" role="switch" aria-label="Settings Fairness Allocation" aria-checked={state.fairness} className={`toggle ${state.fairness ? 'on' : ''}`} onClick={() => update({ fairness: !state.fairness })}>
              <span aria-hidden="true">{state.fairness ? 'ON' : 'OFF'}</span><i aria-hidden="true" />
            </button>
          </div>
        </section>

        <section className="ref-panel p-5">
          <div className="panel-title-row"><Settings size={16} className="text-sky-300" /><span>Model information</span></div>
          <div className="space-y-3 text-sm">
            <GridMetricRow label="Simulation engine" value="Pandapower AC" />
            <GridMetricRow label="Households" value="100" />
            <GridMetricRow label="Voltage range" value="0.950–1.050 pu" />
            <GridMetricRow label="Equipment loading limit" value="100%" />
          </div>
          <button className="btn-secondary mt-5 w-full" onClick={() => update(createSimulationState())}>
            <RotateCcw size={14} /> Reset simulation defaults
          </button>
        </section>
      </div>
    </div>
  )
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {

  return (

    <div className="ref-panel p-4">

      <span className="block font-mono text-[10px] text-amber-400 font-semibold mb-1">{label}</span>

      <b className={`text-2xl font-mono ${highlight ? 'text-emerald-400' : 'text-slate-100'}`}>{value}</b>

    </div>

  )

}



function timeLabel(hour: number) {

  return `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60)).padStart(2, '0')}`

}
