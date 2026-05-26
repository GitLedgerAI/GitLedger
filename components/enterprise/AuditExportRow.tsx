import type { AuditExportJob } from '@/lib/enterprise-types';
import EnterpriseBadge from './EnterpriseBadge';
import { formatDate, formatRelativeDate, shortenAddress } from '@/lib/utils';

interface Props {
  job: AuditExportJob;
}

const FORMAT_TONE: Record<AuditExportJob['format'], 'emerald' | 'blue' | 'amber'> = {
  pdf:  'emerald',
  json: 'blue',
  csv:  'amber',
};

const STATUS_TONE: Record<AuditExportJob['status'], 'emerald' | 'amber' | 'red' | 'neutral'> = {
  ready:   'emerald',
  queued:  'amber',
  running: 'amber',
  failed:  'red',
};

export default function AuditExportRow({ job }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_110px_110px_130px_120px_100px] gap-2 sm:gap-4 px-5 py-3.5 border-b border-white/[0.04] hover:bg-[#111113] transition-colors duration-200">
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
          tone={FORMAT_TONE[job.format]}
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
  );
}
