# Surface World 2.5D Asset Kit — Batch 1

Status: generated asset batch only. Nothing in this directory is wired into the map or UI.

## Shared art direction

- Fixed orthographic 2.5D three-quarter bird's-eye view.
- Camera looks from southeast toward northwest.
- Soft diffuse light comes from upper-left / northwest.
- Cast shadows fall toward lower-right / southeast.
- Fine graphite/ink architectural linework with restrained pale watercolor.
- Warm ivory, weathered pale plaster, charcoal gray roof tile, muted sage foliage, and soft warm gray infrastructure.
- No people, vehicles, text, map labels, UI, watermark, or complete background scene.
- Every deliverable is an RGBA PNG with transparent corners and generous padding.
- Generation masters were produced at roughly 1254–1691 px per side before eventual in-map downscaling.

## Deliverables

### Landmarks (4)

- `landmarks/jijia-residence-persistent.png`
- `landmarks/jijia-residence-mini.png`
- `landmarks/central-council-persistent.png`
- `landmarks/central-council-mini.png`

The mini landmarks are high-detail flattened visual masters. Component layer packs for reveal animation are not included in this first batch.

### Vegetation (6)

- `vegetation/tree-crown-small-a.png`
- `vegetation/tree-crown-small-b.png`
- `vegetation/tree-crown-medium-a.png`
- `vegetation/tree-crown-medium-b.png`
- `vegetation/tree-crown-large-a.png`
- `vegetation/tree-crown-large-b.png`

### Residential roofs (6)

- `roofs/roof-modern-low-a.png`
- `roofs/roof-modern-low-b.png`
- `roofs/roof-modern-low-c.png`
- `roofs/roof-modern-low-d.png`
- `roofs/roof-modern-low-e.png`
- `roofs/roof-modern-low-f.png`

### Courtyard walls (6)

- `walls/courtyard-wall-straight-a.png`
- `walls/courtyard-wall-straight-b.png`
- `walls/courtyard-wall-corner-a.png`
- `walls/courtyard-wall-corner-b.png`
- `walls/courtyard-wall-gate-a.png`
- `walls/courtyard-wall-gate-b.png`

### Covered corridors (4)

- `corridors/corridor-straight-a.png`
- `corridors/corridor-straight-b.png`
- `corridors/corridor-corner-a.png`
- `corridors/corridor-corner-b.png`

### Roads (8)

- `roads/road-main-straight.png`
- `roads/road-main-curve.png`
- `roads/road-main-t-junction.png`
- `roads/road-main-cross-node.png`
- `roads/road-secondary-straight.png`
- `roads/road-secondary-curve.png`
- `roads/road-secondary-t-junction.png`
- `roads/road-main-secondary-merge.png`

### Elevated bridge (3)

- `bridges/elevated-bridge-straight.png`
- `bridges/elevated-bridge-curve.png`
- `bridges/elevated-bridge-pier.png`

### Shadows (6)

- `shadows/shadow-building-compact.png`
- `shadows/shadow-building-lshape.png`
- `shadows/shadow-building-courtyard.png`
- `shadows/shadow-tree-small.png`
- `shadows/shadow-tree-medium.png`
- `shadows/shadow-tree-large.png`

### Texture overlays (5)

- `textures/texture-paper-fiber.png`
- `textures/texture-watercolor-grain.png`
- `textures/texture-roof-grain.png`
- `textures/texture-road-grain.png`
- `textures/texture-surface-world-tone.png`

## Prompt set

All assets used the built-in image generation path. The prompt set shared this base:

> Create exactly one isolated, reusable 2.5D world-map module in the quiet NewTone surface-world hand-drawn style. Use a fixed southeast-to-northwest orthographic bird's-eye camera, northwest light, southeast shadow direction, generous padding, and no text, labels, UI, people, vehicles, watermark, complete background, or unrelated props.

Category modifiers:

- Landmarks: persistent versions use simplified low-detail silhouettes; mini versions use stronger facade, roof, entrance, plaza/courtyard, tree, and shadow detail.
- Vegetation: foliage-only crowns in small, medium, and large size classes; no trunks or ground shadows.
- Roofs: roof-and-eave-only modules with rectangular, L, twin-gable, square-hip, stepped, and U-shaped footprints.
- Walls: two straight segments, two 90-degree corners, and two gate modules with matching wall height and cap thickness.
- Corridors: two straight and two 90-degree covered modules with matching roof height, bay rhythm, and width.
- Roads: arterial and secondary straight, curve, junction, crossing, and merge tiles with clean connector ends.
- Bridge: straight deck, curved deck, and pier/cap module.
- Shadows: neutral graphite-gray footprint overlays only.
- Textures: sparse marks only, with no opaque sheet or baked background.

## Transparency workflow

- Most masters used a flat `#ff00ff` chroma background; neutral shadow and texture replacements used `#00ff00` to avoid pink contamination.
- Final alpha files were produced with border auto-key sampling, soft matte, despill, transparent threshold 12, and opaque threshold 220.
- One foliage replacement and four neutral shadow replacements were regenerated after visual fringe / color-cast review.
- Final validation: 48 PNG files, all readable as RGBA, all four corner alpha values equal to 0.

## Review sheets

- `artifacts/surface-kit-batch1-landmarks.png`
- `artifacts/surface-kit-batch1-modules.png`
- `artifacts/surface-kit-batch1-infrastructure.png`
- `artifacts/surface-kit-batch1-textures.png`
