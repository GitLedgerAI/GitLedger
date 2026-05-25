"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import LogoMark from "@/components/LogoMark";

const MARKET_STATS = [
  {
    value: "$3B",
    label: "Secure Code Review Market",
    body: "Global market by 2026 at 20% CAGR. SOC2 + ISO 27001 buyers need immutable audit trails — EAS attestations are that trail.",
  },
  {
    value: "68%",
    label: "Devs → Private Networks",
    body: "Senior blockchain devs in 2026 only accept roles via vetted networks. A bad hire costs $200K+. Staked review history is the only tamper-proof signal.",
  },
  {
    value: "$52B",
    label: "DeFi Lending TVL",
    body: "Overcollateralized for lack of onchain credit. Reputation score = first cryptographically verifiable developer credit signal, composable with Morpho on Base.",
  },
];

type Week = {
  week: string;
  track: string;
  tagline: string;
  accent: string;
  dot: string;
  border: string;
  items: string[];
  metric: string;
};

const WEEKS: Week[] = [
  {
    week: "Week 5",
    track: "Enterprise Compliance",
    tagline: "$3B SOC2 market",
    accent: "text-emerald-400",
    dot: "bg-emerald-400",
    border: "border-emerald-400/40",
    items: [
      "Compliance API for EAS attestation history in SOC2-ready JSON/PDF",
      "GitHub Enterprise SSO + SCIM provisioning",
      "Policy engine: min stake + reviewer rules per file path",
      "Vanta / Drata / Secureframe webhook integrations",
      "Splunk + Datadog SIEM forwarders for slash events",
    ],
    metric: "3 enterprise pilots signed",
  },
  {
    week: "Week 6",
    track: "DeFi Credit Primitive",
    tagline: "Morpho on Base · $52B market",
    accent: "text-amber-400",
    dot: "bg-amber-400",
    border: "border-amber-400/40",
    items: [
      "ReputationVault.sol curating a Morpho Blue market on Base",
      "Score-tiered LTV: 900+ → 85%, 700+ → 75%, 500+ → 65%",
      "Chainlink credit oracle: slash → LLTV drop in 24h",
      "Aave Base rate discounts + Coinbase Borrow integration",
      "Borrow / repay flows with liquidation warning system",
    ],
    metric: "$500K in reputation-backed loans",
  },
  {
    week: "Week 7",
    track: "GitLedger Hire",
    tagline: "Talent marketplace · $200K/bad-hire problem",
    accent: "text-blue-400",
    dot: "bg-blue-400",
    border: "border-blue-400/40",
    items: [
      "Public /hire marketplace with live reputation + accuracy filters",
      "Recruiter dashboard at $49/mo with private talent pools",
      "x402 background check endpoint — 0.10 USDC per vetting report",
      "Snapshot DAO hiring module for grant + bounty gating",
      "Referral graph from EAS attestation relationships",
    ],
    metric: "50 listings, 10 recruiter accounts, first matches closed",
  },
  {
    week: "Week 8",
    track: "LEDGER Protocol Token",
    tagline: "Value capture · governance",
    accent: "text-rose-400",
    dot: "bg-rose-400",
    border: "border-rose-400/40",
    items: [
      "LEDGER ERC-20 on Base — 100M fixed supply, no inflation",
      "Staking: 1.2× / 1.5× / 1.75× yield multipliers",
      "Governance: credit tiers, slash ratios, oracle windows",
      "20% revenue → market buyback + burn (deflationary)",
      "Airdrop to Weeks 1–4 stakers · Aerodrome LBP for price discovery",
    ],
    metric: "Token live, 1,000 stakers, CoinGecko listing",
  },
];

export default function RoadmapPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Nav */}
      <nav className="print-hide border-b border-white/06 px-6 sm:px-12 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <LogoMark size={28} />
          <span className="font-mono font-bold tracking-[0.14em] text-sm text-white/80 uppercase">
            GitLedger
          </span>
        </Link>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 text-[11px] font-mono tracking-[0.18em] uppercase bg-emerald-500 text-black hover:bg-emerald-400 transition-colors px-4 py-2 font-bold shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]"
            aria-label="Download roadmap as PDF"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M8 1.5v9m0 0L4.5 7m3.5 3.5L11.5 7M2 13.5h12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download PDF
          </button>
          <Link
            href="/whitepaper"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono tracking-[0.2em] text-white/30 uppercase hover:text-white/60 transition-colors"
          >
            White Paper ↗
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 sm:px-12 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-[10px] font-mono tracking-[0.28em] text-amber-400/70 uppercase mb-4">
            Weeks 5–8 · Post-Mainnet Expansion
          </p>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.02] mb-6">
            Expansion<br />
            <span className="text-emerald-400">Roadmap.</span>
          </h1>
          <p className="text-white/40 text-lg font-light leading-relaxed max-w-xl">
            Four weeks from mainnet launch. From GitHub App to institutional
            infrastructure across compliance, DeFi credit, talent, and protocol
            governance.
          </p>
        </motion.div>

        {/* Market backdrop */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-20"
        >
          <p className="text-[10px] font-mono tracking-[0.24em] text-white/30 uppercase mb-4">
            Market Backdrop
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MARKET_STATS.map((s) => (
              <div
                key={s.label}
                className="border border-white/08 border-l-2 border-l-emerald-400 px-5 py-5 bg-white/[0.015]"
              >
                <p className="text-3xl font-black tracking-tight text-emerald-400 mb-1">
                  {s.value}
                </p>
                <p className="text-[10px] font-mono tracking-[0.2em] text-white/55 uppercase mb-3">
                  {s.label}
                </p>
                <p className="text-white/45 text-[13px] leading-[1.6] font-light">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Weekly timeline */}
        <div className="relative">
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-white/06" />

          <div className="flex flex-col gap-14">
            {WEEKS.map((w, i) => (
              <motion.div
                key={w.week}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="pl-10 relative"
              >
                {/* Dot */}
                <span
                  className={`absolute left-0 top-1.5 w-[22px] h-[22px] rounded-full border ${w.border} flex items-center justify-center`}
                >
                  <span className={`w-2 h-2 rounded-full ${w.dot}`} />
                </span>

                {/* Heading */}
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="text-[10px] font-mono tracking-[0.22em] text-white/35 uppercase">
                    {w.week}
                  </span>
                  <span className="w-px h-3 bg-white/10" />
                  <span className={`text-xl font-bold tracking-tight ${w.accent}`}>
                    {w.track}
                  </span>
                </div>

                <p className="text-[11px] font-mono tracking-[0.18em] text-white/35 uppercase mb-5">
                  {w.tagline}
                </p>

                {/* Deliverables */}
                <ul className="flex flex-col gap-2.5 border-l border-white/08 pl-5 mb-5">
                  {w.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 w-1 h-1 rounded-full bg-white/30 shrink-0" />
                      <span className="text-white/55 text-[14px] font-light leading-[1.7]">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* Success metric */}
                <div className={`inline-flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] uppercase px-3 py-1.5 border ${w.border} ${w.accent}`}>
                  <span className="opacity-50">Target →</span>
                  <span>{w.metric}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Flywheel close */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mt-20 border border-white/08 border-l-2 border-l-emerald-400 px-5 py-5 bg-emerald-500/[0.03]"
        >
          <p className="text-[10px] font-mono tracking-[0.24em] text-emerald-400 uppercase mb-2">
            The Flywheel
          </p>
          <p className="text-white/65 text-[14px] leading-[1.75] font-light">
            More reviews → more data → better credit scores → more DeFi TVL → more
            protocol revenue → more LEDGER buybacks → more reviewer incentive to
            stake. By the end of Week 8 GitLedger is no longer a GitHub App — it is
            a protocol.
          </p>
        </motion.div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/06 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-white/18 text-xs font-mono tracking-wide">
            © 2026 GitLedger · Expansion Roadmap Weeks 5–8 · Indicative, subject to change
          </p>
          <Link
            href="/whitepaper"
            target="_blank"
            rel="noopener noreferrer"
            className="print-hide text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase hover:text-white/50 transition-colors"
          >
            View White Paper ↗
          </Link>
        </div>
      </div>
    </main>
  );
}
