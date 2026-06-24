# NewTone Project State

## Current Version

pre-v0.8.2 Station Hub prototype committed locally, pending final review.

Current git truth at last update:

- `HEAD`: `f704659`, `Replace Multiverse card scaffold with Station Hub prototype`
- Current Station Hub prototype commit: `f704659`
- Local tag: `v0.8.0`
- Local tag: `v0.8.1`
- `origin/main`: `ed79ed5`
- Push status: user confirmed `main` is at `ed79ed5`; tag `v0.8.1` remains at `b8efd5d`.
- Working tree clean after local Station Hub prototype commit, before the current keyboard-boarding polish.
- No new tag was created; `HEAD` has no tag.
- No push has been performed for `f704659`.

## Current Phase

Reader-side website skeleton construction. The current focus is closing the Logo -> Multiverse Map -> World Hall -> Chapter Reader skeleton. Do not enter the full body/content system yet.

## Completed

- v0.7.3 Frame 3 reading progress ember closure.
- v0.8.0 Canon entry-flow correction.
- v0.8.0 Code X project docs added.
- v0.8.1 World Hall chapter-list skeleton.
- v0.8.1 mobile World Hall entry spacing fix.
- v0.8.1 Code X workflow hard rule update.
- Pre-v0.8.2 patch: added two placeholder chapters and adjusted World Hall chapter-list visual recognition/spacing.
- v0.8.2 local draft: replaced the card-grid Multiverse scaffold with an asset-backed Station Hub prototype.
- The earlier card-grid Multiverse scaffold was a temporary routing/data validation step and is no longer the accepted visual direction.
- Pure CSS Station Hub visual pass was abandoned and stashed as `abandoned pure-css station hub visual pass`.
- Current accepted direction: asset-backed Station Hub / Transit Scene. Background image lives at `public/assets/multiverse/station-hub-bg.png` and is referenced as `/assets/multiverse/station-hub-bg.png`.
- Station Hub background asset owns the platform/track/fog/lighting space; HTML overlay owns interactive labels and route state.

## Next Suggested Step

- Next task should be explicitly chosen by the user.
- If starting a versioned phase, define the boundary before calling it `v0.8.2`.
- Review the pre-v0.8.2 Station Hub prototype before any commit, tag, push, or v0.8.3 planning.
- Do not start `v0.8.3` automatically.
- Do not enter progress overview, Notion runtime fetch, admin, or official body upload unless the user explicitly asks.
- This is guidance only. Do not execute it unless the user explicitly asks for that task.

## Current Prohibitions

- Do not connect Notion API.
- Do not do real body upload.
- Do not build an admin backend.
- Do not add official new body text.
- Do not expand the multiverse map beyond the asset-backed Station Hub placeholder boundary unless explicitly requested.
- Do not do large refactors.
- Do not push unless the user explicitly asks for it and the tool is available.

## Sources Of Truth

- Code truth: local repo / GitHub.
- Product Canon: Notion Canon.
- Code X working cache: `docs/codex`.
- Short website plan: `docs/codex/WEBSITE_PLAN.md`.
