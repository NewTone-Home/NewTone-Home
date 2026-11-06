# Start activation hotfix

Parent 8a157f6d1733614b5d116566e05dddcaa266bc8c, initially clean. Terra/Sol identified a real initial-screen blocker on PC/390/375: direct EntryButtonSurface call omitted visible; its deliberate shared default false prevented entry animation, visibility and input. This worker did not rerun Terra's incident. Evidence directory supplied by parent: task/entry-retained-terra-8a157.

Only product change: SaveEntryMenu Start call now passes visible={true}. The shared component/default, retainOnAction, permanent Start node, vertical choices/confirmation, Updates layout, service and safety logic are unchanged. No preview server or source from other workspaces touched.

New SaveEntryMenuVisibility.test.mjs renders the real menu with a child-surface spy and requires exactly one begin call with visible===true, no disabled=true, a completion callback and the correct retained-action policy across empty/current/legacy/confirmation modes. Omission would fail this props contract even though an SSR hidden node exists. The existing browser visible/toBeEnabled assertions remain unchanged. The .mjs extension is included by the actual vite test discovery pattern; the earlier SaveEntryMenu.test.jsx is not included by that configured pattern, so it cannot be relied on as an executed regression unless QA explicitly selects it. This focused test is discoverable without widening configuration.

MJS syntax, six-file JSX/TS parse-only and git diff --check passed. No test/typecheck/build/browser/service run, no push/deploy. QA should first run this discovered regression plus actual first-screen entryVisual browser tests for PC/390/375, then retained Start/motion/zero-write checks. All visual safety assertions must remain; independent Sol/Terra acceptance still pending.
