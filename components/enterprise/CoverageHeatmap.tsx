import type { CoverageRow } from '@/lib/enterprise-types';
import { formatUsdc } from '@/lib/utils';

interface Props {
  rows: CoverageRow[];
}

function coverageTone(pct: number) {
  if (pct >= 95) return 'bg-emerald-400/[0.18] text-emerald-300/95 border-emerald-400/40';
  if (pct >= 85) return 'bg-emerald-400/[0.10] text-emerald-300/80 border-emerald-400/25';
  if (pct >= 75) return 'bg-amber-400/[0.10]   text-amber-300/85   border-amber-400/25';
  return            'bg-red-400/[0.10]     text-red-300/85     border-red-400/25';
}

export default function CoverageHeatmap({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center border border-white/[0.06]">
        <p className="text-white/25 font-mono text-sm">No coverage data yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col border border-white/[0.06]">
      <div className="hidden sm:grid grid-cols-[1.6fr_120px_140px_100px_80px] gap-4 px-5 py-2.5 border-b border-white/[0.06] bg-[#0d0d0e]">
        {['File pattern', 'Coverage', 'Avg stake', 'Reviewed', 'Slashes'].map(h => (
          <span key={h} className="text-[10px] font-mono tracking-[0.22em] text-white/22 uppercase">
            {h}
          </span>
        ))}
      </div>
      {rows.map(row => {
        const widthPct = Math.max(2, Math.min(100, row.coveragePct));
        return (
          <div
            key={row.pathPattern}
            className="grid grid-cols-1 sm:grid-cols-[1.6fr_120px_140px_100px_80px] gap-2 sm:gap-4 px-5 py-3.5 border-b border-white/[0.04] hover:bg-[#111113] transition-colors duration-200"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono text-sm text-white/80 truncate">{row.pathPattern}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-20 h-1.5 bg-white/[0.06] overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 ${coverageTone(row.coveragePct).split(' ')[0]}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span
                className={`px-2 py-0.5 text-[9px] font-mono tracking-[0.18em] uppercase border ${coverageTone(row.coveragePct)}`}
              >
                {row.coveragePct.toFixed(1)}%
              </span>
            </div>
            <span className="text-sm font-mono font-bold text-white/70">
              {formatUsdc(row.avgStakeUsdc)}
            </span>
            <span className="text-sm font-mono text-white/55">
              {row.reviewedCount} / {row.totalPrs}
            </span>
            <span
              className={`text-sm font-mono font-bold ${
                row.slashCount === 0 ? 'text-white/30' : 'text-red-400/85'
              }`}
            >
              {row.slashCount}
            </span>
          </div>
        );
      })}
    </div>
  );
}
