## Summary

- What changed?
- Why was this needed?

## Scope

- [ ] Backend
- [ ] Frontend
- [ ] Infra/CI
- [ ] Docs

## Risk

- [ ] Low
- [ ] Medium
- [ ] High

## Validation

- [ ] `pnpm lint:frontend`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`
- [ ] `ruff check backend`
- [ ] `black --check backend`
- [ ] `mypy backend/app`
- [ ] `pytest -q backend/tests`
- [ ] `pnpm e2e` (when relevant)

## Migration/Config changes

- [ ] No migration/env change
- [ ] Includes migration
- [ ] Includes new env vars

## Checklist

- [ ] No secrets committed
- [ ] API contract unchanged or documented
- [ ] Rollback path considered
- [ ] Docs updated (`README.md` / `DEPLOYMENT.md` / `CHECKLIST_RELEASE.md`)
