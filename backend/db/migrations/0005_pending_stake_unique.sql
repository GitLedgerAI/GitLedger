-- 0005_pending_stake_unique.sql
--
-- Prevent the orphan-pending-stake bug we hit before: when deriveStakeId() logic
-- changes between deploys, the same (repo, pr, reviewer) tuple maps to a new
-- stake_id and the old pending_stake row sticks around forever. Also catches
-- duplicate concurrent webhook deliveries from racing.
--
-- One pending stake per reviewer per PR, enforced at the DB level.

-- 1. Clean up any pre-existing duplicates: keep the most recently staked row
--    per (repo_id, pr_id, reviewer_addr) group, drop the rest.
DELETE FROM stakes
WHERE state = 'pending_stake'
  AND id NOT IN (
    SELECT DISTINCT ON (repo_id, pr_id, reviewer_addr) id
    FROM stakes
    WHERE state = 'pending_stake'
    ORDER BY repo_id, pr_id, reviewer_addr, staked_at DESC NULLS LAST
  );

-- 2. Partial unique index: only constrains pending_stake rows, so terminal
--    states (active / slashed / clean) can freely coexist.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stakes_pending_unique
  ON stakes (repo_id, pr_id, reviewer_addr)
  WHERE state = 'pending_stake';
