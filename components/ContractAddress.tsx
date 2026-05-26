'use client';

import { useState } from 'react';
import { shortenAddress } from '@/lib/utils';

export const GITLEDGER_CONTRACT = '0x0a493c97428ff9eaa07cfb9ddefad29aa8e09b07';

interface Props {
  variant?: 'pill' | 'block';
  address?: string;
}

export default function ContractAddress({
  variant = 'block',
  address = GITLEDGER_CONTRACT,
}: Props) {
  const [copied, setCopied] = useState(false);
  const basescanUrl = `https://basescan.org/address/${address}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Older browsers / clipboard blocked — silently no-op.
    }
  };

  if (variant === 'pill') {
    return (
      <div className="inline-flex items-center gap-3 px-4 py-1.5 border border-white/10 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
        <span className="text-[11px] font-mono tracking-[0.25em] text-white/45 uppercase">
          Contract
        </span>
        <span className="w-px h-3 bg-white/15" />
        <button
          onClick={copy}
          className="text-[11px] font-mono tracking-[0.1em] text-white/55 hover:text-white/85 transition-colors duration-200"
        >
          {copied ? 'COPIED ✓' : shortenAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full border border-white/10 bg-[#0a0a0b]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] font-mono tracking-[0.22em] text-white/35 uppercase">
          Contract Address
        </span>
        <span className="text-[10px] font-mono tracking-[0.18em] text-emerald-300/70 uppercase">
          Base L2
        </span>
      </div>
      <div className="px-4 py-4">
        <p className="font-mono text-xs sm:text-sm text-white/85 break-all leading-relaxed select-all">
          {address}
        </p>
      </div>
      <div className="flex border-t border-white/[0.06]">
        <button
          onClick={copy}
          className="flex-1 px-4 py-2.5 text-[11px] font-mono tracking-[0.2em] text-white/55 uppercase hover:bg-white/[0.04] hover:text-white/85 transition-colors duration-200 border-r border-white/[0.06]"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
        <a
          href={basescanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 px-4 py-2.5 text-[11px] font-mono tracking-[0.2em] text-white/55 uppercase hover:bg-white/[0.04] hover:text-white/85 transition-colors duration-200 text-center"
        >
          Basescan ↗
        </a>
      </div>
    </div>
  );
}
