'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useConnect } from 'wagmi';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';

function WalletIcon({ name }: { name: string }) {
  if (name === 'MetaMask') {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-[#f6851b]/10 border border-[#f6851b]/20 shrink-0">
        <svg width="16" height="16" viewBox="0 0 35 33" fill="none">
          <path d="M32.9 1L19.4 10.7l2.4-5.7L32.9 1z" fill="#E17726" stroke="#E17726" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2.1 1l13.4 9.8-2.3-5.8L2.1 1z" fill="#E27625" stroke="#E27625" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M28.2 23.5l-3.6 5.5 7.7 2.1 2.2-7.4-6.3-.2zM1.5 23.7l2.2 7.4 7.7-2.1-3.6-5.5-6.3.2z" fill="#E27625" stroke="#E27625" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11 14.5l-2.1 3.2 7.5.3-.2-8.1L11 14.5zM24 14.5l-5.3-4.7-.2 8.2 7.5-.3L24 14.5zM11.4 29l4.5-2.2-3.9-3-.6 5.2zM19.1 26.8l4.5 2.2-.6-5.2-3.9 3z" fill="#E27625" stroke="#E27625" strokeWidth=".25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  }

  if (name === 'Coinbase Wallet') {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-[#0052ff]/10 border border-[#0052ff]/20 shrink-0">
        <svg width="16" height="16" viewBox="0 0 1024 1024" fill="none">
          <circle cx="512" cy="512" r="512" fill="#0052FF"/>
          <path d="M516 692c-101 0-183-82-183-183s82-183 183-183c91 0 167 67 180 154h183C863 308 702 164 516 164c-193 0-350 157-350 350s157 350 350 350c186 0 347-144 363-326H696c-13 87-89 154-180 154z" fill="white"/>
        </svg>
      </div>
    );
  }

  if (name === 'Rabby') {
    return (
      <div className="w-8 h-8 flex items-center justify-center bg-[#7b5ea7]/10 border border-[#7b5ea7]/20 shrink-0">
        <span className="text-[#7b5ea7] font-bold text-[11px] font-mono">RB</span>
      </div>
    );
  }

  const letter = name.charAt(0).toUpperCase();
  return (
    <div className="w-8 h-8 flex items-center justify-center bg-white/[0.04] border border-white/[0.08] shrink-0">
      <span className="text-white/40 font-mono text-[11px] font-bold">{letter}</span>
    </div>
  );
}

function getConnectorSub(name: string): string {
  if (name === 'MetaMask')      return 'Browser extension';
  if (name === 'Coinbase Wallet') return 'Smart wallet or extension';
  if (name === 'Rabby')         return 'Browser extension';
  if (name === 'Injected')      return 'Detected browser wallet';
  if (name === 'WalletConnect') return 'Mobile wallet via QR';
  return 'Browser extension';
}

export default function AuthModal() {
  const {
    isModalOpen,
    closeModal,
    isWalletConnected,
    isGithubLinked,
    isFullyRegistered,
    connectGitHub,
    disconnectAll,
  } = useAuth();
  const { connect, connectors, isPending, variables } = useConnect();

  const step = !isGithubLinked ? 'github' : !isWalletConnected ? 'wallet' : 'done';

  useEffect(() => {
    if (isFullyRegistered) closeModal();
  }, [isFullyRegistered, closeModal]);

  if (!isModalOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={closeModal}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.22 }}
          className="w-full max-w-sm bg-[#111214] border border-white/[0.08] p-6 flex flex-col gap-5"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono tracking-[0.25em] text-white/25 uppercase mb-1">
                {step === 'github' ? 'Step 1 of 2' : step === 'wallet' ? 'Step 2 of 2' : 'Connected'}
              </p>
              <h2 className="text-base font-bold text-white">
                {step === 'github' ? 'Link GitHub Account' : step === 'wallet' ? 'Connect Wallet' : 'All set'}
              </h2>
            </div>
            <button
              onClick={closeModal}
              className="text-white/25 hover:text-white/60 transition-colors text-lg leading-none mt-0.5"
            >
              ✕
            </button>
          </div>

          {/* Step progress */}
          <div className="flex gap-1.5">
            <div className={`flex-1 h-px transition-colors duration-300 ${step !== 'github' ? 'bg-emerald-400/60' : 'bg-white/20'}`} />
            <div className={`flex-1 h-px transition-colors duration-300 ${step === 'done' ? 'bg-emerald-400/60' : step === 'wallet' ? 'bg-white/20' : 'bg-white/[0.06]'}`} />
          </div>

          {/* ── Step 1: GitHub ── */}
          {step === 'github' && (
            <div className="flex flex-col gap-4">
              <p className="text-[11px] font-mono text-white/35 leading-relaxed">
                Link your GitHub account so GitLedger can detect your PR approvals and trigger the stake flow automatically.
              </p>
              <div className="px-4 py-3 border border-white/[0.06] bg-[#0a0a0b] flex flex-col gap-2">
                {[
                  'One-time setup — no repeat logins',
                  'Read-only access to your public PRs',
                  'Your wallet stays the signing authority',
                ].map(line => (
                  <div key={line} className="flex items-start gap-2">
                    <span className="text-emerald-400/50 text-[10px] mt-0.5 shrink-0">✓</span>
                    <span className="text-[10px] font-mono text-white/30">{line}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={connectGitHub}
                className="w-full py-3 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.18em] font-bold uppercase hover:bg-white transition-all duration-200 flex items-center justify-center gap-2.5"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </button>
            </div>
          )}

          {/* ── Step 2: Wallet ── */}
          {step === 'wallet' && (
            <div className="flex flex-col gap-3">
              <div className="px-4 py-3 bg-emerald-400/[0.04] border border-emerald-400/15 flex items-center gap-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 shrink-0" />
                <span className="text-[10px] font-mono text-emerald-300/60 truncate">GitHub linked</span>
              </div>
              <p className="text-[11px] font-mono text-white/35 leading-relaxed">
                Choose a wallet to sign transactions on Base L2.
              </p>
              <div className="flex flex-col gap-1.5">
                {connectors.map(connector => {
                  const isConnecting = isPending && variables?.connector === connector;
                  return (
                    <button
                      key={connector.uid}
                      onClick={() => connect({ connector })}
                      disabled={isPending}
                      className="flex items-center gap-3 px-3 py-3 border border-white/[0.08] bg-[#0a0a0b] hover:border-white/20 hover:bg-white/[0.02] transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <WalletIcon name={connector.name} />
                      <div className="flex flex-col gap-0.5 text-left flex-1 min-w-0">
                        <span className="text-[12px] font-mono text-white/60 group-hover:text-white/85 transition-colors">
                          {connector.name}
                        </span>
                        <span className="text-[10px] font-mono text-white/22">
                          {getConnectorSub(connector.name)}
                        </span>
                      </div>
                      {isConnecting ? (
                        <span className="w-3.5 h-3.5 border border-white/20 border-t-white/60 rounded-full animate-spin shrink-0" />
                      ) : (
                        <span className="text-white/20 group-hover:text-white/50 transition-colors text-xs shrink-0">→</span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] font-mono text-white/18 text-center">ETH-compatible wallets only · Base L2</p>
              <button onClick={disconnectAll} className="text-[10px] font-mono text-white/20 hover:text-white/45 transition-colors text-center">
                unlink GitHub
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
