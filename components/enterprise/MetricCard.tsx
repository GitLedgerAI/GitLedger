interface Props {
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'amber' | 'red' | 'blue' | 'neutral';
  loading?: boolean;
}

const ACCENT_TOP: Record<NonNullable<Props['accent']>, string> = {
  emerald: 'border-t-emerald-400',
  amber:   'border-t-amber-400',
  red:     'border-t-red-400',
  blue:    'border-t-blue-400',
  neutral: 'border-t-white/30',
};

const ACCENT_VALUE: Record<NonNullable<Props['accent']>, string> = {
  emerald: 'text-emerald-300/90',
  amber:   'text-amber-300/90',
  red:     'text-red-300/90',
  blue:    'text-blue-300/90',
  neutral: 'text-white/85',
};

export default function MetricCard({ label, value, sub, accent = 'neutral', loading = false }: Props) {
  return (
    <div className={`bg-[#111113] border border-white/[0.06] border-t-[1.5px] ${ACCENT_TOP[accent]} px-5 py-4 flex flex-col gap-1`}>
      <p className="text-[10px] font-mono tracking-[0.22em] text-white/25 uppercase">{label}</p>
      {loading ? (
        <div className="h-6 w-20 bg-white/[0.05] animate-pulse mt-1" />
      ) : (
        <p className={`text-xl font-bold font-mono mt-1 ${ACCENT_VALUE[accent]}`}>{value}</p>
      )}
      {sub && <p className="text-[10px] font-mono text-white/22">{sub}</p>}
    </div>
  );
}
