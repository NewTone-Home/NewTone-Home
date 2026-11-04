# Mine expansion: preserve the old save's shop identity

## What changes for a player

The old numeric position `(30,30)` meant the original Yonghe interior. After all shop fronts became longer and interiors became 700 reference pixels deep, interpreting those same numbers directly put the player inside the shoe shop. Looking for the nearest walkable point could move them around furniture but could not recover which shop they had meant to occupy.

The loader now identifies the **old room first**, then maps the position's fraction within that room to the **same named room** in the expanded map. If a new counter or table obstructs it, recovery stays in that room's public component connected to the front interior approach. Locked rear doors and employee restrictions remain active. This is one-time save loading, not a teleport during normal play.

Both remembered mine scene aliases are migrated independently, even when the active scene is elsewhere. All story state, inventory values in scene state, phone/contact notes, notifications, clock and timestamps remain intact. The original mining coordinates are retained in `miningPositionBackup`. No real browser save was read or edited during development.

## Actual source changes

- `miningLayoutMigration.ts`: new frozen metadata for the eight rooms and street lane from published `bae6afb20ce8955d4e3a25a30f008b49e76c4197`; this is metadata, not another scene implementation. `migrateMiningPositions` performs the source-room mapping. `mapLaneY` maps road positions through corresponding row boundaries rather than distributing the whole road uniformly. `recoverOwned` requires an 11px protagonist footprint, legal current collision/access, and a path from the named room's public front-side seed; its fallback never uses a global nearest point. It neither removes obstacles nor opens a passage.
- `playerSave.ts`: `sanitizePlayerSave` passes mine positions through this migrator before existing Cafe alias canonicalization, and excludes mine IDs from the earlier generic transform so it cannot convert twice. `createInitialPlayerSave` stamps new mine layout version 2. `readLegacyPlayerSave` clears that default before interpreting genuinely old split-key storage. `recordPlayerScenePosition` records current-layout room identity and remembers it by scene ID.
- `tests/miningLayoutMigration.test.ts`: ten regressions cover the actual three reported saves, both remembered aliases, all eight old room identities, new/future versions, explicit pre-grid layout 1, unknown epochs, obstructed rear/counter points, and old split-key loading. `tests/fixtures/miningLegacyRoomSaves.json` contains the isolated QA reproduction saves, not user browser data.

### Version rules (important limitations)

1. `miningLayoutVersion >= 2`: keep current and remembered coordinates; do not apply the old-room transform again. Preserve a future integer version rather than silently downgrading it.
2. No mine version plus `worldGridVersion:1`: this is the published pre-expansion mine layout. Use its frozen old bounds to identify the shop. Explicit mine layout 1 can also declare the pre-grid epoch; apply the existing grid conversion once before room mapping.
3. Neither reliable marker: numeric coordinates alone cannot reveal their authoring epoch. Preserve them in the backup. An explicit valid owner hint is respected; otherwise the old `yonghe-eatery` alias recovers at Yonghe's public front interior, while `yonghe-mining-perimeter` recovers at the street entrance. This conservative path can lose the exact old sub-position, and is intentionally reported rather than guessing an arbitrary shop.
4. Unversioned development/prototype expanded-map fixtures are indistinguishable from old published grid saves. They must explicitly carry layout 2. The migration does not guess their version from a coordinate that happens to fit the new map.

```ts
// Before: generic coordinate conversion (or no conversion at worldGridVersion 1)
// followed by ordinary current-map safe-spawn could select another shop.
// After, abbreviated from migrateMiningPositions:
owner = oldRoom.id
mapped = {
  x: newRoom.x + oldLocalFractionX * newRoom.width,
  y: newRoom.y + oldLocalFractionY * newRoom.height,
}
result = recoverOwned(scene, owner, mapped)
// Save writes miningLayoutVersion: 2 and the untouched source-coordinate backup.
```

## Evidence and candidate

Candidate `http://127.0.0.1:4215/`, isolated build `.tmp/mining-room-migration-dist`. It includes the already frozen Cafe and tea layout trial lineage; this commit adds only migration/save handling and its tests. It is not a public release or author acceptance of those layouts.

- JS `index-DqXHoZzF.js`, **856510 bytes**, SHA256 `b8c6e054bd0993859285ed18aae2961434bc8abb44cebc368dd48861ca3549e6`.
- CSS `index-CGh3wNIs.css`, **200573 bytes**, SHA256 `2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039`.
- HTML 2277 bytes, SHA256 `579c8648f639f8d7e7ee60e614ad8652c82c852aeab550ffa142e508df7cd1ae`.

Exact reported cases, with old `worldGridVersion:1` and nonempty progress:

| Old scene / position | Recovered room | New position |
| --- | --- | --- |
| yonghe-eatery / 30,30 | mining-shop-2-interior (Yonghe) | 22.1424904762,45.5343428571 |
| yonghe-mining-perimeter / 30,46.888974 | mining-shop-3-interior (pharmacy) | 14.9993,73.8519369037 |
| yonghe-eatery / 31,31.3334 | mining-shop-2-interior (Yonghe) | 23.9282047619,47.6296857143 |

The focused migration file passes **10/10**. Related five-file run passes **39/40**: the sole failure is the existing `miningStreetShell` assertion that all rooms contain zero furniture, now contradicted by the separately authorized Yonghe furniture trial. It is not silently removed or counted as a pass; migration of old test contracts belongs to the next batch. Typecheck, isolated Vite build and `git diff --check` pass; existing >500KB bundle advisory remains. Whole-suite tests have not yet been run for this candidate.

Browser evidence is kept under `.tmp/mining-room-migration-browser-v3/`: fresh isolated Chrome at 1280x800 and mobile/touch emulation 390x844, using the three exact QA source saves. Normal pointer/touch input, no application movement calls or modified runtime coordinates. Each load is checked against the expected room; refresh must keep the position, then short on-screen clicks approach the real door and the real door is tapped to exit. The final actor is required to remain inside the viewport. Source fixtures, expected map and model approach are in `.tmp/mining-migration-browser-data.json`.

Earlier script attempts are retained: one mobile waypoint was 0.8 screen pixels outside the viewport; another used Playwright's automatic `locator.tap()` scroll into a clipped ancestor, causing a false all-black exit capture. The final script uses raw screen-coordinate taps only and checks the final actor screen rectangle; no application patch was made to hide these harness errors.

Pending: independent QA for this migration, full-suite/retired Cafe test-contract reconciliation, historical Yonghe survey completion scope, author visual acceptance, real phones/Safari. Central abstract `观察` interaction is deliberately unchanged pending author choice. A publication remains denied/pending explicit human approval. No push, public preview replacement, main/staging or Vercel action.
