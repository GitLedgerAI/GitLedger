'use client';

import { useState } from 'react';
import Reveal from '@/components/Reveal';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import EnterpriseBadge from '@/components/enterprise/EnterpriseBadge';
import SiemRow from '@/components/enterprise/SiemRow';
import SiemForm from '@/components/enterprise/SiemForm';
import {
  useEnterpriseOrg,
  useSiemConfigs,
  useCreateSiemConfig,
  useUpdateSiemConfig,
  useTestSiemConfig,
  useDeleteSiemConfig,
} from '@/lib/enterprise-hooks';
import { MOCK_ORG } from '@/lib/enterprise-mock';

const PARTNER_LOGOS = [
  { name: 'Splunk',      letter: 'S', tone: 'text-amber-300/90'  },
  { name: 'Datadog',     letter: 'D', tone: 'text-violet-300/90' },
  { name: 'Vanta',       letter: 'V', tone: 'text-emerald-300/90'},
  { name: 'Drata',       letter: 'D', tone: 'text-blue-300/90'   },
  { name: 'Secureframe', letter: 'S', tone: 'text-cyan-300/90'   },
  { name: 'Custom',      letter: '⤳', tone: 'text-white/65'      },
];

const friendlySiemMutationError = (raw: string): string => {
  if (/webhook_not_found|not_found|\b404\b/i.test(raw))
    return 'That webhook no longer exists — it may have been removed elsewhere. Refresh to see the latest forwarders.';
  if (/endpoint_unreachable|connect_timeout|ENOTFOUND|ECONNREFUSED/i.test(raw))
    return 'Endpoint unreachable. Confirm the URL is publicly accessible (or allowlist GitLedger IPs).';
  if (/invalid_hmac_secret|hmac_failed|signature_invalid/i.test(raw))
    return 'HMAC verification failed at the destination. Rotate your SIEM secret and retry.';
  if (/\b401\b|UNAUTHORIZED/.test(raw))
    return 'Session expired — reconnect your wallet and try again.';
  if (/not_a_member_of_this_org|FORBIDDEN|\b403\b/.test(raw))
    return 'You are not authorized to manage SIEM forwarders for this organization.';
  if (/\b5\d\d\b/.test(raw))
    return 'SIEM forwarding service is temporarily unavailable. Try again in a moment.';
  return 'Operation failed. Please try again.';
};

export default function SiemPage() {
  const orgSlug = MOCK_ORG.orgSlug;
  const { data: org } = useEnterpriseOrg(orgSlug);
  const { data: configs = [], isLoading } = useSiemConfigs(orgSlug);
  const createMut = useCreateSiemConfig(orgSlug);
  const updateMut = useUpdateSiemConfig(orgSlug);
  const testMut = useTestSiemConfig(orgSlug);
  const deleteMut = useDeleteSiemConfig(orgSlug);

  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const handleMutationError = (err: unknown) => {
    const raw = err instanceof Error ? err.message : String(err);
    setActionError(friendlySiemMutationError(raw));
  };

  return (
    <>
      <EnterpriseHeader
        eyebrow="SIEM Forwarding"
        title="Real-time supply-chain alerts"
        subtitle="Forward StakeLocked, ReviewSlashed, and PolicyViolation events to your SIEM. Out-of-the-box integrations for Splunk, Datadog, Vanta, Drata, Secureframe."
        org={org}
        right={
          <button
            onClick={() => setShowForm(s => !s)}
            className="px-4 py-2.5 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200"
          >
            {showForm ? 'Cancel' : '+ Add Webhook'}
          </button>
        }
      />

      {/* ── Partner logos ─────────────────────────────────────────────── */}
      <Reveal direction="up">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-px bg-white/[0.06] mb-10">
          {PARTNER_LOGOS.map(p => (
            <div
              key={p.name}
              className="bg-[#0a0a0b] flex flex-col items-center justify-center gap-2 aspect-square p-4"
            >
              <span className={`text-2xl font-black ${p.tone}`}>{p.letter}</span>
              <span className="text-[10px] font-mono tracking-[0.18em] text-white/35 uppercase">
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ── Event reference ──────────────────────────────────────────── */}
      <Reveal direction="up">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/[0.06] mb-10">
          {[
            {
              event: 'stake.locked',
              tone: 'blue' as const,
              body: 'Fires when a reviewer locks USDC on PR approval. Use for spend tracking + audit.',
            },
            {
              event: 'review.slashed',
              tone: 'red' as const,
              body: 'Fires when Chainlink detects a hotfix targeting reviewed code. Page on-call.',
            },
            {
              event: 'policy.violation',
              tone: 'amber' as const,
              body: 'Fires when a PR ships without satisfying CompliancePolicy.sol. Block merge.',
            },
          ].map(e => (
            <div key={e.event} className="bg-[#0a0a0b] p-5">
              <EnterpriseBadge label={e.event} tone={e.tone} size="sm" />
              <p className="text-sm text-white/55 mt-3 font-light leading-relaxed">{e.body}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {showForm && (
        <Reveal direction="up" className="mb-10">
          <SiemForm
            submitting={createMut.isPending}
            onSubmit={async input => {
              await createMut.mutateAsync(input);
              setShowForm(false);
            }}
          />
        </Reveal>
      )}

      {/* ── Configured webhooks ─────────────────────────────────────── */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">
            Configured forwarders
          </p>
          <p className="text-[10px] font-mono text-white/22">
            HMAC-SHA256 signed · retried 5x with exponential backoff
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-white/[0.02] animate-pulse" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="py-16 text-center border border-white/[0.06]">
            <p className="text-white/25 font-mono text-sm mb-2">No webhooks configured</p>
            <p className="text-[11px] font-mono text-white/15">
              Add a forwarder to start streaming events to your SIEM
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {configs.map(cfg => (
              <SiemRow
                key={cfg.id}
                config={cfg}
                onToggle={enabled => {
                  setActionError(null);
                  updateMut.mutate({ id: cfg.id, enabled }, { onError: handleMutationError });
                }}
                onTest={async () => {
                  setActionError(null);
                  try {
                    return await testMut.mutateAsync(cfg.id);
                  } catch (err) {
                    const raw = err instanceof Error ? err.message : String(err);
                    return { ok: false, deliveredAt: new Date().toISOString(), error: friendlySiemMutationError(raw) };
                  }
                }}
                onDelete={() => {
                  setActionError(null);
                  deleteMut.mutate(cfg.id, { onError: handleMutationError });
                }}
              />
            ))}
          </div>
        )}
        {actionError && (
          <p className="text-[11px] font-mono text-red-400/85 mt-3">{actionError}</p>
        )}
      </section>

      {/* ── Payload reference ─────────────────────────────────────────── */}
      <Reveal direction="up">
        <div className="bg-[#0d0d0e] border border-white/[0.06] p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
              Sample payload
            </p>
            <EnterpriseBadge label="POST · application/json" tone="neutral" size="sm" />
          </div>
          <pre className="text-[11px] font-mono text-white/55 leading-relaxed overflow-x-auto">
{`{
  "event": "review.slashed",
  "orgSlug": "acme-protocol",
  "occurredAt": "2026-05-25T08:14:02Z",
  "repoSlug": "acme-protocol/core",
  "prId": 4821,
  "pathPattern": "contracts/**",
  "reviewer": {
    "basename": "lead.acme.base.eth",
    "address": "0x4c2a...5a4b"
  },
  "amountUsdc": 500000000,
  "attestationUid": "0xab12cd34ef56a789b890c012d345e678",
  "signature": "hmac-sha256=ab12cd34..."
}`}
          </pre>
          <p className="text-[10px] font-mono text-white/25 mt-3">
            Verify with: HMAC_SHA256(body, SIEM_SECRET) and compare to X-GitLedger-Signature.
          </p>
        </div>
      </Reveal>
    </>
  );
}
