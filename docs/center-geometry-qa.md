# Center geometry study QA

## Scope

- Preview: `/?detail=1` on the `feature/center-map-line-art` deployment.
- Reference direction: the supplied dark, warm/cool wireframe world map with
  terrain facets, settlement clusters, rivers, labels and restrained HUD.
- This checkpoint evaluates the new procedural architecture kernel, not the
  final art direction.

## Evidence

- The detail scene contains five interactive entity groups and three generated
  geometry groups (`civic`, `market`, `station`).
- The archive geometry is composed from four masses; market and station each
  have a core plus connected halls/platforms. Each group emits batched SVG
  layers for fill, structure, windows, reveals, frames, balconies, arcades,
  service details and roofs.
- Keyboard selection opens the contextual information panel for
  `记忆档案馆`.
- The zoom control updates the shared scene transform (`scale(1.1275)` was
  observed in browser verification).
- Typecheck, lint, build and the full Vitest suite pass (40 files, 158 tests).

## Findings

### P1 — visual fidelity is not yet at reference level

The implementation no longer reads as a set of plain cuboid placeholders, but
it still reads as a procedural architectural wireframe study rather than the
reference's dense, terrain-integrated settlement drawing. The next iteration
needs stronger compound settlement composition, more varied roof/bridge
profiles and a clearer hierarchy between terrain, district structure and fine
architectural texture.

### P2 — terrain/building hierarchy remains provisional

The terrain mesh and buildings are both present, but the study still needs
better occlusion and line-weight staging so the buildings appear embedded in
the relief instead of sitting on top of it.

## Result

**Blocked for final visual acceptance.**

The geometry route is technically validated and is safe to extend. Do not
promote this checkpoint as the final visual match; use it as the foundation for
the next high-detail settlement pass.
