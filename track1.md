# TRACK 1 — Enterprise Compliance Layer · Backend Handoff

> **BUILD DOCUMENT — Week 5 · May 2026**
> Frontend is complete and live at `/enterprise/*`. This document specifies every
> route, contract, table, env var, and worker the backend dev must ship to make
> Track 1 work end-to-end.
>
> Until the backend lands, the frontend runs on `lib/enterprise-mock.ts` via
> `withMock()` in `lib/enterprise-hooks.ts` — every hook silently falls back to
> mock data on HTTP error, so the UI is usable today. Replace nothing on the
> frontend when you ship; just expose the routes below and the mock fallbacks
> will stop firing.

---

## 1 · Scope

Track 1 adds **four buyer-facing capabilities** to GitLedger:

| Capability         | Frontend route               | What the backend must do                                                      |
|--------------------|------------------------------|-------------------------------------------------------------------------------|
| Compliance API     | `/enterprise/compliance`     | Aggregate EAS attestations into SOC2-ready metrics + 30-day coverage series   |
| Policy Engine      | `/enterprise/policy`         | CRUD per-org path-scoped review rules, enforce onchain via `CompliancePolicy` |
| Audit Export       | `/enterprise/audit`          | Generate signed PDF / JSON / CSV exports of any time window                   |
| SIEM Forwarding    | `/enterprise/siem`           | Stream `stake.locked` / `review.slashed` / `policy.violation` to webhooks     |
| Onboarding         | `/enterprise/onboarding`     | GitHub Enterprise SAML OAuth + SCIM v2 provisioning                           |

All revenue mechanics:

- **Starter**: $29 / mo (5 repos, basic dashboard)
- **Pro**: $79 / mo (unlimited repos, Compliance API, Vanta/Drata webhook)
- **Enterprise**: $299 / mo (SOC2 export, policy engine, SAML SSO, SIEM webhook, SLA)
- **Audit API**: $0.10 / call (per-attestation SOC2 fetch — for audit firms)

Subscription billing is handled via Coinbase CDP USDC charges to the org owner's
Agentic Wallet on Base. Hold ≥ 10,000 LEDGER (Track 4) → Enterprise unlocked free.

---

## 2 · Tech Stack (continuity with existing backend)

Same stack as `BACKEND.md`. New additions for Track 1:

| Concern              | Tool / Library                                                |
|----------------------|---------------------------------------------------------------|
| PDF generation       | `pdfkit` or `@react-pdf/renderer` (server-side)               |
| Object storage       | Cloudflare R2 or S3-compatible bucket for audit PDFs          |
| SAML                 | `@node-saml/node-saml` for GitHub Enterprise SSO              |
| SCIM v2              | Implement RFC 7644 endpoints behind a bearer token            |
| HMAC signing         | `crypto.createHmac('sha256', secret)` for SIEM payload sigs   |
| Outbound webhooks    | `undici` + retry queue (BullMQ on Redis, 5x exponential)      |
| Path glob matching   | `picomatch` for `pathPattern` evaluation                      |

---

## 3 · New Database Tables (Drizzle)

Add to your Drizzle schema. All tables are tenant-scoped by `org_slug`.

```ts
// enterprise_orgs — one row per paying enterprise customer
export const enterpriseOrgs = pgTable('enterprise_orgs', {
  orgSlug:              text('org_slug').primaryKey(),         // lower-kebab, stable
  displayName:          text('display_name').notNull(),
  tier:                 text('tier').notNull(),                // 'starter' | 'pro' | 'enterprise'
  ownerAddress:         text('owner_address').notNull(),       // 0x... — pays the subscription
  githubEnterpriseHost: text('github_enterprise_host'),        // null until OAuth completes
  samlEnabled:          boolean('saml_enabled').default(false),
  scimEnabled:          boolean('scim_enabled').default(false),
  scimBearerHash:       text('scim_bearer_hash'),              // bcrypt(scimToken) — token shown once
  memberCount:          integer('member_count').default(0),
  repoCount:            integer('repo_count').default(0),
  createdAt:            timestamp('created_at').defaultNow(),
});

// enterprise_policies — path-scoped review rules per org
export const enterprisePolicies = pgTable('enterprise_policies', {
  id:               uuid('id').primaryKey().defaultRandom(),
  orgSlug:          text('org_slug').notNull().references(() => enterpriseOrgs.orgSlug, { onDelete: 'cascade' }),
  pathPattern:      text('path_pattern').notNull(),            // 'contracts/**'
  minStakeUsdc:     bigint('min_stake_usdc', { mode: 'number' }).notNull(),  // 6-decimal USDC
  minReviewers:     integer('min_reviewers').notNull().default(1),
  requireCbVerify:  boolean('require_cb_verify').notNull().default(false),
  createdAt:        timestamp('created_at').defaultNow(),
}, (t) => ({
  byOrg: index('enterprise_policies_org_idx').on(t.orgSlug),
}));

// enterprise_org_members — maps wallet/Basename to org role
export const enterpriseOrgMembers = pgTable('enterprise_org_members', {
  id:        uuid('id').primaryKey().defaultRandom(),
  orgSlug:   text('org_slug').notNull().references(() => enterpriseOrgs.orgSlug, { onDelete: 'cascade' }),
  address:   text('address').notNull(),                        // wallet
  role:      text('role').notNull(),                           // 'owner' | 'admin' | 'auditor' | 'member'
  scimExternalId: text('scim_external_id'),                    // IdP user id
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  byOrgAddress: uniqueIndex('enterprise_members_org_addr_idx').on(t.orgSlug, t.address),
}));

// enterprise_siem_configs — outbound webhook configs per org
export const enterpriseSiemConfigs = pgTable('enterprise_siem_configs', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  orgSlug:            text('org_slug').notNull().references(() => enterpriseOrgs.orgSlug, { onDelete: 'cascade' }),
  kind:               text('kind').notNull(),                  // 'splunk'|'datadog'|'vanta'|'drata'|'secureframe'|'custom'
  label:              text('label').notNull(),
  endpointUrl:        text('endpoint_url').notNull(),
  endpointSecret:     text('endpoint_secret').notNull(),       // generated; used for HMAC; never returned via API
  events:             text('events').array().notNull(),        // ['stake.locked','review.clean','review.slashed','policy.violation']
  enabled:            boolean('enabled').notNull().default(true),
  lastDeliveredAt:    timestamp('last_delivered_at'),
  lastDeliveryStatus: text('last_delivery_status'),            // 'ok' | 'failed'
  lastDeliveryError:  text('last_delivery_error'),
  createdAt:          timestamp('created_at').defaultNow(),
}, (t) => ({
  byOrg: index('enterprise_siem_org_idx').on(t.orgSlug),
}));

// enterprise_audit_jobs — record of every audit export request
export const enterpriseAuditJobs = pgTable('enterprise_audit_jobs', {
  id:                uuid('id').primaryKey().defaultRandom(),
  orgSlug:           text('org_slug').notNull().references(() => enterpriseOrgs.orgSlug, { onDelete: 'cascade' }),
  format:            text('format').notNull(),                 // 'pdf' | 'json' | 'csv'
  dateFrom:          date('date_from').notNull(),
  dateTo:            date('date_to').notNull(),
  attestationCount:  integer('attestation_count').notNull().default(0),
  status:            text('status').notNull().default('queued'), // 'queued'|'running'|'ready'|'failed'
  downloadUrl:       text('download_url'),                     // R2/S3 signed URL
  signedBy:          text('signed_by'),                        // contract address used for signature
  signature:         text('signature'),                        // 0x... EIP-191 over content hash
  contentHash:       text('content_hash'),                     // sha256 of the export bytes
  generatedAt:       timestamp('generated_at'),
  createdAt:         timestamp('created_at').defaultNow(),
}, (t) => ({
  byOrg: index('enterprise_audit_org_idx').on(t.orgSlug),
}));

// enterprise_events — append-only timeline for compliance dashboard
export const enterpriseEvents = pgTable('enterprise_events', {
  id:             uuid('id').primaryKey().defaultRandom(),
  orgSlug:        text('org_slug').notNull().references(() => enterpriseOrgs.orgSlug, { onDelete: 'cascade' }),
  kind:           text('kind').notNull(),                      // 'review_clean'|'review_slashed'|'policy_violation'|'stake_locked'|'export_generated'
  repoSlug:       text('repo_slug'),
  prId:           integer('pr_id'),
  pathPattern:    text('path_pattern'),
  reviewer:       text('reviewer'),                            // basename
  amountUsdc:     bigint('amount_usdc', { mode: 'number' }),
  reason:         text('reason'),
  attestationUid: text('attestation_uid'),
  occurredAt:     timestamp('occurred_at').defaultNow(),
}, (t) => ({
  byOrgTime: index('enterprise_events_org_time_idx').on(t.orgSlug, t.occurredAt),
}));
```

Add migrations + rollback. Index for the timeline query is critical — the
`/enterprise/compliance` dashboard hits `enterprise.events` every 30 seconds.

---

## 4 · New Solidity Contract — `CompliancePolicy.sol`

Deploy **one** instance per enterprise org. Owner = org multisig (2/3).

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICodeLedger {
  function getActiveStake(address reviewer, uint256 prId) external view returns (uint256);
  function isCoinbaseVerified(address reviewer) external view returns (bool);
}

contract CompliancePolicy {
  struct PolicyRule {
    string  pathPattern;          // "contracts/**", "src/auth/**"
    uint256 minStakePerReviewer;  // 6-decimal USDC
    uint8   minReviewers;
    bool    requireCoinbaseVerified;
  }

  mapping(bytes32 => PolicyRule[]) public orgPolicies;  // keccak256(orgSlug) => rules
  address public gitLedgerContract;
  address public owner;

  event PolicyAdded(bytes32 indexed orgSlug, uint256 idx, string pathPattern);
  event PolicyRemoved(bytes32 indexed orgSlug, uint256 idx);
  event PolicyViolation(bytes32 indexed orgSlug, string path, uint256 prId, string reason);

  function checkPRCompliance(
    bytes32 orgSlug,
    string  calldata filePath,
    uint256 prId,
    address[] calldata reviewers
  ) external view returns (bool compliant, string memory reason) {
    PolicyRule[] memory rules = orgPolicies[orgSlug];
    for (uint i; i < rules.length; ++i) {
      if (!pathMatches(filePath, rules[i].pathPattern)) continue;
      if (reviewers.length < rules[i].minReviewers)
        return (false, "Insufficient reviewers");
      for (uint j; j < reviewers.length; ++j) {
        if (ICodeLedger(gitLedgerContract).getActiveStake(reviewers[j], prId)
            < rules[i].minStakePerReviewer)
          return (false, "Stake below policy minimum");
        if (rules[i].requireCoinbaseVerified
            && !ICodeLedger(gitLedgerContract).isCoinbaseVerified(reviewers[j]))
          return (false, "Reviewer not Coinbase-verified");
      }
    }
    return (true, "");
  }
}
```

**Glob matching note**: `pathMatches` is a simple `*` / `**` matcher. For
production accuracy, prefer offchain evaluation (`picomatch`) by the GitHub App
and only emit `PolicyViolation` from the contract when truly necessary — chain
storage is expensive and gas-bound.

**Deployment script** required on Base mainnet (chainId 8453) — verify on
Basescan, set 2/3 multisig as owner.

**Contract tests** (Foundry):

- create policy → fetch it back identically
- removePolicy → not enforced
- checkPRCompliance with insufficient reviewers → fails with correct reason
- checkPRCompliance with low stake → fails
- requireCoinbaseVerified honored
- access control: only owner can `addPolicy` / `removePolicy`

---

## 5 · New tRPC Routes

Add a top-level `enterprise` router to `appRouter`. All routes are scoped by
`org_slug` (sent in `x-enterprise-org` header — see Auth section below). The
frontend client is in `lib/enterprise-api.ts`.

### 5.1 · Org / membership

```ts
enterprise: router({
  // List orgs the connected wallet has access to
  listOrgs: protectedProcedure
    .input(z.object({ walletAddress: z.string() }))
    .query(({ input }) => listOrgsForAddress(input.walletAddress)),

  // Full org detail; required role: member+
  getOrg: enterpriseProcedure
    .input(z.object({ orgSlug: z.string() }))
    .query(({ input, ctx }) => getOrg(ctx.orgSlug, input.orgSlug)),

  // ... see sub-routers below
})
```

### 5.2 · Policy engine

```ts
policy: router({
  list:   enterpriseProcedure.input(z.object({ orgSlug: z.string() })).query(listPolicies),
  create: enterpriseProcedure.input(policyCreateSchema).mutation(createPolicy),
  update: enterpriseProcedure.input(policyUpdateSchema).mutation(updatePolicy),
  delete: enterpriseProcedure.input(z.object({ orgSlug: z.string(), id: z.string() })).mutation(deletePolicy),
}),

// schema:
const policyCreateSchema = z.object({
  orgSlug:         z.string(),
  pathPattern:     z.string().min(1).max(200),
  minStakeUsdc:    z.number().int().min(500_000),         // >= $0.50
  minReviewers:    z.number().int().min(1).max(10),
  requireCbVerify: z.boolean(),
});
```

**Side effect on create/update/delete**: write the rule onchain via
`CompliancePolicy.addPolicy(orgSlugHash, rule)` using the org owner's Agentic
Wallet session. DB row is the source of truth for the UI; chain is the source
of truth for enforcement.

### 5.3 · Compliance dashboard

```ts
metrics:        enterpriseProcedure.input(z.object({ orgSlug: z.string() })).query(getComplianceMetrics),
coverage:       enterpriseProcedure.input(z.object({ orgSlug: z.string() })).query(getCoverageMap),
coverageSeries: enterpriseProcedure.input(z.object({ orgSlug: z.string(), days: z.number().min(7).max(90).default(30) })).query(getCoverageSeries),
events:         enterpriseProcedure.input(z.object({ orgSlug: z.string(), limit: z.number().min(1).max(200).default(50) })).query(getEvents),
```

**Computation notes**:

- `reviewCoveragePct` = `attestationsInRange / mergedPrsInRange * 100`
  scoped to repos owned by `orgSlug`.
- `coverage` returns one row per **distinct path pattern** that has at least one
  `enterprise_policies` rule, plus a synthetic `**/*.{ts,go,sol,rs,py}` row for
  the "Uncategorized" fallback. Frontend already handles this list shape.
- `coverageSeries` returns one point per UTC day for the last `days` days:
  `{ date, coveragePct, attestations, slashes }`.
- `events` is the timeline. Order: `occurredAt DESC`. Frontend treats
  `kind = 'export_generated'` as an info event with no associated repo.

### 5.4 · Audit export

```ts
audit: router({
  list:   enterpriseProcedure.input(z.object({ orgSlug: z.string() })).query(listAuditJobs),
  export: enterpriseProcedure.input(auditRequestSchema).mutation(requestAuditExport),
}),

const auditRequestSchema = z.object({
  orgSlug:  z.string(),
  format:   z.enum(['pdf','json','csv']),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

**Generation flow**:

1. Insert `enterprise_audit_jobs` row with `status='queued'`.
2. Worker (BullMQ) pulls the job:
   - Fetch all `attestations` for the org's repos where
     `reviewed_at BETWEEN dateFrom AND dateTo`.
   - Render PDF / write JSON / write CSV. PDF must include a verification
     footer with: contract address, `contentHash`, EIP-191 signature, plus
     step-by-step `cast call` instructions for offline verification.
   - Upload to R2/S3 with a 90-day signed URL.
   - Sign `contentHash` via Agentic Wallet using a dedicated signing key
     (`AUDIT_SIGNING_KEY`, separate from the org owner key).
   - Set `status='ready'`, fill `downloadUrl`, `signedBy`, `signature`,
     `generatedAt`.
   - Insert `enterprise_events` row with `kind='export_generated'`.

**Pricing for the Audit API** ($0.10 / call) is enforced at the
**Audit API** edge — a separate REST endpoint at `POST /api/enterprise/audit/lookup`
with x402 payment middleware. This frontend page does not consume that endpoint;
it consumes the tRPC procedures above on the standard subscription.

### 5.5 · SIEM forwarding

```ts
siem: router({
  list:   enterpriseProcedure.input(z.object({ orgSlug: z.string() })).query(listSiemConfigs),
  create: enterpriseProcedure.input(siemCreateSchema).mutation(createSiemConfig),
  update: enterpriseProcedure.input(siemUpdateSchema).mutation(updateSiemConfig),
  test:   enterpriseProcedure.input(z.object({ orgSlug: z.string(), id: z.string() })).mutation(testSiemDelivery),
  delete: enterpriseProcedure.input(z.object({ orgSlug: z.string(), id: z.string() })).mutation(deleteSiemConfig),
}),

const siemCreateSchema = z.object({
  orgSlug:     z.string(),
  kind:        z.enum(['splunk','datadog','vanta','drata','secureframe','custom']),
  label:       z.string().min(1).max(80),
  endpointUrl: z.string().url().startsWith('https://'),
  events:      z.array(z.enum(['stake.locked','review.clean','review.slashed','policy.violation'])).nonempty(),
  enabled:     z.boolean(),
});
```

**Delivery worker** (`siem-forwarder` BullMQ queue):

1. On any new `attestations` row or `enterprise_events.policy_violation`,
   fan out a job per enabled `enterprise_siem_configs` row whose `events`
   array includes the matching event name.
2. POST the payload to `endpointUrl` with:
   - `Content-Type: application/json`
   - `X-GitLedger-Event: review.slashed` (etc.)
   - `X-GitLedger-Delivery: <uuid>` (idempotency key)
   - `X-GitLedger-Signature: hmac-sha256=<hex>` where `hex = HMAC_SHA256(rawBody, endpointSecret)`
3. On non-2xx, retry 5 times with exponential backoff (1s · 5s · 25s · 2m · 10m).
4. Update `last_delivered_at` / `last_delivery_status` / `last_delivery_error`.
5. `siem.test` mutation enqueues a synthetic `review.slashed` payload with
   `"test": true` so customers can verify their endpoint without waiting for
   real events.

**Payload shape** (matches the sample shown on `/enterprise/siem`):

```json
{
  "event": "review.slashed",
  "orgSlug": "acme-protocol",
  "occurredAt": "2026-05-25T08:14:02Z",
  "repoSlug": "acme-protocol/core",
  "prId": 4821,
  "pathPattern": "contracts/**",
  "reviewer": { "basename": "lead.acme.base.eth", "address": "0x4c2a...5a4b" },
  "amountUsdc": 500000000,
  "attestationUid": "0xab12cd34ef56a789b890c012d345e678",
  "signature": "hmac-sha256=ab12cd34..."
}
```

**Vanta / Drata / Secureframe** kinds get a slight payload transform — see
their respective integration docs. Use the `kind` column to route to the right
serializer:

- `vanta`: map event → Vanta's `evidence/upload` schema
- `drata`: their `webhooks/v1/event` schema
- `secureframe`: their `integrations/gitledger/event` schema
- `splunk` / `datadog` / `custom`: emit the raw payload above

### 5.6 · Onboarding (GitHub Enterprise OAuth + SCIM)

```ts
onboarding: router({
  // Returns SAML redirect URL — the browser navigates to GitHub Enterprise SSO
  start: protectedProcedure.input(z.object({
    githubEnterpriseHost: z.string().min(3),
    walletAddress:        z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  })).mutation(startEnterpriseOAuth),

  // Callback handler (NOT a tRPC route — see Section 7) consumes the SAML
  // assertion, looks up or creates the org, sets samlEnabled = true.

  // Enable SCIM v2 endpoint; returns a one-time bearer token (already stored
  // as bcrypt hash in scim_bearer_hash).
  scim: enterpriseProcedure.input(z.object({
    orgSlug:         z.string(),
    scimEndpointUrl: z.string().url(),
  })).mutation(enableScim),
}),
```

---

## 6 · Authorization Model

The frontend always sends a single per-request header:

```
x-enterprise-org: acme-protocol
```

`enterpriseProcedure` middleware:

1. Resolve the connected wallet from Dynamic.xyz JWT (existing pattern).
2. Look up `enterprise_org_members` for `(orgSlug, walletAddress)`.
3. Reject if no row, or if `role` is insufficient for the route.
4. Attach `ctx.orgSlug` and `ctx.role`.

Role matrix:

| Role     | Read metrics | Read events | Edit policy | Edit SIEM | Trigger export | Invite members |
|----------|:------------:|:-----------:|:-----------:|:---------:|:--------------:|:--------------:|
| auditor  | ✓            | ✓           |             |           | ✓              |                |
| member   | ✓            | ✓           |             |           |                |                |
| admin    | ✓            | ✓           | ✓           | ✓         | ✓              | ✓              |
| owner    | ✓            | ✓           | ✓           | ✓         | ✓              | ✓ + transfer   |

Throw `TRPCError { code: 'FORBIDDEN' }` on insufficient role; frontend
already handles thrown errors by falling back to mock data, so during dev your
test wallet just needs an `enterprise_org_members` row with role=`owner`.

---

## 7 · Non-tRPC HTTP Endpoints

Two endpoints stay raw because they're hit by external systems:

### 7.1 · SAML callback (GitHub Enterprise → us)

```
POST /auth/github-enterprise/callback
```

Consumes the SAML AssertionConsumerService POST, validates with
`@node-saml/node-saml`, finds-or-creates `enterprise_orgs` row, marks
`samlEnabled = true`, sets `enterprise_org_members` for the SAML subject's
mapped wallet, then 302s to `/enterprise/compliance?org=<slug>`.

### 7.2 · SCIM v2 (IdP → us)

```
/scim/v2/Users
/scim/v2/Users/{id}
/scim/v2/Groups
/scim/v2/Groups/{id}
```

Standard RFC 7644 endpoints. Auth: `Authorization: Bearer <scim_token>` —
compare bcrypt(token) against `enterprise_orgs.scim_bearer_hash`.

Mutations write/update `enterprise_org_members` rows. Map IdP user → wallet by
GitHub Enterprise login: each member must connect their wallet at least once
through `/dashboard` before SCIM can resolve them — until then store the SCIM
externalId in `scim_external_id` and reconcile on first wallet connection.

---

## 8 · Worker Jobs (BullMQ on Redis)

| Queue                | Trigger                                                    | Job                                                         |
|----------------------|------------------------------------------------------------|-------------------------------------------------------------|
| `siem-forwarder`     | New attestation, new policy violation, new stake lock      | POST to every matching `enterprise_siem_configs`            |
| `audit-export`       | `enterprise.audit.export` mutation                         | Aggregate + render PDF/JSON/CSV, upload, sign, mark `ready` |
| `enterprise-metrics` | Every 60s                                                  | Recompute `enterprise_events` daily rollups for sparkline   |
| `policy-onchain`     | `enterprise.policy.create / update / delete` mutation      | Reflect rule into `CompliancePolicy.sol` via Agentic Wallet |

All queues need a **dead-letter queue (DLQ)** after 5 retries. Surface DLQ size
in your observability dashboard alongside webhook/queue/oracle/tx success rates.

---

## 9 · Env Vars (backend)

```env
# Existing
DATABASE_URL=postgres://...
BASE_RPC_URL=https://mainnet.base.org
CDP_API_KEY=...
GITHUB_APP_PRIVATE_KEY=...
EAS_SCHEMA_UID=0x...

# New for Track 1
COMPLIANCE_POLICY_CONTRACT=0x...            # CompliancePolicy.sol address on Base
AUDIT_SIGNING_KEY=0x...                     # dedicated signer for audit PDFs (kept in Coinbase CDP)
AUDIT_STORAGE_BUCKET=gitledger-audit
AUDIT_STORAGE_REGION=auto
AUDIT_STORAGE_ENDPOINT=https://<account>.r2.cloudflarestorage.com
AUDIT_STORAGE_ACCESS_KEY=...
AUDIT_STORAGE_SECRET_KEY=...

SAML_ENTITY_ID=https://gitledger.dev/auth/github-enterprise
SAML_CERT_PATH=/secrets/saml-cert.pem
SAML_KEY_PATH=/secrets/saml-key.pem

REDIS_URL=redis://...

SIEM_HMAC_SECRET_SALT=...                   # mixed with per-config secret on rotation
```

---

## 10 · Frontend ↔ Backend Contract Reference

The frontend calls these exact tRPC procedure names. Don't rename them — change
`lib/enterprise-api.ts` if you must.

| Procedure                              | Method   | Header              | Auth        |
|----------------------------------------|----------|---------------------|-------------|
| `enterprise.listOrgs`                  | query    | —                   | protected   |
| `enterprise.getOrg`                    | query    | x-enterprise-org    | enterprise  |
| `enterprise.policy.list`               | query    | x-enterprise-org    | enterprise  |
| `enterprise.policy.create`             | mutation | x-enterprise-org    | admin+      |
| `enterprise.policy.update`             | mutation | x-enterprise-org    | admin+      |
| `enterprise.policy.delete`             | mutation | x-enterprise-org    | admin+      |
| `enterprise.metrics`                   | query    | x-enterprise-org    | enterprise  |
| `enterprise.coverage`                  | query    | x-enterprise-org    | enterprise  |
| `enterprise.coverageSeries`            | query    | x-enterprise-org    | enterprise  |
| `enterprise.events`                    | query    | x-enterprise-org    | enterprise  |
| `enterprise.audit.list`                | query    | x-enterprise-org    | enterprise  |
| `enterprise.audit.export`              | mutation | x-enterprise-org    | auditor+    |
| `enterprise.siem.list`                 | query    | x-enterprise-org    | enterprise  |
| `enterprise.siem.create`               | mutation | x-enterprise-org    | admin+      |
| `enterprise.siem.update`               | mutation | x-enterprise-org    | admin+      |
| `enterprise.siem.test`                 | mutation | x-enterprise-org    | admin+      |
| `enterprise.siem.delete`               | mutation | x-enterprise-org    | admin+      |
| `enterprise.onboarding.start`          | mutation | —                   | protected   |
| `enterprise.onboarding.scim`           | mutation | x-enterprise-org    | owner       |

Frontend type definitions live in `lib/enterprise-types.ts`. Mirror them exactly
in your backend Zod schemas. The frontend transformer is the tRPC default
(no SuperJSON wrapper) — match what's already in `lib/api.ts`.

---

## 11 · Integration with Existing Track 0

Wire two things into the existing flow:

1. **Stake commit → enterprise event**
   After `stake.submit` writes the attestation and the EAS UID resolves, also
   insert into `enterprise_events` with `kind='stake_locked'` if the repo
   belongs to an enterprise org (`enterprise_org_repos` table — add this).
2. **Slash resolution → enterprise event + SIEM fanout**
   When the Chainlink upkeep marks a stake `SLASHED`, insert
   `kind='review_slashed'` and enqueue the `siem-forwarder` jobs.
3. **Policy check at PR open time**
   GitHub App webhook on `pull_request.opened` / `pull_request.synchronize`:
   for each touched file path, call `CompliancePolicy.checkPRCompliance(...)`
   (or do it offchain via `picomatch` against `enterprise_policies` rows for
   speed). If non-compliant, post a bot comment naming the failing rule and
   insert `enterprise_events` with `kind='policy_violation'`.

---

## 12 · QA Acceptance

The frontend treats backend failures as soft (mock fallback fires). Backend
acceptance therefore needs explicit checks:

- [ ] Integration: create policy → onchain rule visible in
      `CompliancePolicy.orgPolicies` → DB row matches
- [ ] Integration: PR with insufficient stake → policy violation event written
      → SIEM forward fired → HMAC signature verifies
- [ ] Integration: PDF export → R2 URL works → contentHash + signature verify
      via `viem.verifyMessage`
- [ ] Permissions: `member` role cannot mutate policy / SIEM / audit endpoints
- [ ] SCIM: SCIM POST creates an `enterprise_org_members` row; DELETE removes it
- [ ] SAML: callback handles signed assertion + binds wallet correctly
- [ ] Worker: `siem-forwarder` DLQ size = 0 under normal load
- [ ] Worker: `audit-export` completes in < 60s for a 1-year window
- [ ] Observability: webhook / queue / oracle / tx success-rate dashboards
      include the new queues

---

## 13 · Delivery Order (Week 5, Day-by-Day)

Matches the roadmap PDF Section 03.

| Day(s) | Deliverable                                                                                          |
|--------|------------------------------------------------------------------------------------------------------|
| 1–2    | `CompliancePolicy.sol` + Drizzle tables + migrations. Foundry tests + Base deployment script.        |
| 3      | `enterprise.policy.*`, `enterprise.metrics`, `enterprise.coverage`, `enterprise.events` tRPC routes. |
| 4      | Vanta + Drata + Splunk + Datadog adapters. SIEM forwarder worker. Audit export PDF generator.        |
| 5      | SAML callback + SCIM v2 endpoints. Wire authorize/SCIM hooks into the new `enterprise_org_members`.  |
| 6–7    | Enterprise onboarding QA. Three pilot orgs onboarded end-to-end. SLA monitoring live.                |

---

## 14 · Out of Scope for Track 1

These are explicitly **not** required for Track 1 acceptance — track 2/3/4 will
follow:

- ReputationVault.sol / Morpho integration (Track 2)
- GitLedger Hire / recruiter dashboard (Track 3)
- LEDGER token mint / governance (Track 4)
- LEDGER-gated "free Enterprise" unlock (Track 4 wires the `≥ 10K LEDGER → tier override`)

---

When this ships, remove the `withMock()` wrapper from `lib/enterprise-hooks.ts`
or leave it in place as a defensive fallback — the call sites stay identical.
