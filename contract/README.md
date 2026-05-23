# GitLedger Contract

Foundry implementation for GitLedger staking, slash, and yield-release logic.

## Run

1. Install Foundry
2. `forge test`
3. `forge script script/DeployGitLedger.s.sol --broadcast --rpc-url base_sepolia`

## Current scope

- `GitLedger.sol` includes:
  - `stakeReview` (locks USDC, records stake, mints ACTIVE attestation)
  - `slashReview` (oracle-only, reporter/treasury split, SLASHED attestation)
  - `releaseYield` (oracle-only, post-window payout, CLEAN attestation)
- Attestation payload is now schema-aligned with explicit structured fields.
- Tests cover state transitions, oracle authorization, window gating, and transfer-failure handling.
