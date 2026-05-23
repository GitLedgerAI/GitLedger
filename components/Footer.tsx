import Image from "next/image";

const COLS = {
  Protocol:   ["How It Works", "Stake Mechanics", "EAS Attestations", "x402 API"],
  Build:      ["GitHub App", "Smart Contracts", "Chainlink Oracle", "API Docs"],
  Community:  ["Twitter / X", "Telegram"],
};

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/06">
      <div className="max-w-6xl mx-auto px-6 sm:px-12 pt-16 pb-10">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5 mb-5">
              <div className="w-7 h-7 border border-white/15 flex items-center justify-center">
                <Image src="/logo.png" alt="" width={15} height={15} style={{ filter: "invert(1)" }} />
              </div>
              <span className="font-mono font-bold tracking-[0.14em] text-sm text-white/80 uppercase">
                GitLedger
              </span>
            </div>
            <p className="text-white/22 text-sm leading-relaxed font-light max-w-[200px]">
              PR reviews with financial skin in the game. On-chain forever.
            </p>
          </div>

          {/* Links */}
          {Object.entries(COLS).map(([col, items]) => (
            <div key={col}>
              <p className="text-[10px] font-mono tracking-[0.24em] text-white/30 uppercase mb-5">
                {col}
              </p>
              <ul className="flex flex-col gap-3">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-white/22 text-sm font-light hover:text-white/55 transition-colors duration-200">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="hr mb-8" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-white/18 text-xs font-mono tracking-wide">
            © 2026 GitLedger · Built on Base L2 · EAS · Chainlink · x402
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white/35 animate-pulse" />
            <span className="text-white/18 text-xs font-mono tracking-wide">
              Mainnet — Q3 2026
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
