# NewTone-Home 当前交接：第一世界中枢环区表里入口版

## Current Product Direction

- This pass is the accepted structural baseline for the NewTone-Home map-entry experiment.
- NewTone is not being treated as a traditional novel site, archive, wiki, or dashboard.
- The current screen is a game-style narrative entry / interactive world interface.
- The current implementation is a playable first-world region entry, not a full open-world map system.
- The current open region is `first-world / central-ring`.
- The current open event is Ghost Market as the first available extra event.

## Accepted Current Flow

- Home primary CTA `从头开始`
  - enters `第一世界：中枢环区 / surface`
  - default selected anchor is `central-court`
- Home secondary CTA `当前开放：鬼市`
  - enters `第一世界：中枢环区 / underside`
  - selects `old-crossing / 鬼市`
- Surface `old-crossing`
  - LocationPanel shows `旧街口`
  - CTA is `查看另一面`
- Clicking `查看另一面`
  - switches to `underside`
  - preserves the same anchor coordinate
  - `old-crossing` manifests as `鬼市`
- Ghost Market panel
  - CTA is `进入事件`
  - opens Reader for event `ghost-market-extra-001`
- Reader `返回地图`
  - returns to `第一世界：中枢环区 / underside / old-crossing / 鬼市 selected`

## Data Hierarchy

The accepted hierarchy is:

```text
world -> region -> layer -> mapAnchor -> manifestation -> event
```

Current data lives primarily in:

- `content/data/worlds.json`
- `content/data/chapters.json`
- `src/types/map.ts`
- `src/types/world.ts`
- `src/types/destination.ts`

Architecture principles to preserve:

- location is not event
- layer is not world
- map is not story list
- Ghost Market is not the architecture center
- Ghost Market is only the current available extra event under old-crossing's underside manifestation
- Reader receives `eventId` and should not care whether the event is main, side, or extra

## Current Map / Asset Approach

- The current temporary map asset is:
  - `public/assets/maps/first-world/central-ring-temp-map-mock.png`
- The same temporary map asset is used as the visual test background for surface and underside.
- Product logic is not baked into the image.
- Real UI labels, nodes, buttons, panels, routes, and event connections remain code/data-driven.
- The visible map treatment currently uses:
  - radial edge fade / vignette to reduce rectangular image boundaries
  - circular/radial scanner-disk treatment around the city structure
  - compact HUD title/status/objective text
  - surface/underside mood overlays
  - selected-node pulse and quick panel transition feedback
  - short surface-to-underside reveal feedback

## Known Issues

- LocationPanel still feels too hard/card-like and should later be integrated more naturally into the map background.
- Current map asset is temporary and may be replaced later.
- Current version is an entry prototype / operational version, not the final visual direction.
- Surface / underside mood separation is acceptable for now but can be improved later.
- Do not rebuild as a full open-world map yet.
- Do not add multiverse selection yet.

## Next Possible Improvements

- Replace the temporary map mock with a purpose-built first-world central-ring map asset.
- Improve LocationPanel integration so it feels more like a map scan result and less like a card.
- Refine surface and underside mood separation after the final map asset exists.
- Add future regions, layers, anchors, manifestations, and events mostly through data configuration.
- Improve mobile-specific composition after the desktop entry flow is stable.
- Keep Reader event loading event-id based.

## Explicit Non-Goals For The Next Pass

- Do not redesign the whole site.
- Do not convert this into a wiki/archive/timeline/admin system.
- Do not add multiverse selection yet.
- Do not build a full open-world map.
- Do not add WebGL, canvas, 3D, WASD, reward systems, or procedural exploration.
- Do not connect Notion runtime fetch to the site.
- Do not add new official prose content.
- Do not restore the abandoned pure-css station hub visual pass.

## Verification Snapshot

Last verified locally in this working session:

- `npm.cmd run lint`: passed
- `npm.cmd run build`: passed
- `git diff --check`: passed with existing LF/CRLF warnings only
- accepted flow smoke tests: passed

Repository constraints observed:

- no commit
- no tag
- no `v0.8.2` created
- `v0.8.1` not moved
- no stash restored
