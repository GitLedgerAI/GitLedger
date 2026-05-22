"use client";

const ITEMS = [
  "STAKED CODE REVIEWS",
  "EAS ATTESTATIONS",
  "BASE L2",
  "x402 PROTOCOL",
  "CHAINLINK ORACLE",
  "USDC YIELD",
  "REVIEWER REPUTATION",
  "SKIN IN THE GAME",
];

const text = ITEMS.join("  ·  ") + "  ·  ";

export default function Marquee() {
  return (
    <div className="relative w-full overflow-hidden border-y border-white/07 py-3 bg-[#0a0a0b]">
      <div className="flex whitespace-nowrap animate-marquee">
        <span className="text-[11px] font-mono tracking-[0.22em] text-white/30 uppercase">
          {text}
        </span>
        <span className="text-[11px] font-mono tracking-[0.22em] text-white/30 uppercase" aria-hidden>
          {text}
        </span>
      </div>
    </div>
  );
}
