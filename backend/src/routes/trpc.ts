import { TRPCError, initTRPC } from '@trpc/server';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { attestations, repos, reviewers, stakes } from '../db/schema';
import { confirmStakeOnchainAndActivate } from '../services/stakeConfirmation';

const t = initTRPC.create();

const VerdictSchema = z.enum(['ALL', 'ACTIVE', 'CLEAN', 'SLASHED']);

const reviewerRouter = t.router({
  getByBasename: t.procedure
    .input(z.object({ basename: z.string() }))
    .query(async ({ input }) => {
      const row = await db.query.reviewers.findFirst({ where: eq(reviewers.basename, input.basename) });
      if (!row) return null;
      return {
        address: row.address,
        basename: row.basename ?? '',
        githubLogin: row.githubLogin ?? '',
        reputationScore: row.reputationScore ?? 500,
        totalStakedUsdc: Number(row.totalStakedUsdc ?? 0),
        totalYieldUsdc: Number(row.totalYieldUsdc ?? 0),
        totalSlashedUsdc: Number(row.totalSlashedUsdc ?? 0),
        cleanCount: row.cleanCount ?? 0,
        slashCount: row.slashCount ?? 0,
        languages: row.languages ?? [],
        lastActiveAt: row.lastActiveAt?.toISOString() ?? new Date().toISOString(),
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    }),

  getLeaderboard: t.procedure
    .input(z.object({ sort: z.enum(['score', 'yield', 'accuracy', 'stakes']).optional(), lang: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const rows = await db.query.reviewers.findMany();
      let filtered = rows;

      if (input?.lang) {
        filtered = filtered.filter((r) => (r.languages ?? []).includes(input.lang!));
      }
      if (input?.search) {
        const s = input.search.toLowerCase();
        filtered = filtered.filter((r) => (r.basename ?? '').toLowerCase().includes(s) || (r.githubLogin ?? '').toLowerCase().includes(s));
      }

      const mapped = filtered.map((r) => {
        const clean = r.cleanCount ?? 0;
        const slash = r.slashCount ?? 0;
        const accuracyRate = clean + slash > 0 ? clean / (clean + slash) : 1;
        return {
          address: r.address,
          basename: r.basename ?? '',
          githubLogin: r.githubLogin ?? '',
          reputationScore: r.reputationScore ?? 500,
          totalStakedUsdc: Number(r.totalStakedUsdc ?? 0),
          totalYieldUsdc: Number(r.totalYieldUsdc ?? 0),
          totalSlashedUsdc: Number(r.totalSlashedUsdc ?? 0),
          cleanCount: clean,
          slashCount: slash,
          languages: r.languages ?? [],
          lastActiveAt: r.lastActiveAt?.toISOString() ?? new Date().toISOString(),
          createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
          accuracyRate,
        };
      });

      const sort = input?.sort ?? 'score';
      mapped.sort((a, b) => {
        if (sort === 'yield') return b.totalYieldUsdc - a.totalYieldUsdc;
        if (sort === 'stakes') return b.totalStakedUsdc - a.totalStakedUsdc;
        if (sort === 'accuracy') return (b.accuracyRate ?? 0) - (a.accuracyRate ?? 0);
        return b.reputationScore - a.reputationScore;
      });

      return mapped;
    }),

  getAttestations: t.procedure
    .input(z.object({ basename: z.string(), verdict: VerdictSchema.optional() }))
    .query(async ({ input }) => {
      const where = input.verdict && input.verdict !== 'ALL'
        ? and(eq(attestations.basename, input.basename), eq(attestations.verdict, input.verdict))
        : eq(attestations.basename, input.basename);

      const rows = await db.select().from(attestations).where(where).orderBy(desc(attestations.reviewedAt));
      return rows.map((a) => ({
        uid: a.uid,
        basename: a.basename ?? '',
        reviewerAddress: a.reviewerAddress ?? '',
        repoSlug: a.repoSlug ?? '',
        prId: a.prId ?? 0,
        prTitle: a.prTitle ?? '',
        stakeAmount: Number(a.stakeAmount ?? 0),
        verdict: (a.verdict ?? 'ACTIVE') as 'ACTIVE' | 'CLEAN' | 'SLASHED',
        reviewedAt: a.reviewedAt?.toISOString() ?? new Date().toISOString(),
        resolvedAt: a.resolvedAt?.toISOString(),
        reputationDelta: a.reputationDelta ?? 0,
        repoLanguages: a.repoLanguages ?? [],
        txHash: a.txHash ?? '',
      }));
    }),
});

const stakeRouter = t.router({
  getMyStakes: t.procedure.input(z.object({ address: z.string() })).query(async ({ input }) => {
    const rows = await db.select().from(stakes).where(eq(stakes.reviewerAddr, input.address)).orderBy(desc(stakes.stakedAt));
    return rows;
  }),

  getPrDetails: t.procedure.input(z.object({ repoSlug: z.string(), prId: z.number().int() })).query(async ({ input }) => {
    const repo = await db.query.repos.findFirst({ where: eq(repos.slug, input.repoSlug) });
    const existing = await db.query.stakes.findFirst({ where: and(eq(stakes.prId, input.prId), eq(stakes.repoId, repo?.id ?? '')) });
    return {
      repoSlug: input.repoSlug,
      prId: input.prId,
      prTitle: existing?.prTitle ?? `PR #${input.prId}`,
      minStakeUsdc: repo?.minStakeUsdc ?? 10_000_000,
      stakeEnabled: repo?.stakeEnabled ?? false,
    };
  }),

  submit: t.procedure
    .input(z.object({ basename: z.string(), repoSlug: z.string(), prId: z.number().int().positive(), amountUsdc: z.number().int().positive(), stakeId: z.string() }))
    .mutation(async ({ input }) => {
      const result = await confirmStakeOnchainAndActivate({
        stakeId: input.stakeId,
        reviewerBasename: input.basename,
        repoSlug: input.repoSlug,
        prId: input.prId,
        amountUsdc: input.amountUsdc,
      });

      if (!result.ok || !result.txHash || !result.attestationUid) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: result.reason ?? 'stake_submit_failed' });
      }

      return { txHash: result.txHash, attestationUid: result.attestationUid };
    }),
});

const repoRouter = t.router({
  getBySlug: t.procedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const row = await db.query.repos.findFirst({ where: eq(repos.slug, input.slug) });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
    return row;
  }),

  getAttestations: t.procedure
    .input(z.object({ slug: z.string(), verdict: VerdictSchema.optional() }))
    .query(async ({ input }) => {
      const where = input.verdict && input.verdict !== 'ALL'
        ? and(eq(attestations.repoSlug, input.slug), eq(attestations.verdict, input.verdict))
        : eq(attestations.repoSlug, input.slug);
      const rows = await db.select().from(attestations).where(where).orderBy(desc(attestations.reviewedAt));
      return rows;
    }),
});

const feedRouter = t.router({
  getLive: t.procedure.query(async () => {
    const rows = await db.select().from(attestations).orderBy(desc(attestations.reviewedAt)).limit(50);
    return rows.map((a) => ({
      basename: a.basename ?? '',
      repoSlug: a.repoSlug ?? '',
      prId: a.prId ?? 0,
      verdict: (a.verdict ?? 'ACTIVE') as 'ACTIVE' | 'CLEAN' | 'SLASHED',
      stakeAmount: Number(a.stakeAmount ?? 0),
      timestamp: a.reviewedAt?.toISOString() ?? new Date().toISOString(),
    }));
  }),
});

export const appRouter = t.router({
  reviewer: reviewerRouter,
  stake: stakeRouter,
  repo: repoRouter,
  feed: feedRouter,
});

export type AppRouter = typeof appRouter;
