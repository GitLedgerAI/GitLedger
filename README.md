# GitLedger

[![Backend CI/CD](https://github.com/GitLedgerAI/GitLedger/actions/workflows/backend-cicd.yml/badge.svg?branch=main)](https://github.com/GitLedgerAI/GitLedger/actions/workflows/backend-cicd.yml)
![Language](https://img.shields.io/badge/language-TypeScript%20%7C%20Solidity-blue)
![Backend](https://img.shields.io/badge/backend-Bun%20%2B%20Hono-black)
![API](https://img.shields.io/badge/api-tRPC%20v11-398CCB)
![Database](https://img.shields.io/badge/database-PostgreSQL%20%2B%20Redis-336791)
![Chain](https://img.shields.io/badge/chain-Base%20Mainnet-0052FF)
![Latest Release](https://img.shields.io/github/v/release/GitLedgerAI/GitLedger)
![License](https://img.shields.io/badge/license-MIT-green)

GitLedger is a review-accountability protocol for AI-era code review.

It links GitHub review events to onchain stake records, attestations, and resolution outcomes so reviewers have economic skin in the game.

## What It Includes

- Frontend app (`app`, `components`) for explorer, reviewer, repo, and dashboard views
- Backend service (`backend`) for:
  - GitHub webhook intake and repo install tracking
  - OAuth routes for GitHub identity linking
  - tRPC API surface used by frontend
  - queue + worker pipeline for prompt-stake jobs
  - onchain stake/resolve orchestration
  - health checks for Postgres, Redis, GitHub, and Base RPC
- Smart contracts (`contract`) for:
  - stake lifecycle (`ACTIVE`, `CLEAN`, `SLASHED`)
  - treasury-subsidized yield payouts
  - slash distribution and oracle-driven settlement

## Official Deployments

- Backend API: `https://backend-uuq8.onrender.com`
- Chain: Base Mainnet
- GitLedger contract: `0x0eCc198f69Bb0334A73250BC672FD157E13A87cc`
- GitLedger EAS attestor: `0x8D921d9329B810238566b88E7C0311f75B4373e3`
- EAS schema UID: `0xa2236010ddea87b84147ee9dabcbf77d898fc3c575dfd7db8a2ae082a0d2e6be`

## Monorepo Structure

- `app/`, `components/`: Next.js frontend
- `backend/`: Bun + Hono + tRPC backend
- `contract/`: Solidity contracts, tests, and scripts
- `.github/workflows/backend-cicd.yml`: backend CI/CD

## How To Run

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

### Contracts

```bash
cd contract
npm install
npm test
```

## Backend Environment

Use `backend/.env.example` as the source template. Core required runtime fields include:

- `DATABASE_URL`, `REDIS_URL`
- `BASE_RPC_URL`, `SIGNER_PRIVATE_KEY`
- `GITLEDGER_CONTRACT`, `EAS_CONTRACT_BASE`, `EAS_SCHEMA_UID`, `TREASURY_ADDRESS`
- `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_URL`, `GITHUB_TOKEN`
- `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`, `SESSION_SECRET`
- `INTERNAL_API_TOKEN`
- `NOTIFIER_WEBHOOK_URL`, `NOTIFIER_WEBHOOK_AUTH_TOKEN` (for prompt-stake notification receiver)

## Contract Operations

### Register EAS schema

Schema string:

`bytes32 stakeId, address reviewer, string status, bytes32 prHash`

### Deploy

```bash
cd contract
set -a; source .env; set +a
npx hardhat run script/deploy.js --network base
```

### Fund yield pool

Fund from the configured `treasuryManager` wallet via contract function call.
Do not direct-transfer USDC to the contract for pool accounting.

```bash
cd contract
set -a; source .env; set +a
GITLEDGER_ADDRESS=0x0eCc198f69Bb0334A73250BC672FD157E13A87cc AMOUNT_USDC=3.5 npx hardhat run script/fundYieldPool.js --network base
```

## CI/CD

Workflow: `.github/workflows/backend-cicd.yml`

Jobs:

1. `test` - install deps, typecheck, unit/integration tests
2. `build` - build and push backend image to GHCR
3. `release` - create tag and GitHub release
4. `deploy` - trigger Render hook when configured

## Current Status

- Backend: deployed and healthy
- Contract: deployed on Base Mainnet

## License

MIT
