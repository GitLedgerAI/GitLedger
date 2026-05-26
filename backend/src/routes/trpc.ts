import { TRPCError, initTRPC } from '@trpc/server';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/client';
import { attestations, promptStakeJobs, repos, reviewers, stakes } from '../db/schema';
import type { TRPCContext, UserRole } from '../trpc/context';
import { reviewerExists } from '../trpc/context';
import { getLanguages, getPullRequest, getRepo } from '../services/githubApi';
import { encodeEasPayload, hashPr } from '../chain/eas';
import { env } from '../config/env';
import { enterpriseRouter } from './enterprise';

const BYTES32_HEX = /^0x[0-9a-fA-F]{64}$/;
const STAKE_WINDOW_SECONDS = 30 * 24 * 60 * 60;
const STAKE_YIELD_BPS = 500;

const t = initTRPC.context<TRPCContext>().create();

const requireAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.walletAddress) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'missing_wallet_address' });
  const exists = await reviewerExists(ctx.walletAddress);
  if (!exists) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'reviewer_not_found' });
  return next({ ctx });
});

const requireRole = (roles: UserRole[]) =>
  t.middleware(async ({ ctx, next }) => {
    if (!roles.includes(ctx.role)) throw new TRPCError({ code: 'FORBIDDEN', message: 'insufficient_role' });
    return next({ ctx });
  });

const publicProcedure = t.procedure;
const protectedProcedure = t.procedure.use(requireAuth);
const adminProcedure = t.procedure.use(requireAuth).use(requireRole(['admin', 'internal_service']));

const VerdictSchema = z.enum(['ALL', 'ACTIVE', 'CLEAN', 'SLASHED']);

const reviewerRouter = t.router({
  getByBasename: publicProcedure.input(z.object({ basename: z.string().min(1) })).query(async ({ input }) => {
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

  getAttestations: publicProcedure.input(z.object({ basename: z.string().min(1), verdict: VerdictSchema.optional() })).query(async ({ input }) => {
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
  getMyStakes: protectedProcedure.input(z.object({ address: z.string().optional() })).query(async ({ input, ctx }) => {
    const requestor = ctx.walletAddress!;
    const targetAddress = (input.address ?? requestor).toLowerCase();
    const isAdmin = ctx.role === 'admin' || ctx.role === 'internal_service';
    if (!isAdmin && requestor !== targetAddress) {
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
      .where(eq(stakes.reviewerAddr, targetAddress))
      .orderBy(desc(stakes.stakedAt));
    return rows;
  }),

  getPrDetails: publicProcedure.input(z.object({ repoSlug: z.string(), prId: z.number().int() })).query(async ({ input }) => {
    const repoRow = await db.query.repos.findFirst({ where: eq(repos.slug, input.repoSlug) });
    const pr = await getPullRequest(input.repoSlug, input.prId);
    const languages = pr?.languagesUrl ? await getLanguages(pr.languagesUrl) : [];
    return {
      repoSlug: input.repoSlug,
      prId: input.prId,
      prTitle: pr?.prTitle ?? `PR #${input.prId}`,
      additions: pr?.additions ?? 0,
      deletions: pr?.deletions ?? 0,
      changedFiles: pr?.changedFiles ?? 0,
      author: pr?.author ?? '',
      languages,
      minStakeUsdc: repoRow?.minStakeUsdc ?? 0,
      stakeEnabled: repoRow?.stakeEnabled ?? false,
    };
  }),

  prepare: protectedProcedure
    .input(z.object({
      stakeId: z.string().regex(BYTES32_HEX, 'stakeId must be 32-byte hex'),
      repoSlug: z.string().min(1),
      prId: z.number().int().positive(),
      amountUsdc: z.number().int().min(500_000),
    }))
    .mutation(async ({ input, ctx }) => {
      const reviewerAddr = ctx.walletAddress!;
      const reviewer = await db.query.reviewers.findFirst({ where: eq(reviewers.address, reviewerAddr) });
      if (!reviewer) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const repoRow = await db.query.repos.findFirst({ where: eq(repos.slug, input.repoSlug) });
      const pr = await getPullRequest(input.repoSlug, input.prId);

      // Dedupe orphan pending_stake rows for the same (repo, pr, reviewer)
      // before upserting by stake_id. See migration 0005.
      await db.transaction(async (tx) => {
        if (repoRow?.id) {
          await tx
            .delete(stakes)
            .where(
              and(
                eq(stakes.repoId, repoRow.id),
                eq(stakes.prId, input.prId),
                eq(stakes.reviewerAddr, reviewerAddr),
                eq(stakes.state, 'pending_stake'),
                ne(stakes.stakeId, input.stakeId),
              ),
            );
        }
        await tx
          .insert(stakes)
          .values({
            stakeId: input.stakeId,
            reviewerAddr,
            repoId: repoRow?.id,
            prId: input.prId,
            prTitle: pr?.prTitle,
            amountUsdc: input.amountUsdc,
            state: 'pending_stake',
          })
          .onConflictDoUpdate({
            target: stakes.stakeId,
            set: {
              reviewerAddr,
              repoId: repoRow?.id,
              prId: input.prId,
              prTitle: pr?.prTitle,
              amountUsdc: input.amountUsdc,
              state: 'pending_stake',
            },
          });
      });

      const schemaData = encodeEasPayload({
        stakeId: input.stakeId as `0x${string}`,
        reviewer: reviewerAddr as `0x${string}`,
        verdict: 'ACTIVE',
        prHash: hashPr(input.repoSlug, input.prId),
      });

      return {
        contractAddress: env.GITLEDGER_CONTRACT as `0x${string}`,
        windowDurationSeconds: STAKE_WINDOW_SECONDS,
        yieldBps: STAKE_YIELD_BPS,
        schemaData,
      };
    }),

  submit: protectedProcedure
    .input(z.object({
      stakeId: z.string().regex(BYTES32_HEX, 'stakeId must be 32-byte hex'),
      txHash: z.string().regex(BYTES32_HEX, 'txHash must be 32-byte hex'),
    }))
    .mutation(async ({ input, ctx }) => {
      const { verifyAndActivateStake } = await import('../services/stakeConfirmation');
      const result = await verifyAndActivateStake({
        stakeId: input.stakeId,
        txHash: input.txHash as `0x${string}`,
        reviewerAddress: ctx.walletAddress as `0x${string}`,
      });
      if (!result.ok) {
        throw new TRPCError({ code: result.code, message: result.reason });
      }
      return { txHash: result.txHash, attestationUid: result.attestationUid };
    }),
});

const repoRouter = t.router({
  getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const row = await db.query.repos.findFirst({ where: eq(repos.slug, input.slug) });
    if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

    const gh = await getRepo(input.slug);
    const agg = await db
      .select({
        totalStaked: sql<number>`coalesce(sum(${stakes.amountUsdc}), 0)`,
        totalReviews: sql<number>`count(*)`,
        activeReviews: sql<number>`sum(case when ${stakes.state} = 'active' then 1 else 0 end)`,
        slashCount: sql<number>`sum(case when ${stakes.state} = 'slashed' then 1 else 0 end)`,
      })
      .from(stakes)
      .where(eq(stakes.repoId, row.id));

    const a = agg[0] ?? { totalStaked: 0, totalReviews: 0, activeReviews: 0, slashCount: 0 };
    const slashRate = a.totalReviews > 0 ? Number(a.slashCount) / Number(a.totalReviews) : 0;
    const trustScore = Math.max(0, 100 - Math.round(slashRate * 100));

    return {
      slug: row.slug,
      name: gh?.name ?? row.slug.split('/')[1] ?? row.slug,
      owner: gh?.owner ?? row.slug.split('/')[0] ?? '',
      language: gh?.language ?? '',
      stars: gh?.stars ?? 0,
      trustScore,
      totalStaked: Number(a.totalStaked ?? 0),
      reviewCount: Number(a.totalReviews ?? 0),
      totalReviews: Number(a.totalReviews ?? 0),
      activeReviews: Number(a.activeReviews ?? 0),
      slashCount: Number(a.slashCount ?? 0),
      slashRate,
      minStakeUsdc: row.minStakeUsdc ?? 0,
      stakeEnabled: row.stakeEnabled ?? false,
    };
  }),

  getAttestations: publicProcedure.input(z.object({ slug: z.string(), verdict: VerdictSchema.optional() })).query(async ({ input }) => {
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
  enterprise: enterpriseRouter,
});
export type AppRouter = typeof appRouter;
