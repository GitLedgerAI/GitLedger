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

const SESSION_KEY = 'cl_github_session';

export interface GithubSession {
  githubLogin: string;
  basename: string | null;
  walletAddress: string | null;
}

interface AuthContextType {
  walletAddress: `0x${string}` | undefined;
  githubSession: GithubSession | null;
  isWalletConnected: boolean;
  isGithubLinked: boolean;
  isFullyRegistered: boolean;
  displayName: string | null;
  connectGitHub: () => void;
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

  // Restore GitHub session from localStorage (GitHub-first: works without wallet too)
  useEffect(() => {
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

  // Auto-open modal to wallet step after GitHub OAuth redirect
  useEffect(() => {
    if (githubSession && !isConnected) setIsModalOpen(true);
  }, [githubSession, isConnected]);

  // Auto-link wallet address into a GitHub-first session once wallet connects
  useEffect(() => {
    if (address && githubSession && !githubSession.walletAddress) {
      const linked = { ...githubSession, walletAddress: address };
      setGithubSession(linked);
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(linked)); } catch { /* ignore */ }
    }
  }, [address, githubSession]);

  const connectGitHub = useCallback(() => {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
    const cb = encodeURIComponent(`${window.location.origin}/auth/callback`);
    const walletParam = address ? `&wallet=${address}` : '';
    window.location.href = `${api}/auth/github?callback=${cb}${walletParam}`;
  }, [address]);

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
        connectGitHub,
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
  }
}
