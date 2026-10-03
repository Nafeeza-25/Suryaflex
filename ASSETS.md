# SuryaFlex Visual Assets Manifest

All visual assets used in the SuryaFlex interactive neighbourhood energy simulation have been created directly for this project as clean, scalable vector illustrations (SVG format) under CC0 / MIT license equivalent.

## Assets Directory: `public/assets/suryaflex/`

- `house-solar.svg`: Illustrated 3D/isometric rooftop solar residential house with blue PV solar panel matrix, roof structure, windows, door, and lawn shadow base.
- `transformer.svg`: Illustrated 11kV / 0.4kV distribution transformer unit with radiator cooling fins, high voltage ceramic bushings, gauge dial indicator, nameplate badge, and ground shadow.
- `transmission-tower.svg`: High-voltage electrical transmission pylon/lattice tower with cross-arms, ceramic insulator bells, top beacon light, and ground shadow.
- `tree.svg`: Layered pine/oak evergreen tree for ambient environment decor.

## Asset Usage & Composite Scene Architecture

SuryaFlex uses a 3-layer composite scene approach:
1. **Background Layer**: Environment grass, street roads, trees, illustrated houses, distribution transformer equipment, and upstream transmission grid tower.
2. **Interactive SVG Power Flow Layer**: Service drop lines, shared central feeder trunk, transformer connecting line, grid pylon line, and animated Motion for React particle flows.
3. **React Overlay Layer**: Floating compact household value cards (`H01-H08`), mode switches, live grid overlay metrics, and interactive click handlers.
