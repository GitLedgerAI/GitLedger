'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/enterprise',            label: 'Overview',   exact: true  },
  { href: '/enterprise/compliance', label: 'Compliance', exact: false },
  { href: '/enterprise/policy',     label: 'Policy',     exact: false },
  { href: '/enterprise/audit',      label: 'Audit',      exact: false },
  { href: '/enterprise/siem',       label: 'SIEM',       exact: false },
  { href: '/enterprise/onboarding', label: 'Onboarding', exact: false },
];

export default function EnterpriseNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-white/[0.06] mb-10">
      <div className="flex items-center gap-1 overflow-x-auto -mb-px">
        {LINKS.map(({ href, label, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`px-4 py-3 text-[10px] font-mono tracking-[0.22em] uppercase border-b transition-colors duration-200 shrink-0 ${
                active
                  ? 'text-emerald-300/90 border-emerald-400/70'
                  : 'text-white/30 border-transparent hover:text-white/65'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
