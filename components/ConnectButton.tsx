'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function ConnectButton() {
  const { isWalletConnected, isGithubLinked, displayName, openModal, disconnectAll } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isGithubLinked && !isWalletConnected) {
    return (
      <button
        onClick={openModal}
        className="px-4 py-1.5 border border-white/15 text-[11px] font-mono tracking-[0.18em] text-white/70 uppercase hover:text-white hover:border-white/35 transition-all duration-200"
      >
        Connect
      </button>
    );
  }

  if (isGithubLinked && !isWalletConnected) {
    return (
      <button
        onClick={openModal}
        className="px-3 py-1.5 border border-amber-400/25 text-[10px] font-mono tracking-[0.15em] text-amber-300/60 uppercase hover:border-amber-400/50 hover:text-amber-300/90 transition-all duration-200"
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 border border-white/[0.08] hover:border-white/20 transition-all duration-200"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 shrink-0" />
        <span className="text-[10px] font-mono tracking-[0.13em] text-white/65 max-w-[120px] truncate">
          {displayName}
        </span>
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-40 bg-[#111214] border border-white/[0.08] z-50">
            <button
              onClick={() => { setMenuOpen(false); disconnectAll(); }}
              className="w-full px-4 py-2.5 text-left text-[10px] font-mono text-white/35 hover:text-white/65 hover:bg-white/[0.03] transition-colors tracking-wide"
            >
              Disconnect
            </button>
          </div>
        </>
      )}
    </div>
  );
}
