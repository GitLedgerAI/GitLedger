"use client";

import { motion } from "framer-motion";

const STATS = [
  { value: "1-in-5", label: "Reviews now AI-generated" },
  { value: "60M+",   label: "Copilot reviews/year"     },
  { value: "0",      label: "Reviewer accountability"   },
  { value: "18%",    label: "Target APY — clean review" },
];

export default function StatsBar() {
  return (
    <div className="relative z-10 w-full border-y border-white/06">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/06">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "0px 0px -30px 0px" }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 0.61, 0.36, 1] }}
            className="px-8 py-10"
          >
            <div className="text-3xl sm:text-4xl font-bold font-mono text-white tracking-tight">
              {s.value}
            </div>
            <div className="text-[11px] text-white/25 mt-2 font-light leading-snug">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
