'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';

import Footer from '@/components/Footer';
import ScoreRing from '@/components/ScoreRing';
import Reveal from '@/components/Reveal';
import { useLeaderboard } from '@/lib/hooks';
import { formatUsdc } from '@/lib/utils';
import type { LeaderboardRow } from '@/lib/api';

type SortKey = 'score' | 'yield' | 'accuracy' | 'stakes';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'score',    label: 'Score'    },
  { key: 'yield',    label: 'Yield'    },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'stakes',   label: 'Staked'   },
];

const ALL_LANGS = ['All', 'TypeScript', 'Rust', 'Solidity', 'Go', 'Python'];

function accuracy(row: LeaderboardRow): number {
  const total = row.cleanCount + row.slashCount;
  return total > 0 ? (row.cleanCount / total) * 100 : 0;
}

export default function Leaderboard() {
  const [sort, setSort]     = useState<SortKey>('score');
  const [lang, setLang]     = useState('All');
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading, isError } = useLeaderboard();

  const filtered = useMemo(() => {
    let list = [...rows];
    if (lang !== 'All') {
      list = list.filter(e => e.languages?.includes(lang));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.basename?.toLowerCase().includes(q) ||
        e.githubLogin?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      if (sort === 'score')    return b.reputationScore - a.reputationScore;
      if (sort === 'yield')    return b.totalYieldUsdc - a.totalYieldUsdc;
      if (sort === 'accuracy') return accuracy(b) - accuracy(a);
      if (sort === 'stakes')   return b.totalStakedUsdc - a.totalStakedUsdc;
      return 0;
    });
    return list;
  }, [rows, sort, lang, search]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">

      <main className="flex-1 max-w-6xl mx-auto px-6 sm:px-12 py-12 w-full">

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-2">Explore</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reviewer Leaderboard</h1>
          <p className="text-white/30 text-sm mt-2 font-light">Ranked by on-chain review performance across Base L2</p>
        </motion.div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex items-center border border-white/10 bg-[#111113] flex-1 max-w-xs focus-within:border-white/25 transition-colors duration-200">
            <span className="px-3 text-white/20 font-mono text-sm">⌕</span>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by basename or handle..."
              className="flex-1 px-2 py-2.5 bg-transparent text-white/70 text-sm font-mono outline-none placeholder:text-white/18"
            />
          </div>
          <div className="flex items-center gap-1">
            {SORT_OPTIONS.map(o => (
              <button key={o.key} onClick={() => setSort(o.key)}
                className={`px-3 py-2 text-[10px] font-mono tracking-widest uppercase transition-all duration-200 ${
                  sort === o.key ? 'bg-white/[0.08] text-white/80 border border-white/15' : 'text-white/25 border border-transparent hover:text-white/50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Language chips */}
        <div className="flex flex-wrap gap-2 mb-8">
          {ALL_LANGS.map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1 border text-[10px] font-mono tracking-widest uppercase transition-all duration-200 ${
                lang === l ? 'border-white/25 text-white/80 bg-white/[0.06]' : 'border-white/[0.08] text-white/25 hover:border-white/18 hover:text-white/50'
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="hidden sm:grid grid-cols-[40px_1fr_90px_100px_90px_100px_80px] gap-4 px-5 py-2 border-b border-white/[0.06] mb-1">
          {['#', 'Reviewer', 'Score', 'Total Staked', 'Yield', 'Accuracy', ''].map((h, i) => (
            <span key={i} className="text-[10px] font-mono tracking-widest text-white/20 uppercase">{h}</span>
          ))}
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col gap-px">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <div className="py-20 text-center border border-white/[0.06]">
            <p className="text-white/20 font-mono text-sm">Failed to load leaderboard</p>
            <p className="text-white/12 text-xs font-mono mt-1">Check your connection and try again</p>
          </div>
        )}

        {/* Rows */}
        {!isLoading && !isError && (
          <div className="flex flex-col">
            {filtered.length === 0 && (
              <div className="py-20 text-center border border-white/[0.06]">
                <p className="text-white/20 font-mono text-sm">No reviewers found</p>
              </div>
            )}
            {filtered.map((entry, i) => {
              const acc = accuracy(entry);
              return (
                <Reveal key={entry.basename} direction="up" delay={i * 0.04}>
                  <Link href={`/reviewer/${encodeURIComponent(entry.basename)}`}>
                    <div className="grid grid-cols-1 sm:grid-cols-[40px_1fr_90px_100px_90px_100px_80px] gap-2 sm:gap-4 px-5 py-4 border-b border-white/[0.04] hover:bg-[#111113] transition-colors duration-200 group cursor-pointer">
                      {/* Rank */}
                      <div className="hidden sm:flex items-center">
                        <span className={`text-sm font-mono font-bold ${
                          i === 0 ? 'text-amber-300/80' : i === 1 ? 'text-white/50' : i === 2 ? 'text-amber-600/70' : 'text-white/20'
                        }`}>
                          {i + 1}
                        </span>
                      </div>

                      {/* Reviewer info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-[#1a1c1f] border border-white/[0.08] flex items-center justify-center shrink-0">
                          <span className="text-sm font-mono font-bold text-white/25">
                            {entry.basename?.[0]?.toUpperCase() ?? '?'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors duration-200 truncate">
                              {entry.basename}
                            </span>
                            {entry.reputationScore >= 700 && (
                              <span className="shrink-0 px-1.5 py-0.5 border border-t-emerald-400 border-white/[0.06] text-[8px] font-mono text-emerald-300/70 tracking-widest uppercase bg-emerald-400/[0.04]">
                                1.5×
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-white/25">@{entry.githubLogin}</span>
                            <span className="hidden sm:flex flex-wrap gap-1">
                              {(entry.languages ?? []).slice(0, 2).map(l => (
                                <span key={l} className="text-[9px] font-mono text-white/20 border border-white/[0.06] px-1.5 py-0.5">{l}</span>
                              ))}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="hidden sm:flex items-center">
                        <ScoreRing score={entry.reputationScore} size={44} />
                      </div>

                      {/* Total Staked */}
                      <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 sm:gap-0">
                        <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase">Staked</span>
                        <span className="text-sm font-mono font-bold text-white/70">{formatUsdc(entry.totalStakedUsdc)}</span>
                      </div>

                      {/* Yield */}
                      <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 sm:gap-0">
                        <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase">Yield</span>
                        <span className="text-sm font-mono font-bold text-emerald-400/80">+{formatUsdc(entry.totalYieldUsdc)}</span>
                      </div>

                      {/* Accuracy */}
                      <div className="flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-1 sm:gap-0">
                        <span className="sm:hidden text-[10px] font-mono text-white/20 uppercase">Accuracy</span>
                        <span className={`text-sm font-mono font-bold ${
                          acc >= 90 ? 'text-emerald-400/80' : acc >= 75 ? 'text-amber-400/80' : 'text-red-400/80'
                        }`}>
                          {acc.toFixed(1)}%
                        </span>
                      </div>

                      {/* CTA */}
                      <div className="hidden sm:flex items-center justify-end">
                        <span className="text-[10px] font-mono tracking-widest text-white/20 uppercase group-hover:text-white/50 transition-colors duration-200">
                          Profile →
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        )}

        {!isLoading && (
          <p className="text-[10px] font-mono text-white/15 text-center mt-8 tracking-wide">
            {filtered.length} reviewer{filtered.length !== 1 ? 's' : ''} · Sorted by {sort} · Base L2
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
