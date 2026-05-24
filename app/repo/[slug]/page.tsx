'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState } from 'react';

import Footer from '@/components/Footer';
import VerdictBadge from '@/components/VerdictBadge';
import Reveal from '@/components/Reveal';
import { useRepo, useRepoAttestations } from '@/lib/hooks';
import { formatUsdc, formatRelativeDate, shortenUid } from '@/lib/utils';
import type { Verdict } from '@/lib/types';

type FilterVerdict = 'ALL' | Verdict;
const FILTERS: FilterVerdict[] = ['ALL', 'ACTIVE', 'CLEAN', 'SLASHED'];

export default function RepoReviews({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const [filter, setFilter] = useState<FilterVerdict>('ALL');

  const { data: repo, isLoading: repoLoading, isError } = useRepo(slug);
  const { data: allAttestations = [], isLoading: attLoading } = useRepoAttestations(slug);

  const filtered = filter === 'ALL' ? allAttestations : allAttestations.filter(a => a.verdict === filter);

  // Derive name/owner from slug if not provided by backend
  const repoName = repo?.name ?? slug.split('/').pop() ?? slug;
  const totalReviews = repo?.totalReviews ?? allAttestations.length;
  const slashCount   = repo?.slashCount ?? 0;
  const slashPct     = totalReviews > 0 ? ((slashCount / totalReviews) * 100).toFixed(1) : '0.0';
  const cleanPct     = totalReviews > 0 ? (((totalReviews - slashCount) / totalReviews) * 100).toFixed(1) : '100.0';

  const trustScore = repo?.trustScore ?? 0;
  const trustColor =
    trustScore >= 80 ? 'text-emerald-400' :
    trustScore >= 60 ? 'text-amber-400' :
    'text-red-400';
  const trustBorderColor =
    trustScore >= 80 ? 'bg-emerald-400/60' :
    trustScore >= 60 ? 'bg-amber-400/60' :
    'bg-red-400/60';

  if (repoLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
        <main className="flex-1 max-w-6xl mx-auto px-6 sm:px-12 py-12 w-full">
          <div className="h-4 w-24 bg-white/[0.04] animate-pulse mb-10" />
          <div className="h-24 bg-white/[0.02] animate-pulse mb-12" />
          <div className="grid grid-cols-4 gap-px bg-white/[0.06]">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#0a0a0b] px-6 py-5 h-20 animate-pulse" />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (isError || !repo) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
        <main className="flex-1 max-w-6xl mx-auto px-6 sm:px-12 py-12 w-full flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-white/20 font-mono text-sm">Repository not found</p>
          <Link href="/explore" className="text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors">
            ← Back to Leaderboard
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">

      <main className="flex-1 max-w-6xl mx-auto px-6 sm:px-12 py-12 w-full">

        <Link href="/explore" className="inline-flex items-center gap-2 text-[11px] font-mono tracking-[0.18em] text-white/25 uppercase hover:text-white/55 transition-colors duration-200 mb-10">
          ← Leaderboard
        </Link>

        {/* Repo header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-12 pb-12 border-b border-white/[0.06]"
        >
          <div className="flex-1">
            <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-2">Repository</p>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">{repoName}</h1>
              {repo.language && (
                <span className="px-2 py-0.5 border border-white/[0.08] text-[10px] font-mono text-white/30 tracking-wider">{repo.language}</span>
              )}
              {(repo.stars ?? 0) >= 1000 && (
                <span className="px-2 py-0.5 border border-amber-400/20 text-[10px] font-mono text-amber-300/60 tracking-wider">
                  ★ {((repo.stars ?? 0) / 1000).toFixed(1)}k
                </span>
              )}
            </div>
            <p className="text-white/30 text-sm font-mono">{repo.slug}</p>
          </div>

          {/* Trust score */}
          <div className="flex flex-col items-center gap-2 px-8 py-5 border border-white/[0.08] bg-[#111113]">
            <p className="text-[9px] font-mono tracking-[0.3em] text-white/20 uppercase">Trust Score</p>
            {repo.trustScore !== undefined
              ? <p className={`text-4xl font-bold font-mono ${trustColor}`}>{trustScore}</p>
              : <p className="text-4xl font-bold font-mono text-white/20">—</p>
            }
            <div className={`w-1.5 h-1.5 rounded-full ${trustBorderColor} animate-pulse`} />
          </div>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/[0.06] mb-12">
          {[
            { label: 'Total Staked',   value: formatUsdc(repo.totalStaked ?? 0) },
            { label: 'Active Reviews', value: (repo.activeReviews ?? 0).toLocaleString() },
            { label: 'Total Reviews',  value: totalReviews.toLocaleString() },
            { label: 'Slash Events',   value: slashCount.toLocaleString() },
          ].map(({ label, value }, i) => (
            <Reveal key={label} direction="up" delay={i * 0.05}>
              <div className="bg-[#0a0a0b] px-6 py-5">
                <p className="text-[10px] font-mono tracking-[0.22em] text-white/25 uppercase mb-2">{label}</p>
                <p className="text-xl font-bold font-mono text-white/85">{value}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Trust breakdown */}
        <Reveal direction="up" className="mb-12">
          <div className="border border-white/[0.08] bg-[#111113] p-6">
            <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-5">Trust Breakdown</p>
            <div className="flex flex-col gap-4">
              {[
                { label: 'Clean Reviews',   pct: parseFloat(cleanPct), color: 'bg-emerald-400/60', text: 'text-emerald-400/80' },
                { label: 'Slashed Reviews', pct: parseFloat(slashPct), color: 'bg-red-400/60',     text: 'text-red-400/80'     },
              ].map(({ label, pct, color, text }) => (
                <div key={label} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-white/30 uppercase tracking-wide">{label}</span>
                    <span className={`text-[11px] font-mono font-bold ${text}`}>{pct}%</span>
                  </div>
                  <div className="h-1 bg-white/[0.05] w-full">
                    <motion.div
                      className={`h-full ${color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {slashCount > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 border border-red-400/15 bg-red-400/[0.03] mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400/60" />
            <span className="text-[11px] font-mono text-red-300/60">
              {slashCount} slash event{slashCount > 1 ? 's' : ''} on record — review history indicates elevated risk
            </span>
          </div>
        )}

        {/* Attestation table */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-1">Staked Reviews</p>
              <p className="text-white/50 text-sm">{allAttestations.length} on-chain records</p>
            </div>
            <div className="flex items-center gap-1">
              {FILTERS.map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 text-[10px] font-mono tracking-widest uppercase transition-all duration-200 ${
                    filter === f ? 'bg-white/[0.08] text-white/80 border border-white/15' : 'text-white/25 border border-transparent hover:text-white/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden sm:grid grid-cols-[1fr_120px_80px_100px_90px_110px] gap-4 px-5 py-2 border-b border-white/[0.06] mb-1">
            {['PR', 'Reviewer', 'Stake', 'Verdict', 'Score Δ', 'Date'].map(h => (
              <span key={h} className="text-[10px] font-mono tracking-widest text-white/20 uppercase">{h}</span>
            ))}
          </div>

          {attLoading && (
            <div className="flex flex-col gap-px">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 bg-white/[0.02] animate-pulse" />)}
            </div>
          )}

          {!attLoading && (
            <div className="flex flex-col">
              {filtered.length === 0 && (
                <div className="px-5 py-12 text-center border border-white/[0.06]">
                  <p className="text-white/20 text-sm font-mono">No attestations found</p>
                </div>
              )}
              {filtered.map((att, i) => (
                <motion.div key={att.uid}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_120px_80px_100px_90px_110px] gap-2 sm:gap-4 px-5 py-4 border-b border-white/[0.04] hover:bg-[#111113] transition-colors duration-200 group"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-white/30">#{att.prId}</span>
                    </div>
                    <p className="text-sm text-white/65 font-light truncate group-hover:text-white/85 transition-colors duration-200">{att.prTitle}</p>
                    <a href={`https://base.easscan.org/attestation/view/${att.uid}`} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] font-mono text-white/18 hover:text-white/45 transition-colors duration-200">
                      {shortenUid(att.uid)} ↗
                    </a>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-start gap-1 sm:gap-0">
                    <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase">Reviewer</span>
                    <Link href={`/reviewer/${encodeURIComponent(att.basename)}`}
                      className="text-sm font-mono text-white/60 hover:text-white/90 transition-colors duration-200">
                      {att.basename}
                    </Link>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-start gap-1 sm:gap-0">
                    <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase">Stake</span>
                    <span className="text-sm font-mono font-bold text-white/70">{formatUsdc(att.stakeAmount)}</span>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-start gap-1 sm:gap-0">
                    <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase">Verdict</span>
                    <VerdictBadge verdict={att.verdict} size="sm" />
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-start gap-1 sm:gap-0">
                    <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase">Δ Score</span>
                    <span className={`text-sm font-mono font-bold ${att.reputationDelta > 0 ? 'text-emerald-400' : att.reputationDelta < 0 ? 'text-red-400' : 'text-white/25'}`}>
                      {att.reputationDelta > 0 ? '+' : ''}{att.reputationDelta || '—'}
                    </span>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-start gap-1 sm:gap-0">
                    <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase">Date</span>
                    <span className="text-[11px] font-mono text-white/30">{formatRelativeDate(att.reviewedAt)}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
