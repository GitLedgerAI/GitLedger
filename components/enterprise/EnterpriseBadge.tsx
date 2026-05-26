interface Props {
  label: string;
  tone?: 'emerald' | 'amber' | 'blue' | 'red' | 'neutral';
  size?: 'sm' | 'md';
}

const TONE: Record<NonNullable<Props['tone']>, string> = {
  emerald: 'border-t-emerald-400 text-emerald-300/90 bg-emerald-400/[0.05]',
  amber:   'border-t-amber-400   text-amber-300/90   bg-amber-400/[0.05]',
  blue:    'border-t-blue-400    text-blue-300/90    bg-blue-400/[0.05]',
  red:     'border-t-red-400     text-red-300/90     bg-red-400/[0.05]',
  neutral: 'border-t-white/40    text-white/70       bg-white/[0.04]',
};

export default function EnterpriseBadge({ label, tone = 'neutral', size = 'md' }: Props) {
  const px = size === 'sm' ? 'px-2 py-0.5 text-[9px]' : 'px-3 py-1 text-[10px]';
  return (
    <span
      className={`inline-flex items-center border border-white/[0.08] border-t-[1.5px] font-mono tracking-[0.18em] uppercase ${px} ${TONE[tone]}`}
    >
      {label}
    </span>
  );
}
