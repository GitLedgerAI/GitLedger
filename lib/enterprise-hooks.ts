'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './enterprise-api';
import {
  MOCK_ORG,
  MOCK_POLICIES,
  MOCK_METRICS,
  MOCK_COVERAGE,
  MOCK_EVENTS,
  MOCK_SIEM_CONFIGS,
  MOCK_AUDIT_JOBS,
  mockCoverageSeries,
} from './enterprise-mock';
import type {
  EnterpriseOrg,
  PolicyRule,
  ComplianceMetrics,
  CoverageRow,
  ComplianceEvent,
  SiemConfig,
  AuditExportJob,
  ComplianceCoveragePoint,
} from './enterprise-types';

// Falls back to mock data when the backend route is missing or errors.
// This lets the Track 1 UI ship before the backend dev wires the routes.
async function withMock<T>(real: Promise<T>, fallback: T): Promise<T> {
  try {
    return await real;
  } catch {
    return fallback;
  }
}

// ── Org ──────────────────────────────────────────────────────────────────────

export function useEnterpriseOrg(orgSlug: string | null) {
  return useQuery<EnterpriseOrg>({
    queryKey: ['enterprise.org', orgSlug],
    queryFn: () => withMock(api.getEnterpriseOrg(orgSlug!), MOCK_ORG),
    enabled: !!orgSlug,
    staleTime: 60_000,
  });
}

export function useMyEnterpriseOrgs(walletAddress: string | null | undefined) {
  return useQuery<EnterpriseOrg[]>({
    queryKey: ['enterprise.orgs', walletAddress],
    queryFn: () => withMock(api.getMyEnterpriseOrgs(walletAddress!), [MOCK_ORG]),
    enabled: !!walletAddress,
    staleTime: 60_000,
  });
}

// ── Policy engine ───────────────────────────────────────────────────────────

export function usePolicies(orgSlug: string | null) {
  return useQuery<PolicyRule[]>({
    queryKey: ['enterprise.policies', orgSlug],
    queryFn: () => withMock(api.listPolicies(orgSlug!), MOCK_POLICIES),
    enabled: !!orgSlug,
    staleTime: 30_000,
  });
}

export function useCreatePolicy(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.createPolicy>[0], 'orgSlug'>) =>
      api.createPolicy({ ...input, orgSlug }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enterprise.policies', orgSlug] }),
  });
}

export function useDeletePolicy(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deletePolicy({ orgSlug, id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enterprise.policies', orgSlug] }),
  });
}

// ── Compliance dashboard ────────────────────────────────────────────────────

export function useComplianceMetrics(orgSlug: string | null) {
  return useQuery<ComplianceMetrics>({
    queryKey: ['enterprise.metrics', orgSlug],
    queryFn: () => withMock(api.getComplianceMetrics(orgSlug!), MOCK_METRICS),
    enabled: !!orgSlug,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCoverageMap(orgSlug: string | null) {
  return useQuery<CoverageRow[]>({
    queryKey: ['enterprise.coverage', orgSlug],
    queryFn: () => withMock(api.getCoverageMap(orgSlug!), MOCK_COVERAGE),
    enabled: !!orgSlug,
    staleTime: 60_000,
  });
}

export function useCoverageSeries(orgSlug: string | null, days = 30) {
  return useQuery<ComplianceCoveragePoint[]>({
    queryKey: ['enterprise.coverageSeries', orgSlug, days],
    queryFn: () => withMock(api.getCoverageSeries(orgSlug!, days), mockCoverageSeries()),
    enabled: !!orgSlug,
    staleTime: 60_000,
  });
}

export function useComplianceEvents(orgSlug: string | null, limit = 50) {
  return useQuery<ComplianceEvent[]>({
    queryKey: ['enterprise.events', orgSlug, limit],
    queryFn: () => withMock(api.getComplianceEvents(orgSlug!, limit), MOCK_EVENTS),
    enabled: !!orgSlug,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

// ── Audit export ────────────────────────────────────────────────────────────

export function useAuditJobs(orgSlug: string | null) {
  return useQuery<AuditExportJob[]>({
    queryKey: ['enterprise.audit', orgSlug],
    queryFn: () => withMock(api.listAuditJobs(orgSlug!), MOCK_AUDIT_JOBS),
    enabled: !!orgSlug,
    staleTime: 30_000,
  });
}

export function useRequestAuditExport(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.requestAuditExport>[0], 'orgSlug'>) =>
      api.requestAuditExport({ ...input, orgSlug }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enterprise.audit', orgSlug] }),
  });
}

// ── SIEM forwarding ─────────────────────────────────────────────────────────

export function useSiemConfigs(orgSlug: string | null) {
  return useQuery<SiemConfig[]>({
    queryKey: ['enterprise.siem', orgSlug],
    queryFn: () => withMock(api.listSiemConfigs(orgSlug!), MOCK_SIEM_CONFIGS),
    enabled: !!orgSlug,
    staleTime: 30_000,
  });
}

export function useCreateSiemConfig(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.createSiemConfig>[0], 'orgSlug'>) =>
      api.createSiemConfig({ ...input, orgSlug }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enterprise.siem', orgSlug] }),
  });
}

export function useUpdateSiemConfig(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.updateSiemConfig>[0], 'orgSlug'>) =>
      api.updateSiemConfig({ ...input, orgSlug }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enterprise.siem', orgSlug] }),
  });
}

export function useTestSiemConfig(orgSlug: string) {
  return useMutation({
    mutationFn: (id: string) => api.testSiemConfig({ orgSlug, id }),
  });
}

export function useDeleteSiemConfig(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSiemConfig({ orgSlug, id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['enterprise.siem', orgSlug] }),
  });
}

// ── Onboarding ──────────────────────────────────────────────────────────────

export function useStartEnterpriseOAuth() {
  return useMutation({
    mutationFn: api.startEnterpriseOAuth,
  });
}

export function useEnableScim(orgSlug: string) {
  return useMutation({
    mutationFn: (input: Omit<Parameters<typeof api.enableScim>[0], 'orgSlug'>) =>
      api.enableScim({ ...input, orgSlug }),
  });
}
