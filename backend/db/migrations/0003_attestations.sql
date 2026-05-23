CREATE TABLE IF NOT EXISTS attestations (
  uid text PRIMARY KEY,
  basename text,
  reviewer_address text,
  repo_slug text,
  pr_id integer,
  pr_title text,
  stake_amount bigint,
  verdict text CHECK (verdict IN ('ACTIVE','CLEAN','SLASHED')),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  reputation_delta integer DEFAULT 0,
  repo_languages text[],
  tx_hash text
);

CREATE INDEX IF NOT EXISTS idx_attestations_basename ON attestations(basename);
CREATE INDEX IF NOT EXISTS idx_attestations_repo_slug ON attestations(repo_slug);
CREATE INDEX IF NOT EXISTS idx_attestations_verdict ON attestations(verdict);
