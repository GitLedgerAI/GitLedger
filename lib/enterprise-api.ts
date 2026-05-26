// ─────────────────────────────────────────────────────────────────────────────
// Track 1 · Enterprise Compliance Layer — tRPC client stubs
//
// These call the backend procedures specified in /track1.md.
// The hooks in lib/enterprise-hooks.ts fall back to mock data when the
// backend hasn't shipped these routes yet (HTTP 404/501 surface as throws).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  EnterpriseOrg,
  PolicyRule,
  ComplianceMetrics,
  CoverageRow,
  ComplianceEvent,
  SiemConfig,
  AuditExportJob,
  AuditFormat,
  ComplianceCoveragePoint,
  SiemKind,
  SiemEventKind,
} from './enterprise-types';

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://backend-uuq8.onrender.com').replace(/\/$/, '');

async function trpcQuery<T>(
  proc: string,
  input: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const inputParam = encodeURIComponent(JSON.stringify({ '0': input }));
  const res = await fetch(`${BASE}/trpc/${proc}?batch=1&input=${inputParam}`, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[${proc}] ${res.status}: ${body.slice(0, 300)}`);
  }
  const batch: [{ result: { data: T } }] = await res.json();
  return batch[0].result.data;
}

async function trpcMutate<T>(
  proc: string,
  input: Record<string, unknown> = {},
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const res = await fetch(`${BASE}/trpc/${proc}?batch=1`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify({ '0': input }),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[${proc}] ${res.status}: ${body.slice(0, 300)}`);
  }
  const batch: [{ result: { data: T } }] = await res.json();
  return batch[0].result.data;
}

const orgHeader = (orgSlug: string): Record<string, string> => ({
  'x-enterprise-org': orgSlug,
});

// ── Org / membership ────────────────────────────────────────────────────────

export function getMyEnterpriseOrgs(walletAddress: string): Promise<EnterpriseOrg[]> {
  return trpcQuery<EnterpriseOrg[]>('enterprise.listOrgs', { walletAddress });
}

export function getEnterpriseOrg(orgSlug: string): Promise<EnterpriseOrg> {
  return trpcQuery<EnterpriseOrg>('enterprise.getOrg', { orgSlug }, orgHeader(orgSlug));
}

// ── Policy engine ───────────────────────────────────────────────────────────

export function listPolicies(orgSlug: string): Promise<PolicyRule[]> {
  return trpcQuery<PolicyRule[]>('enterprise.policy.list', { orgSlug }, orgHeader(orgSlug));
}

export function createPolicy(input: {
  orgSlug: string;
  pathPattern: string;
  minStakeUsdc: number;
  minReviewers: number;
  requireCbVerify: boolean;
}): Promise<PolicyRule> {
  return trpcMutate<PolicyRule>('enterprise.policy.create', input, orgHeader(input.orgSlug));
}

export function updatePolicy(input: {
  orgSlug: string;
  id: string;
  pathPattern?: string;
  minStakeUsdc?: number;
  minReviewers?: number;
  requireCbVerify?: boolean;
}): Promise<PolicyRule> {
  return trpcMutate<PolicyRule>('enterprise.policy.update', input, orgHeader(input.orgSlug));
}

export function deletePolicy(input: { orgSlug: string; id: string }): Promise<{ ok: true }> {
  return trpcMutate<{ ok: true }>('enterprise.policy.delete', input, orgHeader(input.orgSlug));
}

// ── Compliance dashboard ────────────────────────────────────────────────────

export function getComplianceMetrics(orgSlug: string): Promise<ComplianceMetrics> {
  return trpcQuery<ComplianceMetrics>('enterprise.metrics', { orgSlug }, orgHeader(orgSlug));
}

export function getCoverageMap(orgSlug: string): Promise<CoverageRow[]> {
  return trpcQuery<CoverageRow[]>('enterprise.coverage', { orgSlug }, orgHeader(orgSlug));
}

export function getCoverageSeries(
  orgSlug: string,
  days: number = 30,
): Promise<ComplianceCoveragePoint[]> {
  return trpcQuery<ComplianceCoveragePoint[]>(
    'enterprise.coverageSeries',
    { orgSlug, days },
    orgHeader(orgSlug),
  );
}

export function getComplianceEvents(
  orgSlug: string,
  limit: number = 50,
): Promise<ComplianceEvent[]> {
  return trpcQuery<ComplianceEvent[]>(
    'enterprise.events',
    { orgSlug, limit },
    orgHeader(orgSlug),
  );
}

// ── Audit export ────────────────────────────────────────────────────────────

export function listAuditJobs(orgSlug: string): Promise<AuditExportJob[]> {
  return trpcQuery<AuditExportJob[]>('enterprise.audit.list', { orgSlug }, orgHeader(orgSlug));
}

export function requestAuditExport(input: {
  orgSlug: string;
  format: AuditFormat;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
}): Promise<AuditExportJob> {
  return trpcMutate<AuditExportJob>('enterprise.audit.export', input, orgHeader(input.orgSlug));
}

// ── SIEM forwarding ─────────────────────────────────────────────────────────

export function listSiemConfigs(orgSlug: string): Promise<SiemConfig[]> {
  return trpcQuery<SiemConfig[]>('enterprise.siem.list', { orgSlug }, orgHeader(orgSlug));
}

export function createSiemConfig(input: {
  orgSlug: string;
  kind: SiemKind;
  label: string;
  endpointUrl: string;
  events: SiemEventKind[];
  enabled: boolean;
}): Promise<SiemConfig> {
  return trpcMutate<SiemConfig>('enterprise.siem.create', input, orgHeader(input.orgSlug));
}

export function updateSiemConfig(input: {
  orgSlug: string;
  id: string;
  label?: string;
  endpointUrl?: string;
  events?: SiemEventKind[];
  enabled?: boolean;
}): Promise<SiemConfig> {
  return trpcMutate<SiemConfig>('enterprise.siem.update', input, orgHeader(input.orgSlug));
}

export function testSiemConfig(input: { orgSlug: string; id: string }): Promise<{
  ok: boolean;
  deliveredAt: string;
  error?: string;
}> {
  return trpcMutate('enterprise.siem.test', input, orgHeader(input.orgSlug));
}

export function deleteSiemConfig(input: { orgSlug: string; id: string }): Promise<{ ok: true }> {
  return trpcMutate('enterprise.siem.delete', input, orgHeader(input.orgSlug));
}

// ── Onboarding (GitHub Enterprise + SCIM) ──────────────────────────────────

export function startEnterpriseOAuth(input: {
  githubEnterpriseHost: string;
  walletAddress: string;
}): Promise<{ redirectUrl: string }> {
  return trpcMutate('enterprise.onboarding.start', input);
}

export function enableScim(input: {
  orgSlug: string;
  scimEndpointUrl: string;
}): Promise<{ ok: true; bearerToken: string }> {
  return trpcMutate('enterprise.onboarding.scim', input, orgHeader(input.orgSlug));
}
