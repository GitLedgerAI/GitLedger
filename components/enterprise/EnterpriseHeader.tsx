'use client';

import { motion } from 'framer-motion';
import type { EnterpriseOrg } from '@/lib/enterprise-types';

interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
  org?: EnterpriseOrg | null;
  right?: React.ReactNode;
}

export default function EnterpriseHeader({ eyebrow, title, subtitle, org, right }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-8"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-[10px] font-mono tracking-[0.28em] text-emerald-300/70 uppercase">
            {eyebrow}
          </p>
          {org && (
            <span className="px-2 py-0.5 border border-t-[1.5px] border-t-emerald-400 border-white/[0.08] bg-emerald-400/[0.05] text-[9px] font-mono tracking-[0.18em] text-emerald-300/85 uppercase">
              {org.tier}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-white/30 text-sm mt-2 font-light max-w-2xl">{subtitle}</p>
        )}
        {org && (
          <div className="flex items-center gap-4 mt-3">
            <span className="text-[11px] font-mono text-white/35">
              {org.displayName} · {org.orgSlug}
            </span>
            <span className="text-[11px] font-mono text-white/20">·</span>
            <span className="text-[11px] font-mono text-white/35">
              {org.memberCount.toLocaleString()} members · {org.repoCount} repos
            </span>
          </div>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </motion.div>
  );
}
