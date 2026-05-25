'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';

import Footer from '@/components/Footer';
import VerdictBadge from '@/components/VerdictBadge';
import { useAuth } from '@/lib/auth-context';
import { prepareStake, submitStake } from '@/lib/api';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import { useReviewer, usePrDetails } from '@/lib/hooks';
import { USDC_ADDRESS, USDC_ABI, GITLEDGER_CONTRACT, GITLEDGER_ABI, MAX_UINT256 } from '@/lib/contracts';

const QUICK_PICKS = [25, 50, 100, 500];

type Step = 'form' | 'confirm' | 'signing' | 'success';
type SigningPhase = 'approving' | 'staking' | 'recording';

function StakeFlowInner({ prId }: { prId: number }) {
  const searchParams = useSearchParams();
  const repoSlug = searchParams.get('repo') ?? '';

  const [stakeId] = useState(() => {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return '0x' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  });
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [signingPhase, setSigningPhase] = useState<SigningPhase>('approving');
  const [txHash, setTxHash] = useState('');
  const [signError, setSignError] = useState('');

  const { isWalletConnected, isFullyRegistered, walletAddress, displayName, openModal, githubSession } = useAuth();
  const { data: reviewer } = useReviewer(githubSession?.basename ?? null);
  const { data: pr, isLoading: prLoading } = usePrDetails(repoSlug || null, prId);

  const usdcAmount = parseFloat(amount) || 0;
  const amountWei = BigInt(Math.round(usdcAmount * 1_000_000));
  const multiplier = (reviewer?.reputationScore ?? 0) >= 700 ? 1.5 : 1;
  const estimatedYield = usdcAmount * 0.18 * (30 / 365) * multiplier;
  const effectiveMin = 0.5;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: walletAddress ? [walletAddress, GITLEDGER_CONTRACT] : undefined,
    query: { enabled: !!walletAddress },
  });

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  async function handleConfirmStake() {
    if (!isWalletConnected || !isFullyRegistered) { openModal(); return; }
    if (!walletAddress) return;
    if (!publicClient) { setSignError('Wallet not ready. Reconnect and retry.'); return; }
    setSignError('');
    setStep('signing');
    try {
      if ((allowance ?? 0n) < amountWei) {
        setSigningPhase('approving');
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'approve',
          args: [GITLEDGER_CONTRACT, MAX_UINT256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        await refetchAllowance();
      }

      setSigningPhase('staking');
      const prep = await prepareStake({
        stakeId,
        repoSlug: pr?.repoSlug ?? repoSlug,
        prId: pr?.prId ?? prId,
        amountUsdc: Number(amountWei),
        walletAddress,
      });
      const stakeTxHash = await writeContractAsync({
        address: prep.contractAddress,
        abi: GITLEDGER_ABI,
        functionName: 'stakeReview',
        args: [
          stakeId as `0x${string}`,
          walletAddress as `0x${string}`,
          amountWei,
          BigInt(prep.windowDurationSeconds),
          prep.yieldBps,
          prep.schemaData,
        ],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: stakeTxHash });
      if (receipt.status !== 'success') {
        throw new Error('Stake transaction reverted on-chain.');
      }

      setSigningPhase('recording');
      const result = await submitStake({
        stakeId,
        txHash: stakeTxHash,
        walletAddress,
      });
      setTxHash(result.txHash);
      setStep('success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed. Go back and try again.';
      setSignError(msg.includes('User rejected') ? 'You rejected the transaction in your wallet.' : msg);
      setStep('confirm');
    }
  }

  if (prLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
        <main className="flex-1 max-w-3xl mx-auto px-6 sm:px-12 py-12 w-full">
          <div className="h-4 w-24 bg-white/[0.04] animate-pulse mb-10" />
          <div className="h-64 bg-white/[0.02] animate-pulse" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col">
      <main className="flex-1 max-w-3xl mx-auto px-6 sm:px-12 py-12 w-full">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-[11px] font-mono tracking-[0.18em] text-white/25 uppercase hover:text-white/55 transition-colors duration-200 mb-10"
        >
          ← Dashboard
        </Link>

        <AnimatePresence mode="wait">

          {/* ── SUCCESS ── */}
          {step === 'success' && (
            <motion.div key="success"
              initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-6"
            >
              <div className="flex flex-col items-center text-center py-10 gap-4">
                <div className="w-14 h-14 border border-emerald-400/30 bg-emerald-400/[0.05] flex items-center justify-center">
                  <span className="text-emerald-400 text-xl">✓</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Stake Locked</h2>
                  <p className="text-white/35 text-sm font-light">
                    {formatUsdc(usdcAmount * 1_000_000)} USDC is in escrow on Base L2.
                    An EAS attestation has been minted for this review.
                  </p>
                </div>
              </div>

              <div className="border border-white/[0.06] bg-[#111113]">
                <p className="px-5 py-3 text-[10px] font-mono tracking-[0.22em] text-white/25 uppercase border-b border-white/[0.04]">
                  What happens next
                </p>
                <div className="flex flex-col divide-y divide-white/[0.04]">
                  {[
                    { icon: '◉', color: 'text-emerald-400/70', label: 'Now', desc: 'Chainlink oracle begins monitoring the repo for hotfix PRs targeting this commit.' },
                    { icon: '◎', color: 'text-white/30',       label: 'Days 1–30', desc: 'If a hotfix merging against this code is detected, your stake is slashed immediately.' },
                    { icon: '○', color: 'text-white/20',       label: 'Day 30', desc: `If no hotfix is found, you receive your $${usdcAmount} back plus ~$${estimatedYield.toFixed(2)} yield.` },
                  ].map(({ icon, color, label, desc }) => (
                    <div key={label} className="flex items-start gap-4 px-5 py-4">
                      <span className={`${color} font-mono text-base mt-0.5 shrink-0`}>{icon}</span>
                      <div>
                        <p className="text-[10px] font-mono tracking-widest text-white/40 uppercase mb-0.5">{label}</p>
                        <p className="text-[11px] font-mono text-white/30 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {txHash && (
                <div className="px-5 py-3 border border-white/[0.06] bg-[#111113] flex items-center justify-between gap-4">
                  <span className="text-[10px] font-mono text-white/20 tracking-wide uppercase">Tx Hash</span>
                  <span className="text-[10px] font-mono text-white/40 truncate">{txHash}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Link href="/dashboard"
                  className="flex-1 py-3 text-center border border-white/10 text-[11px] font-mono tracking-widest text-white/40 uppercase hover:text-white/70 hover:border-white/20 transition-all duration-200">
                  Back to Dashboard
                </Link>
                <Link href={githubSession?.basename ? `/reviewer/${encodeURIComponent(githubSession.basename)}` : '/explore'}
                  className="flex-1 py-3 text-center border border-white/10 text-[11px] font-mono tracking-widest text-white/40 uppercase hover:text-white/70 hover:border-white/20 transition-all duration-200">
                  View Profile
                </Link>
              </div>
            </motion.div>
          )}

          {/* ── CONFIRM / SIGNING ── */}
          {(step === 'confirm' || step === 'signing') && (
            <motion.div key="confirm"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-5"
            >
              <div>
                <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-2">Confirm Stake</p>
                <h1 className="text-2xl font-bold text-white">Review & confirm</h1>
              </div>

              <div className="border border-white/[0.08] bg-[#111113] divide-y divide-white/[0.04]">
                {[
                  ['Reviewer',     displayName ?? shortenAddress(walletAddress ?? '')],
                  ['Repository',   pr?.repoSlug ?? repoSlug],
                  ['Pull Request', `#${pr?.prId ?? prId}${pr?.prTitle ? ` — ${pr.prTitle}` : ''}`],
                  ['Stake',        formatUsdc(usdcAmount * 1_000_000)],
                  ['Est. yield',   `+$${estimatedYield.toFixed(2)} if clean over 30 days${multiplier > 1 ? ' (1.5× applied)' : ''}`],
                  ['Oracle window','30 days from block timestamp'],
                  ['Chain',        'Base L2 · chainId 8453'],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[130px_1fr] gap-4 px-5 py-3">
                    <span className="text-[10px] font-mono tracking-wide text-white/25 uppercase">{k}</span>
                    <span className="text-sm text-white/65 font-light">{v}</span>
                  </div>
                ))}
              </div>

              <div className="px-5 py-4 border border-amber-400/15 bg-amber-400/[0.03] flex items-start gap-3">
                <span className="text-amber-400/60 shrink-0 mt-0.5">⚠</span>
                <p className="text-[11px] font-mono text-amber-300/60 leading-relaxed">
                  If a hotfix PR targeting this merged code is detected within 30 days,
                  your full {formatUsdc(usdcAmount * 1_000_000)} stake is permanently slashed.
                </p>
              </div>

              {signError && (
                <p className="text-[11px] font-mono text-red-400/60 text-center">{signError}</p>
              )}

              <div className="flex gap-3">
                <button onClick={() => setStep('form')} disabled={step === 'signing'}
                  className="flex-1 py-3 border border-white/10 text-[11px] font-mono tracking-widest text-white/35 uppercase hover:text-white/60 hover:border-white/20 transition-all duration-200 disabled:opacity-40">
                  Back
                </button>
                <button onClick={handleConfirmStake} disabled={step === 'signing'}
                  className="flex-1 py-3 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-widest font-bold uppercase hover:bg-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {step === 'signing' ? (
                    <>
                      <span className="w-3 h-3 border border-[#0a0a0b]/40 border-t-[#0a0a0b] rounded-full animate-spin" />
                      {signingPhase === 'approving'
                        ? 'Approve USDC in wallet…'
                        : signingPhase === 'staking'
                        ? 'Sign stake in wallet…'
                        : 'Recording on backend…'}
                    </>
                  ) : (
                    (allowance ?? 0n) < amountWei
                      ? `Approve & Stake ${formatUsdc(usdcAmount * 1_000_000)}`
                      : `Confirm & Stake ${formatUsdc(usdcAmount * 1_000_000)}`
                  )}
                </button>
              </div>
              <p className="text-[10px] font-mono text-white/15 text-center tracking-wide -mt-2">
                Gasless on Base L2 · Powered by Coinbase Agentic Wallet
              </p>
            </motion.div>
          )}

          {/* ── FORM ── */}
          {step === 'form' && (
            <motion.div key="form"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col gap-7"
            >
              <div>
                <p className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase mb-2">Stake Your Review</p>
                <h1 className="text-2xl font-bold text-white tracking-tight">
                  You approved this PR.<br />How much do you stand behind it?
                </h1>
                <p className="text-white/30 text-sm font-light mt-2 leading-relaxed">
                  Lock USDC as a confidence signal. If the code ships clean for 30 days you earn yield.
                  If a hotfix is merged, you lose your stake.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
                <div className="bg-[#111113] px-4 py-4 flex flex-col gap-2">
                  <p className="text-[10px] font-mono tracking-[0.2em] text-emerald-400/60 uppercase">If it ships clean</p>
                  <p className="text-sm font-bold text-white/80">You earn yield</p>
                  <p className="text-[11px] font-mono text-white/30 leading-relaxed">
                    Your stake returns after 30 days plus ~18% APY. Score ≥ 700 earns 1.5×.
                  </p>
                  {usdcAmount > 0 && (
                    <p className="text-emerald-400/70 font-mono text-sm font-bold mt-1">
                      +${estimatedYield.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="bg-[#111113] px-4 py-4 flex flex-col gap-2">
                  <p className="text-[10px] font-mono tracking-[0.2em] text-red-400/60 uppercase">If a hotfix lands</p>
                  <p className="text-sm font-bold text-white/80">You lose your stake</p>
                  <p className="text-[11px] font-mono text-white/30 leading-relaxed">
                    A Chainlink oracle monitors the repo. Hotfix detected = 100% slash to treasury.
                  </p>
                  {usdcAmount > 0 && (
                    <p className="text-red-400/60 font-mono text-sm font-bold mt-1">
                      −{formatUsdc(usdcAmount * 1_000_000)}
                    </p>
                  )}
                </div>
              </div>

              {/* PR card */}
              <div className="border border-white/[0.08] bg-[#111113] p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/30 tracking-widest">{pr?.repoSlug ?? repoSlug}</span>
                  <VerdictBadge verdict="ACTIVE" size="sm" />
                </div>
                <p className="text-base text-white/80 font-medium leading-snug">
                  {pr?.prTitle ?? `PR #${prId}`}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-white/20">#{pr?.prId ?? prId}</span>
                  {pr && !pr.stakeEnabled && (
                    <span className="text-[10px] font-mono text-red-400/60">Staking disabled for this repo</span>
                  )}
                </div>
              </div>

              {/* Amount input */}
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-mono tracking-[0.28em] text-white/25 uppercase">
                  Confidence amount
                </label>
                <div className="flex gap-2">
                  {QUICK_PICKS.map(v => (
                    <button key={v} onClick={() => setAmount(String(v))}
                      className={`flex-1 py-2 border text-[11px] font-mono tracking-widest uppercase transition-all duration-200 ${
                        amount === String(v)
                          ? 'border-white/25 text-white/80 bg-white/[0.06]'
                          : 'border-white/[0.08] text-white/30 hover:border-white/18 hover:text-white/55'
                      }`}
                    >
                      ${v}
                    </button>
                  ))}
                </div>
                <div className="flex items-center border border-white/10 bg-[#111113] focus-within:border-white/25 transition-colors duration-200">
                  <span className="px-4 py-3 text-white/30 font-mono text-sm border-r border-white/[0.08]">$</span>
                  <input
                    type="number" min={effectiveMin} step="1" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={`Custom amount (min $${effectiveMin})`}
                    className="flex-1 px-4 py-3 bg-transparent text-white/80 text-sm font-mono outline-none placeholder:text-white/18"
                  />
                  <span className="px-4 py-3 text-white/25 font-mono text-xs border-l border-white/[0.08]">USDC</span>
                </div>
                {usdcAmount > 0 && (
                  <p className="text-[11px] font-mono text-white/25">
                    Clean window pays back{' '}
                    <span className="text-emerald-400/70">+${estimatedYield.toFixed(2)} yield</span>
                    {multiplier > 1 && <span className="text-emerald-400/45"> (1.5× score bonus)</span>}
                  </p>
                )}
              </div>

              {!isWalletConnected && (
                <div className="px-5 py-4 border border-white/[0.06] bg-[#111113] flex items-center justify-between gap-4">
                  <p className="text-[11px] font-mono text-white/35">Connect wallet to stake</p>
                  <button onClick={openModal}
                    className="px-4 py-2 border border-white/15 text-[10px] font-mono tracking-[0.15em] text-white/55 uppercase hover:text-white hover:border-white/30 transition-all duration-200 shrink-0">
                    Connect
                  </button>
                </div>
              )}

              <button
                onClick={() => usdcAmount >= effectiveMin && (isFullyRegistered ? setStep('confirm') : openModal())}
                disabled={usdcAmount < effectiveMin || (pr !== undefined && !pr?.stakeEnabled)}
                className={`w-full py-4 text-[11px] font-mono tracking-[0.2em] uppercase font-bold transition-all duration-200 ${
                  usdcAmount >= effectiveMin && pr?.stakeEnabled !== false
                    ? 'bg-white/90 text-[#0a0a0b] hover:bg-white cursor-pointer'
                    : 'bg-white/[0.06] text-white/18 cursor-not-allowed'
                }`}
              >
                {pr?.stakeEnabled === false
                  ? 'Staking disabled for this repo'
                  : usdcAmount >= effectiveMin
                  ? `Review & Stake ${formatUsdc(usdcAmount * 1_000_000)}`
                  : `Enter stake amount (min $${effectiveMin})`}
              </button>
              <p className="text-[10px] font-mono text-white/15 text-center tracking-wide -mt-4">
                Gasless on Base L2 · Powered by Coinbase Agentic Wallet
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
}

export default function StakeFlowPage({ params }: { params: { prId: string } }) {
  const prId = parseInt(params.prId, 10);
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <span className="w-6 h-6 border border-white/20 border-t-white/50 rounded-full animate-spin" />
      </div>
    }>
      <StakeFlowInner prId={prId} />
    </Suspense>
  );
}
