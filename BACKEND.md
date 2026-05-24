# CODELEDGER — Backend Developer Handoff

> **BUILD DOCUMENT v0.1-ALPHA · May 2026**
> Frontend is complete. This document specifies everything the backend must expose.

---

## Overview

The backend has four moving parts:

1. **API server** — Bun + tRPC + Drizzle, exposes typed RPC endpoints to the Next.js frontend
2. **GitHub App** — Webhook server that intercepts PR review events and triggers the stake flow
3. **Chainlink Functions oracle** — Monitors merged PRs for 30-day hotfix detection
4. **Smart contract bridge** — Receives Chainlink results and executes slash / yield release

The frontend currently runs on **mock data** in `lib/mock-data.ts`. Every mock export maps 1:1 to a tRPC procedure. Replacing the mock import with the tRPC hook is all the frontend dev needs to do.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| API framework | tRPC v11 |
| ORM | Drizzle ORM |
| DB | PostgreSQL (Neon or Supabase) |
| Auth | Dynamic.xyz (JWT validation) |
| Onchain reads | Viem v2 (Base L2, chainId 8453) |
| Onchain writes | Coinbase CDP Agentic Wallet SDK |
| Oracle | Chainlink Functions on Base |
| Attestations | EAS SDK (`@ethereum-attestation-service/eas-sdk`) |
| GitHub integration | Octokit + GitHub App (webhooks) |

---

## Database Schema

```sql
-- Reviewer profile (synced from on-chain + GitHub)
CREATE TABLE reviewers (
  address          TEXT PRIMARY KEY,  -- 0x...
  basename         TEXT UNIQUE,       -- alice.base.eth
  github_login     TEXT UNIQUE,
  reputation_score INTEGER DEFAULT 500,
  total_staked     BIGINT  DEFAULT 0, -- micro USDC (6 dec)
  total_yield      BIGINT  DEFAULT 0,
  total_slashed    BIGINT  DEFAULT 0,
  clean_count      INTEGER DEFAULT 0,
  slash_count      INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- On-chain attestation record (EAS)
CREATE TABLE attestations (
  uid              TEXT PRIMARY KEY,  -- EAS attestation UID (0x...)
  basename         TEXT REFERENCES reviewers(basename),
  reviewer_address TEXT,
  repo_slug        TEXT,              -- "owner/repo"
  pr_id            INTEGER,
  pr_title         TEXT,
  stake_amount     BIGINT,            -- micro USDC
  verdict          TEXT CHECK (verdict IN ('ACTIVE','CLEAN','SLASHED')),
  reviewed_at      TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  reputation_delta INTEGER DEFAULT 0,
  repo_languages   TEXT[],
  tx_hash          TEXT
);

-- Active stake window (mutable, mirrors on-chain escrow)
CREATE TABLE stakes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id         TEXT UNIQUE,       -- on-chain ID
  reviewer_addr    TEXT,
  repo_slug        TEXT,
  pr_id            INTEGER,
  pr_title         TEXT,
  amount_usdc      BIGINT,
  state            TEXT CHECK (state IN ('active','clean','slashed')),
  attestation_uid  TEXT REFERENCES attestations(uid),
  yield_earned     BIGINT DEFAULT 0,
  window_ends_at   TIMESTAMPTZ,
  staked_at        TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ
);

-- Repository trust profile
CREATE TABLE repos (
  slug             TEXT PRIMARY KEY,  -- "owner/repo"
  name             TEXT,
  owner            TEXT,
  language         TEXT,
  stars            INTEGER,
  trust_score      INTEGER DEFAULT 100,
  total_staked     BIGINT  DEFAULT 0,
  review_count     INTEGER DEFAULT 0,
  total_reviews    INTEGER DEFAULT 0,
  active_reviews   INTEGER DEFAULT 0,
  slash_count      INTEGER DEFAULT 0,
  slash_rate       NUMERIC(5,4) DEFAULT 0
);
```

---

## tRPC Router Contract

The frontend expects these procedures. Match the exact output shapes.

### `reviewer` router

```typescript
// GET /trpc/reviewer.getByBasename
// Input: { basename: string }
// Output: Reviewer | null
reviewer.getByBasename

// GET /trpc/reviewer.getLeaderboard
// Input: { sort?: 'score'|'yield'|'accuracy'|'stakes', lang?: string, search?: string }
// Output: LeaderboardEntry[]
reviewer.getLeaderboard

// GET /trpc/reviewer.getAttestations
// Input: { basename: string, verdict?: 'ALL'|'ACTIVE'|'CLEAN'|'SLASHED' }
// Output: Attestation[]
reviewer.getAttestations
```

### `stake` router

```typescript
// GET /trpc/stake.getMyStakes
// Input: { address: string }
// Output: Stake[]
stake.getMyStakes

// GET /trpc/stake.getPrDetails
// Input: { repoSlug: string, prId: number }
// Output: PrDetails
stake.getPrDetails

// MUTATION /trpc/stake.submit
// Input: { basename: string, repoSlug: string, prId: number, amountUsdc: number }
// Output: { txHash: string, attestationUid: string }
// Side effects: calls CodeLedger.sol stakeReview(), mints EAS attestation
stake.submit
```

### `repo` router

```typescript
// GET /trpc/repo.getBySlug
// Input: { slug: string }
// Output: Repo
repo.getBySlug

// GET /trpc/repo.getAttestations
// Input: { slug: string, verdict?: 'ALL'|'ACTIVE'|'CLEAN'|'SLASHED' }
// Output: Attestation[]
repo.getAttestations
```

### `feed` router

```typescript
// GET /trpc/feed.getLive
// Input: none
// Output: LiveFeedItem[]  -- see types below
feed.getLive
```

---

## TypeScript Types (shared with frontend)

These are already defined in `lib/types.ts` on the frontend. The backend should expose the same types via a shared package or copy.

```typescript
type Verdict = 'ACTIVE' | 'CLEAN' | 'SLASHED';
type StakeState = 'active' | 'clean' | 'slashed';

interface Reviewer {
  address: string;
  basename: string;
  githubLogin: string;
  reputationScore: number;       // 0–1000
  totalStakedUsdc: number;       // micro USDC
  totalYieldUsdc: number;
  totalSlashedUsdc: number;
  cleanCount: number;
  slashCount: number;
  languages: string[];
  lastActiveAt: string;          // ISO
  createdAt: string;
  percentile?: number;
  accuracyRate?: number;         // 0.0–1.0
}

interface Attestation {
  uid: string;
  basename: string;
  reviewerAddress: string;
  repoSlug: string;
  prId: number;
  prTitle: string;
  stakeAmount: number;           // micro USDC
  verdict: Verdict;
  reviewedAt: string;
  resolvedAt?: string;
  reputationDelta: number;
  repoLanguages: string[];
  txHash: string;
}

interface LiveFeedItem {
  basename: string;
  repoSlug: string;
  prId: number;
  verdict: Verdict;
  stakeAmount: number;           // micro USDC
  timestamp: string;             // ISO
}
```

---

## GitHub App Webhook Handler

**Event:** `pull_request_review` (action: `submitted`, state: `approved`)

```
POST /webhooks/github

1. Verify X-Hub-Signature-256 header (GITHUB_WEBHOOK_SECRET)
2. Extract: reviewer login, repo full_name, PR number, PR title
3. Look up reviewer's Basename via Dynamic.xyz user record or on-chain reverse lookup
4. Look up reviewer's address from Basename registry (Base L2)
5. Call tRPC stake.getPrDetails to return PR metadata to frontend
6. Frontend initiates stake.submit — backend receives and executes:
   a. Call CodeLedger.sol stakeReview(basename, repoSlug, prId, amount) via CDP Agentic Wallet
   b. Mint EAS attestation on Base:
      - Schema UID: NEXT_PUBLIC_EAS_SCHEMA_UID
      - Fields: basename, repoSlug, prId, stakeAmount (6-dec), verdict="ACTIVE", windowEnds
   c. Write attestation record to DB
   d. Start 30-day Chainlink Functions subscription for this PR
```

---

## Chainlink Functions Oracle

**Trigger:** Called at stake time and every ~24h for active windows

**JS source (runs off-chain inside Chainlink DON):**
```javascript
// Check if a hotfix PR targeting the merged commit exists
const [owner, repo] = args[0].split('/');
const prId = parseInt(args[1]);
const mergedSha = args[2];

const resp = await Functions.makeHttpRequest({
  url: `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated`,
  headers: { Authorization: `token ${secrets.GITHUB_TOKEN}` },
});

const hotfix = resp.data.find(pr =>
  pr.base.sha === mergedSha &&
  pr.title.match(/hotfix|fix|patch/i) &&
  pr.merged_at !== null
);

return Functions.encodeUint256(hotfix ? 1 : 0);  // 1 = slash, 0 = clean
```

**On-chain callback (`fulfillRequest`):**
```solidity
function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
  uint256 result = abi.decode(response, (uint256));
  StakeRecord storage stake = stakes[requestIdToStakeId[requestId]];
  if (result == 1) {
    _slash(stake);        // transfer USDC to slash treasury
  } else if (block.timestamp >= stake.windowEndsAt) {
    _releaseYield(stake); // return principal + yield to reviewer
  }
}
```

---

## Smart Contract Interface (`CodeLedger.sol`)

**Chain:** Base L2, chainId 8453

```solidity
interface ICodeLedger {
  // Called by backend when reviewer submits stake
  function stakeReview(
    string calldata basename,
    string calldata repoSlug,
    uint256 prId,
    uint256 amountUsdc  // 6-decimal USDC
  ) external returns (bytes32 stakeId);

  // Called by Chainlink oracle on hotfix detection
  function slash(bytes32 stakeId) external;

  // Called by Chainlink oracle on clean window close
  function releaseYield(bytes32 stakeId) external;

  // View
  function getStake(bytes32 stakeId) external view returns (StakeRecord memory);
}
```

**USDC contract on Base:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

---

## Auth Architecture

The frontend uses **wagmi v2 direct** (no Dynamic.xyz) for wallet connection, plus a custom GitHub OAuth flow.

### Wallet connection
The user connects any ETH-compatible EVM wallet (MetaMask, Rabby, Coinbase Wallet, etc.) via the browser. The wallet address is the signing identity — no SDK required on the backend to verify wallet ownership; signatures are verified on-chain.

### GitHub OAuth flow

```
1. Frontend redirects to:
   GET /auth/github?wallet=0x...&callback=https://app.com/auth/callback

2. Backend initiates GitHub OAuth (standard OAuth 2.0 code flow)
   - Scope required: read:user (username only)
   - State param: encode wallet address for CSRF protection

3. GitHub redirects to your callback:
   GET /auth/github/callback?code=...&state=...

4. Backend exchanges code for token, fetches GitHub user
5. Looks up Basename for wallet address via Base L2 reverse lookup (optional)
6. Upserts reviewer record in DB: { address, github_login, basename }
7. Redirects to frontend callback:
   GET https://app.com/auth/callback
     ?wallet=0x...
     &github_login=alice_dev
     &basename=alice.base.eth   ← omit if not found
```

The frontend (`app/auth/callback/page.tsx`) reads these params and stores the session in `localStorage`. No JWT needed — the wallet address is the auth key for all subsequent tRPC calls.

### Identity resolution priority
1. **Basename** (`alice.base.eth`) — resolved from Base L2 Basename registry
2. **GitHub login** (`@alice_dev`) — from GitHub OAuth
3. **Wallet address** (`0x1234…abcd`) — always available as fallback

### Protecting tRPC mutations
Pass the wallet address in the request header and verify with a signed message:

```typescript
async function requireAuth(ctx: Context) {
  const wallet = ctx.req.headers['x-wallet-address'] as string;
  if (!wallet) throw new TRPCError({ code: 'UNAUTHORIZED' });
  // Verify the wallet owns a reviewer record
  const reviewer = await db.query.reviewers.findFirst({
    where: eq(reviewers.address, wallet.toLowerCase()),
  });
  if (!reviewer) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return reviewer;
}
```

For higher-security mutations (stake.submit), require a signed message from the wallet as a bearer token instead.

---

## Reputation Score Formula

```
INITIAL_SCORE = 500

on CLEAN resolution:
  delta = +10 (base)
  if score >= 700: delta = +7   (diminishing returns at top)
  if stakeAmount >= 1_000_000_000 (>= $1000): delta += 3

on SLASH:
  delta = -50
  new_score = max(0, score + delta)

score = clamp(0, 1000)
```

Score > 700 activates the **1.5× yield multiplier** on all future clean windows.

---

## Yield Calculation

```
APY = 18%  (18% per year from USDC lending protocol, e.g. Morpho on Base)
yield = principal * APY * (days_elapsed / 365)

Example: $500 staked, 30-day window
  = 500 * 0.18 * (30/365)
  = $7.40 USDC
```

---

## x402 Paywall (optional, Day 5+)

The reviewer profile page at `/reviewer/[basename]` can gate detailed attestation history behind an x402 micropayment.

**Flow:**
1. Frontend issues `GET /api/reviewer/:basename/attestations`
2. Backend returns `402 Payment Required` with `X-Payment-Offer` header (amount in USDC, payment address)
3. Frontend uses CDP Wallet to sign and send micropayment
4. Backend verifies payment on-chain, returns full attestation history

---

## Environment Variables

```env
# Database
DATABASE_URL=postgres://...

# Auth (GitHub OAuth)
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
SESSION_SECRET=...               # for CSRF state param

# GitHub App
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_WEBHOOK_SECRET=...
GITHUB_TOKEN=ghp_...           # for Chainlink Functions oracle

# Coinbase CDP
CDP_API_KEY_NAME=...
CDP_API_KEY_PRIVATE_KEY=...
CODELEDGER_CONTRACT=0x...      # CodeLedger.sol on Base

# Chainlink
CHAINLINK_SUBSCRIPTION_ID=...
CHAINLINK_DON_ID=fun-base-mainnet-1
CHAINLINK_ROUTER=0xf9B8fc078197181C841c296C876945aaa425B278  # Base mainnet

# EAS
EAS_CONTRACT=0xC2679fBD37d54388Ce493F1DB75320D236e1815e  # Base mainnet
EAS_SCHEMA_UID=0x...

# Base L2
BASE_RPC_URL=https://mainnet.base.org
CHAIN_ID=8453
```

---

## Recommended Dev Order

| Day | Task |
|-----|------|
| 1 | Drizzle schema + migrations, Bun server bootstrap, tRPC scaffold |
| 2 | GitHub App install + webhook handler (review event → DB write) |
| 3 | CDP Agentic Wallet integration + `stakeReview` contract call |
| 4 | EAS attestation minting on stake submit |
| 5 | Chainlink Functions subscription — hotfix detection JS source |
| 6 | Slash / yield release callbacks + reputation score updates |
| 7 | GitHub OAuth endpoints (/auth/github, /auth/github/callback), connect all tRPC procedures to DB |
| 8 | x402 micropayment gate (optional) |

---

## Frontend ↔ Backend Integration Checklist

When you're ready to connect the frontend, replace imports in these files:

| Frontend file | Mock export to replace | tRPC procedure |
|---|---|---|
| `app/explore/page.tsx` | `MOCK_LEADERBOARD` | `reviewer.getLeaderboard` |
| `app/reviewer/[basename]/page.tsx` | `getReviewerByBasename`, `getAttestationsByBasename` | `reviewer.getByBasename`, `reviewer.getAttestations` |
| `app/dashboard/page.tsx` | `MOCK_MY_STAKES`, `MOCK_REVIEWERS[0]` | `stake.getMyStakes`, `reviewer.getByBasename` (authed) |
| `app/dashboard/stake/[prId]/page.tsx` | `MOCK_PR`, `MOCK_REVIEWERS[0]` | `stake.getPrDetails`, reviewer from auth context |
| `app/repo/[slug]/page.tsx` | `getRepoBySlug`, `getAttestationsByRepo` | `repo.getBySlug`, `repo.getAttestations` |
| `app/page.tsx` | `MOCK_LIVE_FEED` | `feed.getLive` |

---

*Questions? Check `CLAUDE.md` for project overview and design system, or `lib/types.ts` for all shared TypeScript interfaces.*
