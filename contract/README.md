# GitLedger Contract

Foundry scaffold for the GitLedger staking and attestation protocol.

## Run

1. Install Foundry.
2. `forge test`
3. `forge script script/DeployGitLedger.s.sol --broadcast --rpc-url base_sepolia`

## Current scope

- `GitLedger.sol` includes stake, slash, release flow and reputation updates.
- EAS payload is currently a placeholder `abi.encode` payload.
- Replace `_buildAttestationPayload` with strict EAS schema encoder integration in next pass.
