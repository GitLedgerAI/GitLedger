export function formatUsdc(microUsdc: number): string {
  const dollars = microUsdc / 1_000_000;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(1)}K`;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function shortenAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function shortenUid(uid: string): string {
  if (!uid) return '';
  return `${uid.slice(0, 10)}...`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1mo ago' : `${months}mo ago`;
}

export function daysRemaining(windowEndsAt: string): number {
  const diff = new Date(windowEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function scoreToColor(score: number): string {
  if (score >= 700) return 'text-emerald-400';
  if (score >= 500) return 'text-amber-400';
  return 'text-red-400';
}
