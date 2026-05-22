const BADGES = [
  "BASE L2",
  "EAS ATTESTATIONS",
  "x402 PROTOCOL",
  "CHAINLINK FUNCTIONS",
];

export default function TechBadges() {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {BADGES.map((label) => (
        <span
          key={label}
          className="px-3 py-1 text-[10px] font-mono tracking-[0.18em] uppercase rounded-sm bg-[#16181c] border border-white/10 text-white/40"
          style={{ borderTopColor: "rgba(255,255,255,0.30)", borderTopWidth: 1 }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
