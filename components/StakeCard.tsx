import Link from 'next/link';
import { Stake } from '@/lib/types';
import { formatUsdc, formatDate, daysRemaining } from '@/lib/utils';
import VerdictBadge from './VerdictBadge';

interface StakeCardProps {
  stake: Stake;
  showActions?: boolean;
}

export default function StakeCard({ stake, showActions = false }: StakeCardProps) {
  const days = daysRemaining(stake.windowEndsAt);
  const verdictMap = { active: 'ACTIVE', clean: 'CLEAN', slashed: 'SLASHED' } as const;
  const verdict = verdictMap[stake.state];

  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-4 p-5 bg-[#111113] border border-white/[0.06] hover:border-white/[0.12] transition-colors duration-200 group">
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-white/30 tracking-widest">{stake.repoSlug ?? '—'}</span>
          <span className="text-[10px] font-mono text-white/18">#{stake.prId}</span>
        </div>
        <p className="text-sm text-white/80 font-light leading-snug truncate group-hover:text-white/95 transition-colors duration-200">
          {stake.prTitle}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-[10px] font-mono text-white/25">Staked {formatDate(stake.stakedAt)}</span>
          {stake.state === 'active' && (
            <span className="text-[10px] font-mono text-amber-400/70">{days}d remaining</span>
          )}
          {stake.state === 'clean' && (stake.yieldEarned ?? 0) > 0 && (
            <span className="text-[10px] font-mono text-emerald-400/80">+{formatUsdc(stake.yieldEarned ?? 0)} yield</span>
          )}
          {stake.state === 'slashed' && (
            <span className="text-[10px] font-mono text-red-400/80">Slashed</span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <VerdictBadge verdict={verdict} size="sm" />
        <span className="text-sm font-mono font-bold text-white/70">{formatUsdc(stake.amountUsdc)}</span>
        {showActions && stake.state === 'active' && (
          <Link
            href={`/dashboard/stake/${stake.prId}?repo=${encodeURIComponent(stake.repoSlug ?? '')}`}
            className="text-[9px] font-mono tracking-widest text-white/25 hover:text-white/55 uppercase transition-colors duration-200"
          >
            View →
          </Link>
        )}
      </div>
    </div>
  );
}
