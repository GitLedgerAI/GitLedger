# GitLedger Frontend Integration Guide

## Backend Base URLs
- Staging/current: `https://backend-uuq8.onrender.com`
- Production target: `https://api.gitledger.tech`

Use a single env var in frontend:

```env
NEXT_PUBLIC_API_BASE_URL=https://backend-uuq8.onrender.com
```

Switch to `https://api.gitledger.tech` for production.

## API Surface

### tRPC endpoint
- HTTP endpoint: `/trpc/*`
- Example: `POST https://backend-uuq8.onrender.com/trpc/reviewer.getLeaderboard`

### REST endpoints
- `GET /health`
- `POST /webhooks/github` (GitHub App only)
- Internal ops (Bearer `INTERNAL_API_TOKEN`):
  - `GET /internal/prompt-stake-jobs`
  - `POST /internal/stakes/activate`
  - `POST /internal/stakes/confirm`

## Auth Model for Frontend

For protected tRPC procedures, send headers:
- `x-wallet-address`: connected wallet address (lowercase recommended)
- `x-user-role`: `reviewer` (default), `admin`, or `internal`

Current role usage:
- `stake.getMyStakes` requires auth; non-admin can only query own address
- `stake.submit` requires auth and basename consistency check
- public routes are open for now (`reviewer.*`, `repo.*`, `feed.getLive`, `stake.getPrDetails`)

## tRPC Procedure Mapping

### reviewer router
- `reviewer.getByBasename({ basename })`
- `reviewer.getLeaderboard({ sort?, lang?, search? })`
- `reviewer.getAttestations({ basename, verdict? })`

### stake router
- `stake.getMyStakes({ address })` (protected)
- `stake.getPrDetails({ repoSlug, prId })`
- `stake.submit({ basename, repoSlug, prId, amountUsdc, stakeId })` (protected)

### repo router
- `repo.getBySlug({ slug })`
- `repo.getAttestations({ slug, verdict? })`

### feed router
- `feed.getLive()`

## Expected stake.submit flow

Frontend should call `stake.submit` after wallet-auth context is established.

Input:
- `basename`
- `repoSlug`
- `prId`
- `amountUsdc` (micro USDC, 6 decimals)
- `stakeId` (pending stake id from backend workflow)

Output:
- `{ txHash, attestationUid }`

## What is ready vs pending

Ready:
- Core tRPC routes wired to DB-backed queries/mutations
- Webhook ingestion and queueing flow
- Onchain submit pipeline skeleton with DB activation
- Internal ops endpoints for queue/stake workflows

Pending (contract/oracle finalization phase):
- Final slash/release reconciliation and full oracle lifecycle
- Strong signature-based auth for high-risk mutations (currently wallet header + reviewer existence)
- Final schema/response tuning as contract settles

## Frontend Integration Steps

1. Replace mock data calls with tRPC hooks in your pages.
2. Configure tRPC client base URL from `NEXT_PUBLIC_API_BASE_URL`.
3. Attach `x-wallet-address` and `x-user-role` in tRPC headers for protected calls.
4. For dashboard stake history, call `stake.getMyStakes` with connected wallet address.
5. For stake flow page, use `stake.getPrDetails` then `stake.submit`.

## Minimal header setup example

```ts
headers() {
  return {
    'x-wallet-address': walletAddress?.toLowerCase() ?? '',
    'x-user-role': 'reviewer',
  };
}
```

## Notes
- All monetary values are currently handled as micro USDC integers.
- Keep verdict filters aligned with: `ALL | ACTIVE | CLEAN | SLASHED`.
