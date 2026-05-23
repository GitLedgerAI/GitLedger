import { TRPCError, initTRPC } from '@trpc/server';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { attestations, promptStakeJobs, repos, reviewers, stakes } from '../db/schema';
import type { TRPCContext, UserRole } from '../trpc/context';
import { reviewerExists } from '../trpc/context';

const t = initTRPC.context<TRPCContext>().create();

const requireAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.walletAddress) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'missing_wallet_address' });
  }
  const exists = await reviewerExists(ctx.walletAddress);
  if (!exists) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'reviewer_not_found' });
  }
  return next({ ctx });
});

const requireRole = (roles: UserRole[]) =>
  t.middleware(async ({ ctx, next }) => {
    if (!roles.includes(ctx.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'insufficient_role' });
    }
    return next({ ctx });
  });

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(requireAuth);
const adminProcedure = t.procedure.use(requireAuth).use(requireRole(['admin', 'internal_service']));

const VerdictSchema = z.enum(['ALL', 'ACTIVE', 'CLEAN', 'SLASHED']);

type LeaderboardRow = {
  address: string;
  basename: string;
  githubLogin: string;
  reputationScore: number;
  totalStakedUsdc: number;
  totalYieldUsdc: number;
  totalSlashedUsdc: number;
  cleanCount: number;
  slashCount: number;
  languages: string[];
  lastActiveAt: string;
  createdAt: string;
  accuracyRate: number;
};

const reviewerRouter = t.router({
  getByBasename: publicProcedure.input(z.object({ basename: z.string() })).query(async ({ input }) => {
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

  getLeaderboard: publicProcedure
    .input(z.object({ sort: z.enum(['score', 'yield', 'accuracy', 'stakes']).optional(), lang: z.string().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const rows = await db.query.reviewers.findMany();
      let filtered = rows;

      if (input?.lang) filtered = filtered.filter((r) => (r.languages ?? []).includes(input.lang!));
      if (input?.search) {
        const s = input.search.toLowerCase();
        filtered = filtered.filter((r) => (r.basename ?? '').toLowerCase().includes(s) || (r.githubLogin ?? '').toLowerCase().includes(s));
      }

      const mapped: LeaderboardRow[] = filtered.map((r) => {
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
        if (sort === 'accuracy') return b.accuracyRate - a.accuracyRate;
        return b.reputationScore - a.reputationScore;
      });
      return mapped;
    }),

  getAttestations: publicProcedure
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
  getMyStakes: protectedProcedure.input(z.object({ address: z.string() })).query(async ({ input, ctx }) => {
    const requestor = ctx.walletAddress!;
    const isAdmin = ctx.role === 'admin' || ctx.role === 'internal_service';
    if (!isAdmin && requestor !== input.address.toLowerCase()) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'cannot_access_other_user_stakes' });
    }
    const rows = await db
      .select({
        id: stakes.id,
        stakeId: stakes.stakeId,
        reviewerAddr: stakes.reviewerAddr,
        repoSlug: repos.slug,
        prId: stakes.prId,
        prTitle: stakes.prTitle,
        amountUsdc: stakes.amountUsdc,
        state: stakes.state,
        attestationUid: stakes.attestationUid,
        yieldEarned: stakes.yieldEarned,
        windowEndsAt: stakes.windowEndsAt,
        stakedAt: stakes.stakedAt,
        resolvedAt: stakes.resolvedAt,
      })
      .from(stakes)
      .leftJoin(repos, eq(stakes.repoId, repos.id))
      .where(eq(stakes.reviewerAddr, input.address.toLowerCase()))
      .orderBy(desc(stakes.stakedAt));
    return rows;
  }),

  getPrDetails: publicProcedure.input(z.object({ repoSlug: z.string(), prId: z.number().int() })).query(async ({ input }) => {
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

  submit: protectedProcedure
    .input(z.object({ basename: z.string(), repoSlug: z.string(), prId: z.number().int().positive(), amountUsdc: z.number().int().positive(), stakeId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const reviewer = await db.query.reviewers.findFirst({ where: eq(reviewers.address, ctx.walletAddress!) });
      if (!reviewer) throw new TRPCError({ code: 'UNAUTHORIZED' });
      if (reviewer.basename && reviewer.basename !== input.basename) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'basename_mismatch' });
      }

      const { confirmStakeOnchainAndActivate } = await import('../services/stakeConfirmation');
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
  getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const row = await db.query.repos.findFirst({ where: eq(repos.slug, input.slug) });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

    const atts = await db.select().from(attestations).where(eq(attestations.repoSlug, input.slug));
    const totalReviews  = atts.length;
    const slashCount    = atts.filter(a => a.verdict === 'SLASHED').length;
    const totalStaked   = atts.reduce((sum, a) => sum + Number(a.stakeAmount ?? 0), 0);
    const trustScore    = totalReviews > 0 ? Math.round(((totalReviews - slashCount) / totalReviews) * 100) : 100;
    const slashRate     = totalReviews > 0 ? slashCount / totalReviews : 0;

    const activeRows = await db
      .select({ id: stakes.id })
      .from(stakes)
      .leftJoin(repos, eq(stakes.repoId, repos.id))
      .where(and(eq(repos.slug, input.slug), eq(stakes.state, 'active')));

    const parts = input.slug.split('/');
    return {
      ...row,
      name:         parts[1] ?? input.slug,
      owner:        parts[0] ?? '',
      trustScore,
      totalStaked,
      totalReviews,
      activeReviews: activeRows.length,
      slashCount,
      slashRate,
    };
  }),
  getAttestations: publicProcedure
    .input(z.object({ slug: z.string(), verdict: VerdictSchema.optional() }))
    .query(async ({ input }) => {
      const where = input.verdict && input.verdict !== 'ALL'
        ? and(eq(attestations.repoSlug, input.slug), eq(attestations.verdict, input.verdict))
        : eq(attestations.repoSlug, input.slug);
      return db.select().from(attestations).where(where).orderBy(desc(attestations.reviewedAt));
    }),
});

const feedRouter = t.router({
  getLive: publicProcedure.query(async () => {
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

const adminRouter = t.router({
  listPromptStakeJobs: adminProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(25), status: z.enum(['received', 'processed', 'failed']).optional() }).optional())
    .query(async ({ input }) => {
      const lim = input?.limit ?? 25;
      const where = input?.status ? eq(promptStakeJobs.status, input.status) : undefined;
      if (where) {
        return db.select().from(promptStakeJobs).where(where).orderBy(desc(promptStakeJobs.receivedAt)).limit(lim);
      }
      return db.select().from(promptStakeJobs).orderBy(desc(promptStakeJobs.receivedAt)).limit(lim);
    }),
});

export const appRouter = t.router({
  reviewer: reviewerRouter,
  stake: stakeRouter,
  repo: repoRouter,
  feed: feedRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
