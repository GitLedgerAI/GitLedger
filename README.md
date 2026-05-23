# GitLedger

GitLedger turns pull-request approvals into staked, onchain accountability records.

## Monorepo layout
- `app`, `components`: Next.js frontend
- `backend`: Bun API (webhooks, stake orchestration, data layer)
- `contract`: Foundry smart contracts for staking/slash/yield

## Current backend status
Implemented now:
- Bun + Hono backend scaffold
- GitHub webhook endpoint: signature verification + dedup + approved-review handling
- PRD-aligned database schema in Drizzle
- Testable app factory and unit/integration tests
- Backend Dockerfile for GHCR container builds
- CI/CD workflow with jobs: `test`, `build`, `release`, `deploy`

Pending integration work:
- Real Redis queue worker
- Octokit GitHub App auth + install flow
- Onchain writes (viem + EAS schema encoding)
- Chainlink callback path and stake resolution persistence

## Quick start
### Frontend
```bash
npm install
npm run dev:frontend
```

### Backend
```bash
cd backend
cp .env.example .env
bun install
bun run dev
```

### Contract
```bash
cd contract
forge test
```

## Useful commands
- `npm run dev:frontend`
- `npm run dev:backend`
- `npm run contract:test`
- `cd backend && bun test`
- `cd backend && bun run check`

## CI/CD pipeline
Workflow: `.github/workflows/backend-cicd.yml`
- `test`: installs backend deps, typechecks, runs tests
- `build`: builds and pushes backend image to GHCR
- `release`: creates git tag and GitHub release
- `deploy`: triggers Render deploy hook via `RENDER_DEPLOY_HOOK_URL`

Required secret:
- `RENDER_DEPLOY_HOOK_URL`

## Branching
Development is expected on `main`.
