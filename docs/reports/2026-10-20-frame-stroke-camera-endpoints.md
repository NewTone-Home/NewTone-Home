# Shared frame stroke and camera endpoint repair

Baseline: `6e4eca64808f72d79d85fe164777727bddae1849` on `preview/commercial-street-restore-20261019`.

## Actual runtime diff and reason

### `scene.css` — `.scene-focus-frame path`

Before:

```css
stroke-width: 1;
vector-effect: non-scaling-stroke;
stroke-dasharray: 1;
stroke-dashoffset: var(--scene-focus-stroke-offset);
```

After:

```css
stroke-width: 1;
stroke-dasharray: 1;
stroke-dashoffset: var(--scene-focus-stroke-offset);
```

The existing frame geometry is measured in viewport pixels. Its local host bounds already divide by the ancestor world scale, so the SVG's final screen transform is approximately 1. The additional non-scaling stroke path treatment in Chrome breaks dash coverage under that ancestor scale. This repair removes that conflicting treatment for the entire animation. `pathLength=1`, offset 1→0 draw, 0→1 retraction, duration, corner selection, lifecycle and collapsed visibility remain the same. There is no end-state dash override.

An isolated installed-Chrome experiment uses an 80×30 screen-pixel frame with the same nested world scale and compensated local SVG dimensions. At scale .740741, the original normalized/non-scaling stroke has no left-edge ink and a partly absent bottom edge. Replacing only normalized dashes with pixel-length dashes still fails. Removing the vector effect produces complete edges at .5, .740741, 1 and 1.5. Evidence: `.tmp/frame-stroke-control/`; straight edge pixel counts at .740741 change top/left/bottom/right from 152/0/100/52 to 152/52/152/52 in the sampled strips. This is raster evidence, not a DOM visibility inference.

### `mainlineViewport.ts` — `cameraOffsetForView`

Before:

```ts
const centerMin = start + Math.min(size / 2, span / 2 + (size > span ? padding : 0))
const centerMax = start + size - Math.min(size / 2, span / 2 + (size > span ? padding : 0))
```

After:

```ts
const centerMin = start + span / 2 - padding
const centerMax = start + size - span / 2 + padding
```

`padding = Math.min(2, span * .04)` now adds visible space outside the map rather than excluding map edges. A map that fits still uses the unchanged centered branch. World projection, collision bounds, movement, mobile exit logic and all map/store/furniture dimensions are untouched. For the reported 390×844 horizontal span, x=8 is now inside the left endpoint with about 15.6 screen pixels of margin, rather than about 15.6 pixels outside it; the same rule applies to the right endpoint and vertical overflow.

## Regression coverage

- `mainlineViewport.test.ts`: phone and desktop left/right/top/bottom overscan, target-camera travel and return, and a smaller-than-viewport map remaining centered. Final focused file: 9/9.
- Six related Vitest files: 42/42 (viewport, frame geometry, lifecycle, endpoint measurement, visual bounds and visibility). First attempt failed before collecting tests because the sandbox system temp directory could not rename Vite cache files; rerunning with workspace `.codex-test-tmp` succeeded.
- `e2e/scene-focus-frame-scale.spec.ts`: four installed-Chrome raster tests at .5/.740741/1/1.5. Each checks appearance progress, all four stable edges against an undashed solid reference, retraction progress and no pixels when collapsed. Straight edge comparisons permit two RGB channel levels of antialias variation; corner cap/join antialias is excluded from the straight-edge comparison. 4/4 passed. Config used: `.tmp/frame-scale.config.ts`; screenshots: `.tmp/frame-scale-test-results/`.
- TypeScript `--noEmit` and isolated Vite build passed. Existing >500KB bundle advisory only. `git diff --check` passed.

## Candidate preview

Only isolated 4174 was restarted, PID 40788, serving `.tmp/frame-camera-candidate-dist`:

- `http://127.0.0.1:4174/?scene=commercial-street`
- JS `index-C4ojA2ne.js`, 825498 bytes, SHA-256 `2f64b96253d5f03c49f60b92f9b155776e65417b1e590ad253153dfdcbb44692`.
- CSS `index-oIqil_8F.css`, 200101 bytes, SHA-256 `1218fd0bc039fd10d5b850899db4918b38716898a78d7d795a648cac93a91771`.
- Homepage and both assets returned HTTP 200.

Public 4173 was checked read-only and still serves baseline JS `index-CkQMegyM.js` / CSS `index-BDDmnMkz.css`; it was not replaced. No Vercel/main/staging command was run. Existing untracked profile/temp artifacts remain outside the commit.

Actual-game screenshots/state for 1280×800 and 390×844 are recorded in `.tmp/frame-candidate-motion/` (40 states each). Fruit/creative shop entry and exit positions are present in the recordings; representative door/sign frames were visually inspected as closed. Ordinary camera travel in that script did not reach both map endpoints, so those loops are not endpoint acceptance evidence.

The separate `.tmp/frame-camera-endpoints.mjs` uses disposable browser-context saves, seeded at document start, to resume at x=9 and x=161.9, y=50. It then captures the real game camera after 2.6 seconds. No real player save is touched. The four actual captures passed:

| Viewport | Endpoint | Actual visible world x range | Outer wall screen x |
| --- | --- | --- | --- |
| 1280×800 | left | 6.00465–96.00466 | 28.378px |
| 1280×800 | right | 74.90839–164.90840 | 1251.627px |
| 390×844 | left | 6.96485–32.95714 | 15.532px |
| 390×844 | right | 137.95580–163.94810 | 374.475px |

Screenshots and raw state: `.tmp/frame-camera-endpoints/`. Differences of about .005 world units from the formula come from the sampled smoothed camera. These are engineering checks; independent QA must approve the candidate before replacing 4173. No same-path performance profile or full-game regression was run for this rendering/camera-only change.
