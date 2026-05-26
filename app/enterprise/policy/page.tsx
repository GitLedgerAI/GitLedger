'use client';

import { useState } from 'react';
import Reveal from '@/components/Reveal';
import EnterpriseHeader from '@/components/enterprise/EnterpriseHeader';
import EnterpriseBadge from '@/components/enterprise/EnterpriseBadge';
import PolicyRuleCard from '@/components/enterprise/PolicyRuleCard';
import PolicyRuleForm from '@/components/enterprise/PolicyRuleForm';
import {
  useEnterpriseOrg,
  usePolicies,
  useCreatePolicy,
  useDeletePolicy,
} from '@/lib/enterprise-hooks';
import { MOCK_ORG } from '@/lib/enterprise-mock';

export default function PolicyEnginePage() {
  const orgSlug = MOCK_ORG.orgSlug;
  const { data: org } = useEnterpriseOrg(orgSlug);
  const { data: policies = [], isLoading } = usePolicies(orgSlug);
  const createMut = useCreatePolicy(orgSlug);
  const deleteMut = useDeletePolicy(orgSlug);

  const [showForm, setShowForm] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <>
      <EnterpriseHeader
        eyebrow="Policy Engine"
        title="Path-scoped review rules"
        subtitle="Define minimum stake and reviewer requirements per file glob. Enforced onchain by CompliancePolicy.sol — violations emit PolicyViolation events to your SIEM."
        org={org}
        right={
          <button
            onClick={() => setShowForm(s => !s)}
            className="px-4 py-2.5 bg-white/90 text-[#0a0a0b] text-[11px] font-mono tracking-[0.2em] font-bold uppercase hover:bg-white transition-colors duration-200"
          >
            {showForm ? 'Cancel' : '+ Add Policy'}
          </button>
        }
      />

      {/* ── Enforcement summary ─────────────────────────────────────────── */}
      <Reveal direction="up">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-white/[0.06] mb-10">
          <div className="bg-[#0a0a0b] p-5 flex flex-col gap-1">
            <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
              Active rules
            </p>
            <p className="text-xl font-bold font-mono text-white/85 mt-1">
              {isLoading ? '—' : policies.length}
            </p>
            <p className="text-[10px] font-mono text-white/22">
              Evaluated on every PR open / sync
            </p>
          </div>
          <div className="bg-[#0a0a0b] p-5 flex flex-col gap-1">
            <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
              Enforced by
            </p>
            <p className="text-sm font-mono text-white/75 mt-1.5">CompliancePolicy.sol</p>
            <p className="text-[10px] font-mono text-white/22">
              Base L2 · Verified · 2/3 multisig
            </p>
          </div>
          <div className="bg-[#0a0a0b] p-5 flex flex-col gap-2">
            <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
              On violation
            </p>
            <div className="flex flex-wrap gap-1.5">
              <EnterpriseBadge label="PR Block" tone="red" size="sm" />
              <EnterpriseBadge label="SIEM Alert" tone="amber" size="sm" />
              <EnterpriseBadge label="EAS Log" tone="emerald" size="sm" />
            </div>
          </div>
        </div>
      </Reveal>

      {showForm && (
        <Reveal direction="up" className="mb-10">
          <PolicyRuleForm
            submitting={createMut.isPending}
            onSubmit={async input => {
              await createMut.mutateAsync(input);
              setShowForm(false);
            }}
          />
        </Reveal>
      )}

      {/* ── Rule list ─────────────────────────────────────────────────── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-mono tracking-[0.28em] text-white/30 uppercase">
            Configured rules
          </p>
          <p className="text-[10px] font-mono text-white/22">
            Path glob · Min stake · Min reviewers · KYC
          </p>
        </div>

        <div className="border border-white/[0.06]">
          <div className="hidden sm:grid grid-cols-[1.4fr_140px_120px_130px_80px] gap-4 px-5 py-2.5 border-b border-white/[0.06] bg-[#0d0d0e]">
            {['Path pattern', 'Min stake', 'Reviewers', 'KYC', ''].map(h => (
              <span
                key={h}
                className="text-[10px] font-mono tracking-[0.22em] text-white/22 uppercase"
              >
                {h}
              </span>
            ))}
          </div>

          {isLoading ? (
            <div className="flex flex-col">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/[0.02] animate-pulse" />
              ))}
            </div>
          ) : policies.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-white/25 font-mono text-sm mb-2">No policies yet</p>
              <p className="text-[11px] font-mono text-white/15">
                Add your first rule to start enforcing review standards on protected paths
              </p>
            </div>
          ) : (
            policies.map(rule => (
              <PolicyRuleCard
                key={rule.id}
                rule={rule}
                deleting={deleteMut.isPending && confirmId === rule.id}
                onDelete={id => {
                  if (confirmId !== id) {
                    setConfirmId(id);
                    return;
                  }
                  deleteMut.mutate(id, { onSettled: () => setConfirmId(null) });
                }}
              />
            ))
          )}
        </div>
        {confirmId && (
          <p className="text-[11px] font-mono text-amber-300/80 mt-3">
            Click <span className="font-bold">Remove</span> again to confirm — this revokes
            enforcement on next PR sync.
          </p>
        )}
      </section>

      {/* ── Reference: contract ABI ───────────────────────────────────── */}
      <Reveal direction="up">
        <div className="bg-[#0d0d0e] border border-white/[0.06] p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-mono tracking-[0.22em] text-white/30 uppercase">
              Contract reference
            </p>
            <EnterpriseBadge label="CompliancePolicy.sol" tone="amber" size="sm" />
          </div>
          <pre className="text-[11px] font-mono text-white/55 leading-relaxed overflow-x-auto">
{`function checkPRCompliance(
  bytes32 orgSlug,
  string  calldata filePath,
  uint256 prId,
  address[] calldata reviewers
) external view returns (bool compliant, string memory reason);`}
          </pre>
          <p className="text-[10px] font-mono text-white/25 mt-3">
            The GitHub App calls this read-only check on every PR. Failures append a
            comment, emit PolicyViolation, and block the merge until the stake threshold
            is met.
          </p>
        </div>
      </Reveal>
    </>
  );
}
