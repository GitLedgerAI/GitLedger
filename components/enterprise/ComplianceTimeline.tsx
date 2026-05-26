import type { ComplianceEvent, ComplianceEventKind } from '@/lib/enterprise-types';
import { formatUsdc, formatRelativeDate, shortenUid } from '@/lib/utils';

interface Props {
  events: ComplianceEvent[];
}

const KIND_LABEL: Record<ComplianceEventKind, string> = {
  review_clean:      'Clean Review',
  review_slashed:    'Slash',
  policy_violation:  'Policy Violation',
  stake_locked:      'Stake Locked',
  export_generated:  'Audit Export',
};

const KIND_TONE: Record<ComplianceEventKind, { dot: string; label: string }> = {
  review_clean:     { dot: 'bg-emerald-400', label: 'text-emerald-300/90' },
  review_slashed:   { dot: 'bg-red-400',     label: 'text-red-300/90'     },
  policy_violation: { dot: 'bg-amber-400',   label: 'text-amber-300/90'   },
  stake_locked:     { dot: 'bg-blue-400',    label: 'text-blue-300/90'    },
  export_generated: { dot: 'bg-white/55',    label: 'text-white/75'       },
};

export default function ComplianceTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="py-12 text-center border border-white/[0.06]">
        <p className="text-white/25 font-mono text-sm">No compliance events in this window</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {events.map((evt, i) => {
        const tone = KIND_TONE[evt.kind];
        const last = i === events.length - 1;
        return (
          <div key={evt.id} className="grid grid-cols-[20px_1fr] gap-4 px-1">
            {/* Rail */}
            <div className="relative flex flex-col items-center">
              <span className={`mt-2 w-2 h-2 rounded-full ${tone.dot}`} />
              {!last && <span className="flex-1 w-px bg-white/[0.06] mt-1" />}
            </div>
            <div className={`pb-6 ${last ? '' : 'border-b border-white/[0.04]'}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-[10px] font-mono tracking-[0.2em] uppercase ${tone.label}`}>
                  {KIND_LABEL[evt.kind]}
                </span>
                <span className="text-[10px] font-mono text-white/22">·</span>
                <span className="text-[10px] font-mono text-white/30">
                  {formatRelativeDate(evt.occurredAt)}
                </span>
                {evt.amountUsdc !== undefined && (
                  <>
                    <span className="text-[10px] font-mono text-white/22">·</span>
                    <span className="text-[10px] font-mono font-bold text-white/65">
                      {formatUsdc(evt.amountUsdc)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap mt-1.5 text-sm">
                {evt.repoSlug && (
                  <span className="font-mono text-white/75">
                    {evt.repoSlug}
                    {evt.prId !== undefined && (
                      <span className="text-white/30"> #{evt.prId}</span>
                    )}
                  </span>
                )}
                {evt.pathPattern && (
                  <span className="font-mono text-[11px] text-white/45 border border-white/[0.06] px-1.5 py-0.5">
                    {evt.pathPattern}
                  </span>
                )}
                {evt.reviewer && (
                  <span className="font-mono text-[11px] text-white/45">{evt.reviewer}</span>
                )}
              </div>
              {evt.reason && (
                <p className="text-[11px] text-white/40 mt-2 font-light leading-relaxed">
                  {evt.reason}
                </p>
              )}
              {evt.attestationUid && (
                <p className="text-[10px] font-mono text-white/22 mt-1.5">
                  EAS · {shortenUid(evt.attestationUid)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
