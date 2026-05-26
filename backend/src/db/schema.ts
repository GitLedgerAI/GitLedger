import { bigint, boolean, date, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const repos = pgTable('repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(),
  ghInstallId: bigint('gh_install_id', { mode: 'number' }),
  minStakeUsdc: integer('min_stake_usdc').default(0),
  stakeEnabled: boolean('stake_enabled').default(true),
  installedAt: timestamp('installed_at').defaultNow(),
});

export const reviewers = pgTable('reviewers', {
  address: text('address').primaryKey(),
  basename: text('basename').unique(),
  githubLogin: text('github_login').unique(),
  reputationScore: integer('reputation_score').default(500),
  totalStakedUsdc: numeric('total_staked_usdc').default('0'),
  totalYieldUsdc: numeric('total_yield_usdc').default('0'),
  totalSlashedUsdc: numeric('total_slashed_usdc').default('0'),
  cleanCount: integer('clean_count').default(0),
  slashCount: integer('slash_count').default(0),
  languages: text('languages').array(),
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const attestations = pgTable('attestations', {
  uid: text('uid').primaryKey(),
  basename: text('basename'),
  reviewerAddress: text('reviewer_address'),
  repoSlug: text('repo_slug'),
  prId: integer('pr_id'),
  prTitle: text('pr_title'),
  stakeAmount: bigint('stake_amount', { mode: 'number' }),
  verdict: text('verdict'),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  reputationDelta: integer('reputation_delta').default(0),
  repoLanguages: text('repo_languages').array(),
  txHash: text('tx_hash'),
});

export const stakes = pgTable('stakes', {
  id: uuid('id').primaryKey().defaultRandom(),
  stakeId: text('stake_id').unique().notNull(),
  reviewerAddr: text('reviewer_addr').notNull(),
  repoId: uuid('repo_id').references(() => repos.id),
  prId: integer('pr_id').notNull(),
  prTitle: text('pr_title'),
  amountUsdc: integer('amount_usdc').notNull(),
  state: text('state').default('active'),
  attestationUid: text('attestation_uid'),
  txHashStake: text('tx_hash_stake'),
  txHashResolve: text('tx_hash_resolve'),
  yieldEarned: integer('yield_earned').default(0),
  windowEndsAt: timestamp('window_ends_at'),
  stakedAt: timestamp('staked_at').defaultNow(),
  resolvedAt: timestamp('resolved_at'),
});

export const attestationEvents = pgTable('attestation_events', {
  time: timestamp('time').defaultNow(),
  reviewerAddr: text('reviewer_addr'),
  repoSlug: text('repo_slug'),
  prId: integer('pr_id'),
  eventType: text('event_type'),
  amountUsdc: integer('amount_usdc'),
  attestationUid: text('attestation_uid'),
  txHash: text('tx_hash'),
});

// ─── Track 1 · Enterprise Compliance Layer ───────────────────────────────────
// All tables here are tenant-scoped by org_slug. Track 1 lives entirely
// offchain: no new contracts, no new EAS schemas. Policy enforcement is the
// GitHub App's responsibility (see services/enterprisePolicy.ts) and audit
// exports are signed with the existing SIGNER_PRIVATE_KEY via EIP-191.

export const enterpriseOrgs = pgTable('enterprise_orgs', {
  orgSlug: text('org_slug').primaryKey(),
  displayName: text('display_name').notNull(),
  tier: text('tier').notNull().default('starter'),          // 'starter' | 'pro' | 'enterprise'
  ownerAddress: text('owner_address').notNull(),
  githubEnterpriseHost: text('github_enterprise_host'),
  samlEnabled: boolean('saml_enabled').notNull().default(false),
  scimEnabled: boolean('scim_enabled').notNull().default(false),
  scimBearerHash: text('scim_bearer_hash'),                 // bcrypt-equivalent; bearer shown once
  memberCount: integer('member_count').notNull().default(0),
  repoCount: integer('repo_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const enterpriseOrgMembers = pgTable(
  'enterprise_org_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgSlug: text('org_slug').notNull(),
    address: text('address').notNull(),
    role: text('role').notNull(),                           // 'owner' | 'admin' | 'auditor' | 'member'
    scimExternalId: text('scim_external_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byOrgAddress: uniqueIndex('enterprise_members_org_addr_idx').on(t.orgSlug, t.address),
    byOrg: index('enterprise_members_org_idx').on(t.orgSlug),
  }),
);

// Links repos (by slug) to an enterprise org. A repo can only belong to one
// org at a time. This is what scopes attestations + events + metrics.
export const enterpriseOrgRepos = pgTable(
  'enterprise_org_repos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgSlug: text('org_slug').notNull(),
    repoSlug: text('repo_slug').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    bySlug: uniqueIndex('enterprise_org_repos_slug_idx').on(t.repoSlug),
    byOrg: index('enterprise_org_repos_org_idx').on(t.orgSlug),
  }),
);

export const enterprisePolicies = pgTable(
  'enterprise_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgSlug: text('org_slug').notNull(),
    pathPattern: text('path_pattern').notNull(),            // 'contracts/**'
    minStakeUsdc: bigint('min_stake_usdc', { mode: 'number' }).notNull(),
    minReviewers: integer('min_reviewers').notNull().default(1),
    requireCbVerify: boolean('require_cb_verify').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ byOrg: index('enterprise_policies_org_idx').on(t.orgSlug) }),
);

export const enterpriseSiemConfigs = pgTable(
  'enterprise_siem_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgSlug: text('org_slug').notNull(),
    kind: text('kind').notNull(),                            // 'splunk'|'datadog'|'vanta'|'drata'|'secureframe'|'custom'
    label: text('label').notNull(),
    endpointUrl: text('endpoint_url').notNull(),
    endpointSecret: text('endpoint_secret').notNull(),       // never returned via API; used for HMAC
    events: text('events').array().notNull(),                // ['stake.locked','review.clean','review.slashed','policy.violation']
    enabled: boolean('enabled').notNull().default(true),
    lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }),
    lastDeliveryStatus: text('last_delivery_status'),
    lastDeliveryError: text('last_delivery_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ byOrg: index('enterprise_siem_org_idx').on(t.orgSlug) }),
);

export const enterpriseAuditJobs = pgTable(
  'enterprise_audit_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgSlug: text('org_slug').notNull(),
    format: text('format').notNull(),                        // 'pdf' | 'json' | 'csv'
    dateFrom: date('date_from').notNull(),
    dateTo: date('date_to').notNull(),
    attestationCount: integer('attestation_count').notNull().default(0),
    status: text('status').notNull().default('queued'),      // 'queued' | 'running' | 'ready' | 'failed'
    contentText: text('content_text'),                       // rendered export body (JSON / CSV / HTML)
    contentMime: text('content_mime'),
    contentHash: text('content_hash'),                       // sha256 hex of contentText
    signature: text('signature'),                            // EIP-191 hex over contentHash
    signedBy: text('signed_by'),                             // signer address
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ byOrg: index('enterprise_audit_org_idx').on(t.orgSlug) }),
);

export const enterpriseEvents = pgTable(
  'enterprise_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgSlug: text('org_slug').notNull(),
    kind: text('kind').notNull(),                            // 'review_clean'|'review_slashed'|'policy_violation'|'stake_locked'|'export_generated'
    repoSlug: text('repo_slug'),
    prId: integer('pr_id'),
    pathPattern: text('path_pattern'),
    reviewer: text('reviewer'),                              // basename or github_login
    amountUsdc: bigint('amount_usdc', { mode: 'number' }),
    reason: text('reason'),
    attestationUid: text('attestation_uid'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({ byOrgTime: index('enterprise_events_org_time_idx').on(t.orgSlug, t.occurredAt) }),
);

export const promptStakeJobs = pgTable('prompt_stake_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  queueName: text('queue_name').notNull(),
  reviewerLogin: text('reviewer_login'),
  repoSlug: text('repo_slug'),
  prId: integer('pr_id'),
  minStakeUsdc: integer('min_stake_usdc'),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('received'),
  attempts: integer('attempts').notNull().default(1),
  error: text('error'),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
});
