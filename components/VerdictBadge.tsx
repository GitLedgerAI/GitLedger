import { Verdict } from '@/lib/types';

const CONFIG = {
  ACTIVE:  { label: 'Active',  classes: 'border-t-blue-400    text-blue-300/90    bg-blue-400/[0.05]'    },
  CLEAN:   { label: 'Clean',   classes: 'border-t-emerald-400 text-emerald-300/90 bg-emerald-400/[0.05]' },
  SLASHED: { label: 'Slashed', classes: 'border-t-red-400     text-red-300/90     bg-red-400/[0.05]'     },
} as const;

interface VerdictBadgeProps {
  verdict: Verdict;
  size?: 'sm' | 'md';
}

export default function VerdictBadge({ verdict, size = 'md' }: VerdictBadgeProps) {
  const { label, classes } = CONFIG[verdict];
  const px = size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]';
  return (
    <span className={`inline-flex items-center border border-white/[0.08] border-t-[1.5px] font-mono tracking-[0.16em] uppercase ${px} ${classes}`}>
      {label}
    </span>
  );
}
