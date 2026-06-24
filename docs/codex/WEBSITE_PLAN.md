# NewTone Website Plan

## Purpose

This file is the short local entry point for website work. Read it before opening long Notion pages or searching the repo.

## Current Truth

- Repo: `NewTone-Home/NewTone-Home`
- Local path: workspace root `E:\小说`, repo folder `NewTone-Home-main`
- Branch: `main`
- Current version: `pre-v0.8.2 Station Hub prototype committed locally, pending final review`
- Current commit: `f704659`, `Replace Multiverse card scaffold with Station Hub prototype`
- Current Station Hub prototype commit: `f704659`
- Current tag: `v0.8.1`
- GitHub status: `main` is at `ed79ed5`; tag `v0.8.1` remains at `b8efd5d`.
- Working tree at last check: clean after local Station Hub prototype commit, before the current keyboard-boarding polish.

## Product Boundary

- Build the reader-side website skeleton first.
- Current focus: Canon entry flow, asset-backed Station Hub / Multiverse Transit placeholder, World Hall structure, and Chapter Reader closure.
- Do not enter full body/content system yet.
- Do not connect Notion runtime fetch yet.
- Do not build admin backend yet.
- Do not upload official body text yet.
- Do not expand the multiverse map beyond the explicit asset-backed `v0.8.2` placeholder boundary.

## Completed

- Frame 1 Logo entry flow foundation.
- Frame 2 World Hall foundation.
- Ambient `Zha` / `Shi` character entries.
- Continue last chapter entry.
- Frame 3 chapter reader foundation.
- Reading progress ember closure.
- Local content adapter foundation.
- Canon entry-flow correction.
- Code X workflow docs and hard rule: next suggested step is not an automatic command.
- `v0.8.1` World Hall chapter-list skeleton.
- Pre-v0.8.2 patch: two placeholder chapters added for density testing, with chapter-list visual/spacing adjustment.
- `v0.8.2` local draft: card-grid Multiverse scaffold connected W1 Chumo to World Hall and showed locked coming-soon world slots.
- Current local Station Hub prototype replaces card-based world selection with Station Hub / Multiverse Transit.
- Current local Station Hub prototype uses `/assets/multiverse/station-hub-bg.png` as the scene background and keeps route labels/status as HTML overlay.

## Current Known Caveat

- Chapter list currently has three local chapters: two placeholder test chapters plus `chumo-arc1-ch3`.
- Placeholder chapters are for local UI validation only and do not represent official body text.
- Desktop and mobile World Hall were checked with the chapter list, ambient `Zha` / `Shi` entries, and continue-reading entry.

## Next Candidates

These are options only. Do not execute unless the user explicitly asks.

1. Define the next explicit task before doing more development.
2. If needed, lightly retune chapter-list opacity/position/label.
3. Build World Hall progress overview only if explicitly requested.
4. Define `v0.8.2` boundary before entering multiverse map.

## Fast Local Files

- Current state: `docs/codex/PROJECT_STATE.md`
- Workflow rules: `docs/codex/CODEX_WORKFLOW.md`
- Release checklist: `docs/codex/RELEASE_CHECKLIST.md`
- Canon web checklist: `docs/codex/CANON_WEB_CHECKLIST.md`
- World Hall entry: `src/frames/Frame2WorldHall/index.tsx`
- World Hall data hook: `src/frames/Frame2WorldHall/hooks/useWorldHallData.ts`
- Chapter list: `src/frames/Frame2WorldHall/parts/ChapterList.tsx`
- Content adapter: `src/content/adapter.ts`
- Local chapters: `content/data/chapters.json`

## Notion Pointers

- NewTone total entry: `https://app.notion.com/p/2a5b138d1e118029a6acfba447f86621`
- Front-end current status index: `https://app.notion.com/p/d1a1076293ae414a96f2bd1130ff35b5`
- Front-end old archive: `https://app.notion.com/p/384b138d1e1181ef866bf136016ebd38`
- Canon v2.3: `https://app.notion.com/p/06a6f6cd2e4a4c478718a346132e3469`

## Operating Rule

After finishing the current user task, stop and report. Do not continue to the next candidate automatically.
Do not start `v0.8.3` automatically.
