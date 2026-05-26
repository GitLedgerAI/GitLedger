import type { ComplianceCoveragePoint } from '@/lib/enterprise-types';

interface Props {
  series: ComplianceCoveragePoint[];
  height?: number;
}

export default function CoverageSparkline({ series, height = 96 }: Props) {
  if (series.length < 2) return null;

  const w = 100;
  const h = 30;
  const xs = series.map((_, i) => (i / (series.length - 1)) * w);
  const min = Math.min(...series.map(p => p.coveragePct)) - 2;
  const max = Math.max(...series.map(p => p.coveragePct)) + 2;
  const ys = series.map(p => h - ((p.coveragePct - min) / (max - min)) * h);
  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${ys[i].toFixed(2)}`).join(' ');
  const areaPath = `${linePath} L ${w} ${h} L 0 ${h} Z`;

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
      >
        <defs>
          <linearGradient id="cov-spark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(52,211,153,0.30)" />
            <stop offset="100%" stopColor="rgba(52,211,153,0.0)" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#cov-spark)" />
        <path d={linePath} fill="none" stroke="#34d399" strokeWidth={0.5} strokeLinecap="round" />
        {series.map((p, i) =>
          p.slashes > 0 ? (
            <circle key={i} cx={xs[i]} cy={ys[i]} r={0.8} fill="#f87171" />
          ) : null,
        )}
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between text-[9px] font-mono text-white/22 tracking-wide">
        <span>{series[0].date}</span>
        <span>{series[series.length - 1].date}</span>
      </div>
    </div>
  );
}
