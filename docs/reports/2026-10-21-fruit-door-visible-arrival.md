# A: fruit-tea door arrival after the scene becomes visible

Status: isolated candidate only, **not published**. Public remainsbae6afb. Final application SHA **d00f93cd7864ccb547f3d7423c1b7600bfa63d53** (includes69ea675,dcaa8c3, test follow-ups4ea2064/e2edd84). No B/C/mining/scale changes in this package.

## Plain-language result and exact behavior

The protagonist starts near the first fruit-tea door rather than halfway between fruit-tea and fashion. Landing/taxi curtains finish first. The visible fruit-tea sign stays unchanged briefly, then the existing frame retracts and the sign rolls into wall/door/wall. The player can observe the reveal. This is presentation only; no new story, permission or traversal mechanism.

The public-side arrival is **(22.2083333333,39.4072148148)**, matching `mainlineStorefrontApproach` for the compiled first facade. Old middle-road arrival was(22.2083333333,50.2590666667). New game, explicit restart and taxi use the new scene initial/ride positions. Ordinary saved positions and story progression are not moved/reset. A saved occupant inside the room retains the already revealed door rather than replaying the outdoor demonstration.

## Actual diff: files/functions and reasons

Relative to the published application's later documentation HEAD374c839,8 code/test files changed,65 additions/14 deletions. Runtime changes:

1. `mainlineSceneModel.ts` / `commercialStreetEntrance`, `alignedStreetEntrance`: authoring uses north facade+6; aligned result uses actual snapped door x/y+6. Both initial and ride positions still share one entrance. The original transformed threshold differs slightly from the final snapped facade, so using the compiled six-unit public approach avoids retaining a pre-snap coordinate. No door or wall is moved.
2. `CenterExperience.jsx` / `renderScenePage`: supplies `presentationReady={!snapshot && entryPhase==='active' && !longDistanceTravel}`. A prepared hidden target can signal scene-ready without consuming its reveal under the curtain.
3. `MainlineScenePage.tsx`: forwards readiness to `useStorefrontPresentation`; defaulttrue preserves standalone mounts.
4. `storefrontPresentation.ts`: adds350ms initial visible delay constant and optional readiness argument to `activeStorefrontPresentationOwner`. While not ready, no outdoor presentation owner is selected.
5. `useStorefrontPresentation.ts`: releases outdoor proximity ownership350ms after readiness. Existing phase transitions (`retracting -> revealing -> revealed`), their700ms roll and restore paths remain. Interior ownership still immediately keeps its actual doorway revealed. Navigation/collision/door lifecycle are separate and unchanged.
6. `playerSave.ts` / `clearPlayerSave`, `createPositionSaveCoordinator`: explicit reset increments a document-local writer generation. An already-mounted departing coordinator cannot flush queued coordinates or commit old state after reset; a new coordinator captures the new generation and saves normally. This does not run on ordinary load or continuation. An isolated manual-key-clear test exposed the pagehide rewrite risk; a regression directly proves the real clear function invalidates old writers. Manual storage deletion does not invoke this protection and is not represented as the actual reset API.

Key code:

```ts
const alignedStreetEntrance = {
  x: entrancePortal.endpoint.doorPosition.x,
  y: entrancePortal.endpoint.doorPosition.y + 6,
}
// Center visibility, separate from scene-ready:
presentationReady={!snapshot && entryPhase === 'active' && !longDistanceTravel}
// Departing save writer after explicit clear:
if (generation !== playerSaveResetGeneration) { buffer.clear(); return getSave() }
```

Tests: `commercialStreetEntrance.test.ts` covers the exact compiled approach, public walkability, first camera page, held presentation, continuation progress and stale-writer reset. `commercialStreetStorefrontInteractions.test.ts` still requires legal walking to three representative approaches, but starts that movement probe at lane midpoint: its former assertion that the new-game point must be far from every approach contradicts the newly approved birth location. No route/open/door assertion was removed. An intermediate test-only ASI error was fixed by naming the target array; it was not accepted as a pass.

Not changed: world/grid/font/furniture sizes, device scale027f31, map boundaries, door locations/access, scene graph, story/dialogue content, NPC simulation, layout, or real browser saves. B old Cafe cleanup and C four-store/mining work remain separate and unimplemented at this handoff.

## Reproducible validation

- Focused4 files **63/63 pass**, including player-save lifecycle contracts (`.tmp/fruit-reset-tests.json`). Typecheck, Vite build and diff-check pass; existing large-chunk advisory remains.
- Whole suite final **761/778 pass,17 fail**, no newly failing full test names compared with the recorded grid baseline (`.tmp/fruit-reset-all-tests.json`). Not all-green. Remaining failures: street ambient east-bound patrol; followupExperience old Cafe ETA; geometrySnapshot old door label/outdoor Yonghe chairs/phone-landscape assumptions; spatialMigration old object; visualFootprint old NPC size; npcFoundation old Cafe access; p1Experience old camera/interior ride; phoneRideRound3 old seated Cafe ETA;2 releasePreparation snapshots; worldNavigation east-outside points/2 old mining intents; mainlineSceneInteractions mining label. Prior unchanged027f31 control already reproduced these names; no NPC/geometry weakening was used to hide them.
- Actual Chrome1280x800 and390x844 on frozen4194 (same reveal runtime as final4195, before save-generation-only addition): normal Landing entry and Office phone destination/vehicle/confirm ride first show baseline sign/progress0, then begin retracting after **341.3–374.6ms observed visible time**, finally revealed. Six contexts include2 saved interior occupants at(22.2083,10), kept in place with revealed doorway and retained Cafe completion/contact note. No page errors. Events and six PNGs: `.tmp/fruit-arrival-final/results.json`.
- Restart integration uses source server4196 solely to invoke the **actual existing `clearPlayerSave` function** from its Vite module in a fresh Chrome context. Leaving the initial scene no longer resurrects a save: Landing is present and save remainsnull; re-entering starts at39.4072 and reveals the first door. Evidence `.tmp/fruit-reset-integration.json`. This is a function integration test, not a claim that a reset button is present in the public production bundle.4196 was stopped; browser closed.
- Initial manual-storage-clear browser attempts failed because the mounted writer could persist during navigation. These are not counted as successful reset evidence. No real user storage was touched.
- Not yet independently verified: final4195 QA, physical phones/Safari, real public reset UI (test control is build-gated), complete story walkthrough. Animation timings are observational, not FPS/performance acceptance.

## Frozen final candidate for QA

**http://127.0.0.1:4195/**, PID28436, output `.tmp/fruit-reset-dist`, applicationd00f93c.4194/dcaa8c3 remains frozen for comparison (PID3524);4193/69ea675 is superseded and must not be mistaken for final.

| File | bytes | SHA256 |
| --- | ---: | --- |
| index-B0C8Wu_6.js |840774|c7d0a62e33a9e791153e4a13544f2a16583bcac0fcf4aaa269f7ee3e250f27e1|
| index-BsDrr4lS.css |200381|67dbb36fb235e8f7493fda38992e06ed6f9b88cfb724e7b928fefe6c4aa5664e|

HTML and all4 referenced files HTTP200/bytes/SHA match frozen build (`.tmp/fruit-reset-http.json`). Public4173/QuickTunnel remainsbae6afb with027f31 rollback. No push/main/staging/Vercel. Await independent A QA before any same-link update.
