# Keep an employee permission edge inside its own finite region

## Actual regression found during contract reconciliation

4216/ca95603 restored the existing Cafe denial text and passed its local desktop/mobile checks. The subsequent cross-store assertions exposed a real regression, not an obsolete expectation: northern stores 2–6 could no longer stand near their rear walls. These points have no physical obstacle and are not inside any Cafe staff region. 4216 must not be published; its narrow QA result does not cover this newly found problem.

Root cause: `mainlineOccupancyQuery` checked a denied access edge's tangent span and `signedDistance <= actorClearance`, with no lower bound. The Cafe rear strip's right edge at x≈139.29 therefore rejected every point to its left in the same y band, including entirely different shops. The original API's half-plane assumption was invalid in a shared world. Removing the failing tests, removing the new feedback, or pretending those shops were staff territory would hide the regression.

## Exact minimal source correction

`mainlineNavigation.ts` only:

```diff
- if (tangentInSpan && signedDistance <= clearance) return false
+ if (tangentInSpan
+   && signedDistance >= -regionDepth - clearance
+   && signedDistance <= clearance) return false
```

`accessBoundaryGeometry` supplies `depth` from the actual rectangle's normal dimension (width for a left/right edge, height for top/bottom). `mainlineOccupancyQuery` now limits the edge contact check to that finite region plus the actual actor's half-body contact clearance. The existing region-contains check, finite crossing segment, collision boxes, role access and path solver remain. No furniture, wall, door, map/viewport dimension, collision footprint or plot change. It does not open staff space or add a large transparent obstacle.

`cafeAccessFeedback.test.ts` retains all four feedback/authorized-owner/body checks and adds the regression for the five real north-store rear points, plus public crossing denial at the real Cafe opening. The related six-file run passes **54/54**, including 14 rear-door integrity cases, front/rear route assertions, unchanged retail layouts, the ten mine migration cases and shared actor access. Interior geometry tests explicitly use their actual front-inside point; crossing a front door uses `openPassageIds` for that lifecycle, rather than asserting that a closed physical gate can be walked through. Locked rear access is still checked for a role legally allowed to approach the employee side, with ordinary wall and denied-public assertions retained in the associated contracts.

## Frozen new candidate and evidence

**http://127.0.0.1:4217/**, PID26188, `.tmp/cafe-bounded-access-dist`. 4215 and 4216 have not been replaced.

| Asset | bytes | SHA256 |
| --- | ---: | --- |
| index-C6XP-qXn.js | 856911 | 4dc85baf89f97e460182162f73e131100d34a842ee97ee287f45be21b63b39a5 |
| index-CGh3wNIs.css | 200573 | 2d1e58d828b388fe280461c6df36351b83657fbbe32c14763870d44f77afe039 |

Typecheck and isolated build pass (existing chunk advisory); diff-check passes. Actual normal Chrome pointer/touch input, separate fresh contexts at 1280x800 and 390x844:

- Cafe employee-ground click walks to the public side and visibly shows `这里是柜台员工区`. Floor server records 62 distinct positions in each context, no sampled blocked state or page errors. `.tmp/cafe-bounded-access-feedback-browser/results.json`, two PNGs.
- North slot 2 (creative) and slot 6 (fragrance): four contexts load exactly at the previously rejected rear area, walk three world-percent units sideways and back through empty ground, then normally click the actual rear door and show `后门尚未开放`, without crossing it. Zero page errors. `.tmp/bounded-north-rear-browser-v2/results.json`, four PNGs. Desktop starts `(39.7083,-26.4076)` / `(109.708,-26.4076)`; mobile retains those same starts. No safe-spawn relocation or runtime movement calls were injected.
- An earlier mobile short-ground tap did not complete its movement wait. Its exact cause was not established; it is not presented as a pass. The final run uses farther clear ground away from the door target and records successful normal movement and the separately clicked locked door. No runtime change was made between these two harness runs.

Parent independent QA subsequently passed 4217: desktop north slots 2–6 and mobile slots 2/6 no longer receive the unrelated denial (old 4216 rejected all five points), real rear doors stay locked, both Cafe openings retain customer feedback and authorized employee passage, front-door return passes, and 423 server samples pass. Tea staff areas and Yonghe kitchen permissions remain restrictive. Evidence: `E:/NewTone-Preview/.tmp/qa-bound-6dc1596/`.

These are focused checks, not full-device/story/performance acceptance. Final whole suite: 151 files, 839 tests, 828 pass, 11 fail, no pending/todo; every remaining failing full name appears in both preserved historical controls. See `2026-10-21-integrated-contract-reconciliation.md` for the actual categories and remaining risks. Author layout aesthetics, physical phones and Safari remain pending. A publication is still denied/pending direct human approval. Public stays bae6afb. No push/main/staging/Vercel or true-user-save access.
