'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';

import Footer from '@/components/Footer';
import ScoreRing from '@/components/ScoreRing';
import StakeCard from '@/components/StakeCard';
import Reveal from '@/components/Reveal';
import { useAuth } from '@/lib/auth-context';
import { useMyStakes, useReviewer } from '@/lib/hooks';
import { formatUsdc, daysRemaining } from '@/lib/utils';

export default function MyDashboard() {
  const { walletAddress, githubSession, isFullyRegistered, displayName, openModal } = useAuth();
  const basename = githubSession?.basename ?? null;

  const { data: stakes = [], isLoading: stakesLoading } = useMyStakes(walletAddress);
  const { data: reviewer, isLoading: reviewerLoading } = useReviewer(basename);

  const [tab, setTab] = useState<'active' | 'history'>('active');

  const active = stakes.filter(s => s.state === 'active' || s.state === 'pending_stake');
  const past   = stakes.filter(s => s.state === 'clean' || s.state === 'slashed');
  const pendingCount = stakes.filter(s => s.state === 'pending_stake').length;

  const totalActiveStake = active.reduce((sum, s) => sum + s.amountUsdc, 0);
  const totalYield = past.filter(s => s.state === 'clean').reduce((sum, s) => sum + (s.yieldEarned ?? 0), 0);

  const isLoading = stakesLoading || reviewerLoading;

  // Not authenticated
  if (!isFullyRegistered) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
        <main className="flex-1 max-w-6xl mx-auto px-6 sm:px-12 py-12 w-full flex flex-col items-center justify-center gap-6 text-center">
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase">My Dashboard</p>
          <h1 className="text-2xl font-bold text-white tracking-tight">Connect to view your dashboard</h1>
          <p className="text-white/30 text-sm font-light max-w-xs leading-relaxed">
            Link your GitHub account and connect a wallet to see your active stakes, yield history, and reputation score.
          </p>
          <button
            onClick={openModal}
            className="px-6 py-3 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-all duration-200"
          >
            Get Started
          </button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">

      <main className="flex-1 max-w-6xl mx-auto px-6 sm:px-12 py-12 w-full">

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-12 pb-10 border-b border-white/[0.06]"
        >
          <div>
            <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-3">My Dashboard</p>
            <h1 className="text-3xl font-bold text-white tracking-tight">{displayName}</h1>
            {githubSession?.githubLogin && (
              <p className="text-white/30 text-sm mt-1 font-light">@{githubSession.githubLogin}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            {reviewer && <ScoreRing score={reviewer.reputationScore} size={72} />}
            {basename && (
              <Link href={`/reviewer/${encodeURIComponent(basename)}`}
                className="text-[11px] font-mono tracking-[0.18em] text-white/25 uppercase hover:text-white/55 transition-colors duration-200">
                Public Profile →
              </Link>
            )}
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] mb-12">
          {[
            { label: 'Active Stake',  value: formatUsdc(totalActiveStake), sub: `${active.length} open windows` },
            { label: 'Yield Earned',  value: formatUsdc(totalYield),       sub: 'lifetime' },
            { label: 'Clean Reviews', value: (reviewer?.cleanCount ?? 0).toLocaleString(), sub: `of ${(reviewer?.cleanCount ?? 0) + (reviewer?.slashCount ?? 0)} total` },
            { label: 'Slash Events',  value: (reviewer?.slashCount ?? 0).toLocaleString(), sub: formatUsdc(reviewer?.totalSlashedUsdc ?? 0) + ' lost' },
          ].map(({ label, value, sub }, i) => (
            <Reveal key={label} direction="up" delay={i * 0.06}>
              <div className="bg-[#0a0a0b] px-6 py-5 flex flex-col gap-1">
                <p className="text-[10px] font-mono tracking-[0.22em] text-white/25 uppercase">{label}</p>
                {isLoading
                  ? <div className="h-6 w-16 bg-white/[0.04] animate-pulse mt-1" />
                  : <p className="text-xl font-bold font-mono text-white/85 mt-1">{value}</p>
                }
                <p className="text-[10px] font-mono text-white/20">{sub}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="flex items-center gap-1 mb-6">
          {(['active', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-[10px] font-mono tracking-widest uppercase transition-all duration-200 ${
                tab === t ? 'bg-white/[0.08] text-white/80 border border-white/15' : 'text-white/25 border border-transparent hover:text-white/50'
              }`}
            >
              {t === 'active' ? `Active (${active.length})` : `History (${past.length})`}
            </button>
          ))}
        </div>

        {!isLoading && pendingCount > 0 && (
          <div className="mb-6 border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3">
            <p className="text-[10px] font-mono tracking-[0.16em] uppercase text-amber-300/80">
              {pendingCount} stake awaiting on-chain confirmation.
            </p>
            <p className="text-[10px] font-mono text-white/35 mt-1">
              Open the pending stake and complete Confirm Stake. This dashboard auto-refreshes every 10s.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && tab === 'active' && (
          <div className="flex flex-col gap-2">
            {active.length === 0 && (
              <div className="py-16 text-center border border-white/[0.06]">
                <p className="text-white/20 font-mono text-sm mb-4">No active stakes</p>
                <p className="text-[11px] font-mono text-white/12">Review a PR on a GitLedger-enabled repo to start staking</p>
              </div>
            )}
            {active.map(stake => (
              <motion.div key={stake.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <StakeCard stake={stake} showActions />
                <div className="h-px bg-white/[0.04] relative overflow-hidden">
                  <motion.div className="absolute inset-y-0 left-0 bg-amber-400/40"
                    initial={{ width: 0 }}
                    animate={{ width: `${((30 - daysRemaining(stake.windowEndsAt)) / 30) * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!isLoading && tab === 'history' && (
          <div className="flex flex-col gap-2">
            {past.length === 0 && (
              <div className="py-16 text-center border border-white/[0.06]">
                <p className="text-white/20 font-mono text-sm">No past stakes yet</p>
              </div>
            )}
            {past.map(stake => (
              <motion.div key={stake.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <StakeCard stake={stake} />
              </motion.div>
            ))}
          </div>
        )}

        {reviewer && reviewer.reputationScore >= 700 && (
          <Reveal direction="up" className="mt-10">
            <div className="flex items-center gap-4 px-6 py-4 border border-emerald-400/15 bg-emerald-400/[0.03]">
              <span className="w-2 h-2 rounded-full bg-emerald-400/60 animate-pulse shrink-0" />
              <div>
                <p className="text-[11px] font-mono text-emerald-300/70 tracking-wide">1.5× YIELD MULTIPLIER ACTIVE</p>
                <p className="text-[10px] font-mono text-white/20 mt-0.5">
                  Your score of {reviewer.reputationScore} qualifies you for enhanced yield on all clean reviews.
                </p>
              </div>
            </div>
          </Reveal>
        )}
      </main>
      <Footer />
    </div>
  );
}
