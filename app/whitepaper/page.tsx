"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import LogoMark from "@/components/LogoMark";

const SECTIONS = [
  {
    id: "abstract",
    label: "00 — Abstract",
    content: `GitLedger is a protocol that transforms GitHub pull-request code reviews into
staked, on-chain attestations on Base L2. Reviewers lock USDC collateral at the
moment of approval. A Chainlink Functions oracle monitors the repository for 30
days after merge. If a hotfix targeting the merged code is detected, the stake is
slashed proportionally. If the window closes clean, the reviewer earns yield. Every
outcome is written as a permanent EAS (Ethereum Attestation Service) attestation —
forming a verifiable, monetizable reputation record.`,
  },
  {
    id: "problem",
    label: "01 — Problem",
    content: `Modern software teams rely on code review as the primary quality gate before
production. Yet reviewers bear zero financial accountability for their decisions.
1-in-5 GitHub reviews now involve an AI agent; review volume is outpacing human
oversight capacity. The result: rubber-stamp approvals, ship-and-forget culture,
and no durable signal about reviewer quality that survives beyond a team's Slack
history.

Hiring pipelines, DeFi credit protocols, and AI orchestration systems increasingly
need trustworthy signals about the humans and agents making technical decisions.
No such primitive exists today.`,
  },
  {
    id: "solution",
    label: "02 — Solution",
    content: `GitLedger introduces a financial accountability layer at the exact moment a
reviewer approves a PR. The mechanic is simple: stake to review, earn yield when
code ships clean, lose stake when it breaks production.

The outcome of every review is written permanently to EAS on Base. This creates
an immutable, queryable reputation record that is chain-native, portable across
platforms, and composable with existing DeFi and identity primitives. Reviewers
build a score (0–1000) that governs their yield multiplier and unlocks access to
higher-value review queues.`,
  },
  {
    id: "architecture",
    label: "03 — Architecture",
    subsections: [
      {
        title: "Smart Contract Layer",
        body: `CodeLedger.sol is an escrow contract deployed on Base L2 (chainId 8453).
It exposes stakeReview(basename, repoSlug, prId, amount) and manages
stake lifecycle: ACTIVE → CLEAN or SLASHED. The contract emits events
consumed by the EAS attestation writer and the frontend.`,
      },
      {
        title: "Oracle Layer",
        body: `A Chainlink Functions job polls the GitHub REST API for hotfix commits
that reference the original PR number within the 30-day accountability window.
The job runs on a time-triggered Automation upkeep and calls fulfillSlash()
or fulfillClean() on the escrow contract.`,
      },
      {
        title: "Attestation Layer",
        body: `Every stake, slash, and clean outcome is recorded as an EAS attestation
using a versioned schema (schemaUID stored in env). Attestations are
queryable via the EAS GraphQL API on Base, enabling hiring tools, DeFi
protocols, and AI agents to verify reviewer track records without trusting
a centralised database.`,
      },
      {
        title: "Identity Layer",
        body: `Reviewer identity is anchored to a Basename (name.base.eth) resolved
via OnchainKit. Dynamic.xyz handles GitHub OAuth → wallet binding and
issues a JWT for tRPC API auth. Anonymous 0x addresses are supported
as a fallback but ineligible for yield multipliers.`,
      },
      {
        title: "API Layer",
        body: `A Bun-based tRPC server exposes procedures for reviewer profiles,
attestation feeds, leaderboards, and stake management. An x402-gated
endpoint allows third-party consumers to pay per-call in USDC for
structured reputation data — no API key required, wallet pays per request.`,
      },
    ],
  },
  {
    id: "economics",
    label: "04 — Economics",
    content: `Reviewers stake any amount of USDC (minimum 1 USDC) per PR approval.
Protocol yield is sourced from two flows: (1) slashed stakes redistributed
proportionally to stakers who flagged the hotfix via the oracle, and
(2) base yield from Coinbase yield products applied to idle escrow balances.

Yield multipliers are gated by reviewer score:
· Score 0–699: 1.0× base yield
· Score 700–899: 1.5× base yield
· Score 900–1000: 2.0× base yield

Early-access reviewers (first 30 days post-mainnet) receive a flat 2×
multiplier regardless of score.

The protocol takes a 5% fee on slash events. There is no token. All value
flows in USDC on Base L2.`,
  },
  {
    id: "privacy",
    label: "05 — Privacy & Security",
    content: `All attestations are public on-chain by design. Reviewers choosing to
participate consent to having their review decisions recorded permanently.
Stake amounts and outcomes are visible; the content of code reviews is
not stored on-chain.

The escrow contract has been internally reviewed and will undergo a
third-party audit prior to mainnet deployment. Chainlink oracle jobs are
deterministic and reproducible — job source is open-sourced. Dynamic.xyz
manages auth credentials; GitLedger never stores GitHub tokens.`,
  },
  {
    id: "roadmap",
    label: "06 — Roadmap",
    content: `See the full product roadmap at gitledger.xyz/roadmap for milestone
detail. In summary:

· Q2 2026 — Core infrastructure, contracts, oracle, frontend
· Q3 2026 — Mainnet launch, GitHub App public listing, x402 API
· Q4 2026 — Hiring integrations, DeFi trust scores, AI agent reviewer support
· Q1 2027 — Cross-chain bridging, enterprise tier, DAO governance`,
  },
  {
    id: "contact",
    label: "07 — Contact",
    content: `GitLedger is an open protocol. Contributions, partnerships, and integration
requests are welcome.

Security disclosures: security@gitledger.xyz
General: hello@gitledger.xyz
GitHub: github.com/gitledger`,
  },
];

export default function WhitepaperPage() {
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
          href="/roadmap"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-mono tracking-[0.2em] text-white/30 uppercase hover:text-white/60 transition-colors"
        >
          Roadmap ↗
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 sm:px-12 py-20">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase mb-4">
            Technical White Paper · v0.1-ALPHA · May 2026
          </p>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.02] mb-6">
            GitLedger<br />
            <span className="text-white/25 font-light italic">Protocol Overview</span>
          </h1>
          <p className="text-white/35 text-lg font-light leading-relaxed max-w-xl">
            Staked, on-chain code review accountability on Base L2.
          </p>
          <div className="flex gap-4 mt-8">
            {["EAS · Base L2", "Chainlink Functions", "USDC · No Token"].map((tag) => (
              <span
                key={tag}
                className="text-[9px] font-mono tracking-[0.2em] text-white/30 uppercase px-2.5 py-1 border border-white/08"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Table of contents */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="border border-white/08 p-6 mb-16"
        >
          <p className="text-[10px] font-mono tracking-[0.24em] text-white/30 uppercase mb-4">
            Contents
          </p>
          <ul className="flex flex-col gap-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-white/35 text-sm font-light hover:text-white/65 transition-colors"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Sections */}
        <div className="flex flex-col gap-20">
          {SECTIONS.map((section, i) => (
            <motion.section
              key={section.id}
              id={section.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.07 }}
            >
              <div className="hr mb-6" />
              <h2 className="text-[10px] font-mono tracking-[0.24em] text-white/30 uppercase mb-5">
                {section.label}
              </h2>

              {"content" in section && (
                <p className="text-white/55 text-[15px] leading-[1.8] font-light whitespace-pre-line">
                  {section.content}
                </p>
              )}

              {"subsections" in section && section.subsections && (
                <div className="flex flex-col gap-8">
                  {section.subsections.map((sub) => (
                    <div key={sub.title}>
                      <h3 className="text-sm font-semibold text-white/80 mb-2 tracking-tight">
                        {sub.title}
                      </h3>
                      <p className="text-white/45 text-[14px] leading-[1.8] font-light whitespace-pre-line">
                        {sub.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.section>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-24 pt-8 border-t border-white/06 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-white/18 text-xs font-mono tracking-wide">
            © 2026 GitLedger · White Paper v0.1-ALPHA · Subject to change
          </p>
          <Link
            href="/roadmap"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase hover:text-white/50 transition-colors"
          >
            View Roadmap ↗
          </Link>
        </div>
      </div>
    </main>
  );
}
