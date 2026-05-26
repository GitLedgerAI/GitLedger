'use client';

import { useState } from 'react';

interface Props {
  onSubmit: (input: {
    pathPattern: string;
    minStakeUsdc: number;
    minReviewers: number;
    requireCbVerify: boolean;
  }) => Promise<unknown> | unknown;
  submitting?: boolean;
}

export default function PolicyRuleForm({ onSubmit, submitting = false }: Props) {
  const [pathPattern, setPathPattern] = useState('');
  const [minStake, setMinStake] = useState('500');           // USDC dollars
  const [minReviewers, setMinReviewers] = useState('2');
  const [requireCbVerify, setRequireCbVerify] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pathPattern.trim()) return setError('Path pattern is required');
    const stakeDollars = Number(minStake);
    if (!Number.isFinite(stakeDollars) || stakeDollars < 0.5)
      return setError('Min stake must be at least $0.50');
    const reviewers = Number(minReviewers);
    if (!Number.isInteger(reviewers) || reviewers < 1 || reviewers > 10)
      return setError('Reviewers must be between 1 and 10');

    try {
      await onSubmit({
        pathPattern: pathPattern.trim(),
        minStakeUsdc: Math.round(stakeDollars * 1_000_000),
        minReviewers: reviewers,
        requireCbVerify,
      });
      setPathPattern('');
      setMinStake('500');
      setMinReviewers('2');
      setRequireCbVerify(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
    }
  };

  return (
    <form
      onSubmit={submit}
      className="bg-[#111113] border border-white/[0.06] p-6 flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
          Path pattern
        </label>
        <input
          value={pathPattern}
          onChange={e => setPathPattern(e.target.value)}
          placeholder='contracts/** or src/auth/**'
          className="bg-[#0a0a0b] border border-white/10 px-3 py-2.5 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40 placeholder:text-white/18"
        />
        <p className="text-[10px] font-mono text-white/22">
          Matches PR diffs touching files within this glob.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
            Min stake (USDC)
          </label>
          <input
            value={minStake}
            onChange={e => setMinStake(e.target.value)}
            inputMode="decimal"
            className="bg-[#0a0a0b] border border-white/10 px-3 py-2.5 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
            Min reviewers
          </label>
          <input
            value={minReviewers}
            onChange={e => setMinReviewers(e.target.value)}
            inputMode="numeric"
            className="bg-[#0a0a0b] border border-white/10 px-3 py-2.5 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40"
          />
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={requireCbVerify}
          onChange={e => setRequireCbVerify(e.target.checked)}
          className="accent-emerald-400"
        />
        <span className="text-sm text-white/75">Require Coinbase KYC-verified reviewers</span>
      </label>

      {error && (
        <p className="text-[11px] font-mono text-red-400/85">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-white/[0.05]">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200 disabled:opacity-50"
        >
          {submitting ? 'Adding…' : 'Add Policy'}
        </button>
        <p className="text-[10px] font-mono text-white/22">
          Enforced by CompliancePolicy.sol on Base L2.
        </p>
      </div>
    </form>
  );
}
