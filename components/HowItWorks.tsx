"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const STEPS = [
  { n: "01", title: "Install GitHub App",        body: "One-click install on any repo. Zero workflow disruption. GitLedger intercepts PR approval events.",               dir: "left"  },
  { n: "02", title: "Approve & Stake USDC",      body: "Submit approval on GitHub. A prompt fires — stake your chosen USDC amount via Coinbase Agentic Wallet.",          dir: "up"    },
  { n: "03", title: "Oracle Watches 30 Days",    body: "Chainlink polls the repo daily. Any hotfix PR mentioning your merged code within the window triggers a slash.",    dir: "up"    },
  { n: "04", title: "Earn Yield or Get Slashed", body: "Clean window closes → stake + yield returned. Hotfix found → 70% to reporter, 30% to treasury. Always on-chain.", dir: "right" },
] as const;

export default function HowItWorks() {
  return (
    <section className="relative z-10 w-full max-w-6xl mx-auto px-6 sm:px-12 py-20">
      <Reveal direction="up" className="mb-14">
        <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-4">
          How It Works
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          Four steps.{" "}
          <span className="text-white/25 font-light italic">Full accountability.</span>
        </h2>
      </Reveal>

      {/* Timeline list */}
      <div className="flex flex-col">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.n}
            initial={{ opacity: 0, x: step.dir === "left" ? -40 : step.dir === "right" ? 40 : 0, y: step.dir === "up" ? 30 : 0 }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -60px 0px" }}
            transition={{ duration: 0.55, delay: i * 0.06, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <div className="grid grid-cols-[56px_1fr] sm:grid-cols-[80px_1fr_1fr] gap-0 group border-t border-white/06 hover:border-white/12 transition-colors duration-300">
              {/* Number */}
              <div className="py-7 pr-6 flex items-start pt-8">
                <span className="font-mono text-xs tracking-widest text-white/18 group-hover:text-white/40 transition-colors duration-300">
                  {step.n}
                </span>
              </div>
              {/* Title */}
              <div className="py-7 sm:border-r border-white/06 sm:pr-10">
                <p className="text-white font-semibold text-lg leading-snug group-hover:text-white/90 transition-colors duration-300">
                  {step.title}
                </p>
              </div>
              {/* Body — hidden on mobile, shown sm+ */}
              <div className="hidden sm:flex py-7 pl-10 items-start">
                <p className="text-white/28 text-sm leading-relaxed font-light">
                  {step.body}
                </p>
              </div>
              {/* Body mobile */}
              <div className="sm:hidden col-start-2 pb-5">
                <p className="text-white/28 text-sm leading-relaxed font-light">{step.body}</p>
              </div>
            </div>
          </motion.div>
        ))}
        <div className="hr" />
      </div>
    </section>
  );
}
