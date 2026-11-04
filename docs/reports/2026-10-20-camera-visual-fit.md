# Camera fit must include boundary glyphs and focus frames

Baseline: `d81ac8c11214d42c87ba1bf490b086705b93a397`, branch `preview/commercial-street-restore-20261019`.

## Reproduction and cause

Fresh Chrome on the baseline 4174 build (`index-C4ojA2ne.js`), viewport 1280×800, reproduced the reported screenshots:

| Target | Before, screen x range |
| --- | --- |
| Courtyard main door | 1271.923–1288.092px |
| Courtyard left gate, 门 | −8.077–8.092px |
| Interior right portrait | 1271.078–1288.925px |
| Interior left main door | −8.077–8.092px |

The courtyard and interior walk bounds are x=10…100 (90 logical units). At the existing uniform world scale, a 1280×800 viewport exposes exactly 90 units. The old `size <= span` test therefore centered those anchor bounds permanently, while the glyph and frame extend approximately 8–9 screen pixels beyond their boundary anchors. The office's 88-unit bounds really do fit, with enough space for the same boundary visuals.

Reproduction screenshots/state: `.tmp/fit-edge-baseline/`; source evidence supplied by QA remains untouched in `E:\NewTone-Preview\.tmp\qa-all-scenes-d81/`.

## Actual runtime diff — `mainlineViewport.ts`

New `mainlineCameraVisualOutset(viewport)` uses the existing one-glyph `mainlineLabelFootprint` at the fixed design reference, plus the same focus-frame gap/inset constants used by frame measurement. It converts the screen-pixel gap to logical coordinates with the current uniform world scale:

```ts
const glyph = mainlineLabelFootprint('字', { x: 0, y: 0 }, sceneDesignReferenceMetrics)
const scale = mainlineWorldScale(viewport)
const frameGap = sceneFocusVisualGapPx + sceneFocusStrokeInsetPx
return {
  x: glyph.width / 2 + frameGap / (sceneDesignReferenceMetrics.width * scale) * 100,
  y: glyph.height / 2 + frameGap / (sceneDesignReferenceMetrics.height * scale) * 100,
}
```

Boundary cell positions are character centers. This is their outward text/frame envelope, not a change to collision or walk bounds. It does not add a DOM observer or per-frame DOM measurement. At 1280×800, the horizontal envelope is about .6276 world units per side, corresponding to about 8.93 screen pixels. The office's 88-unit bounds plus that envelope still fit within 90; the courtyard's 90-unit bounds plus the envelope do not.

Before, `cameraOffsetForView` only checked logical walk size:

```ts
const padding = Math.min(2, span * .04)
const preferredCenter = follow ? position[axis] : start + size / 2
const center = size <= span ? start + size / 2 : clamp(preferredCenter, centerMin, centerMax)
```

After:

```ts
const padding = Math.max(visualOutset[axis], Math.min(2, span * .04))
const fits = size + 2 * visualOutset[axis] <= span
const center = fits ? start + size / 2 : clamp(position[axis], centerMin, centerMax)
```

The d81 outward endpoint formulas remain unchanged. `mainlineCameraOffset` now delegates directly to this per-axis fit decision rather than bypassing following when a fixed scene's walk bounds alone fit. `mainlineCameraTarget` uses the same decision. The existing hook already updates fixed-scene offsets when the actor moves, so no hook/renderer change is needed.

At 1280×800 the courtyard can pan between offsets −3 and −7, around its original center −5. At a fixed scale, both outer frames cannot simultaneously fit in a viewport narrower than their complete visual extent; approaching either side exposes that side completely. At 1920×1080 the full visual extent fits, so the courtyard remains centered. Truly smaller scenes, including the office at 1280×800, remain centered. For the tested commercial-street viewports, d81 padding already exceeds the visual envelope and the world overflows as before, so its endpoint calculations are unchanged.

No world scale, layout, 28/16 spacing, CSS, story, navigation, collision, save or phone-exit source changed. Runtime changes are confined to `mainlineViewport.ts`.

## Verification

- Viewport and visibility unit suites: 17/17, including exact-fit courtyard edge frames, a genuinely fitting office remaining centered regardless of actor position, reference-size centering, phone following, smaller-map centering and existing commercial-style overscan/return cases.
- TypeScript `--noEmit`, isolated Vite build and `git diff --check` passed. Existing >500KB chunk advisory only.
- Actual Chrome matrix: courtyard gates, interior portrait/doors, office bounds and commercial-street endpoints at 1280×800, 1920×1080 and 390×844. Screenshots, frame rectangles, center hit-tests and raw actor/camera state: `.tmp/fit-camera-qa/`. Right-portrait clicks also produce the existing interaction response, captured after 2.4s in each viewport.
- The initial saved-position matrix passed 23 of 24 cases. Its phone office-right fixture was rejected by the existing safe-spawn rule (which requires a path back through initially closed doors), returning the actor to the initial office position. This was not reported as a camera pass or fixed by changing navigation. A separate ordinary phone playthrough clicks the office corridor door, walks through the corridor with ground taps to x≈86.5, and captures the right boundary at x≈374.404px. Evidence: `.tmp/office-right-walk/`. This completes the requested office-right visual check through the real navigation flow.
- An ordinary desktop courtyard run also ground-clicks toward the right from the initial position, exposing the complete right door, then clicks that door and successfully enters the ancestral interior. Evidence: `.tmp/fit-home-walk/`. This verifies the new micro-pan through real movement, not only seeded screenshots.

Representative actual results:

| Viewport | Target | After, screen x range |
| --- | --- | --- |
| 1280×800 | Courtyard left gate, 门 | 20.367–36.536px |
| 1280×800 | Courtyard right main door | 1243.479–1259.648px |
| 1280×800 | Interior right portrait | 1242.634–1260.481px |
| 1280×800 | Office left secret door, centered | 6.136–22.305px (unchanged) |
| 1920×1080 | Courtyard right main door, centered | 1813.852–1834.148px |
| 390×844 | Courtyard left gate, 门 | 7.013–24.181px |
| 390×844 | Courtyard right main door | 365.813–382.981px |
| 390×844 | Interior right portrait | 365.160–383.659px |

The relevant frame centers hit their actual focus target groups. Representative desktop/mobile screenshots were also visually inspected; the frames/ink are inside the stage, including after portrait interaction. The matrix uses disposable browser contexts and synthetic resume positions, not real user saves. The office-right exception above uses ordinary input instead of resume.

## Candidate only — independent QA pending

- `http://127.0.0.1:4174/?scene=jijia-ancestral-home`, PID45496, serving `.tmp/fit-camera-candidate-dist`.
- JS `index-CuUPkzmo.js`, 825562 bytes, SHA-256 `d44b2ed890cb62c21d1b9459cd7682771afad0640c442a71b071c660d7d8cc58`.
- CSS `index-oIqil_8F.css`, 200101 bytes, SHA-256 `1218fd0bc039fd10d5b850899db4918b38716898a78d7d795a648cac93a91771` (unchanged).
- Candidate page and assets HTTP200. Public 4173 remains the approved d81 build and was not replaced. No Vercel/main/staging operation was run.

The new fit rule and specified visual cases have engineering verification. Independent QA and authorization are still required before a public 4173 replacement. No full-story playthrough or same-path performance profile was run for this camera-only repair. Existing untracked profile/temp files are preserved and excluded from commits.
