# Center local detail study QA

## Scope

- Branch: `feature/center-map-line-art`
- Preview: https://new-tone-1iazwn2oi-newtone-homes-projects.vercel.app/?detail=1
- Reference direction: the user-supplied dark, warm/cool pseudo-3D world map.
- This checkpoint evaluates the first semantic local-detail sample, not a final art-direction sign-off.

## What was verified

- The page enters the Center detail scene and renders the structured SVG scene.
- Five independent landmark entities are present: `memory-archive`, `crossing-market`, `relay-17`, `south-station`, and `signal-tower`.
- Keyboard focus plus Enter selects `记忆档案馆`; its contextual information panel appears with status, unlock state, and an open-record action.
- The shared zoom controls change the scene LOD:
  - default: `standard`
  - zoomed in: `detail`, fine geometry visible at full opacity
  - zoomed out: `overview`, secondary and fine geometry hidden
- The scene remains a single SVG world structure: terrain, river, road, building masses, roofs, façade details and interaction groups are generated from semantic data rather than a raster overlay.
- Local verification: 41 test files / 161 tests passed; TypeScript check, oxlint and Vite production build passed.
- Vercel deployment for the branch is READY.

## Findings

### Passed: structural checkpoint

The new sample is materially different from the old full-screen triangulation study:

- terrain has explicit ridges, slopes, plateau and river-cut structure;
- the river and road follow the terrain model;
- the archive landmark is a compound of multiple masses, roofs, courtyard/platform relationships and secondary/fine detail;
- primary, secondary and tertiary line weights are separated;
- filled footprints and draw order provide basic occlusion;
- zoom reveals additional geometry instead of only enlarging the same paths.

### P1 — final visual fidelity is still blocked

The sample is a clean semantic/procedural study, but it is not yet at the reference image's architectural density and authored landmark richness. The main landmark still reads as a simplified compound model. The next visual pass should deepen one landmark only with stronger façade grammar, roof/edge variation, courtyard depth, stairs/entry structure and more deliberate hidden-line removal.

### P2 — occlusion is a first pass

Current occlusion is based on semantic draw order, filled footprints and focus attenuation. It is not yet a complete hidden-line solver for arbitrary terrain/building overlap. This is acceptable for the local prototype checkpoint but must be improved before scaling the scene.

## Result

**Technical / interaction checkpoint: passed.**

**Final visual acceptance against the reference direction: blocked.**

Do not promote this checkpoint as the final Center art result. Continue by refining one landmark at high detail without expanding the map footprint.
