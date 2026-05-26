'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { getGitHubAppInstallStatus, linkWalletToGithubSession } from './api';

const SESSION_KEY = 'cl_github_session';

export interface GithubSession {
  githubLogin: string;
  basename: string | null;
  walletAddress: string | null;
  appInstallConfirmed?: boolean;
  appInstalled?: boolean;
}

type AppInstallStatus = 'idle' | 'checking' | 'installed' | 'not_installed' | 'error';

interface AuthContextType {
  walletAddress: `0x${string}` | undefined;
  githubSession: GithubSession | null;
  isWalletConnected: boolean;
  isGithubLinked: boolean;
  isFullyRegistered: boolean;
  displayName: string | null;
  appInstallStatus: AppInstallStatus;
  appInstallCheckError: string | null;
  refreshAppInstallStatus: () => Promise<void>;
  connectGitHub: () => void;
  confirmAppInstall: () => void;
  disconnectAll: () => void;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [githubSession, setGithubSession] = useState<GithubSession | null>(null);
  const [appInstallStatus, setAppInstallStatus] = useState<AppInstallStatus>('idle');
  const [appInstallCheckError, setAppInstallCheckError] = useState<string | null>(null);
  const [isWalletLinking, setIsWalletLinking] = useState(false);

  // Restore GitHub session from localStorage (GitHub-first: works without wallet too)
  useEffect(() => {
    localStorage.removeItem('cl_app_installed');
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw) as GithubSession;
      // Restore if: no wallet recorded in session, or wallet matches current
      if (!session.walletAddress || !address ||
          session.walletAddress.toLowerCase() === address.toLowerCase()) {
        setGithubSession(session);
      }
    } catch { /* ignore */ }
  }, [address]);

  // Auto-open modal only after fresh OAuth redirect to avoid repeated prompts across pages.
  useEffect(() => {
    if (!githubSession) return;
    const isFreshOAuth = typeof window !== 'undefined' && sessionStorage.getItem('cl_fresh_oauth') === '1';
    if (isFreshOAuth) {
      setIsModalOpen(true);
      sessionStorage.removeItem('cl_fresh_oauth');
    }
  }, [githubSession, isConnected]);

  // Auto-link wallet address into a GitHub-first session once wallet connects.
  // This ensures backend reviewer row exists for protected tRPC routes.
  useEffect(() => {
    if (!address || !githubSession?.githubLogin || isWalletLinking) return;
    const normalizedAddress = address.toLowerCase();
    const alreadyLinked = githubSession.walletAddress?.toLowerCase() === normalizedAddress;
    if (alreadyLinked) return;

    setIsWalletLinking(true);
    void (async () => {
      try {
        await linkWalletToGithubSession(githubSession.githubLogin, normalizedAddress);
        const linked = { ...githubSession, walletAddress: normalizedAddress };
        setGithubSession(linked);
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(linked)); } catch { /* ignore */ }
      } catch (error) {
        console.error('[auth] failed to link wallet to github session', error);
      } finally {
        setIsWalletLinking(false);
      }
    })();
  }, [address, githubSession, isWalletLinking]);

  const connectGitHub = useCallback(() => {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://gitledger.tech';
    const cb = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const walletParam = address ? `&wallet=${address}` : '';
    window.location.href = `${api}/auth/github?callback=${cb}${walletParam}`;
  }, [address]);

  const refreshAppInstallStatus = useCallback(async () => {
    if (!githubSession?.githubLogin || !isConnected) return;
    setAppInstallStatus('checking');
    setAppInstallCheckError(null);
    try {
      const status = await Promise.race([
        getGitHubAppInstallStatus(githubSession.githubLogin),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('install status check timeout')), 10000),
        ),
      ]);
      const installed = !!status.installed;
      setAppInstallStatus(installed ? 'installed' : 'not_installed');
      setGithubSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, appInstalled: installed, appInstallConfirmed: installed ? true : prev.appInstallConfirmed };
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    } catch (error) {
      setAppInstallStatus('error');
      setAppInstallCheckError(error instanceof Error ? error.message : String(error));
    }
  }, [githubSession?.githubLogin, isConnected]);

  useEffect(() => {
    if (!githubSession?.githubLogin || !isConnected) {
      setAppInstallStatus('idle');
      return;
    }
    if (githubSession.appInstalled === true) {
      setAppInstallStatus('installed');
      return;
    }
    void refreshAppInstallStatus();
  }, [githubSession?.githubLogin, githubSession?.appInstalled, isConnected, refreshAppInstallStatus]);

  const confirmAppInstall = useCallback(() => {
    if (!githubSession) return;
    const updated = { ...githubSession, appInstallConfirmed: true, appInstalled: true };
    setGithubSession(updated);
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }, [githubSession]);

  const disconnectAll = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setGithubSession(null);
    disconnect();
  }, [disconnect]);

  // basename > @githubLogin > shortened address
  const displayName =
    githubSession?.basename ??
    (githubSession?.githubLogin ? `@${githubSession.githubLogin}` : null) ??
    (address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null);

  return (
    <AuthContext.Provider
      value={{
        walletAddress: address,
        githubSession,
        isWalletConnected: isConnected,
        isGithubLinked: !!githubSession,
        isFullyRegistered: isConnected && !!githubSession,
        displayName,
        appInstallStatus,
        appInstallCheckError,
        refreshAppInstallStatus,
        connectGitHub,
        confirmAppInstall,
        disconnectAll,
        isModalOpen,
        openModal: () => setIsModalOpen(true),
        closeModal: () => setIsModalOpen(false),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function storeGithubSession(session: GithubSession) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem('cl_fresh_oauth', '1');
  }
}
