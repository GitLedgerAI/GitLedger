import type { PolicyRule } from '@/lib/enterprise-types';
import { formatUsdc, formatDate } from '@/lib/utils';

interface Props {
  rule: PolicyRule;
  onDelete?: (id: string) => void;
  deleting?: boolean;
}

export default function PolicyRuleCard({ rule, onDelete, deleting }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_140px_120px_130px_80px] gap-4 px-5 py-4 border-b border-white/[0.04] hover:bg-[#111113] transition-colors duration-200">
      <div className="min-w-0">
        <p className="font-mono text-sm text-white/85 truncate">{rule.pathPattern}</p>
        <p className="text-[10px] font-mono text-white/22 mt-1">
          Added {formatDate(rule.createdAt)}
        </p>
      </div>
      <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 sm:gap-0">
        <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase tracking-widest">
          Min Stake
        </span>
        <span className="text-sm font-mono font-bold text-white/80">
          {formatUsdc(rule.minStakeUsdc)}
        </span>
      </div>
      <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 sm:gap-0">
        <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase tracking-widest">
          Reviewers
        </span>
        <span className="text-sm font-mono font-bold text-white/80">{rule.minReviewers}</span>
      </div>
      <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 sm:gap-0">
        <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase tracking-widest">
          KYC
        </span>
        {rule.requireCbVerify ? (
          <span className="inline-flex items-center px-2 py-0.5 border border-t-[1.5px] border-t-blue-400 border-white/[0.08] bg-blue-400/[0.05] text-[9px] font-mono tracking-[0.18em] text-blue-300/90 uppercase">
            CB Verified
          </span>
        ) : (
          <span className="text-[10px] font-mono text-white/25 uppercase tracking-[0.18em]">
            Not required
          </span>
        )}
      </div>
      <div className="flex items-center justify-end">
        {onDelete && (
          <button
            disabled={deleting}
            onClick={() => onDelete(rule.id)}
            className="text-[10px] font-mono tracking-[0.18em] text-white/25 uppercase hover:text-red-400/85 transition-colors duration-200 disabled:opacity-40"
          >
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>
    </div>
  );
}
