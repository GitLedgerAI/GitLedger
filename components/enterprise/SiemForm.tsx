'use client';

import { useState } from 'react';
import type { SiemKind, SiemEventKind } from '@/lib/enterprise-types';

interface Props {
  onSubmit: (input: {
    kind: SiemKind;
    label: string;
    endpointUrl: string;
    events: SiemEventKind[];
    enabled: boolean;
  }) => Promise<unknown> | unknown;
  submitting?: boolean;
}

const KINDS: { id: SiemKind; label: string }[] = [
  { id: 'splunk',      label: 'Splunk' },
  { id: 'datadog',     label: 'Datadog' },
  { id: 'vanta',       label: 'Vanta' },
  { id: 'drata',       label: 'Drata' },
  { id: 'secureframe', label: 'Secureframe' },
  { id: 'custom',      label: 'Custom Webhook' },
];

const EVENT_KINDS: { id: SiemEventKind; label: string }[] = [
  { id: 'stake.locked',     label: 'Stake locked' },
  { id: 'review.clean',     label: 'Clean review' },
  { id: 'review.slashed',   label: 'Slash' },
  { id: 'policy.violation', label: 'Policy violation' },
];

export default function SiemForm({ onSubmit, submitting = false }: Props) {
  const [kind, setKind] = useState<SiemKind>('splunk');
  const [label, setLabel] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [events, setEvents] = useState<Set<SiemEventKind>>(
    new Set<SiemEventKind>(['review.slashed', 'policy.violation']),
  );
  const [error, setError] = useState<string | null>(null);

  const toggleEvent = (id: SiemEventKind) => {
    setEvents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const friendlySiemError = (raw: string): string => {
    if (/duplicate_webhook|endpoint_already_exists|already_exists/i.test(raw))
      return 'A webhook for that endpoint already exists. Edit or remove it before adding a new one.';
    if (/invalid_endpoint_url|bad_url|invalid_url/i.test(raw))
      return 'Endpoint URL is invalid. Use a fully-qualified https:// URL your SIEM exposes.';
    if (/endpoint_unreachable|connect_timeout|ENOTFOUND|ECONNREFUSED/i.test(raw))
      return 'We could not reach that endpoint. Confirm the URL is publicly accessible (or allowlist GitLedger IPs).';
    if (/invalid_hmac_secret|hmac_failed/i.test(raw))
      return 'HMAC signing setup failed. Regenerate your SIEM secret and retry.';
    if (/not_a_member_of_this_org|FORBIDDEN|\b403\b/.test(raw))
      return 'You are not authorized to configure SIEM forwarders for this organization.';
    if (/\b401\b|UNAUTHORIZED/.test(raw))
      return 'Session expired — reconnect your wallet and try again.';
    if (/\b5\d\d\b/.test(raw))
      return 'SIEM forwarding service is temporarily unavailable. Try again in a moment.';
    return 'Failed to create webhook. Please try again.';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!label.trim()) return setError('Label is required');
    if (!endpointUrl.trim().startsWith('https://'))
      return setError('Endpoint must be an https:// URL');
    if (events.size === 0) return setError('Select at least one event');

    try {
      await onSubmit({
        kind,
        label: label.trim(),
        endpointUrl: endpointUrl.trim(),
        events: Array.from(events),
        enabled: true,
      });
      setLabel('');
      setEndpointUrl('');
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(friendlySiemError(raw));
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-[#111113] border border-white/[0.06] p-6 flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
          Destination
        </label>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(k => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={`px-3 py-1.5 text-[10px] font-mono tracking-[0.18em] uppercase border transition-colors duration-200 ${
                kind === k.id
                  ? 'border-white/25 text-white/85 bg-white/[0.06]'
                  : 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/60'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
            Label
          </label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Prod Splunk"
            className="bg-[#0a0a0b] border border-white/10 px-3 py-2.5 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40 placeholder:text-white/18"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
            Endpoint URL
          </label>
          <input
            value={endpointUrl}
            onChange={e => setEndpointUrl(e.target.value)}
            placeholder="https://splunk.acme.io/services/collector/event"
            className="bg-[#0a0a0b] border border-white/10 px-3 py-2.5 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40 placeholder:text-white/18"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
          Forward events
        </label>
        <div className="flex flex-wrap gap-2">
          {EVENT_KINDS.map(e => {
            const on = events.has(e.id);
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => toggleEvent(e.id)}
                className={`px-3 py-1.5 text-[10px] font-mono tracking-[0.18em] uppercase border transition-colors duration-200 ${
                  on
                    ? 'border-emerald-400/40 text-emerald-300/90 bg-emerald-400/[0.06]'
                    : 'border-white/[0.08] text-white/30 hover:border-white/20 hover:text-white/60'
                }`}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-[11px] font-mono text-red-400/85">{error}</p>}

      <div className="flex items-center gap-3 pt-2 border-t border-white/[0.05]">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Add Webhook'}
        </button>
        <p className="text-[10px] font-mono text-white/22">
          Outbound from CodeLedger.sol event stream on Base L2.
        </p>
      </div>
    </form>
  );
}
