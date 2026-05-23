# Contributing to GitLedger

## Branching
- Work from `main`.
- Use short-lived feature branches: `feat/...`, `fix/...`, `chore/...`.
- Keep PRs focused and small.

## Local setup
1. Frontend: `npm install` then `npm run dev:frontend`
2. Backend: install Bun, then `cd backend && bun install && bun run dev`
3. Contract: install Foundry, then `cd contract && forge test`

## Quality gates
- Backend tests: `cd backend && bun test`
- Backend typecheck: `cd backend && bun run check`
- Frontend lint: `npm run lint`
- Contract tests: `cd contract && forge test`

## PR requirements
- Explain user impact and technical change.
- Add/update tests for behavior changes.
- Include migration notes for DB/contract changes.
- Link related issue/ticket.

## Commit style
- Prefer Conventional Commits:
  - `feat: ...`
  - `fix: ...`
  - `chore: ...`
  - `docs: ...`

## Security and secrets
- Never commit private keys, API tokens, webhook secrets, or `.env` files.
- Use `.env.example` as the template for required variables.
- Report vulnerabilities via `SECURITY.md`.
