'use client';

import Link from 'next/link';
import Reveal from '@/components/Reveal';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import EnterpriseBadge from '@/components/enterprise/EnterpriseBadge';
import MetricCard from '@/components/enterprise/MetricCard';
import CoverageHeatmap from '@/components/enterprise/CoverageHeatmap';
import CoverageSparkline from '@/components/enterprise/CoverageSparkline';
import ComplianceTimeline from '@/components/enterprise/ComplianceTimeline';
import {
  useEnterpriseOrg,
  useComplianceMetrics,
  useCoverageMap,
  useCoverageSeries,
  useComplianceEvents,
} from '@/lib/enterprise-hooks';
import { MOCK_ORG } from '@/lib/enterprise-mock';
import { formatUsdc, formatRelativeDate } from '@/lib/utils';

export default function ComplianceDashboardPage() {
  const orgSlug = MOCK_ORG.orgSlug; // TODO: switch to active org once /enterprise/orgs ships
  const { data: org } = useEnterpriseOrg(orgSlug);
  const { data: metrics, isLoading: mLoading } = useComplianceMetrics(orgSlug);
  const { data: coverage = [], isLoading: cLoading } = useCoverageMap(orgSlug);
  const { data: series = [] } = useCoverageSeries(orgSlug, 30);
  const { data: events = [], isLoading: eLoading } = useComplianceEvents(orgSlug, 25);

  return (
    <>
      <EnterpriseHeader
        eyebrow="Compliance"
        title="Compliance Dashboard"
        subtitle="Live SOC2 CC7.2 change-management evidence. Onchain on Base · streamed to your SIEM."
        org={org}
        right={
          <Link
            href="/enterprise/audit"
            className="px-4 py-2.5 border border-white/15 text-[11px] font-mono tracking-[0.18em] text-white/70 uppercase hover:text-white hover:border-white/35 transition-colors duration-200"
          >
            Export Evidence →
          </Link>
        }
      />

      {/* ── Top KPI strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <MetricCard
          label="Review Coverage"
          value={metrics ? `${metrics.reviewCoveragePct.toFixed(1)}%` : '—'}
          sub="of merged PRs reviewed"
          accent="emerald"
          loading={mLoading}
        />
        <MetricCard
          label="Active Stake"
          value={metrics ? formatUsdc(metrics.activeStakeUsdc) : '—'}
          sub="across all open windows"
          accent="neutral"
          loading={mLoading}
        />
        <MetricCard
          label="Slashes (30d)"
          value={metrics ? metrics.slashCount30d.toLocaleString() : '—'}
          sub={metrics ? `${metrics.violationCount30d} policy violations` : '—'}
          accent="red"
          loading={mLoading}
        />
        <MetricCard
          label="Attestations"
          value={metrics ? metrics.totalAttestations.toLocaleString() : '—'}
          sub="EAS · Base L2 · all-time"
          accent="blue"
          loading={mLoading}
        />
      </div>

      {/* ── Coverage sparkline + CC7.2 status ─────────────────────────── */}
      <Reveal direction="up">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-px bg-white/[0.06] mb-10">
          <div className="bg-[#0a0a0b] p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                  Coverage · last 30 days
                </p>
                <p className="text-sm text-white/55 font-light mt-1">
                  % of merged PRs with a staked reviewer attestation
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-300/75 tracking-[0.18em] uppercase">
                ● Trending Healthy
              </span>
            </div>
            <CoverageSparkline series={series} height={120} />
          </div>
          <div className="bg-[#0a0a0b] p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                SOC2 CC7.2
              </p>
              {metrics?.cc72Evidence ? (
                <EnterpriseBadge label="Evidence Ready" tone="emerald" size="sm" />
              ) : (
                <EnterpriseBadge label="Gathering" tone="amber" size="sm" />
              )}
            </div>
            <p className="text-sm text-white/55 font-light leading-relaxed">
              Change management evidence is collected per merged PR, signed by
              CodeLedger.sol, and exportable as PDF for your auditor.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <p className="text-[10px] font-mono tracking-[0.18em] text-white/22 uppercase">
                  Policies
                </p>
                <p className="text-lg font-mono font-bold text-white/85 mt-0.5">
                  {metrics?.policyRulesActive ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono tracking-[0.18em] text-white/22 uppercase">
                  Last export
                </p>
                <p className="text-[12px] font-mono text-white/55 mt-1.5">
                  {metrics?.lastAuditExportAt
                    ? formatRelativeDate(metrics.lastAuditExportAt)
                    : 'Never'}
                </p>
              </div>
            </div>
            <Link
              href="/enterprise/audit"
              className="mt-2 inline-flex items-center text-[10px] font-mono tracking-[0.2em] text-white/65 uppercase hover:text-white transition-colors duration-200"
            >
              Generate audit PDF →
            </Link>
          </div>
        </div>
      </Reveal>

      {/* ── Coverage by path ──────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">
            Review coverage by path
          </p>
          <Link
            href="/enterprise/policy"
            className="text-[10px] font-mono tracking-[0.18em] text-white/35 uppercase hover:text-white/75 transition-colors duration-200"
          >
            Edit policies →
          </Link>
        </div>
        {cLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : (
          <CoverageHeatmap rows={coverage} />
        )}
      </section>

      {/* ── Live event timeline ───────────────────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">
              Live event stream
            </p>
            <p className="text-[11px] font-mono text-white/22 mt-1">
              Forwarded to your SIEM in real time · auto-refresh 30s
            </p>
          </div>
          <Link
            href="/enterprise/siem"
            className="text-[10px] font-mono tracking-[0.18em] text-white/35 uppercase hover:text-white/75 transition-colors duration-200"
          >
            SIEM Webhooks →
          </Link>
        </div>
        {eLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : (
          <ComplianceTimeline events={events} />
        )}
      </section>
    </>
  );
}
