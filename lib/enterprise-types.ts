// ─────────────────────────────────────────────────────────────────────────────
// Track 1 · Enterprise Compliance Layer
// Types for the Compliance API, Policy Engine, Audit Export, and SIEM forwarding.
// Mirrors the backend spec in /track1.md.
// ─────────────────────────────────────────────────────────────────────────────

export type EnterpriseTier = 'starter' | 'pro' | 'enterprise';

export type ComplianceStatus = 'compliant' | 'violation' | 'pending';

export type SiemKind =
  | 'splunk'
  | 'datadog'
  | 'vanta'
  | 'drata'
  | 'secureframe'
  | 'custom';

export type SiemEventKind =
  | 'stake.locked'
  | 'review.clean'
  | 'review.slashed'
  | 'policy.violation';

export type AuditFormat = 'pdf' | 'json' | 'csv';

export interface EnterpriseOrg {
  orgSlug: string;
  displayName: string;
  tier: EnterpriseTier;
  githubEnterpriseHost?: string;
  samlEnabled: boolean;
  scimEnabled: boolean;
  memberCount: number;
  repoCount: number;
  createdAt: string;
  ownerAddress: string;
}

export interface PolicyRule {
  id: string;
  orgSlug: string;
  pathPattern: string;        // e.g. "contracts/**" or "src/auth/**"
  minStakeUsdc: number;       // 6-decimal USDC (1.00 USDC = 1_000_000)
  minReviewers: number;       // staked approvals required
  requireCbVerify: boolean;   // Coinbase KYC required
  createdAt: string;
}

export interface ComplianceMetrics {
  orgSlug: string;
  reviewCoveragePct: number;       // 0–100
  totalAttestations: number;
  activeStakeUsdc: number;
  slashCount30d: number;
  violationCount30d: number;
  policyRulesActive: number;
  lastAuditExportAt?: string;
  cc72Evidence: boolean;           // SOC2 CC7.2 evidence ready
}

export interface CoverageRow {
  pathPattern: string;
  reviewedCount: number;
  totalPrs: number;
  coveragePct: number;
  avgStakeUsdc: number;
  slashCount: number;
}

export type ComplianceEventKind =
  | 'review_clean'
  | 'review_slashed'
  | 'policy_violation'
  | 'stake_locked'
  | 'export_generated';

export interface ComplianceEvent {
  id: string;
  orgSlug: string;
  kind: ComplianceEventKind;
  repoSlug?: string;
  prId?: number;
  pathPattern?: string;
  reviewer?: string;          // basename
  amountUsdc?: number;
  reason?: string;            // for policy_violation
  attestationUid?: string;
  occurredAt: string;
}

export interface SiemConfig {
  id: string;
  orgSlug: string;
  kind: SiemKind;
  label: string;              // user-facing nickname (e.g. "Prod Splunk")
  endpointUrl: string;        // webhook URL (write-only; redacted on read)
  events: SiemEventKind[];    // which events to forward
  enabled: boolean;
  lastDeliveredAt?: string;
  lastDeliveryStatus?: 'ok' | 'failed';
  lastDeliveryError?: string;
  createdAt: string;
}

export interface AuditExportJob {
  id: string;
  orgSlug: string;
  format: AuditFormat;
  dateFrom: string;
  dateTo: string;
  attestationCount: number;
  status: 'queued' | 'running' | 'ready' | 'failed';
  downloadUrl?: string;
  signedBy?: string;          // base contract address that signed the export
  generatedAt?: string;
  createdAt: string;
}

export interface ComplianceCoveragePoint {
  date: string;               // YYYY-MM-DD
  coveragePct: number;
  attestations: number;
  slashes: number;
}
