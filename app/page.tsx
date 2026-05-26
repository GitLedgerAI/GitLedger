"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import CellGrid from "@/components/CellGrid";
import ContractAddress from "@/components/ContractAddress";
import FloatingLogos from "@/components/FloatingLogo";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import LogoMark from "@/components/LogoMark";
import Marquee from "@/components/Marquee";
import Reveal from "@/components/Reveal";
import StatsBar from "@/components/StatsBar";
import VerdictBadge from "@/components/VerdictBadge";
import { MOCK_LIVE_FEED } from "@/lib/mock-data";
import { formatUsdc, formatRelativeDate } from "@/lib/utils";
import { useLiveFeed } from "@/lib/hooks";

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const bgY  = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const { data: liveFeed } = useLiveFeed();
  const feedItems = liveFeed ?? MOCK_LIVE_FEED;

  return (
    <main className="relative min-h-screen flex flex-col bg-[#0a0a0b]">
      <FloatingLogos />

      {/* ══════════════════════════════════════
          HERO
      ══════════════════════════════════════ */}
      <section ref={heroRef} className="relative w-full min-h-screen flex flex-col overflow-hidden">

        {/* Cell grid — full bleed */}
        <div className="absolute inset-0 vignette">
          <CellGrid />
        </div>

        {/* Large ghost text behind everything */}
        <motion.div
          style={{ y: bgY }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0"
          aria-hidden
        >
          <span
            className="font-black text-[clamp(5rem,20vw,18rem)] leading-none tracking-tighter text-white"
            style={{ opacity: 0.022, fontFamily: "Inter, sans-serif" }}
          >
            REVIEW
          </span>
        </motion.div>


        {/* ── Hero content ── */}
        <motion.div
          style={{ opacity: fade }}
          className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 sm:px-12 py-16 text-center"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1] }}
            className="mb-10"
          >
            <LogoMark size={96} />
          </motion.div>

          {/* Contract address pill */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25 }}
            className="mb-8"
          >
            <ContractAddress variant="pill" />
          </motion.div>

          {/* Headline */}
          <div className="overflow-hidden mb-3">
            <motion.h1
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.75, delay: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
              className="text-[clamp(2.6rem,6.5vw,5.5rem)] font-black leading-[1.0] tracking-[-0.03em] text-white"
            >
              Your Review Has
            </motion.h1>
          </div>
          <div className="overflow-hidden mb-10">
            <motion.h1
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              transition={{ duration: 0.75, delay: 0.46, ease: [0.22, 0.61, 0.36, 1] }}
              className="text-[clamp(2.6rem,6.5vw,5.5rem)] font-light italic leading-[1.0] tracking-[-0.03em] text-white/40"
            >
              Skin in the Game.
            </motion.h1>
          </div>

          {/* Sub */}
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.6 }}
            className="text-white/35 text-base sm:text-lg max-w-lg leading-relaxed mb-14 font-light"
          >
            Stake USDC on every PR approval. Earn yield when code ships clean.
            Get slashed when it breaks production.
          </motion.p>

          {/* Divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="w-32 h-px bg-white/12 mb-10"
          />

          {/* Contract address block */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.95 }}
            className="w-full max-w-md"
          >
            <ContractAddress variant="block" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 1.1 }}
            className="mt-5"
          >
            <a
              href="/whitepaper"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2 border border-white/10 text-[11px] font-mono tracking-[0.2em] text-white/40 uppercase hover:text-white/70 hover:border-white/20 transition-all duration-200"
            >
              Read White Paper
              <span className="text-white/25">↗</span>
            </a>
          </motion.div>
        </motion.div>

        {/* Bottom tech tags */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1, duration: 0.5 }}
          className="relative z-20 flex items-center justify-center gap-6 px-6 pb-8"
        >
          {["BASE L2", "EAS", "x402", "CHAINLINK"].map((t) => (
            <span key={t} className="text-[10px] font-mono tracking-[0.2em] text-white/18 uppercase">
              {t}
            </span>
          ))}
        </motion.div>
      </section>

      {/* ══════════════════════════════════════
          MARQUEE
      ══════════════════════════════════════ */}
      <Marquee />

      {/* ══════════════════════════════════════
          STATS
      ══════════════════════════════════════ */}
      <StatsBar />

      {/* ══════════════════════════════════════
          LIVE ATTESTATION FEED
      ══════════════════════════════════════ */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-12 py-16">
        <Reveal direction="up">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
              <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">Live Attestations</p>
            </div>
            <Link href="/explore" className="text-[10px] font-mono tracking-[0.18em] text-white/20 uppercase hover:text-white/50 transition-colors duration-200">
              Leaderboard →
            </Link>
          </div>
        </Reveal>
        <div className="flex flex-col border border-white/[0.06]">
          {feedItems.map((item, i) => (
            <Reveal key={i} direction="up" delay={i * 0.06}>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_90px_90px_100px] gap-2 sm:gap-4 px-5 py-3.5 border-b border-white/[0.04] hover:bg-[#111113] transition-colors duration-200">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-6 h-6 bg-[#1a1c1f] border border-white/[0.08] flex items-center justify-center shrink-0">
                    <span className="text-[9px] font-mono font-bold text-white/25">{item.basename?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-white/70 truncate">{item.basename}</span>
                    <span className="text-[10px] font-mono text-white/25 ml-2">{item.repoSlug}</span>
                  </div>
                </div>
                <div className="flex sm:justify-start items-center">
                  <span className="text-xs font-mono font-bold text-white/55">#{item.prId}</span>
                </div>
                <div className="flex sm:justify-start items-center">
                  <VerdictBadge verdict={item.verdict} size="sm" />
                </div>
                <div className="flex sm:justify-start items-center gap-3">
                  <span className="text-xs font-mono font-bold text-white/60">{formatUsdc(item.stakeAmount)}</span>
                  <span className="text-[10px] font-mono text-white/20">{formatRelativeDate(item.timestamp)}</span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════
          PROBLEM — editorial two-column
      ══════════════════════════════════════ */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-12 py-28">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-start">
          {/* Left — number anchor */}
          <Reveal direction="left">
            <div className="flex flex-col gap-6">
              <div className="hr" />
              <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">
                The Problem
              </p>
              <span
                className="font-black leading-none tracking-tighter text-white/06 select-none"
                style={{ fontSize: "clamp(5rem,14vw,11rem)" }}
              >
                00
              </span>
              <p className="text-[11px] font-mono tracking-[0.18em] text-white/20 uppercase">
                Reviewers with financial accountability
              </p>
            </div>
          </Reveal>

          {/* Right — statement */}
          <div className="flex flex-col gap-8">
            <Reveal direction="right" delay={0.08}>
              <blockquote className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white leading-[1.2] tracking-tight">
                Code review is the last line of defense.{" "}
                <span className="text-white/30 font-light italic">
                  But reviewers carry zero financial accountability.
                </span>
              </blockquote>
            </Reveal>
            <Reveal direction="right" delay={0.18}>
              <p className="text-white/30 text-base leading-relaxed font-light max-w-md">
                1-in-5 GitHub reviews now involve an AI agent. Volume is
                outpacing oversight. GitLedger fixes the incentive layer —
                approve code that breaks production and you pay. Approve code
                that ships clean and you earn.
              </p>
            </Reveal>
            <Reveal direction="right" delay={0.28}>
              <div className="flex gap-8 pt-2">
                {[["1-in-5", "reviews are AI"], ["60M+", "Copilot reviews/yr"], ["0", "accountability"]].map(([v, l]) => (
                  <div key={l}>
                    <div className="text-xl font-bold font-mono text-white">{v}</div>
                    <div className="text-[11px] text-white/25 mt-0.5">{l}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════ */}
      <div className="hr" />
      <HowItWorks />
      <div className="hr" />

      {/* ══════════════════════════════════════
          ECOSYSTEM
      ══════════════════════════════════════ */}
      <section className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-12 py-20">
        <Reveal direction="up">
          <div className="flex items-center gap-4 mb-12">
            <div className="hr flex-1" />
            <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase shrink-0">
              Built With
            </p>
            <div className="hr flex-1" />
          </div>
        </Reveal>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-white/06">
          {[
            ["Base L2", "B"],
            ["EAS", "E"],
            ["Coinbase CDP", "C"],
            ["Chainlink", "⬡"],
            ["x402", "X"],
            ["OnchainKit", "O"],
          ].map(([name, letter], i) => {
            const dirs = ["left","up","left","right","up","right"] as const;
            return (
              <Reveal key={name} direction={dirs[i]} delay={i * 0.06}>
                <div className="flex flex-col items-center justify-center gap-3 p-6 bg-[#0a0a0b] group hover:bg-[#111113] transition-colors duration-300 aspect-square">
                  <span className="text-xl font-mono font-bold text-white/55 group-hover:text-white/90 transition-colors duration-300">
                    {letter}
                  </span>
                  <span className="text-[10px] font-mono tracking-[0.15em] text-white/45 text-center uppercase group-hover:text-white/75 transition-colors duration-300">
                    {name}
                  </span>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <Footer />
    </main>
  );
}
