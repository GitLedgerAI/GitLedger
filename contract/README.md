# GitLedger — Smart Contract Package

Solidity smart contracts for **GitLedger**: a protocol that lets reviewers stake USDC on Base when approving PRs. A backend oracle settles stakes as CLEAN (window elapsed without incident) or SLASHED (bad outcome within window). On-chain lifecycle is tracked as EAS attestations.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                       GitLedger.sol                        │
│                                                            │
│  stakeReview()  ──→  ACTIVE  ──→  slashReview()           │
│                         │                  │               │
│                         └──────────────────→  SLASHED      │
│                         └──→  releaseYield()  ──→  CLEAN   │
│                                                            │
│  yieldPoolBalance (funded by treasuryManager)              │
│  stakeEscrow[stakeId] (reviewer principal)                 │
└────────────────────────────────────────────────────────────┘
         │ EAS attestation per state transition
         ▼
  GitLedgerEASAttestor.sol  ──→  EAS (Base mainnet)
```

### Economic model — Treasury-subsidy yield

| Path   | Principal source | Yield source         | Who receives          |
|--------|-----------------|---------------------|-----------------------|
| CLEAN  | `stakeEscrow`   | `yieldPoolBalance`  | reviewer              |
| SLASH  | `stakeEscrow`   | —                   | reporter + treasury   |

Yield formula (simple interest, annualised):

    yield = principal × yieldBps × elapsed / (10_000 × 365 days)

If `yieldPoolBalance < computed yield`, `releaseYield` **reverts** — no partial payments.

---

## Contracts

| File | Description |
|------|-------------|
| `src/GitLedger.sol` | Main protocol contract |
| `src/IEASAttestor.sol` | Interface between GitLedger and EAS |
| `src/GitLedgerEASAttestor.sol` | Concrete EAS wrapper (production) |
| `src/test/MockUSDC.sol` | Test double — 6-decimal mintable ERC-20 |
| `src/test/MockEASAttestor.sol` | Test double — tracks attestation lifecycle |
| `src/test/MaliciousToken.sol` | Test double — reentrancy attack vector |

### EAS schema

    bytes32 stakeId, address reviewer, string status, bytes32 prHash

Status values: `"ACTIVE"` → `"CLEAN"` or `"SLASHED"`

---

## Access control

| Role | Address | Powers |
|------|---------|--------|
| `owner` | Deployer (Ownable) | Set oracle, treasuryManager, treasury, config |
| `oracle` | Backend oracle EOA | `slashReview`, `releaseYield` |
| `treasuryManager` | Treasury multisig | `fundYieldPool` |

---

## Setup

### Prerequisites

- Node.js ≥ 18
- npm

Note: Hardhat tests in this package are written for Solidity `0.8.24`.

### Install

```bash
cd contract
npm install
```

### Compile

```bash
npx hardhat compile
```

### Test (65 tests, all passing)

```bash
npx hardhat test
```

---

## Deploy

### Environment variables

```bash
export DEPLOYER_PRIVATE_KEY=0x...
export ORACLE_ADDRESS=0x...
export TREASURY_MANAGER=0x...
export TREASURY=0x...
export BASE_SEPOLIA_RPC_URL=https://...
export EAS_SCHEMA_UID=0x...
export BASESCAN_API_KEY=...
```

### Deploy to Base Sepolia

```bash
npx hardhat run script/deploy.js --network base-sepolia
```

### Deploy to Base Mainnet

```bash
npx hardhat run script/deploy.js --network base
```

The deploy script:
1. Deploys `GitLedgerEASAttestor`
2. Deploys `GitLedger`
3. Wires `attestor.setGitLedger(gitLedgerAddress)`

### Verify on Basescan

```bash
npx hardhat verify --network base-sepolia <GITLEDGER_ADDR> \
  "<USDC>" "<ATTESTOR_ADDR>" "<ORACLE>" "<TREASURY_MGR>" "<TREASURY>" "<OWNER>"
```

---

## Fund the yield pool

```bash
GITLEDGER_ADDRESS=0x... AMOUNT_USDC=1000 \
npx hardhat run script/fundYieldPool.js --network base-sepolia
```

The treasury manager must have pre-approved the GitLedger contract to spend USDC.

---

## EAS schema registration

Register the schema on Base via the EAS schema registry before deploying to mainnet:

- Schema: `bytes32 stakeId, address reviewer, string status, bytes32 prHash`
- Resolver: `address(0)`
- Revocable: `true`

Pass the returned `schemaUID` as `EAS_SCHEMA_UID` during deployment.

**EAS addresses on Base:**
- EAS contract: `0x4200000000000000000000000000000000000021`
- Schema registry: `0x4200000000000000000000000000000000000020`

---

## Backend oracle integration

The oracle calls:

```solidity
// Slash (within window)
gitLedger.slashReview(stakeId, reporterAddress, easSchemaData);

// Release (after window)
gitLedger.releaseYield(stakeId, easSchemaData);
```

`easSchemaData` is ABI-encoded using the attestor's helpers:

```solidity
bytes memory data = attestor.encodeSlashed(stakeId, reviewer, prHash);
bytes memory data = attestor.encodeClean(stakeId, reviewer, prHash);
```

---

## Test coverage summary

| Group | Tests |
|-------|-------|
| Deployment & config | 3 |
| `stakeReview` | 11 |
| `slashReview` | 13 |
| `releaseYield` | 16 |
| `fundYieldPool` | 6 |
| Access control | 8 |
| Balance invariants | 1 |
| `previewYield` | 2 |
| EAS lifecycle | 3 |
| Reentrancy | 1 |
| Concurrent stakes | 1 |
| **Total** | **65** |

---

## Invariants enforced

1. `stakeEscrow[id] + yieldPoolBalance == usdc.balanceOf(address(this))` at all times.
2. A stake may only be settled once — `ACTIVE → CLEAN` or `ACTIVE → SLASHED`, never back.
3. `releaseYield` reverts with `InsufficientYieldPool(required, available)` if the pool can't cover the yield. No partial payments.
4. Slash never touches `yieldPoolBalance`.
5. `slashReview` may only execute within the settlement window.
6. `releaseYield` may only execute after the settlement window closes.
