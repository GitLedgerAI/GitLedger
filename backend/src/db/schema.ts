import { bigint, boolean, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const repos = pgTable('repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').unique().notNull(),
  ghInstallId: bigint('gh_install_id', { mode: 'number' }),
  minStakeUsdc: integer('min_stake_usdc').default(10_000_000),
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
