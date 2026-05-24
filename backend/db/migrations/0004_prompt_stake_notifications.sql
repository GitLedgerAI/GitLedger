CREATE TABLE IF NOT EXISTS prompt_stake_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_login text NOT NULL,
  repo_slug text NOT NULL,
  pr_id integer NOT NULL,
  min_stake_usdc integer NOT NULL,
  source text NOT NULL DEFAULT 'webhook',
  payload jsonb NOT NULL,
  received_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_stake_notifications_received_at ON prompt_stake_notifications(received_at);
CREATE INDEX IF NOT EXISTS idx_prompt_stake_notifications_repo_pr ON prompt_stake_notifications(repo_slug, pr_id);
