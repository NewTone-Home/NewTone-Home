# NewTone Website Plan

## Purpose

This file is the short local entry point for website work. Read it before opening long Notion pages or searching the repo.

## Current Truth

- Repo: `NewTone-Home/NewTone-Home`
- Local path: workspace root `E:\小说`, repo folder `NewTone-Home-main`
- Branch: `main`
- Current version: `v0.8.1`
- Current commit: `c75d673`, `Add pre-v0.8.2 World Hall chapter list patch`
- Current tag: `v0.8.1`
- GitHub status: user confirmed `main` was pushed through `c75d673`; tag `v0.8.1` remains at `b8efd5d`.
- Working tree at last check: clean after the pre-v0.8.2 World Hall chapter-list density patch.

## Product Boundary

- Build the reader-side website skeleton first.
- Current focus: Canon entry flow, World Hall structure, and Chapter Reader closure.
- Do not enter full body/content system yet.
- Do not connect Notion runtime fetch yet.
- Do not build admin backend yet.
- Do not upload official body text yet.
- Do not build multiverse map unless user explicitly enters `v0.8.2`.

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
