# Root Cause Guard v2 policy

Guard helps finish work reliably by reporting lexical risk signals. It does not prove semantic correctness or replace Vitest, Playwright, TypeScript, lint, build or real acceptance.

## Priorities

Current explicit user requirements > confirmed product design > current code/tests > historical contract records.
When behavior changes are authorized, update implementation, obsolete assertions and necessary new behavior tests. Explain changed assertions in the final report; do not request the same approval again.

## Severity and continuation

- **BLOCK / exit 1:** pause the relevant dangerous action, first attempt a safe resolution. Agent safety policy covers unauthorized overwrites of user changes, unknown or unarchived deletion, stash clearing, destructive Git/history operations, unauthorized production data/secrets changes and unresolved factual conflicts with significant loss risk. Other safe work continues. The current executable has no lexical code rule that automatically proves these dangers.
- **REVIEW / exit 0:** continue, inspect context, resolve what can be resolved and report meaningful findings. Timers, polling, coordinates, listeners, empty catch, changed/deleted assertions and missing/stale/legacy baselines are reminders, not prohibitions. Valid lifecycle waits, test waits, fixtures and authored geometry are allowed.
- **INFO / exit 0:** historical contracts and ordinary context.
- **TOOL FAILURE / exit 2:** report the tool failure; do not change product behavior to satisfy a broken tool. Continue safe development and ordinary validation when possible, reporting the verification boundary.

Destructive safety is primarily agent policy, not a semantic claim made by regular expressions. Uncertainty means review, not automatic prohibition.

## Baselines and history

Before editing code in the actual Git root, explicitly run `baseline`; after editing and before relevant validation run `check`. Read-only tasks need neither. Only explicit `baseline` writes snapshots. `check` falls back to current HEAD diff plus untracked scanning for missing, stale or legacy state; it never silently replaces the baseline.

State remains local under the user's `Documents/Codex/_persistent_state/root-cause-guard`, partitioned by repository identity and worktree key. Snapshots include dirty/untracked contents and must never be committed. `CODEX_GUARD_STATE_ROOT` is reserved for reported isolated tests or controlled alternate paths.

The existing root registry is historical context. Preserve its records. No replacement marker or exact added assertion is required for an authorized test change.

## Tests and scope

- Fix failures related to the task and retest. Proven existing/unrelated failures do not stop the task; report `PRE-EXISTING / UNRELATED FAILURE`. Gather evidence for ambiguous failures that affect credibility, pausing only the unresolved affected part when necessary.
- Do not proactively broaden scope or overwrite user changes. Safe incidental changes already made, checked and validated are report-only as `OUT-OF-SCOPE CHANGE`; explain origin and risk rather than automatically reverting them.
- Small changes: focused tests. Medium: focused tests plus typecheck. Large/multiple systems: broader relevant tests, typecheck and necessary E2E. Merge/staging/release: full tests, E2E, lint and build as supported and authorized.
- If build already includes typecheck, do not immediately duplicate a full typecheck without a reason.

This document describes NewTone Guard policy. Installation does not replace global AGENTS files or automatically inject instructions, hooks or CI gates.
