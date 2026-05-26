-- 0006_enterprise_compliance.sql
--
-- Track 1 — Enterprise Compliance Layer (offchain).
-- No new contracts. No EAS schema changes. All tenant data scoped by org_slug.
--
-- Tables:
--   enterprise_orgs           — one paying customer
--   enterprise_org_members    — wallet → role within an org
--   enterprise_org_repos      — which repos belong to which org (1 repo → 1 org)
--   enterprise_policies       — path-glob rules (offchain enforced by the GitHub App)
--   enterprise_siem_configs   — outbound HMAC-signed webhooks
--   enterprise_audit_jobs     — signed audit exports (JSON/CSV/HTML-for-PDF)
--   enterprise_events         — append-only compliance timeline

CREATE TABLE IF NOT EXISTS enterprise_orgs (
  org_slug              text PRIMARY KEY,
  display_name          text NOT NULL,
  tier                  text NOT NULL DEFAULT 'starter',
  owner_address         text NOT NULL,
  github_enterprise_host text,
  saml_enabled          boolean NOT NULL DEFAULT false,
  scim_enabled          boolean NOT NULL DEFAULT false,
  scim_bearer_hash      text,
  member_count          integer NOT NULL DEFAULT 0,
  repo_count            integer NOT NULL DEFAULT 0,
  created_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enterprise_org_members (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_slug         text NOT NULL REFERENCES enterprise_orgs(org_slug) ON DELETE CASCADE,
  address          text NOT NULL,
  role             text NOT NULL,
  scim_external_id text,
  created_at       timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS enterprise_members_org_addr_idx
  ON enterprise_org_members (org_slug, address);
CREATE INDEX IF NOT EXISTS enterprise_members_org_idx
  ON enterprise_org_members (org_slug);

CREATE TABLE IF NOT EXISTS enterprise_org_repos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_slug   text NOT NULL REFERENCES enterprise_orgs(org_slug) ON DELETE CASCADE,
  repo_slug  text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS enterprise_org_repos_slug_idx
  ON enterprise_org_repos (repo_slug);
CREATE INDEX IF NOT EXISTS enterprise_org_repos_org_idx
  ON enterprise_org_repos (org_slug);

CREATE TABLE IF NOT EXISTS enterprise_policies (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_slug          text NOT NULL REFERENCES enterprise_orgs(org_slug) ON DELETE CASCADE,
  path_pattern      text NOT NULL,
  min_stake_usdc    bigint NOT NULL,
  min_reviewers     integer NOT NULL DEFAULT 1,
  require_cb_verify boolean NOT NULL DEFAULT false,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enterprise_policies_org_idx
  ON enterprise_policies (org_slug);

CREATE TABLE IF NOT EXISTS enterprise_siem_configs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_slug             text NOT NULL REFERENCES enterprise_orgs(org_slug) ON DELETE CASCADE,
  kind                 text NOT NULL,
  label                text NOT NULL,
  endpoint_url         text NOT NULL,
  endpoint_secret      text NOT NULL,
  events               text[] NOT NULL,
  enabled              boolean NOT NULL DEFAULT true,
  last_delivered_at    timestamptz,
  last_delivery_status text,
  last_delivery_error  text,
  created_at           timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enterprise_siem_org_idx
  ON enterprise_siem_configs (org_slug);

CREATE TABLE IF NOT EXISTS enterprise_audit_jobs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_slug          text NOT NULL REFERENCES enterprise_orgs(org_slug) ON DELETE CASCADE,
  format            text NOT NULL,
  date_from         date NOT NULL,
  date_to           date NOT NULL,
  attestation_count integer NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'queued',
  content_text      text,
  content_mime      text,
  content_hash      text,
  signature         text,
  signed_by         text,
  generated_at      timestamptz,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enterprise_audit_org_idx
  ON enterprise_audit_jobs (org_slug);

CREATE TABLE IF NOT EXISTS enterprise_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_slug        text NOT NULL REFERENCES enterprise_orgs(org_slug) ON DELETE CASCADE,
  kind            text NOT NULL,
  repo_slug       text,
  pr_id           integer,
  path_pattern    text,
  reviewer        text,
  amount_usdc     bigint,
  reason          text,
  attestation_uid text,
  occurred_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enterprise_events_org_time_idx
  ON enterprise_events (org_slug, occurred_at DESC);
