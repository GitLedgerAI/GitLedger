CREATE TABLE IF NOT EXISTS prompt_stake_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name text NOT NULL,
  reviewer_login text,
  repo_slug text,
  pr_id integer,
  min_stake_usdc integer,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  attempts integer NOT NULL DEFAULT 1,
  error text,
  received_at timestamp NOT NULL DEFAULT now(),
  processed_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_prompt_stake_jobs_status ON prompt_stake_jobs(status);
CREATE INDEX IF NOT EXISTS idx_prompt_stake_jobs_received_at ON prompt_stake_jobs(received_at);
