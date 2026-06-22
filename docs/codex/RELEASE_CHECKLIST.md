# Release Checklist

## Manual Release Flow

- Browser manual acceptance.
- `git status`
- `git diff --stat`
- `git add .`
- `git commit -m "..."`
- `git tag -a vX.X.X -m "..."`
- `git push origin main`
- `git push origin vX.X.X`

## After Push

- `git status`
- `git log --oneline --decorate -5`

## Notion Sync Record Template

- Date:
- Version:
- Commit hash:
- Tag:
- Verification result:
- Changed files:
- Completed scope:
- Phase boundaries:
- Next suggested step:
