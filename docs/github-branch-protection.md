# GitHub Branch Protection (main)

Configuracao recomendada para `main` no repositório `DNL-8/SIte`.

## Como configurar

1. GitHub -> `Settings` -> `Branches`.
2. `Add branch protection rule`.
3. Branch name pattern: `main`.

## Regras recomendadas (minimo)

1. `Require a pull request before merging`:
   - `Require approvals`: `1`
   - `Dismiss stale pull request approvals when new commits are pushed`
   - `Require review from Code Owners`
2. `Require status checks to pass before merging`:
   - Status check: `fullstack` (workflow `CI`)
3. `Require conversation resolution before merging`
4. `Do not allow bypassing the above settings`
5. `Restrict pushes that create files larger than 100 MB` (se disponível)
6. `Do not allow force pushes`
7. `Do not allow deletions`

## Resultado esperado

- Ninguem faz merge direto na `main` sem PR.
- PR exige ao menos 1 aprovacao.
- CI precisa estar verde antes do merge.
- Areas criticas exigem review de `CODEOWNERS`.
