# Root Cause Guard v2

This directory is the canonical source for NewTone's Guard. The user-level `.codex/scripts/root-cause-guard.mjs` is a runtime copy, not an independently maintained version.

Guard reports suspicious text patterns and test-contract changes so the agent can inspect their context. It exists to help reliable work finish, not to freeze legitimate product changes. See [POLICY.md](POLICY.md).

## Results

| Exit | Meaning | Action |
| --- | --- | --- |
| 0 | INFO/REVIEW or no findings | Continue; inspect and report important reviews |
| 1 | Explicit BLOCK | Pause the dangerous action and resolve safely |
| 2 | Tool/argument/Git error | Report tool failure; safe normal work may continue |

All current lexical rules are REVIEW. The explicit internal BLOCK fixture verifies report/exit plumbing; it is not a production regex safety rule.

The root `root-cause-guard.contract-replacements.json` is a **HISTORICAL CONTRACT MIGRATION RECORD**. Guard reads valid history as INFO. Its markers, paths and exact assertion strings do not decide PASS/FAIL. Existing records remain unchanged.

## Verify and install (PowerShell, repository root)

Requires Node.js, Git and PowerShell. No product dependencies are needed.

```powershell
node --test tools/root-cause-guard/guard-fixtures.mjs tools/root-cause-guard/install-fixtures.mjs
Get-FileHash -LiteralPath tools/root-cause-guard/root-cause-guard.mjs -Algorithm SHA256
& ./tools/root-cause-guard/install-local.ps1
$guardSourceHash = (Get-FileHash tools/root-cause-guard/root-cause-guard.mjs).Hash
$guardRuntimeHash = (Get-FileHash (Join-Path $HOME '.codex/scripts/root-cause-guard.mjs')).Hash
if ($guardSourceHash -ne $guardRuntimeHash) { throw 'Guard runtime differs from canonical source' }
```

The installer records both hashes, preserves a differing old runtime as a uniquely named `.bak`, copies the source and verifies equality. An identical runtime is left untouched. It never installs instructions or touches state, baselines, registry or product files. Use `-Destination <temporary-file-path>` for an isolated simulation.

Fixtures use new OS temporary directories and dedicated fixture Git repositories/state. They do not use real dirty NewTone worktrees. Temporary evidence is retained for inspection outside the repo. `CODEX_GUARD_STATE_ROOT` is explicitly overridden only inside these isolated Guard fixtures. The Git executable can be selected with `CODEX_GUARD_GIT`; otherwise the installed Codex bundled Git is preferred when available, with PATH Git as fallback.

These filenames deliberately avoid normal product test discovery. Run them explicitly with Node; no npm test/build integration, hooks or required CI checks are added.

## Use, update and recover

From the actual target Git root:

```powershell
node (Join-Path $HOME '.codex/scripts/root-cause-guard.mjs') baseline
# Edit and inspect the intended change.
node (Join-Path $HOME '.codex/scripts/root-cause-guard.mjs') check
```

Only `baseline` creates a new snapshot. Missing/stale/legacy baselines cause REVIEW and HEAD-diff/untracked fallback; `check` does not overwrite them. Default state is the user's `Documents/Codex/_persistent_state/root-cause-guard`, separated by repo identity/worktree key. Never commit it: snapshots may contain full private dirty/untracked text.

To update Guard, edit this canonical source, run fixtures and sync with the installer; do not maintain a separate local fork. Version is recorded in `VERSION`. Directory-local `.gitattributes` disables line-ending conversion for the executable so Git stores and restores its exact bytes. The first canonical v2 source has SHA256 `8029F07D881778F06A732FAFA2C1E39752403679DEC623C6D6504534F0C4B9CF`.

On a new machine or after local configuration loss:

1. Clone NewTone and select the branch containing this directory.
2. Find `tools/root-cause-guard` and run its fixtures.
3. Run `install-local.ps1` and verify source/runtime hashes.
4. Review `POLICY.md` when maintaining project-specific instructions. Do not overwrite whole global AGENTS files.
5. Create a fresh baseline in the intended Git worktree and start work.

Do not restore old baselines. They describe an earlier machine/worktree/task, not portable project history. Global AGENTS, credentials, sessions, traces, backups and persistent state are intentionally absent here.
