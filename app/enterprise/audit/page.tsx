'use client';

import Reveal from '@/components/Reveal';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import AuditExportForm from '@/components/enterprise/AuditExportForm';
import AuditExportRow from '@/components/enterprise/AuditExportRow';
import {
  useEnterpriseOrg,
  useAuditJobs,
  useRequestAuditExport,
} from '@/lib/enterprise-hooks';
import { MOCK_ORG } from '@/lib/enterprise-mock';

export default function AuditExportPage() {
  const orgSlug = MOCK_ORG.orgSlug;
  const { data: org } = useEnterpriseOrg(orgSlug);
  const { data: jobs = [], isLoading } = useAuditJobs(orgSlug);
  const requestMut = useRequestAuditExport(orgSlug);

  return (
    <>
      <EnterpriseHeader
        eyebrow="Audit Export"
        title="SOC2 evidence export"
        subtitle="One-click signed export of every staked reviewer, verdict, and EAS UID over any time window — verifiable offline against your Base contract."
        org={org}
      />

      {/* ── Request form ─────────────────────────────────────────────────── */}
      <Reveal direction="up" className="mb-10">
        <AuditExportForm
          submitting={requestMut.isPending}
          onSubmit={input => requestMut.mutateAsync(input)}
        />
      </Reveal>

      {/* ── Past exports ─────────────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">
            Past exports
          </p>
          <p className="text-[10px] font-mono text-white/22">
            Retained for 7 years · AICPA Trust Services-aligned
          </p>
        </div>

        <div className="border border-white/[0.06]">
          <div className="hidden sm:grid grid-cols-[1.4fr_110px_110px_130px_120px_100px] gap-4 px-5 py-2.5 border-b border-white/[0.06] bg-[#0d0d0e]">
            {['Window', 'Format', 'Records', 'Generated', 'Signed by', ''].map(h => (
              <span
                key={h}
                className="text-[10px] font-mono tracking-[0.22em] text-white/22 uppercase"
              >
                {h}
              </span>
            ))}
          </div>

          {isLoading ? (
            <div className="flex flex-col">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-white/25 font-mono text-sm">No exports generated yet</p>
            </div>
          ) : (
            jobs.map(job => <AuditExportRow key={job.id} job={job} />)
          )}
        </div>
      </section>
    </>
  );
}
