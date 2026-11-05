# Historical website date fix — independent review handoff

Scope: one proved compatibility defect, based on frozen trial a230f5b6d9fa40e8c5fac2ac1f274c9be5ea69b1 / tree 00a921b687ff859fd939b5dc27a7e22f6a33c9bf. Independent clone/worktree: C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-historical-date-fix-20261104, branch fix/historical-date-compat-20261104. Clone was local, --no-hardlinks --no-checkout; no source worktree/index/refs edited, no network or real staging/main operation. Initial branch had 755 tracked files and no dirty/untracked paths. Supervisor independently refreshed and verified this existing window as Sol Medium before writing.

## Evidence and recognition boundary

- Website fixed a5860fc202e58a450d6d7ef6a1b665b6d6d1ac43: PlayerSave writer schema is 1 (not release version). mainlineStoryClock.storyClockForStage writes paired month=4/day=12, weekday=6, stage-specific time, no year. Its playerSave sanitizer regenerates this fixed date on writes. Git blobs: mainlineStoryClock.ts 7efd61e6744a8d32ba76fd4666c8500b9707c268; playerSave.ts 8b2c87d247804074d0aabfdfd2a0cd74ccb3ea24.
- Pre-calendar v1 1a8115adeb2abb47caade8a5e7c8c9e7afa89d05 writes only dayId/stage. Existing no-date baseline behavior remains unchanged.
- Early v2 8220392e571b71eb58c19773dffead931b67a778 also wrote no year, but lacked later canonical v2 required fields. It is NOT one of the currently registered canonical v2 formats. This patch does not silently register or promote it by version number alone.
- Calendar introduction 4153e438987569a1464ac74ac9518709b0d2141b and registered bddf114495588ef0eab8bfd1ec100a2ab259177a use the explicit 2025/4/12 anchor. Current playerSave also defaults missing historical year to 2025; strict migration previously rejected before reaching that sanitizer.
- Terra observed failure/control evidence: newtone-save-entry-20261104-evidence/terra-33-recheck/historical-date-results.json and historical-date.mjs. This implementation window read those existing artifacts, did not reproduce or claim their PASS as post-fix success.

## Exact behavior

convert parses an object, requires schema v1 and the existing allowed outer fields, then passes the missing-year case through a private historical bridge. Only story-day-001 / known stage / paired numeric 4/12 may add frozen year 2025; an explicitly supplied weekday must agree with Saturday (6). The bridge copies the object; it does not modify the parsed source or raw storage string. Partial dates, yearless leap days and even calendar-valid other month/day pairs have no reliable fixed-writer year evidence and stay blocked, rather than guessing a leap year/current year. Explicit year, including bad types/null/out-of-range, never enters this bridge and is checked exactly as before.

The normalized copy then runs the existing strict validateCore and sanitizer followed by validateNew. validateCore and validateNew function text is byte-equivalent after newline normalization to base. No current/v2 validation relaxation, service classification change, broad missing-marker rule, default-success migration or fixture-year insertion. Unknown outer/nested structures and malformed gameTime remain protected. Valid explicit dated/leap-year saves are unchanged.

Valid existing gameTimeMs is retained exactly; absent simulation time follows the existing historical saved hour/minute fallback. Month/day, stage, money and phone/Center business collections remain under the existing preservation checks. No changes to source archive/backups, locks, pending/receipt/ACK, one-time money, Lao Zhou, four-scene placement, phone compatibility or retired Reader policy. Non-date behavior was not refactored.

## Prepared regression coverage (37 cases, not run here)

New tests/historicalDateCompatibility.test.mjs imports the ACTUAL convert/validateNew/save-entry service. Its public v1 fixture intentionally has no year and matches the public field contract. Covers all four stage clocks; valid time/money/Center extensions; real inspect -> prepare -> commit -> ACK -> close/reopen with exact original raw/backup/retired Reader string and 650->640 balance kept; partial/bad/unanchored/leap dates and wrong year types; explicit valid month ends/leap dates; pre-calendar v1; unknown and current schemas; unknown fields; current canonical v2 strictness; corrupted authority must not fall back to old raw; malformed gameTime extension. Existing test files and the other 32 old failures were not changed.

Only syntax parsing/static self-review were performed. No runtime tests, typecheck, build, services or browser launched. The independent clone has no node_modules; dependencies were not installed or linked. Terra should provide its approved existing isolated dependency setup before running:

```powershell
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vitest/vitest.mjs" run --config vite.config.js tests/historicalDateCompatibility.test.mjs tests/saveEntryService.test.mjs
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/typescript/bin/tsc" --noEmit
node "C:/Users/Tony_Li/Documents/Codex/2026-10-30/task/newtone-save-entry-20261104/node_modules/vite/bin/vite.js" build
```

Re-run Terra's historical-date browser scenario against a build from the new fixed commit: public no-year v1 must Continue, explicit-year control must Continue, invalid month must remain protected; verify exact raw preservation and no duplicate money/placement/notification. Run targeted migration/ACK/source-conflict regression. Early unregistered yearless v2 is a documented unsupported format, not claimed fixed.

No push, deployment, merge to real staging/main, deletion, public preview access, database query or original trial service change. Finish at independent Sol review and Terra validation; final commit/tree identity is supplied in the task handoff, avoiding a self-referential manifest hash.
