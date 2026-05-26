'use client';

import { useState } from 'react';
import type { SiemConfig, SiemEventKind } from '@/lib/enterprise-types';
import { formatRelativeDate } from '@/lib/utils';

interface Props {
  config: SiemConfig;
  onToggle: (enabled: boolean) => void;
  onTest: () => Promise<{ ok: boolean; deliveredAt: string; error?: string }>;
  onDelete: () => void;
}

const KIND_LABEL: Record<string, string> = {
  splunk:      'Splunk',
  datadog:     'Datadog',
  vanta:       'Vanta',
  drata:       'Drata',
  secureframe: 'Secureframe',
  custom:      'Custom Webhook',
};

const KIND_TONE: Record<string, string> = {
  splunk:      'border-t-amber-400 text-amber-300/90',
  datadog:     'border-t-violet-400 text-violet-300/90',
  vanta:       'border-t-emerald-400 text-emerald-300/90',
  drata:       'border-t-blue-400 text-blue-300/90',
  secureframe: 'border-t-cyan-400 text-cyan-300/90',
  custom:      'border-t-white/40 text-white/75',
};

const EVENT_KINDS: { id: SiemEventKind; label: string }[] = [
  { id: 'stake.locked',     label: 'Stake locked' },
  { id: 'review.clean',     label: 'Clean review' },
  { id: 'review.slashed',   label: 'Slash' },
  { id: 'policy.violation', label: 'Policy violation' },
];

export default function SiemRow({ config, onToggle, onTest, onDelete }: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await onTest();
      setTestResult({
        ok: r.ok,
        message: r.ok
          ? `Delivered at ${new Date(r.deliveredAt).toLocaleTimeString()}`
          : r.error ?? 'Delivery failed',
      });
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Delivery failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-[#111113] border border-white/[0.06] p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 border border-white/[0.08] border-t-[1.5px] bg-white/[0.04] text-[9px] font-mono tracking-[0.18em] uppercase ${
                KIND_TONE[config.kind]
              }`}
            >
              {KIND_LABEL[config.kind]}
            </span>
            <span className="text-sm font-medium text-white/85">{config.label}</span>
            {config.enabled ? (
              <span className="text-[9px] font-mono tracking-[0.2em] text-emerald-300/80 uppercase">
                ● Active
              </span>
            ) : (
              <span className="text-[9px] font-mono tracking-[0.2em] text-white/25 uppercase">
                ○ Paused
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] text-white/35 truncate">{config.endpointUrl}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={e => onToggle(e.target.checked)}
            className="accent-emerald-400"
          />
          <span className="text-[10px] font-mono tracking-[0.18em] text-white/35 uppercase">
            Enabled
          </span>
        </label>
      </div>

      <div>
        <p className="text-[10px] font-mono tracking-[0.22em] text-white/25 uppercase mb-2">
          Forwarded events
        </p>
        <div className="flex flex-wrap gap-2">
          {EVENT_KINDS.map(({ id, label }) => {
            const on = config.events.includes(id);
            return (
              <span
                key={id}
                className={`px-2 py-1 text-[9px] font-mono tracking-[0.18em] uppercase border ${
                  on
                    ? 'border-white/20 text-white/80 bg-white/[0.05]'
                    : 'border-white/[0.06] text-white/22'
                }`}
              >
                {label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/[0.05]">
        <div className="flex flex-col gap-0.5">
          <p className="text-[10px] font-mono tracking-[0.18em] text-white/22 uppercase">
            Last delivery
          </p>
          {config.lastDeliveredAt ? (
            <p
              className={`text-[11px] font-mono ${
                config.lastDeliveryStatus === 'failed'
                  ? 'text-red-400/85'
                  : 'text-white/55'
              }`}
            >
              {config.lastDeliveryStatus === 'failed' ? 'Failed · ' : 'OK · '}
              {formatRelativeDate(config.lastDeliveredAt)}
              {config.lastDeliveryError && ` — ${config.lastDeliveryError}`}
            </p>
          ) : (
            <p className="text-[11px] font-mono text-white/25">Never delivered</p>
          )}
          {testResult && (
            <p
              className={`text-[10px] font-mono mt-1 ${
                testResult.ok ? 'text-emerald-300/85' : 'text-red-400/85'
              }`}
            >
              Test: {testResult.message}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={runTest}
            disabled={testing}
            className="px-3 py-1.5 border border-white/15 text-[10px] font-mono tracking-[0.18em] text-white/70 uppercase hover:border-white/35 hover:text-white transition-colors duration-200 disabled:opacity-50"
          >
            {testing ? 'Sending…' : 'Test'}
          </button>
          <button
            onClick={onDelete}
            className="text-[10px] font-mono tracking-[0.18em] text-white/22 uppercase hover:text-red-400/85 transition-colors duration-200"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
