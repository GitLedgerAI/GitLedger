'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import Reveal from '@/components/Reveal';
import EnterpriseBadge from '@/components/enterprise/EnterpriseBadge';

const FEATURES = [
  {
    eyebrow: 'Compliance API',
    title: 'SOC2-ready evidence in JSON or PDF',
    body: 'REST + tRPC endpoints return EAS attestation history scoped to your org. Plug directly into Vanta, Drata, or Secureframe.',
    href: '/enterprise/compliance',
    cta: 'View dashboard',
    accent: 'emerald' as const,
  },
  {
    eyebrow: 'Policy Engine',
    title: 'Enforce min stake + reviewer rules by path',
    body: '"All PRs touching /contracts require min $500 stake from 2 KYC-verified reviewers." Enforced onchain by CompliancePolicy.sol.',
    href: '/enterprise/policy',
    cta: 'Configure policies',
    accent: 'amber' as const,
  },
  {
    eyebrow: 'Audit Export',
    title: 'One-click signed PDF for any window',
    body: 'Every staked reviewer, verdict, and EAS UID from Jan–Dec 2026. Signed by your Base contract — verifiable offline.',
    href: '/enterprise/audit',
    cta: 'Export evidence',
    accent: 'blue' as const,
  },
  {
    eyebrow: 'SIEM Webhooks',
    title: 'Forward slash + stake events to Splunk / Datadog',
    body: 'Real-time supply chain alerts. ReviewSlashed, StakeLocked, and PolicyViolation events stream to any HTTPS sink.',
    href: '/enterprise/siem',
    cta: 'Set up forwarding',
    accent: 'red' as const,
  },
];

const PRICING = [
  {
    tier: 'Starter',
    price: '$29',
    cadence: '/ mo',
    includes: ['Staking + EAS', 'Up to 5 repos', 'Basic dashboard'],
    target: 'Small teams · open source',
    accent: 'border-t-white/30',
  },
  {
    tier: 'Pro',
    price: '$79',
    cadence: '/ mo',
    includes: ['Unlimited repos', 'Compliance API', 'Vanta / Drata webhook'],
    target: 'Series A startups',
    accent: 'border-t-blue-400',
  },
  {
    tier: 'Enterprise',
    price: '$299',
    cadence: '/ mo',
    includes: ['SOC2 export', 'Policy engine', 'SAML SSO', 'SIEM webhook', 'SLA'],
    target: 'Fortune 500 · regulated industries',
    accent: 'border-t-emerald-400',
    featured: true,
  },
  {
    tier: 'Audit API',
    price: '$0.10',
    cadence: '/ call',
    includes: ['Per-attestation SOC2 fetch', 'For external auditors'],
    target: 'Audit firms · compliance vendors',
    accent: 'border-t-amber-400',
  },
];

const ICPS = [
  { tag: 'FinTech',     body: 'Money movement under examiner scrutiny' },
  { tag: 'HealthTech',  body: 'HIPAA + SOC2 dual-attestation flows' },
  { tag: 'Crypto',      body: 'Audit-grade history of contract changes' },
  { tag: 'Defense',     body: 'FedRAMP-aligned supply-chain evidence' },
];

export default function EnterpriseOverviewPage() {
  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-14 items-end pb-12 mb-12 border-b border-white/[0.06]"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-6">
            <EnterpriseBadge label="Track 1 · Live" tone="emerald" />
            <span className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
              $3B SOC2 Market
            </span>
          </div>
          <h1 className="text-[clamp(2.3rem,5.6vw,4.4rem)] font-black tracking-[-0.025em] leading-[1.02] text-white">
            Immutable audit evidence{' '}
            <span className="text-white/35 font-light italic">for every PR you ship.</span>
          </h1>
          <p className="text-white/45 text-base sm:text-lg mt-6 max-w-xl font-light leading-relaxed">
            GitLedger Enterprise turns every staked code review into SOC2 CC7.2
            change-management evidence — onchain, cryptographically signed, and
            queryable by Vanta, Drata, Splunk, or your internal audit team.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Link
              href="/enterprise/onboarding"
              className="px-6 py-3 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200"
            >
              Start 30-day Trial
            </Link>
            <Link
              href="/enterprise/compliance"
              className="px-6 py-3 border border-white/15 text-[11px] font-mono tracking-[0.2em] text-white/70 uppercase hover:text-white hover:border-white/35 transition-colors duration-200"
            >
              View Dashboard →
            </Link>
            <span className="text-[10px] font-mono text-white/22 ml-2">
              No credit card · Import existing GitHub repos
            </span>
          </div>
        </div>

        {/* Right callout — live SOC2 evidence card */}
        <Reveal direction="right" delay={0.18}>
          <div className="relative bg-[#111113] border border-white/[0.06] border-t-[1.5px] border-t-emerald-400 p-6">
            <div className="absolute inset-0 pointer-events-none opacity-[0.05]">
              <div
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(255,255,255,0.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.18) 1px,transparent 1px)',
                  backgroundSize: '22px 22px',
                  width: '100%',
                  height: '100%',
                }}
              />
            </div>
            <p className="text-[10px] font-mono tracking-[0.22em] text-emerald-300/70 uppercase mb-4">
              SOC2 CC7.2 Evidence · Live
            </p>
            <div className="flex flex-col gap-3 relative">
              {[
                ['Coverage',       '92.4%'],
                ['Attestations',   '3,412'],
                ['Active stake',   '$184.5K'],
                ['Slashes (30d)',  '4'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between text-sm pb-2 border-b border-white/[0.05] last:border-b-0"
                >
                  <span className="font-mono text-[11px] tracking-[0.18em] text-white/35 uppercase">
                    {k}
                  </span>
                  <span className="font-mono font-bold text-white/85">{v}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] font-mono text-white/22 mt-4">
              Signed by CodeLedger.sol · Base L2 · last refresh 12s ago
            </p>
          </div>
        </Reveal>
      </motion.section>

      {/* ── Feature grid ────────────────────────────────────────────────── */}
      <section className="mb-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">
            What we build · Week 5
          </span>
          <div className="hr flex-1" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.06]">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} direction="up" delay={i * 0.06}>
              <Link
                href={f.href}
                className="group flex flex-col gap-3 bg-[#0a0a0b] hover:bg-[#111113] transition-colors duration-300 p-7 h-full"
              >
                <div className="flex items-center gap-2 mb-2">
                  <EnterpriseBadge label={f.eyebrow} tone={f.accent} size="sm" />
                </div>
                <h3 className="text-xl font-semibold text-white/90 tracking-tight leading-snug group-hover:text-white transition-colors duration-200">
                  {f.title}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed font-light">{f.body}</p>
                <span className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase mt-2 group-hover:text-white/70 transition-colors duration-200">
                  {f.cta} →
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── ICP / market ─────────────────────────────────────────────────── */}
      <section className="mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 items-start">
          <Reveal direction="left">
            <div>
              <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase mb-4">
                Ideal Customer
              </p>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-3">
                Series B+ teams under audit pressure
              </h2>
              <p className="text-white/35 text-sm leading-relaxed font-light">
                SOC2 audits in 2026 require real-time evidence feeds and richer
                supply-chain assurance. Compliance teams already pay for Vanta or
                Drata — GitLedger drops in as their highest-fidelity change-management
                source.
              </p>
            </div>
          </Reveal>
          <Reveal direction="right" delay={0.1}>
            <div className="grid grid-cols-2 gap-px bg-white/[0.06]">
              {ICPS.map(({ tag, body }) => (
                <div key={tag} className="bg-[#0a0a0b] p-5 flex flex-col gap-2">
                  <span className="text-[10px] font-mono tracking-[0.22em] text-emerald-300/75 uppercase">
                    {tag}
                  </span>
                  <p className="text-sm text-white/55 font-light leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────── */}
      <section className="mb-20">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">
            Enterprise Pricing
          </span>
          <div className="hr flex-1" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06]">
          {PRICING.map((p, i) => (
            <Reveal key={p.tier} direction="up" delay={i * 0.06}>
              <div
                className={`bg-[#0a0a0b] p-6 h-full flex flex-col gap-4 border-t-[1.5px] ${p.accent} ${
                  p.featured ? 'shadow-[inset_0_0_0_1px_rgba(52,211,153,0.18)]' : ''
                }`}
              >
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                    {p.tier}
                  </span>
                  {p.featured && (
                    <span className="text-[9px] font-mono tracking-[0.22em] text-emerald-300/80 uppercase ml-2">
                      ★ Popular
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black font-mono text-white">{p.price}</span>
                  <span className="text-xs font-mono text-white/30">{p.cadence}</span>
                </div>
                <ul className="flex flex-col gap-2 mt-1">
                  {p.includes.map(line => (
                    <li
                      key={line}
                      className="flex items-start gap-2 text-[12px] text-white/65 font-light leading-snug"
                    >
                      <span className="text-emerald-400/60 mt-1">▸</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] font-mono tracking-[0.18em] text-white/25 uppercase mt-auto pt-2 border-t border-white/[0.05]">
                  {p.target}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="text-[10px] font-mono text-white/22 mt-4 text-center tracking-wide">
          All prices in USDC, billed monthly via Coinbase CDP. Hold 10K LEDGER → Enterprise unlocked free.
        </p>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] pt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <Reveal direction="left">
            <div>
              <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase mb-4">
                Start in 5 Minutes
              </p>
              <h2 className="text-3xl font-black tracking-tight text-white leading-[1.1] mb-3">
                Import a repo,{' '}
                <span className="text-white/35 font-light italic">see your audit trail.</span>
              </h2>
              <p className="text-white/35 text-sm leading-relaxed font-light max-w-md">
                Connect GitHub Enterprise via SAML. SCIM-provision your team. Set your first
                policy. Your compliance team gets verifiable evidence by lunch.
              </p>
            </div>
          </Reveal>
          <Reveal direction="right" delay={0.1}>
            <div className="flex flex-col gap-3">
              <Link
                href="/enterprise/onboarding"
                className="block text-center px-6 py-4 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200"
              >
                Start Enterprise Trial →
              </Link>
              <Link
                href="/enterprise/compliance"
                className="block text-center px-6 py-3 border border-white/15 text-[11px] font-mono tracking-[0.2em] text-white/65 uppercase hover:text-white hover:border-white/35 transition-colors duration-200"
              >
                Tour the Live Dashboard
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
