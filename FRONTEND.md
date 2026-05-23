# GitLedger Frontend Integration Guide

## Backend Base URLs
- Staging/current: `https://backend-uuq8.onrender.com`
- Production target: `https://api.gitledger.tech`

Use frontend env:
```env
NEXT_PUBLIC_API_BASE_URL=https://backend-uuq8.onrender.com
```
Switch to `https://api.gitledger.tech` in production.

## tRPC Endpoint
- `/trpc/*`
- Example: `POST https://backend-uuq8.onrender.com/trpc/reviewer.getLeaderboard`

## Auth Model (finalized)

### Reviewer auth (frontend-facing)
- Send header: `x-wallet-address: <wallet>` (lowercase)
- Backend resolves role as `reviewer` from wallet presence.
- Reviewer must exist in DB for protected procedures.

### Privileged auth (backend/internal only)
- `Authorization: Bearer <ADMIN_API_TOKEN | INTERNAL_SERVICE_TOKEN>`
- Role is derived server-side from token.
- Frontend should not use privileged tokens.

### Important
- `x-user-role` is not trusted for elevation.
- Role is always server-derived.

## Procedure Map

### reviewer
- `reviewer.getByBasename({ basename })` public
- `reviewer.getLeaderboard({ sort?, lang?, search? })` public
- `reviewer.getAttestations({ basename, verdict? })` public

### stake
- `stake.getMyStakes({ address })` protected
  - reviewer can fetch only own address
  - admin/internal can fetch any
- `stake.getPrDetails({ repoSlug, prId })` public
- `stake.submit({ basename, repoSlug, prId, amountUsdc, stakeId })` protected

### repo
- `repo.getBySlug({ slug })` public
- `repo.getAttestations({ slug, verdict? })` public

### feed
- `feed.getLive()` public

### admin (not for frontend clients)
- `admin.listPromptStakeJobs(...)` privileged

## REST Endpoints
- `GET /health`
- `POST /webhooks/github` (GitHub App)

Internal only:
- `GET /internal/prompt-stake-jobs`
- `POST /internal/stakes/activate`
- `POST /internal/stakes/confirm`

## Frontend Header Example
```ts
headers() {
  return {
    'x-wallet-address': walletAddress?.toLowerCase() ?? '',
  };
}
```

## Notes
- Amount fields are micro-USDC integers (6 decimals).
- Verdict filter values: `ALL | ACTIVE | CLEAN | SLASHED`.
