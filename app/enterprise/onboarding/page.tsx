'use client';

import { useState } from 'react';
import Link from 'next/link';
import Reveal from '@/components/Reveal';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import EnterpriseBadge from '@/components/enterprise/EnterpriseBadge';
import { useAuth } from '@/lib/auth-context';
import {
  useEnterpriseOrg,
  useStartEnterpriseOAuth,
  useEnableScim,
} from '@/lib/enterprise-hooks';
import { MOCK_ORG } from '@/lib/enterprise-mock';

const STEPS = [
  {
    n: '01',
    label: 'GitHub Enterprise OAuth',
    body: 'SAML-compatible. Maps GitHub Enterprise users to Basenames. Required for SCIM and audit-grade attribution.',
  },
  {
    n: '02',
    label: 'SCIM Provisioning',
    body: 'Auto-sync user adds, removals, and group membership from your IdP (Okta, Azure AD, Google).',
  },
  {
    n: '03',
    label: 'First Policy',
    body: 'Set a baseline rule on /contracts or /payments. Enforced before next merge.',
  },
  {
    n: '04',
    label: 'SIEM Forwarder',
    body: 'Stream slash + violation events to Splunk, Datadog, Vanta, or Drata in real time.',
  },
];

export default function OnboardingPage() {
  const orgSlug = MOCK_ORG.orgSlug;
  const { data: org } = useEnterpriseOrg(orgSlug);
  const { walletAddress } = useAuth();
  const startOAuth = useStartEnterpriseOAuth();
  const enableScim = useEnableScim(orgSlug);

  const [ghHost, setGhHost] = useState(org?.githubEnterpriseHost ?? 'github.acme.io');
  const [scimUrl, setScimUrl] = useState('https://gitledger.dev/scim/v2');
  const [scimToken, setScimToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const friendlyOAuthError = (raw: string): string => {
    if (/invalid_github_host|invalid_host|bad_host/i.test(raw))
      return 'That GitHub Enterprise host is not reachable. Check the spelling (e.g. github.acme.io — no protocol, no path).';
    if (/host_not_found|dns|ENOTFOUND/i.test(raw))
      return 'We could not resolve that host. Verify your GitHub Enterprise URL with your IT admin.';
    if (/wallet_already_bound|org_already_bound|already_bound/i.test(raw))
      return 'This wallet is already bound to another GitHub Enterprise org. Disconnect there first or use a different wallet.';
    if (/oauth_app_missing|app_not_installed/i.test(raw))
      return 'The GitLedger OAuth App is not installed on your GitHub Enterprise instance. Ask your admin to approve it first.';
    if (/\b401\b|UNAUTHORIZED/.test(raw))
      return 'Session expired — reconnect your wallet and try again.';
    if (/\b403\b|FORBIDDEN|not_a_member/.test(raw))
      return 'Your wallet is not authorized to connect this org. Contact your GitLedger admin.';
    if (/\b5\d\d\b/.test(raw))
      return 'GitHub Enterprise OAuth service is temporarily unavailable. Try again in a moment.';
    return 'OAuth start failed. Please try again.';
  };

  const beginOAuth = async () => {
    setError(null);
    if (!walletAddress) {
      setError('Connect a wallet first — your org will be bound to this address.');
      return;
    }
    if (!ghHost.trim()) return setError('GitHub Enterprise host is required');
    try {
      const r = await startOAuth.mutateAsync({
        githubEnterpriseHost: ghHost.trim(),
        walletAddress,
      });
      window.location.href = r.redirectUrl;
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      setError(friendlyOAuthError(raw));
    }
  };

  const provisionScim = async () => {
    setError(null);
    try {
      const r = await enableScim.mutateAsync({ scimEndpointUrl: scimUrl.trim() });
      setScimToken(r.bearerToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SCIM enable failed');
    }
  };

  return (
    <>
      <EnterpriseHeader
        eyebrow="Onboarding"
        title="Connect GitHub Enterprise"
        subtitle="SAML SSO, SCIM provisioning, and your first policy in under 5 minutes."
        org={org}
      />

      {/* ── Step list ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] mb-12">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} direction="up" delay={i * 0.05}>
            <div className="bg-[#0a0a0b] p-5 flex flex-col gap-3 h-full">
              <span className="text-[10px] font-mono tracking-[0.22em] text-emerald-300/70 uppercase">
                Step {s.n}
              </span>
              <p className="text-sm font-medium text-white/85">{s.label}</p>
              <p className="text-[12px] text-white/40 font-light leading-relaxed">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* ── GitHub Enterprise OAuth ─────────────────────────────────────── */}
      <Reveal direction="up">
        <div className="bg-[#111113] border border-white/[0.06] p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-mono tracking-[0.22em] text-emerald-300/70 uppercase">
              Step 01 · GitHub Enterprise OAuth
            </p>
            {org?.samlEnabled ? (
              <EnterpriseBadge label="SAML Connected" tone="emerald" size="sm" />
            ) : (
              <EnterpriseBadge label="Not Connected" tone="amber" size="sm" />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                GitHub Enterprise host
              </label>
              <input
                value={ghHost}
                onChange={e => setGhHost(e.target.value)}
                placeholder="github.acme.io"
                className="bg-[#0a0a0b] border border-white/10 px-3 py-2.5 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40 placeholder:text-white/18"
              />
              <p className="text-[10px] font-mono text-white/22">
                We use this for the SAML AssertionConsumer + GraphQL API endpoint.
              </p>
            </div>
            <button
              onClick={beginOAuth}
              disabled={startOAuth.isPending}
              className="px-5 py-2.5 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200 disabled:opacity-50"
            >
              {startOAuth.isPending ? 'Redirecting…' : 'Authorize →'}
            </button>
          </div>
        </div>
      </Reveal>

      {/* ── SCIM provisioning ───────────────────────────────────────────── */}
      <Reveal direction="up">
        <div className="bg-[#111113] border border-white/[0.06] p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] font-mono tracking-[0.22em] text-emerald-300/70 uppercase">
              Step 02 · SCIM Provisioning
            </p>
            {org?.scimEnabled ? (
              <EnterpriseBadge label="SCIM Active" tone="emerald" size="sm" />
            ) : (
              <EnterpriseBadge label="Optional" tone="neutral" size="sm" />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
                SCIM v2 endpoint
              </label>
              <input
                value={scimUrl}
                onChange={e => setScimUrl(e.target.value)}
                className="bg-[#0a0a0b] border border-white/10 px-3 py-2.5 font-mono text-sm text-white/85 outline-none focus:border-emerald-400/40"
              />
              <p className="text-[10px] font-mono text-white/22">
                Compatible with Okta · Azure AD · Google Workspace · OneLogin.
              </p>
            </div>
            <button
              onClick={provisionScim}
              disabled={enableScim.isPending}
              className="px-5 py-2.5 border border-white/15 text-[11px] font-mono tracking-[0.2em] text-white/70 uppercase hover:text-white hover:border-white/35 transition-colors duration-200 disabled:opacity-50"
            >
              {enableScim.isPending ? 'Provisioning…' : 'Generate Bearer Token'}
            </button>
          </div>
          {scimToken && (
            <div className="mt-5 pt-5 border-t border-white/[0.05]">
              <p className="text-[10px] font-mono tracking-[0.22em] text-emerald-300/70 uppercase mb-2">
                Bearer token (shown once)
              </p>
              <pre className="font-mono text-[11px] text-white/75 bg-[#0a0a0b] border border-white/[0.06] p-3 overflow-x-auto">
                {scimToken}
              </pre>
              <p className="text-[10px] font-mono text-amber-300/70 mt-2">
                Copy now. Rotate via /enterprise/onboarding if leaked.
              </p>
            </div>
          )}
        </div>
      </Reveal>

      {error && (
        <p className="text-[11px] font-mono text-red-400/85 mb-6">{error}</p>
      )}

      {/* ── Next steps ──────────────────────────────────────────────────── */}
      <Reveal direction="up">
        <div className="bg-[#0d0d0e] border border-white/[0.06] p-6">
          <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase mb-4">
            Then continue with
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/enterprise/policy"
              className="flex items-center justify-between gap-3 px-5 py-4 border border-white/[0.08] hover:border-white/25 hover:bg-[#111113] transition-colors duration-200"
            >
              <div>
                <p className="text-sm font-medium text-white/80">Set your first policy</p>
                <p className="text-[11px] font-mono text-white/30 mt-0.5">
                  contracts/** · min $500 · 2 reviewers
                </p>
              </div>
              <span className="text-[10px] font-mono text-white/45 tracking-[0.18em] uppercase">
                Step 03 →
              </span>
            </Link>
            <Link
              href="/enterprise/siem"
              className="flex items-center justify-between gap-3 px-5 py-4 border border-white/[0.08] hover:border-white/25 hover:bg-[#111113] transition-colors duration-200"
            >
              <div>
                <p className="text-sm font-medium text-white/80">Connect a SIEM</p>
                <p className="text-[11px] font-mono text-white/30 mt-0.5">
                  Splunk · Datadog · Vanta · Drata
                </p>
              </div>
              <span className="text-[10px] font-mono text-white/45 tracking-[0.18em] uppercase">
                Step 04 →
              </span>
            </Link>
          </div>
        </div>
      </Reveal>
    </>
  );
}
