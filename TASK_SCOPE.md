# TASK_SCOPE — 2026-10-18: Unified Commercial Street Runtime

## 唯一交付目标
Implement all 14 commercial-street merchants, including Café and Milk Tea, inside one continuous commercial-street runtime world. One active world scene owns shared coordinates, collision, NPC actors, interactions, story state, orders, notifications, and persistence. Entering or leaving any shop or lakeside area changes only the visible display region and camera focus; it must not load, unmount, reset, or switch to another runtime scene.

## Non-goals and boundaries
- Do not keep Cafe or Milk Tea as enterable independent runtime worlds. Retain old IDs only as save/content migration aliases; no playable portal or runtime fallback may target them.
- Do not undo the accepted shop layouts by pasting the old street image/layout back. Preserve authored business layouts and adapt their coordinates/room shape to the single world.
- Preserve the Cafe reduced seating, lake-facing glazing, Lao Zhou story table, counter/staff routes, and dialogue triggers.
- Preserve the Milk Tea L counter, public customer approach, staff-only route, kitchen/stock split and staff passage, tutorial, phone ordering, explicit counter pickup, and current order clock.
- Use stable, unique IDs for every world object and NPC. Hiding an inactive display region must not unload or reset its business state.
- Existing calls between distinct worlds, including Commercial Street and the mine, remain valid.
- No production release, main/staging merge, force push, or external screenshot upload. Push only the temporary preview branch after passing the full verification gate and making a detailed commit.

## Architecture requirements
- Keep `commercial-street` as the runtime scene ID throughout all intra-street travel.
- Compile Café and merchant room content into shared world coordinates with explicit transforms. Existing scene blueprints may serve as layout/content input, but cannot mount as independent runtime scenes.
- Display regions control visibility and camera anchors only. Physical door traversal updates player world coordinates continuously and preserves world/runtime scene identity.
- Store Cafe story state, all merchant/NPC state, Milk Tea orders and notifications in the shared persistent world model, with namespaced stable keys.
- Migrate legacy saves from `commercial-cafe`, `commercial-milktea-shop`, and `commercial-milktea-interior` without losing coordinates, dialogue/story progress, NPC state, orders, notifications, or tutorial flags. Migration is idempotent; legacy IDs must not remain enterable.
- Trigger story beats from stable world interactions/region events, not a change of runtime scene ID.

## Required verification
- Exercise actual door crossings in and out of Café, Milk Tea, and representative generated merchants. Assert continuous coordinates, unchanged `commercial-street` runtime/world ID, no remount/reset, and region/camera visibility changes.
- Verify Café lake-facing side, reduced seats, story-table interaction, counter/staff route, and dialogue trigger.
- Verify Milk Tea staff access, kitchen/stock passage, first-visit clerk tutorial, phone ordering, notification de-duplication, explicit pickup, persistence, refresh, and legacy save migration.
- Run desktop and 390×844 mobile journeys, English and Chinese, legacy and current isolated save fixtures; do not touch real user saves.
- Run typecheck, production build, focused tests and full test suite; report all failures with evidence. Passing build alone is not acceptance.

## Worktree baseline and delivery
- Branch: `preview/commercial-street-full-20261018`
- Verified mainline baseline: `a5860fc202e58a450d6d7ef6a1b665b6d6d1ac43`; the branch currently contains the existing implementation commit `cd55331b6115d3adda5ea7b5af1fed9f9c32f487` plus uncommitted continuation work. Do not rewrite or discard that implementation.
- Scope confirmation from the author: “应该是所有的建筑都是一体的，就是商业街所有建筑都是一体的。它只是分室内、室外……咖啡馆也是，然后永和小馆其实也得是。那奶茶店跟所有新做的这些所有的商业街，它都得是。” Implement the entire 14-merchant Commercial Street/Cafe/lakeside continuous world here; Yonghe/mining work belongs to the independent other thread.
- Preserve existing uncommitted implementation work; inspect each diff before staging.
- Make a detailed local commit explaining the prior mistaken split-world interpretation and the unified-world correction. Push only this temporary preview branch after tests pass; do not merge.
