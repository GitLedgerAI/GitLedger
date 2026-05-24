'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { storeGithubSession } from '@/lib/auth-context';

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const githubLogin = params.get('github_login');
    const basename = params.get('basename');
    const wallet = params.get('wallet');
    const error = params.get('error');

    if (error || !githubLogin) {
      router.replace('/dashboard?auth_error=1');
      return;
    }

    storeGithubSession({ githubLogin, basename, walletAddress: wallet });
    router.replace('/dashboard');
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <p className="text-white/40 font-mono text-sm tracking-[0.2em] uppercase animate-pulse">
        Completing sign in…
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
          <p className="text-white/40 font-mono text-sm tracking-[0.2em] uppercase animate-pulse">
            Loading…
          </p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
