CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  gh_install_id bigint,
  min_stake_usdc integer DEFAULT 10000000,
  stake_enabled boolean DEFAULT true,
  installed_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reviewers (
  address text PRIMARY KEY,
  basename text UNIQUE,
  github_login text UNIQUE,
  reputation_score integer DEFAULT 500,
  total_staked_usdc numeric DEFAULT '0',
  total_yield_usdc numeric DEFAULT '0',
  total_slashed_usdc numeric DEFAULT '0',
  clean_count integer DEFAULT 0,
  slash_count integer DEFAULT 0,
  languages text[],
  last_active_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id text UNIQUE NOT NULL,
  reviewer_addr text NOT NULL,
  repo_id uuid REFERENCES repos(id),
  pr_id integer NOT NULL,
  pr_title text,
  amount_usdc integer NOT NULL,
  state text DEFAULT 'active',
  attestation_uid text,
  tx_hash_stake text,
  tx_hash_resolve text,
  yield_earned integer DEFAULT 0,
  window_ends_at timestamp,
  staked_at timestamp DEFAULT now(),
  resolved_at timestamp
);

CREATE TABLE IF NOT EXISTS attestation_events (
  time timestamp DEFAULT now(),
  reviewer_addr text,
  repo_slug text,
  pr_id integer,
  event_type text,
  amount_usdc integer,
  attestation_uid text,
  tx_hash text
);

CREATE INDEX IF NOT EXISTS idx_stakes_reviewer_addr ON stakes(reviewer_addr);
CREATE INDEX IF NOT EXISTS idx_stakes_state ON stakes(state);
CREATE INDEX IF NOT EXISTS idx_attestation_events_time ON attestation_events(time);
