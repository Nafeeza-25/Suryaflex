# SuryaFlex — Product Design Direction

## Product

SuryaFlex is a technical clean-energy/grid intelligence product for Indian electricity distribution networks.

It dynamically manages rooftop-solar grid export using grid conditions, AC power-flow simulation, fairness-aware allocation, and confidence-aware control.

This is not a consumer solar-monitoring app.

This is not a generic analytics dashboard.

It should feel like a premium, credible utility-grade decision and control platform that could realistically be shown to:

- DISCOM engineers
- grid operators
- climate-tech investors
- regulators
- technical competition judges

---

# Core Design Read

Premium energy-tech operations platform.

Visual language:

- sophisticated
- technically credible
- futuristic but realistic
- high-value B2B infrastructure software
- clean-energy optimism without looking childish
- visually cinematic enough for a competition demo
- dense enough to feel powerful, but not cluttered

Think:

modern grid-control software
+
premium climate-tech startup
+
digital twin
+
energy command center

NOT:

generic SaaS dashboard
crypto dashboard
gaming UI
student project
admin template
AI-purple gradient website

---

# Design Priorities

1. The product must look valuable within 5 seconds.
2. The energy-flow story must be understandable within 15 seconds.
3. Static vs SuryaFlex must be visually obvious.
4. Real engineering outputs must look trustworthy.
5. The main screen should look excellent when screen-recorded for a pitch video.
6. Every visual element must support the product story.

---

# Primary Demo Story

The main Simulation page should communicate:

Sun
→ Rooftop PV
→ DC generation
→ Inverter
→ AC power
→ Household consumption
→ Solar surplus
→ Feeder
→ Distribution transformer
→ Grid

Then:

STATIC GRID ACCESS
→ unnecessary restriction or grid stress

versus

SURYAFLEX
→ dynamic export allocation
→ grid constraints respected
→ renewable export maximized

The interface must visually explain this rather than relying on paragraphs.

---

# Visual Style

## Overall

Dark premium control-room aesthetic.

Use deep navy / blue-black backgrounds.

Panels should be differentiated through:
- subtle tonal shifts
- thin borders
- controlled shadows
- restrained glow

Avoid excessive rounded floating cards.

Avoid card-inside-card-inside-card layouts.

Use larger integrated surfaces where possible.

---

# Color Roles

Background:
deep navy / almost black

Surface:
dark desaturated navy

Primary SuryaFlex:
mint / emerald / teal-green

Grid / data:
electric cyan / cool blue

Solar:
warm amber / golden yellow

Warning:
amber

Violation:
coral / red

Text:
soft white

Secondary text:
cool blue-gray

Do not use random gradients.

Gradients may only be used subtly to create depth or energy flow.

---

# Typography

Typography should feel technical but premium.

Use a modern sans-serif for interface text.

Headlines:
strong, clean, slightly condensed/tight tracking where appropriate.

Technical values:
use tabular numerals.
A subtle technical/monospace treatment is acceptable for:
- voltage
- kW
- loading
- API status
- timestamps

Do not make the entire interface monospace.

Strong hierarchy:

Page title
> state/result
> key metrics
> labels
> metadata

Numbers should often have more visual weight than their labels.

---

# Main Simulation Page

This is the HERO page.

It must receive the highest visual effort.

Desktop-first:
1440×900 primary competition viewport.

Structure:

Top navigation

Left:
compact product/navigation rail

Center:
large live neighbourhood / grid scene

Right:
grid-state / controls panel

Below:
selected-house energy path
+
technical comparison charts

The hero visual must dominate.

Do not let controls dominate.

---

# Neighbourhood / Digital Twin Art Direction

The neighbourhood should feel like a premium digital twin.

Use detailed solar houses rather than generic house icons.

Include:

- rooftop solar
- landscaping
- local feeder
- distribution transformer
- upstream grid
- directional power flows

Use perspective/isometric illustration where appropriate.

Energy flows should feel alive.

Use subtle animated particles, path motion, pulses, or travelling highlights.

Animation should show:

day:
house → feeder → transformer → grid

night:
grid → transformer → feeder → house

Avoid cartoonish animation.

---

# Motion

Use Motion for React.

MOTION_INTENSITY target: approximately 6/10.

Motion should communicate:

- electricity flow
- changed export limits
- state transitions
- safe/warning/violation
- Static → SuryaFlex transformation
- recalculation

Avoid:
- bouncing cards
- constant decorative floating
- excessive entrance animations
- meaningless shimmer everywhere

Motion must communicate system behavior.

Respect reduced-motion preferences.

---

# Information Density

Target density: 7/10.

This is a control/analytics product, so meaningful data density is desirable.

However:

the hero should remain readable.

Use progressive disclosure.

Neighbourhood house cards show only:

House ID
PV AC
Load
Export

Detailed values go into the selected-house view.

---

# Static vs SuryaFlex

This is a key visual moment.

STATIC must feel visibly inferior when the simulation data supports that conclusion.

SURYAFLEX must visibly show:

- changing household limits
- constraint-aware allocation
- higher safe utilization or restored safety
- changed voltage/transformer status

Never fake a benefit.

All visual states must originate from simulation results.

---

# Engineering Credibility

Pandapower AC results must visually be distinguished from mock/demo values.

Show engine status subtly:

AC ENGINE · PANDAPOWER

The technical interface may display:

- max voltage
- min voltage
- transformer loading
- line loading
- grid export
- PV generation
- load
- curtailment

Use clear limits.

Example:

Maximum Voltage
1.047 pu
Limit 1.050

Make safety thresholds visually clear.

---

# Page Structure

## Simulation
Competition hero/demo screen.

## Replay
24-hour simulation with playback and time-series charts.

## Analytics
Detailed electrical digital twin:
- bus voltage
- line loading
- transformer loading
- household export allocation

## Compare
Static vs SuryaFlex experiment comparison.

## Reports
Benchmark scenario results.

## About
Problem, architecture, novelty, technical limitations.

Do not overload Simulation with everything.

---

# Component Style

Prefer:
- integrated panels
- thin separators
- compact toolbars
- grouped technical readouts
- restrained corner radii
- clear typography hierarchy
- purposeful status indicators

Avoid:
- every metric inside a separate card
- excessive pills
- giant rounded rectangles
- default shadcn styling
- excessive glassmorphism
- AI-template compositions

shadcn is a primitive foundation, NOT the final visual style.

Customize it substantially.

---

# Charts

Charts should resemble professional energy/grid monitoring tools.

Use:

Voltage profile:
Static vs SuryaFlex + limit

Transformer loading:
Static vs SuryaFlex + limit

24-hour views:
PV
load
export/import
curtailment
voltage
loading

Charts should prioritize:
- readable axes
- strong comparison
- clear threshold lines
- tooltips
- restrained grid lines

Avoid unnecessary legends or decorative chart effects.

---

# Competition Presentation

The application will be screen-recorded.

Therefore:

- major states must look good while static
- animations must remain legible in video
- important numbers must be large enough
- no tiny text
- no horizontal overflow
- no modal blocking the core flow
- Static vs SuryaFlex should be demonstrable in seconds

---

# Design Skill Workflow

Before redesigning:

Use `ui-ux-pro-max` to create a design system for:

"premium climate-tech energy grid control dashboard digital twin"

Recommended dials:

variance: 6
motion: 6
density: 8

Use `image-to-code` when the provided SuryaFlex reference screenshot is available.

Treat the screenshot as the primary visual reference.

Use `design-taste-frontend` only where applicable for:
- hierarchy
- composition
- anti-generic visual review

Note:
SuryaFlex is a dashboard/product UI, so dashboard-specific guidance from
`ui-ux-pro-max` takes priority over landing-page rules.

After implementation use:
`web-design-guidelines`

Then run browser tests / Playwright at:
1366×768
1440×900

Final acceptance is based on both:
technical correctness
AND
visual quality.