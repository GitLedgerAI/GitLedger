"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import LogoMark from "@/components/LogoMark";

const PHASES = [
  {
    quarter: "Q2 2026",
    label: "Foundation",
    status: "current",
    items: [
      "Smart contract architecture & Foundry test suite",
      "EAS schema design and attestation flow",
      "GitHub App webhook server (Bun + tRPC)",
      "Coinbase CDP Agentic Wallet integration",
      "Chainlink Functions oracle prototype",
      "Frontend scaffold — landing, reviewer profile, dashboard",
    ],
  },
  {
    quarter: "Q3 2026",
    label: "Mainnet Launch",
    status: "next",
    items: [
      "Audit of CodeLedger.sol escrow contract",
      "Base L2 mainnet deployment",
      "GitHub App public listing",
      "Dynamic.xyz + Basename auth live",
      "x402 API for reputation data",
      "Early-access reviewer 2× yield multiplier",
    ],
  },
  {
    quarter: "Q4 2026",
    label: "Ecosystem",
    status: "future",
    items: [
      "Hiring integrations — reputation badge for job applications",
      "DeFi protocol trust scores via x402",
      "AI agent reviewer support (verified agent staking)",
      "Multi-repo portfolio dashboards",
      "USDC yield routing via Coinbase yield products",
    ],
  },
  {
    quarter: "Q1 2027",
    label: "Scale",
    status: "future",
    items: [
      "Cross-chain attestation bridging (OP Stack rollups)",
      "Enterprise tier — private repos with permissioned staking",
      "SDK for third-party reputation consumers",
      "DAO governance for protocol parameters",
      "Mobile reviewer companion app",
    ],
  },
];

const STATUS_STYLES: Record<string, { dot: string; border: string; label: string }> = {
  current: { dot: "bg-emerald-400", border: "border-emerald-400/30", label: "In Progress" },
  next:    { dot: "bg-amber-400",   border: "border-amber-400/30",   label: "Up Next"     },
  future:  { dot: "bg-white/20",    border: "border-white/10",       label: "Planned"     },
};

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Nav */}
      <nav className="border-b border-white/06 px-6 sm:px-12 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <LogoMark size={28} />
          <span className="font-mono font-bold tracking-[0.14em] text-sm text-white/80 uppercase">
            GitLedger
          </span>
        </Link>
        <Link
          href="/whitepaper"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono tracking-[0.2em] text-white/30 uppercase hover:text-white/60 transition-colors"
        >
          White Paper ↗
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 sm:px-12 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase mb-4">
            Product Roadmap
          </p>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.0] mb-6">
            Building Accountable<br />
            <span className="text-white/25 font-light italic">Code Review.</span>
          </h1>
          <p className="text-white/35 text-lg font-light leading-relaxed max-w-xl">
            A transparent view of where GitLedger is, where it is going, and what
            ships at each milestone on the road to mainnet and beyond.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-white/06" />

          <div className="flex flex-col gap-16">
            {PHASES.map((phase, i) => {
              const s = STATUS_STYLES[phase.status];
              return (
                <motion.div
                  key={phase.quarter}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="pl-10 relative"
                >
                  {/* Dot */}
                  <span className={`absolute left-0 top-1.5 w-[22px] h-[22px] rounded-full border ${s.border} flex items-center justify-center`}>
                    <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  </span>

                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <span className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                      {phase.quarter}
                    </span>
                    <span className="w-px h-3 bg-white/10" />
                    <span className="text-xl font-bold tracking-tight">
                      {phase.label}
                    </span>
                    <span className={`text-[9px] font-mono tracking-[0.2em] uppercase px-2 py-0.5 border ${s.border} text-white/40`}>
                      {s.label}
                    </span>
                  </div>

                  <ul className="flex flex-col gap-2.5 border-l border-white/06 pl-5">
                    {phase.items.map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-white/20 shrink-0" />
                        <span className="text-white/45 text-sm font-light leading-relaxed">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-24 pt-8 border-t border-white/06"
        >
          <p className="text-white/20 text-xs font-mono tracking-wide">
            Roadmap is indicative and subject to change. Follow{" "}
            <a href="#" className="text-white/40 hover:text-white/60 underline underline-offset-2 transition-colors">
              @GitLedger
            </a>{" "}
            for real-time updates. Last updated May 2026.
          </p>
        </motion.div>
      </div>
    </main>
  );
}
