# Mining street empty shells — 2026-10-20

Candidate only. Furniture, authored story, observation proposals and rear alley are outside this change. Await independent QA and the coordinated shared adapters before publication.

## Branch and baseline

- Repo: NewTone-Home/NewTone-Home.
- Baseline: 8d4023945013fe093e85252e89b29ac47f3070c0.
- Worktree: E:/小说/NewTone-Workspace/preview-mining-shell-20261020.
- Branch: preview/mining-shell-20261020-e.
- Implementation commit: 742694c6c3d4218ba304b4455b1cf961276a9ba3.
- No push, public preview update, Vercel, main or staging change. Remote preview-branch deployment behavior has not been verified; no push was attempted.

## Actual changes and why

1. src/center/runtime/miningStreetShell.ts adds miningShopShells and createMiningStreetShellBlueprint. Eight storefronts share one public lane, room graph, geometry and collision world. Every front door is open, routeThrough, from mining-street-public-lane to mining-shop-N-interior, without targetSceneId. One fixed facade source owns sign, revealed door and door collision. Names use 2/3/4 characters; there are no window/glass roles or new graphic signs.
2. src/center/runtime/mainlineSceneModel.ts imports the builder and replaces only the old Yonghe exterior/interior data block (213 removed lines). The commercial street, cafe, milk-tea, shared camera/renderer/navigation and presentation files are unchanged. The historic eatery URL also renders all eight shells and the street, not a standalone room; its old save bucket is not migrated by this change. Legacy save landing and phone-map alias behavior are not accepted as validated.
3. tests/miningStreetShell.test.ts covers the compiled geometry, exact three inter-sign walls, dimensions by intervals, absence of furniture/glass, 2/3/4-character identity and real door position, all eight closed/open bidirectional physical crossings, street reachability, locked rear door and legacy full-map content.
4. scripts/mining-shell-preview-{inspect,doors,deep}.mjs use fresh ephemeral Playwright contexts. They visit local 4175 only, store screenshots/JSON in .mining-evidence, and never load the user's browser profile. The initial entryX/entryY fixture did not change the actual spawn; before-coordinates document this. The normal door click nevertheless walks from the actual street arrival to each requested portal. The door script verifies boundary crossing; the deep script separately verifies walking farther into Yonghe, refresh and exit.

## Character-grid geometry

Use the existing wall pitch and internal furniture-letter pitch sources (28/16); no furniture is instantiated. Report dimensions in wall-grid intervals, not pixels and not anchor count. A name with N letters gets N+2 facade cells (wall + N signs + wall), followed by one separator wall. Between adjacent signs there are exactly three walls. Side-wall center span is N+3 intervals; room depth is twice that span. Net clear space is smaller after wall thickness.

| Shop | Name cells | Width intervals | Depth intervals |
| --- | --- | --- | --- |
| 修鞋 | 2 | 5 | 10 |
| 永和小馆 | 4 | 7 | 14 |
| 药店 | 2 | 5 | 10 |
| 五金店 | 3 | 6 | 12 |
| 小吃 | 2 | 5 | 10 |
| 面馆 | 2 | 5 | 10 |
| 修理 | 2 | 5 | 10 |
| 早点 | 2 | 5 | 10 |

The six-wall-interval street clearance and unchanged nearRadius 10 are candidate data/default reuse, not newly approved author parameters. Camera overlap/pan rules were not changed. Varying room depths have blocked unused space behind them, not a traversable alley. Only Yonghe retains a locked rear door.

## Validation actually run

- Typecheck passed.
- Isolated Vite build passed: 340 modules, main JS 823.45 kB; existing large-chunk warning. Output .mining-build.
- Mining shell 8 tests + current viewport 12 tests: 20/20 passed.
- Earlier combined storefront/shell/viewport run: 47 passed, 1 failed. The failure is tests/storefrontPresentation.test.ts:140 asserting Yonghe characterSwitch must not be true. That old expectation conflicts with this request; the shared test file was not edited. Assertions after that early assertion in that case were not reached.
- Actual Chrome 1280×800 and 390×844: initial scenes rendered with no pageerror. Normal door clicks for 永和小馆/药店/五金店 each crossed into and out of the room while the scene ID stayed yonghe-mining-perimeter (6 boundary round trips).
- Desktop and phone: normal ground clicks moved farther into Yonghe, refresh retained the same isolated save position, then normal door click exited into the same scene. Initial mobile deep script attempted an offscreen click; that was a fixture error, not a product failure. It was corrected to move through visible ground before repeating; both final runs complete.
- Product failure on BOTH sizes: at the rear of Yonghe, after waiting through the grace period, sign phase is baseline and the entrance frame is collapsed. Exiting still works, but the required inside-door presentation is not complete. Evidence: .mining-evidence/deep-browser.json and deep-1280.png/deep-390.png.
- No independent QA, full old-save migration, English localization acceptance, rear-door click smoke, all-eight-door browser run or full commercial regression suite is claimed.

## Shared owner coordination — NOT changed here

- storefrontPresentation.ts activeStorefrontPresentationOwner (~90): public-lane guard is commercial-only. Identify the public side through room/passages data for the mining scene too.
- storefrontPresentation.ts activeStorefrontInteriorOwner (~117): returns null outside commercial-street and hardcodes commercial-street-public-lane. Resolve the current shop's entrance using routeThrough/fromRoomId/toRoomId/portalId. The collapsed deep-room door frame is now browser-reproduced.
- mainlineNavigation.ts targetIsInsideStorefrontFrame (~822) and entry-intent selection (~926): generalize the commercial-specific inward/outward click behavior for same-scene mining portals, preserving ordinary lane walking and locked rear-door behavior.
- Existing shared test expectation at tests/storefrontPresentation.test.ts:140 also requires coordinated update for the new mine behavior.

Do not cherry-pick unrelated shared changes blindly. This branch touches only the Yonghe block of the large scene-model file; merge/review that block explicitly.

## Reproduce

From this E: worktree, run:

    node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4175 --strictPort --configLoader runner

Open http://127.0.0.1:4175/?scene=yonghe-mining-perimeter . The candidate dev server was left running. It does not replace 4173 or 4174. Run the scripts above with node from the worktree root. Dependencies were independently copied from the existing E:/NewTone-Preview/node_modules into this E: worktree; shared dependencies were not edited and nothing was installed on C:.

## Migration error diagnosis correction

The earlier C: worktree is intact and clean on preview/mining-continuous-20261020 at 8d40239. The elevated git worktree move C:→E: command actually ran and Git returned Permission denied (not a tool safety-review rejection). Read-only checks confirmed distinct fixed NTFS drives, ordinary ACLs granting Modify/FullControl to the account/groups, and no read-only attribute on the source. CIM process/volume queries were refused by the environment, so handle occupancy was NOT ruled out. The original command was also launched with its working directory inside the source; its exact native error was not captured.

Git 2.54 Windows worktree move delegates to rename. Windows directory rename/move is same-volume. Thus the cross-volume operation is unsuitable, but that does not prove the sole origin of this particular generic error. Creating a NEW E: worktree from the same baseline with a NEW branch succeeded and resolves the operational blocker, without changing ACLs, copying/removing the C: worktree, or touching the shared street worktree.

Primary references: https://raw.githubusercontent.com/git-for-windows/git/v2.54.0.windows.1/builtin/worktree.c (move_worktree rename), https://raw.githubusercontent.com/git-for-windows/git/v2.54.0.windows.1/compat/mingw.c (mingw_rename), https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-movefileexw (directory target must be same drive).
