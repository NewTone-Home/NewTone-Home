# Code X Workflow

## Start Of Each Task

Read these first:

1. `docs/codex/WEBSITE_PLAN.md`
2. `docs/codex/PROJECT_STATE.md`
3. The checklist relevant to the current task.
4. The code files named by the task brief.

## Default Limits

- Do not read Notion by default.
- Do not search the entire repo by default.
- Do not implement multiple versions in one task.
- Treat `PROJECT_STATE.md` "Next Suggested Step" as guidance only, not an automatic execution command.
- Do not start development just because `PROJECT_STATE.md` names a next suggested step.
- Execute only the user's current explicit task.
- If the user's current task differs from the next suggested step, follow the user's current task.
- If the user asks only for git closure, checks, or commit work, do not enter the next development phase.
- After completing the current task, stop and report. Wait for user confirmation before continuing to another version or phase.
- If the current brief conflicts with `PROJECT_STATE.md`, stop and report before changing files.
- If the task needs a boundary change, ask the user first.

## Completion Requirements

Before reporting completion:

- Run `npm.cmd run lint`.
- Run `npm.cmd run build`.
- Run `git diff --check`.
- Output changed files.
- Output whether `PROJECT_STATE.md` needs an update.
- Output whether Notion needs sync.

## Push Policy

Never push unless the user explicitly says push is allowed and the tool is actually available. The current default is that the user pushes manually.
