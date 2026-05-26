import type {
  EnterpriseOrg,
  PolicyRule,
  ComplianceMetrics,
  CoverageRow,
  ComplianceEvent,
  SiemConfig,
  AuditExportJob,
  ComplianceCoveragePoint,
} from './enterprise-types';

// ─────────────────────────────────────────────────────────────────────────────
// Mock data used as a graceful fallback until the backend ships Track 1 routes.
// The shape matches /track1.md exactly.
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_ORG: EnterpriseOrg = {
  orgSlug: 'acme-protocol',
  displayName: 'ACME Protocol',
  tier: 'enterprise',
  githubEnterpriseHost: 'github.acme.io',
  samlEnabled: true,
  scimEnabled: true,
  memberCount: 184,
  repoCount: 27,
  createdAt: '2026-04-02T10:00:00Z',
  ownerAddress: '0x4c2a3b1d8f7e9a6c5b4d3e2f1a0b9c8d7e6f5a4b',
};

export const MOCK_POLICIES: PolicyRule[] = [
  {
    id: 'pol_01',
    orgSlug: MOCK_ORG.orgSlug,
    pathPattern: 'contracts/**',
    minStakeUsdc: 500_000_000,    // $500.00
    minReviewers: 2,
    requireCbVerify: true,
    createdAt: '2026-04-08T14:22:00Z',
  },
  {
    id: 'pol_02',
    orgSlug: MOCK_ORG.orgSlug,
    pathPattern: 'src/auth/**',
    minStakeUsdc: 250_000_000,    // $250.00
    minReviewers: 2,
    requireCbVerify: true,
    createdAt: '2026-04-08T14:25:00Z',
  },
  {
    id: 'pol_03',
    orgSlug: MOCK_ORG.orgSlug,
    pathPattern: 'src/payments/**',
    minStakeUsdc: 300_000_000,    // $300.00
    minReviewers: 2,
    requireCbVerify: false,
    createdAt: '2026-04-12T09:10:00Z',
  },
  {
    id: 'pol_04',
    orgSlug: MOCK_ORG.orgSlug,
    pathPattern: 'infra/terraform/**',
    minStakeUsdc: 150_000_000,    // $150.00
    minReviewers: 1,
    requireCbVerify: false,
    createdAt: '2026-04-15T18:42:00Z',
  },
];

export const MOCK_METRICS: ComplianceMetrics = {
  orgSlug: MOCK_ORG.orgSlug,
  reviewCoveragePct: 92.4,
  totalAttestations: 3_412,
  activeStakeUsdc: 184_500_000_000, // $184,500
  slashCount30d: 4,
  violationCount30d: 2,
  policyRulesActive: 4,
  lastAuditExportAt: '2026-05-22T17:32:00Z',
  cc72Evidence: true,
};

export const MOCK_COVERAGE: CoverageRow[] = [
  {
    pathPattern: 'contracts/**',
    reviewedCount: 218,
    totalPrs: 220,
    coveragePct: 99.1,
    avgStakeUsdc: 612_000_000,
    slashCount: 1,
  },
  {
    pathPattern: 'src/auth/**',
    reviewedCount: 142,
    totalPrs: 148,
    coveragePct: 95.9,
    avgStakeUsdc: 285_000_000,
    slashCount: 0,
  },
  {
    pathPattern: 'src/payments/**',
    reviewedCount: 96,
    totalPrs: 104,
    coveragePct: 92.3,
    avgStakeUsdc: 322_000_000,
    slashCount: 2,
  },
  {
    pathPattern: 'src/api/**',
    reviewedCount: 412,
    totalPrs: 478,
    coveragePct: 86.2,
    avgStakeUsdc: 96_000_000,
    slashCount: 1,
  },
  {
    pathPattern: 'infra/terraform/**',
    reviewedCount: 38,
    totalPrs: 46,
    coveragePct: 82.6,
    avgStakeUsdc: 158_000_000,
    slashCount: 0,
  },
  {
    pathPattern: 'app/**',
    reviewedCount: 286,
    totalPrs: 354,
    coveragePct: 80.8,
    avgStakeUsdc: 82_000_000,
    slashCount: 0,
  },
];

export const MOCK_EVENTS: ComplianceEvent[] = [
  {
    id: 'evt_01',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'policy_violation',
    repoSlug: 'acme-protocol/core',
    prId: 4821,
    pathPattern: 'contracts/**',
    reviewer: 'devops.acme.base.eth',
    reason: 'Stake $200 below policy minimum $500',
    occurredAt: '2026-05-25T08:14:00Z',
  },
  {
    id: 'evt_02',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'review_slashed',
    repoSlug: 'acme-protocol/payments',
    prId: 4810,
    pathPattern: 'src/payments/**',
    reviewer: 'lead.acme.base.eth',
    amountUsdc: 350_000_000,
    attestationUid: '0x9a8f6b2e4c1d3a5f7e8b9c0d1e2f3a4b',
    occurredAt: '2026-05-24T21:42:00Z',
  },
  {
    id: 'evt_03',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'review_clean',
    repoSlug: 'acme-protocol/core',
    prId: 4805,
    pathPattern: 'contracts/**',
    reviewer: 'audit.acme.base.eth',
    amountUsdc: 800_000_000,
    attestationUid: '0xab12cd34ef56a789b890c012d345e678',
    occurredAt: '2026-05-24T19:08:00Z',
  },
  {
    id: 'evt_04',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'stake_locked',
    repoSlug: 'acme-protocol/api',
    prId: 4806,
    pathPattern: 'src/api/**',
    reviewer: 'sre.acme.base.eth',
    amountUsdc: 120_000_000,
    occurredAt: '2026-05-24T16:30:00Z',
  },
  {
    id: 'evt_05',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'export_generated',
    reason: 'SOC2 CC7.2 evidence export · 2026-04 → 2026-05',
    occurredAt: '2026-05-22T17:32:00Z',
  },
  {
    id: 'evt_06',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'policy_violation',
    repoSlug: 'acme-protocol/auth',
    prId: 4774,
    pathPattern: 'src/auth/**',
    reviewer: 'junior.acme.base.eth',
    reason: 'Only 1 reviewer attached (policy requires 2)',
    occurredAt: '2026-05-21T11:05:00Z',
  },
  {
    id: 'evt_07',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'review_slashed',
    repoSlug: 'acme-protocol/core',
    prId: 4762,
    pathPattern: 'contracts/**',
    reviewer: 'newbie.acme.base.eth',
    amountUsdc: 500_000_000,
    attestationUid: '0xfe12dc34ba56987688a012b3c4d5e6f7',
    occurredAt: '2026-05-19T22:54:00Z',
  },
];

export const MOCK_SIEM_CONFIGS: SiemConfig[] = [
  {
    id: 'siem_01',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'splunk',
    label: 'Prod Splunk',
    endpointUrl: 'https://splunk.acme.io/services/collector/event',
    events: ['review.slashed', 'policy.violation'],
    enabled: true,
    lastDeliveredAt: '2026-05-25T08:14:32Z',
    lastDeliveryStatus: 'ok',
    createdAt: '2026-04-10T12:00:00Z',
  },
  {
    id: 'siem_02',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'datadog',
    label: 'Security Datadog',
    endpointUrl: 'https://http-intake.logs.datadoghq.com/v1/input/****',
    events: ['stake.locked', 'review.clean', 'review.slashed', 'policy.violation'],
    enabled: true,
    lastDeliveredAt: '2026-05-25T08:15:01Z',
    lastDeliveryStatus: 'ok',
    createdAt: '2026-04-11T09:30:00Z',
  },
  {
    id: 'siem_03',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'vanta',
    label: 'Vanta · SOC2 evidence',
    endpointUrl: 'https://api.vanta.com/v1/integrations/gitledger/webhook',
    events: ['review.clean', 'review.slashed'],
    enabled: true,
    lastDeliveredAt: '2026-05-24T22:00:00Z',
    lastDeliveryStatus: 'ok',
    createdAt: '2026-04-12T15:42:00Z',
  },
  {
    id: 'siem_04',
    orgSlug: MOCK_ORG.orgSlug,
    kind: 'drata',
    label: 'Drata · SOC2',
    endpointUrl: 'https://api.drata.com/integrations/gitledger',
    events: ['review.clean', 'review.slashed'],
    enabled: false,
    lastDeliveredAt: '2026-05-12T14:00:00Z',
    lastDeliveryStatus: 'failed',
    lastDeliveryError: '401 Unauthorized — rotate API key',
    createdAt: '2026-04-15T11:10:00Z',
  },
];

export const MOCK_AUDIT_JOBS: AuditExportJob[] = [
  {
    id: 'aud_01',
    orgSlug: MOCK_ORG.orgSlug,
    format: 'pdf',
    dateFrom: '2026-04-01',
    dateTo: '2026-04-30',
    attestationCount: 612,
    status: 'ready',
    downloadUrl: '#mock-april-2026.pdf',
    signedBy: '0xC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    generatedAt: '2026-05-02T10:00:00Z',
    createdAt: '2026-05-02T09:58:11Z',
  },
  {
    id: 'aud_02',
    orgSlug: MOCK_ORG.orgSlug,
    format: 'pdf',
    dateFrom: '2026-05-01',
    dateTo: '2026-05-22',
    attestationCount: 421,
    status: 'ready',
    downloadUrl: '#mock-may-2026.pdf',
    signedBy: '0xC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    generatedAt: '2026-05-22T17:32:00Z',
    createdAt: '2026-05-22T17:30:18Z',
  },
  {
    id: 'aud_03',
    orgSlug: MOCK_ORG.orgSlug,
    format: 'json',
    dateFrom: '2026-01-01',
    dateTo: '2026-04-30',
    attestationCount: 2_184,
    status: 'ready',
    downloadUrl: '#mock-q1-2026.json',
    signedBy: '0xC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE',
    generatedAt: '2026-05-01T08:14:00Z',
    createdAt: '2026-05-01T08:10:42Z',
  },
];

export function mockCoverageSeries(): ComplianceCoveragePoint[] {
  const points: ComplianceCoveragePoint[] = [];
  const start = new Date('2026-04-26T00:00:00Z').getTime();
  for (let i = 0; i < 30; i++) {
    const day = new Date(start + i * 86400000);
    const base = 84 + Math.sin(i / 4) * 5;
    const noise = (Math.sin(i * 1.3) + Math.cos(i * 0.7)) * 1.5;
    points.push({
      date: day.toISOString().slice(0, 10),
      coveragePct: Math.min(99.5, Math.max(72, base + noise + 4)),
      attestations: Math.round(95 + Math.sin(i / 3) * 22 + i * 1.2),
      slashes: i % 7 === 0 ? 1 : i === 14 || i === 24 ? 1 : 0,
    });
  }
  return points;
}
