'use client';

import { useState } from 'react';
import Reveal from '@/components/Reveal';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import EnterpriseBadge from '@/components/enterprise/EnterpriseBadge';
import {
  useEnterpriseOrg,
  useAuditJobs,
  useRequestAuditExport,
} from '@/lib/enterprise-hooks';
import { MOCK_ORG } from '@/lib/enterprise-mock';
import type { AuditFormat } from '@/lib/enterprise-types';
import { formatDate, formatRelativeDate, shortenAddress } from '@/lib/utils';

const FORMATS: { id: AuditFormat; label: string; tone: 'emerald' | 'blue' | 'amber' }[] = [
  { id: 'pdf',  label: 'Signed PDF', tone: 'emerald' },
  { id: 'json', label: 'JSON',       tone: 'blue'    },
  { id: 'csv',  label: 'CSV',        tone: 'amber'   },
];

const STATUS_TONE: Record<string, 'emerald' | 'amber' | 'red' | 'neutral'> = {
  ready:   'emerald',
  queued:  'amber',
  running: 'amber',
  failed:  'red',
};

export default function AuditExportPage() {
  const orgSlug = MOCK_ORG.orgSlug;
  const { data: org } = useEnterpriseOrg(orgSlug);
  const { data: jobs = [], isLoading } = useAuditJobs(orgSlug);
  const requestMut = useRequestAuditExport(orgSlug);

  const today = new Date();
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const defaultFrom = new Date(today);
  defaultFrom.setMonth(defaultFrom.getMonth() - 1);

  const [format, setFormat] = useState<AuditFormat>('pdf');
  const [dateFrom, setDateFrom] = useState(isoDate(defaultFrom));
  const [dateTo, setDateTo] = useState(isoDate(today));
  const [error, setError] = useState<string | null>(null);

  const requestExport = async () => {
    setError(null);
    if (new Date(dateFrom) > new Date(dateTo))
      return setError('From date must be before To date');
    try {
      await requestMut.mutateAsync({ format, dateFrom, dateTo });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  return (
    <>
      <EnterpriseHeader
        eyebrow="Audit Export"
        title="SOC2 evidence export"
        subtitle="One-click signed export of every staked reviewer, verdict, and EAS UID over any time window — verifiable offline against your Base contract."
        org={org}
      />

      {/* ── Request form ─────────────────────────────────────────────────── */}
      <Reveal direction="up">
        <div className="bg-[#111113] border border-white/[0.06] p-6 mb-10">
          <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase mb-5">
            Generate new export
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                Format
              </label>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`px-3 py-2 text-[10px] font-mono tracking-[0.18em] uppercase border transition-colors duration-200 ${
                      format === f.id
                        ? 'border-white/25 text-white/85 bg-white/[0.06]'
                        : 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/60'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={e => setDateFrom(e.target.value)}
                className="bg-[#0a0a0b] border border-white/10 px-3 py-2 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={isoDate(today)}
                onChange={e => setDateTo(e.target.value)}
                className="bg-[#0a0a0b] border border-white/10 px-3 py-2 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40"
              />
            </div>
            <button
              onClick={requestExport}
              disabled={requestMut.isPending}
              className="px-5 py-2.5 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200 disabled:opacity-50"
            >
              {requestMut.isPending ? 'Queuing…' : 'Generate'}
            </button>
          </div>

          {error && (
            <p className="text-[11px] font-mono text-red-400/85 mt-3">{error}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-white/[0.05]">
            <div>
              <p className="text-[10px] font-mono tracking-[0.18em] text-white/22 uppercase mb-1">
                Schema mapping
              </p>
              <p className="text-[11px] font-mono text-white/55">
                SOC2 CC7.2 · ISO 27001 A.14.2.2 · NIST 800-53 CM-3
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-[0.18em] text-white/22 uppercase mb-1">
                Signing key
              </p>
              <p className="text-[11px] font-mono text-white/55">
                {shortenAddress('0xC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DEC0DE')} · Base L2
              </p>
            </div>
            <div>
              <p className="text-[10px] font-mono tracking-[0.18em] text-white/22 uppercase mb-1">
                Verification
              </p>
              <p className="text-[11px] font-mono text-white/55">
                Recompute EAS root onchain to verify — instructions ship inside the PDF.
              </p>
            </div>
          </div>
        </div>
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
            jobs.map(job => (
              <div
                key={job.id}
                className="grid grid-cols-1 sm:grid-cols-[1.4fr_110px_110px_130px_120px_100px] gap-2 sm:gap-4 px-5 py-3.5 border-b border-white/[0.04] hover:bg-[#111113] transition-colors duration-200"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm text-white/80">
                    {formatDate(job.dateFrom)}
                    <span className="text-white/22 mx-1.5">→</span>
                    {formatDate(job.dateTo)}
                  </p>
                  <p className="text-[10px] font-mono text-white/22 mt-1">id · {job.id}</p>
                </div>
                <div className="flex items-center">
                  <EnterpriseBadge
                    label={job.format.toUpperCase()}
                    tone={job.format === 'pdf' ? 'emerald' : job.format === 'json' ? 'blue' : 'amber'}
                    size="sm"
                  />
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-mono font-bold text-white/75">
                    {job.attestationCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-[11px] font-mono text-white/55">
                    {job.generatedAt ? formatRelativeDate(job.generatedAt) : '—'}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-[11px] font-mono text-white/45">
                    {job.signedBy ? shortenAddress(job.signedBy) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-3">
                  <EnterpriseBadge label={job.status} tone={STATUS_TONE[job.status]} size="sm" />
                  {job.status === 'ready' && job.downloadUrl && (
                    <a
                      href={job.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-mono tracking-[0.18em] text-emerald-300/80 uppercase hover:text-emerald-300 transition-colors duration-200"
                    >
                      ↓ Download
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}
