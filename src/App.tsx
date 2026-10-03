import { useEffect, useMemo, useState } from 'react'
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
  const [result, setResult] = useState<{ key: string; pair?: GridComparison; error?: string } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    fetchPandapowerComparison(state, controller.signal).then(pair => {
      if (!controller.signal.aborted) setResult({ key, pair })
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : 'AC engine unavailable' })
    })
    return () => controller.abort()
  }, [key])
  // A control change invalidates the old pair in the same render, before effect cleanup.
  const current = result?.key === key ? result : null
  return { comparison: current?.pair ?? null, error: current?.error ?? null }
}

export default function App() {
  const [state, setState] = useState<SimulationState>(createSimulationState())
  const [page, setPage] = useState<Page>('Live Simulation')
  const [selectedHouseId, setSelectedHouseId] = useState<string>('H01')
  const [playing, setPlaying] = useState(false)
  const [headerNav, setHeaderNav] = useState<'Simulation' | 'Analytics' | 'Reports' | 'About'>('Simulation')

  const { comparison, error } = useAcComparison(state)
  const evaluation = comparison ? (state.mode === 'static' ? comparison.static : comparison.flex) : null
  const unavailable = error ? 'ENGINE OFFLINE' : 'RECALCULATING · AC POWER FLOW'
  const status = evaluation ? displayStatus(evaluation) : { tone: 'warning', title: unavailable, detail: error ? 'AC results unavailable — adjust controls or reset to retry' : 'Waiting for the current control state' }
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
              {!evaluation && !['24-Hour Replay', 'Scenario Controls', 'Settings'].includes(page) && <section className="ref-panel p-6" role="status" aria-live="polite"><h1 className="ref-title">{unavailable}</h1><p className="ref-subtitle">{status.detail}</p></section>}
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
  evaluation: GridEvaluation;
  state: SimulationState;
  selectedHouseId: string;
  setSelectedHouseId: (id: string) => void;
}) {
  const night = state.hour >= 19 || state.hour < 6
  const reduceMotion = useReducedMotion()

  const repHouses = evaluation.houses.slice(0, 8)
  const isViolation = evaluation.gridState === 'violation'

  return (
    <div className="hero-scene-container">
      <svg viewBox="0 0 1000 420" className="hero-svg-canvas" preserveAspectRatio="xMidYMid meet" role="group" aria-label={`Neighbourhood electrical network · ${night ? 'grid import' : 'solar export'}`}>
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={night ? "#030c14" : "#061824"} />
            <stop offset="100%" stopColor={night ? "#02070c" : "#041018"} />
          </linearGradient>
          <linearGradient id="grassGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#08202d" />
            <stop offset="70%" stopColor="#0a2636" />
            <stop offset="100%" stopColor="#061824" />
          </linearGradient>
          <radialGradient id="houseEdgeFade">
            <stop offset="65%" stopColor="white" />
            <stop offset="100%" stopColor="black" />
          </radialGradient>
          <mask id="houseAssetMask" maskContentUnits="objectBoundingBox">
            <rect width="1" height="1" fill="url(#houseEdgeFade)" />
          </mask>
          <filter id="glowMint" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Scene Canvas Background */}
        <rect width="1000" height="450" rx="10" fill="url(#bgGrad)" />

        {/* Neighbourhood Ground Bed Base */}
        <path d="M 15 15 L 670 15 L 670 435 L 15 435 Z" fill="url(#grassGrad)" opacity="0.4" rx="8" />

        {/* Environmental Grass & Trees Graphic Layer */}
        <g opacity="0.85">
          <image href="/assets/suryaflex/tree.svg" x="15" y="45" width="32" height="42" />
          <image href="/assets/suryaflex/tree.svg" x="165" y="40" width="32" height="42" />
          <image href="/assets/suryaflex/tree.svg" x="325" y="45" width="32" height="42" />
          <image href="/assets/suryaflex/tree.svg" x="485" y="40" width="32" height="42" />

          <image href="/assets/suryaflex/tree.svg" x="15" y="260" width="32" height="42" />
          <image href="/assets/suryaflex/tree.svg" x="165" y="265" width="32" height="42" />
          <image href="/assets/suryaflex/tree.svg" x="325" y="260" width="32" height="42" />
          <image href="/assets/suryaflex/tree.svg" x="485" y="265" width="32" height="42" />

          <image href="/assets/suryaflex/tree.svg" x="635" y="50" width="32" height="42" />
          <image href="/assets/suryaflex/tree.svg" x="635" y="270" width="32" height="42" />
        </g>

        {/* Central Street Feeder Road Platform */}
        <rect x="20" y="200" width="650" height="34" rx="4" fill="#081824" stroke="#163447" strokeWidth="1" />
        <line x1="30" y1="217" x2="665" y2="217" stroke="#1c435c" strokeWidth="2" strokeDasharray="8 6" />

        {/* Shared Feeder Power Line */}
        <line
          x1="35"
          y1="217"
          x2="910"
          y2="217"
          stroke={isViolation ? '#ff5252' : night ? '#f4ba47' : '#2ee9a6'}
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Feeder Label Badge */}
        <g transform="translate(310, 205)">
          <rect width="85" height="22" rx="11" fill="#061622" stroke={night ? '#f4ba47' : '#2ee9a6'} strokeWidth="1" />
          <text x="42.5" y="14" fill={night ? '#f4ba47' : '#2ee9a6'} fontSize="10" fontFamily="DM Mono, monospace" fontWeight="700" textAnchor="middle">
            Feeder Line
          </text>
        </g>

        {/* 8 REPRESENTATIVE HOUSES ARRANGED IN 2 BALANCED ROWS */}
        {repHouses.map((house, idx) => {
          const isTopRow = idx < 4
          const col = idx % 4
          const houseX = 30 + col * 160 // 30, 190, 350, 510
          const cardY = isTopRow ? 5 : 345
          const houseY = isTopRow ? 65 : 225
          const cardWidth = 120

          const centerX = houseX + cardWidth / 2
          const serviceY1 = isTopRow ? 180 : 225
          const serviceY2 = 217

          const isSelected = selectedHouseId === house.id
          const houseExporting = house.allowedExport > 0 && !night

          return (
            <g key={house.id} className="house-interactive-group" role="button" tabIndex={0} aria-label={`Select ${house.id}, PV ${house.generation} kilowatts, load ${house.load} kilowatts, export ${house.allowedExport} kilowatts`} aria-pressed={isSelected} onClick={() => setSelectedHouseId(house.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedHouseId(house.id) } }} style={{ cursor: 'pointer' }}>
              {/* Service Line Connecting House to Main Feeder */}
              <line
                x1={centerX}
                y1={serviceY1}
                x2={centerX}
                y2={serviceY2}
                stroke={night ? '#f4ba47' : houseExporting ? '#2ee9a6' : '#38bdf8'}
                strokeWidth="1.8"
                strokeDasharray="4 3"
              />

              {/* Animated Power Flow Particle Dots on Service Line */}
              {!reduceMotion && (
                <motion.circle
                  r="3.5"
                  initial={{ cy: night ? serviceY2 : serviceY1 }}
                  fill={night ? '#f4ba47' : houseExporting ? '#2ee9a6' : '#38bdf8'}
                  animate={{ cy: night ? (isTopRow ? [serviceY2, serviceY1] : [serviceY2, serviceY1]) : (isTopRow ? [serviceY1, serviceY2] : [serviceY1, serviceY2]) }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                  cx={centerX}
                />
              )}

              {/* Compact Floating Card Format */}
              <rect
                x={houseX}
                y={cardY}
                width={cardWidth}
                height={66}
                rx="6"
                fill={isSelected ? '#0a2536' : 'rgba(8, 26, 38, 0.92)'}
                stroke={isSelected ? '#2ee9a6' : '#1c3e54'}
                strokeWidth={isSelected ? '2' : '1.2'}
                filter={isSelected ? 'url(#glowMint)' : undefined}
              />

              {/* House Card Text */}
              <text x={houseX + 8} y={cardY + 17} fill="#e9f2f6" fontSize="13" fontFamily="DM Mono, monospace" fontWeight="700">
                {house.id}
              </text>

              <text x={houseX + 8} y={cardY + 32} fill="#2ee9a6" fontSize="13" fontFamily="DM Mono, monospace" fontWeight="500">
                PV      {night ? '0.0 kW' : `${fmt(house.generation)} kW`}
              </text>

              <text x={houseX + 8} y={cardY + 47} fill="#a4bdca" fontSize="13" fontFamily="DM Mono, monospace">
                Load    {fmt(house.load)} kW
              </text>

              <text x={houseX + 8} y={cardY + 62} fill={night ? '#f4ba47' : '#2ee9a6'} fontSize="13" fontFamily="DM Mono, monospace" fontWeight="500">
                Export  {night ? '0.0 kW' : `${fmt(house.allowedExport)} kW`}
              </text>

              {/* ENLARGED 3D Isometric House Asset */}
              <g transform={`translate(${houseX - 10}, ${houseY})`}>
                <ellipse cx="72" cy="104" rx="51" ry="12" fill="#02090d" opacity=".55" />
                <image
                  href={`/assets/suryaflex/house-0${idx + 1}.jpg`}
                  x="0"
                  y="0"
                  width="145"
                  height="120"
                  mask="url(#houseAssetMask)"
                  style={{
                    borderRadius: '12px',
                    mixBlendMode: 'lighten',
                    filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.3))'
                  }}
                />
              </g>
            </g>
          )
        })}

        {/* MAIN FEEDER ANIMATED FLOW PARTICLES */}
        {!reduceMotion && !night && (
          <motion.circle
            r="4.5"
            initial={{ cx: 35, cy: 217 }}
            fill={isViolation ? '#ff5252' : '#2ee9a6'}
            animate={{ cx: [35, 910], cy: [217, 217] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* NIGHT REVERSE GRID IMPORT FLOW PARTICLES */}
        {!reduceMotion && night && (
          <motion.circle
            r="4.5"
            initial={{ cx: 910, cy: 217 }}
            fill="#f4ba47"
            animate={{ cx: [910, 35], cy: [217, 217] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* DISTRIBUTION TRANSFORMER NODE ASSET (Enlarged) */}
        <g transform="translate(685, 125)">
          <image href="/assets/suryaflex/transformer.svg" x="0" y="0" width="135" height="135" />
          
          <rect y="122" width="135" height="38" rx="6" fill="#081c2b" stroke={evaluation.transformerLoading > 100 ? '#ff5252' : '#2d5a73'} strokeWidth="1.5" />
          
          <text x="67.5" y="137" fill="#e9f2f6" fontSize="12" fontFamily="DM Mono, monospace" fontWeight="700" textAnchor="middle">
            Transformer
          </text>
          <text x="67.5" y="151" fill="#a4bdca" fontSize="12" fontFamily="DM Mono, monospace" textAnchor="middle">
            11 kV / 0.4 kV
          </text>
        </g>

        {/* Luminous Animated Line from Transformer to Grid Tower */}

        {/* UPSTREAM GRID TRANSMISSION TOWER ASSET (Enlarged) */}
        <g transform="translate(850, 110)">
          <image href="/assets/suryaflex/transmission-tower.svg" x="0" y="0" width="135" height="160" />
          <text x="67.5" y="162" fill="#38bdf8" fontSize="11" fontFamily="DM Mono, monospace" fontWeight="800" textAnchor="middle">
            {night ? 'Grid Import' : 'To Grid'}
          </text>
        </g>
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
  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">DISCOM OPERATOR VIEW</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Grid Analytics & Feeder Operations</h1>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatTile label="ROOFTOP PV PENETRATION" value={`${state.solarPenetration}%`} />
        <StatTile label="FEEDER DEMAND" value={num(evaluation.totalLoad)} />
        <StatTile label="POTENTIAL PV EXPORT" value={num(evaluation.totalExport + evaluation.totalCurtailment)} />
        <StatTile label="SURYAFLEX EXPORT" value={num(evaluation.totalExport)} highlight />
      </div>
    </div>
  )
}

function ConsumerPage({ evaluation, selectedId, setSelectedId }: { evaluation: GridEvaluation; selectedId: string; setSelectedId: (id: string) => void }) {
  const house = evaluation.houses.find(h => h.id === selectedId) || evaluation.houses[0]
  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">PROSUMER TRANSPARENCY</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Consumer House Details — {house.id}</h1>
      <SelectedHouseDiagram house={house} />
    </div>
  )
}

function DecisionPage({ state, evaluation }: { state: SimulationState; evaluation: GridEvaluation }) {
  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">SURYAFLEX CONTROL LOGIC</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">8-Stage Optimization Pipeline Report</h1>
    </div>
  )
}

function ResultsPage({ comparison }: { comparison: GridComparison }) {
  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">TECHNICAL EVIDENCE</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Static Caps vs. SuryaFlex Dynamic Envelopes</h1>
    </div>
  )
}

function SettingsView({ state, update }: { state: SimulationState; update: (patch: Partial<SimulationState>) => void }) {
  return (
    <div className="p-6">
      <p className="text-amber-400 font-mono text-xs font-semibold">SYSTEM CONFIGURATION</p>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">SuryaFlex Settings & Configuration</h1>
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
