'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import ConnectButton from '@/components/ConnectButton';

const NAV_LINKS = [
  { href: '/explore',    label: 'Leaderboard' },
  { href: '/dashboard',  label: 'Dashboard'   },
  { href: '/enterprise', label: 'Enterprise'  },
];

export default function Navbar() {
  const pathname = usePathname();
  const isLandingPage = pathname === '/';
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#0a0a0b]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 sm:px-12 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-7 h-7 border border-white/20 flex items-center justify-center group-hover:border-white/40 transition-colors duration-200">
            <Image src="/logo.png" alt="" width={16} height={16} style={{ filter: 'invert(1)' }} />
          </div>
          <span className="font-mono font-bold tracking-[0.15em] text-sm text-white/90 uppercase group-hover:text-white transition-colors duration-200">
            GitLedger
          </span>
        </Link>

        <nav className="hidden sm:flex items-center gap-8">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-[11px] font-mono tracking-[0.18em] uppercase transition-colors duration-200 ${
                pathname.startsWith(href) ? 'text-white' : 'text-white/35 hover:text-white/70'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 border border-white/[0.08] rounded-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80 animate-pulse" />
            <span className="text-[10px] font-mono tracking-[0.18em] text-white/35 uppercase">Base L2</span>
          </div>
          {isLandingPage ? (
            <Link
              href="/dashboard"
              className="px-4 py-1.5 border border-white/15 text-[11px] font-mono tracking-[0.18em] text-white/70 uppercase hover:text-white hover:border-white/35 transition-all duration-200"
            >
              Launch App
            </Link>
          ) : (
            <ConnectButton />
          )}
          <button
            className="sm:hidden flex flex-col gap-1 p-1"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            <span className={`w-5 h-px bg-white/50 transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
            <span className={`w-5 h-px bg-white/50 transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-5 h-px bg-white/50 transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="sm:hidden border-t border-white/[0.06] bg-[#0a0a0b] px-6 py-4 flex flex-col gap-4">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="text-[11px] font-mono tracking-[0.18em] text-white/45 uppercase hover:text-white/80 transition-colors duration-200"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
