'use client';

import { useState } from 'react';
import type { AuditFormat } from '@/lib/enterprise-types';
import { shortenAddress } from '@/lib/utils';

interface Props {
  onSubmit: (input: {
    format: AuditFormat;
    dateFrom: string;
    dateTo: string;
  }) => Promise<unknown> | unknown;
  submitting?: boolean;
}

const FORMATS: { id: AuditFormat; label: string }[] = [
  { id: 'pdf',  label: 'Signed PDF' },
  { id: 'json', label: 'JSON'       },
  { id: 'csv',  label: 'CSV'        },
];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function AuditExportForm({ onSubmit, submitting = false }: Props) {
  const today = new Date();
  const todayIso = isoDate(today);
  const defaultFrom = new Date(today);
  defaultFrom.setMonth(defaultFrom.getMonth() - 1);

  const [format, setFormat] = useState<AuditFormat>('pdf');
  const [dateFrom, setDateFrom] = useState(isoDate(defaultFrom));
  const [dateTo, setDateTo] = useState(todayIso);
  const [error, setError] = useState<string | null>(null);

  const friendlyError = (raw: string): string => {
    if (/not_a_member_of_this_org/i.test(raw))
      return 'You are not a member of this organization. Connect a wallet linked to your org membership to export audit evidence.';
    if (/\b403\b|FORBIDDEN/.test(raw))
      return 'Permission denied — your role cannot generate audit exports.';
    if (/\b401\b|UNAUTHORIZED/.test(raw))
      return 'Session expired — reconnect your wallet and try again.';
    if (/\b404\b|NOT_FOUND/.test(raw))
      return 'Audit export service unavailable for this org.';
    return 'Export failed. Please try again.';
  };

  const submit = async () => {
    setError(null);
    if (new Date(dateFrom) > new Date(dateTo))
      return setError('From date must be before To date');
    try {
      await onSubmit({ format, dateFrom, dateTo });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(friendlyError(raw));
    }
  };

  return (
    <div className="bg-[#111113] border border-white/[0.06] p-6">
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
            max={todayIso}
            onChange={e => setDateTo(e.target.value)}
            className="bg-[#0a0a0b] border border-white/10 px-3 py-2 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40"
          />
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="px-5 py-2.5 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200 disabled:opacity-50"
        >
          {submitting ? 'Queuing…' : 'Generate'}
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
  );
}
