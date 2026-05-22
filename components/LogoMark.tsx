"use client";

import Image from "next/image";

export default function LogoMark({ size = 80 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Pulse rings */}
      {[0, 0.8, 1.6].map((delay, i) => (
        <span
          key={i}
          className="absolute inset-0 rounded-full border border-white/15 animate-pulse-ring"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}

      {/* Corner crosshairs */}
      {["top-0 left-0 border-t border-l", "top-0 right-0 border-t border-r", "bottom-0 left-0 border-b border-l", "bottom-0 right-0 border-b border-r"].map((cls, i) => (
        <span key={i} className={`absolute w-[22%] h-[22%] ${cls} border-white/60`} />
      ))}

      {/* Scan line */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent animate-scan-line" />
      </div>

      {/* Logo */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Image
          src="/logo.png"
          alt="GitLedger"
          width={size * 0.58}
          height={size * 0.58}
          priority
          style={{ filter: "invert(1)", objectFit: "contain" }}
        />
      </div>
    </div>
  );
}
