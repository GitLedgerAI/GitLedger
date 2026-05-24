'use client';

import { useQuery } from '@tanstack/react-query';
import * as api from './api';
import type { Verdict } from './types';

export function useLeaderboard(sort?: string, lang?: string) {
  return useQuery({
    queryKey: ['leaderboard', sort, lang],
    queryFn: () => api.getLeaderboard({ sort, lang }),
    staleTime: 60_000,
  });
}

export function useReviewer(basename: string | null | undefined) {
  return useQuery({
    queryKey: ['reviewer', basename],
    queryFn: () => api.getReviewerByBasename(basename!),
    enabled: !!basename,
    staleTime: 60_000,
  });
}

export function useReviewerAttestations(
  basename: string | null | undefined,
  verdict?: Verdict | 'ALL',
) {
  return useQuery({
    queryKey: ['reviewer-attestations', basename, verdict],
    queryFn: () => api.getReviewerAttestations(basename!, verdict),
    enabled: !!basename,
    staleTime: 60_000,
  });
}

export function useMyStakes(address: string | null | undefined) {
  return useQuery({
    queryKey: ['my-stakes', address],
    queryFn: () => api.getMyStakes(address!),
    enabled: !!address,
    staleTime: 30_000,
  });
}

export function useRepo(slug: string | null | undefined) {
  return useQuery({
    queryKey: ['repo', slug],
    queryFn: () => api.getRepoBySlug(slug!),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useRepoAttestations(
  slug: string | null | undefined,
  verdict?: Verdict | 'ALL',
) {
  return useQuery({
    queryKey: ['repo-attestations', slug, verdict],
    queryFn: () => api.getRepoAttestations(slug!, verdict),
    enabled: !!slug,
    staleTime: 60_000,
  });
}

export function useLiveFeed() {
  return useQuery({
    queryKey: ['live-feed'],
    queryFn: api.getLiveFeed,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function usePrDetails(repoSlug: string | null, prId: number | null) {
  return useQuery({
    queryKey: ['pr-details', repoSlug, prId],
    queryFn: () => api.getPrDetails(repoSlug!, prId!),
    enabled: !!repoSlug && prId !== null,
    staleTime: 300_000,
  });
}
