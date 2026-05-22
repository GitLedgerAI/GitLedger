"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { useRef } from "react";
import CellGrid from "@/components/CellGrid";
import Countdown from "@/components/Countdown";
import EmailSignup from "@/components/EmailSignup";
import FloatingLogos from "@/components/FloatingLogo";
import Footer from "@/components/Footer";
import HowItWorks from "@/components/HowItWorks";
import LogoMark from "@/components/LogoMark";
import Marquee from "@/components/Marquee";
import Reveal from "@/components/Reveal";
import StatsBar from "@/components/StatsBar";

export default function Home() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const bgY  = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const fade = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

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

        {/* ── Navbar ── */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="relative z-20 flex items-center justify-between px-6 sm:px-12 py-6 border-b border-white/06"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 border border-white/20 flex items-center justify-center">
              <Image src="/logo.png" alt="" width={16} height={16} style={{ filter: "invert(1)" }} />
            </div>
            <span className="font-mono font-bold tracking-[0.15em] text-sm text-white/90 uppercase">
              GitLedger
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-[11px] font-mono tracking-[0.2em] text-white/25 uppercase">
              v0.1-Alpha
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 border border-white/10 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />
              <span className="text-[10px] font-mono tracking-[0.18em] text-white/40 uppercase">
                Base L2
              </span>
            </div>
          </div>
        </motion.header>

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

          {/* Coming soon pill */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25 }}
            className="mb-8"
          >
            <div className="inline-flex items-center gap-3 px-4 py-1.5 border border-white/10 rounded-full">
              <motion.span
                className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/05 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
              />
              <span className="relative flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse" />
              </span>
              <span className="text-[11px] font-mono tracking-[0.25em] text-white/45 uppercase">
                Coming Soon
              </span>
              <span className="w-px h-3 bg-white/15" />
              <span className="text-[11px] font-mono tracking-[0.2em] text-white/25 uppercase">
                Q3 2026
              </span>
            </div>
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

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.72 }}
            className="mb-14"
          >
            <Countdown />
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.85 }}
            className="w-32 h-px bg-white/12 mb-10"
          />

          {/* Email */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.95 }}
            className="w-full max-w-md"
          >
            <EmailSignup />
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
          CTA
      ══════════════════════════════════════ */}
      <section className="relative z-10 w-full border-t border-white/06">
        <div className="max-w-6xl mx-auto px-6 sm:px-12 py-28">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <Reveal direction="left">
              <div>
                <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-5">
                  Early Access
                </p>
                <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-[1.05] mb-4">
                  Be First.<br />
                  <span className="text-white/30 font-light italic">Stake Your Reputation.</span>
                </h2>
                <p className="text-white/30 text-base leading-relaxed font-light max-w-sm">
                  Early reviewers earn a 2× yield multiplier for the first 30 days post-launch.
                </p>
              </div>
            </Reveal>

            <Reveal direction="right" delay={0.12}>
              <div className="flex flex-col gap-5">
                <EmailSignup />
                <div className="flex items-center gap-3 text-[11px] font-mono text-white/18 tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
                  No spam. Notified at launch only.
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FOOTER
      ══════════════════════════════════════ */}
      <Footer />
    </main>
  );
}
