import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

const reviewerRouter = t.router({
  profile: t.procedure.input(z.string()).query(({ input }) => ({ basename: input, status: 'todo' })),
  leaderboard: t.procedure.query(() => ({ items: [], status: 'todo' })),
  myStakes: t.procedure.query(() => ({ items: [], status: 'todo' })),
});

const attestationRouter = t.router({
  byReviewer: t.procedure.input(z.string()).query(({ input }) => ({ reviewer: input, items: [] })),
  byRepo: t.procedure.input(z.string()).query(({ input }) => ({ repo: input, items: [] })),
});

const stakeSchema = z.object({
  basenameHash: z.string(),
  repoSlug: z.string(),
  prId: z.number().int().positive(),
  amountUsdc: z.number().int().positive(),
});

const stakeRouter = t.router({
  initiate: t.procedure.input(stakeSchema).mutation(({ input }) => ({ accepted: true, input })),
  status: t.procedure.input(z.string()).query(({ input }) => ({ stakeId: input, status: 'todo' })),
  history: t.procedure.query(() => ({ items: [] })),
});

const repoRouter = t.router({
  install: t.procedure.mutation(() => ({ ok: true })),
  settings: t.procedure.input(z.string()).query(({ input }) => ({ repoSlug: input, status: 'todo' })),
});

export const appRouter = t.router({
  reviewer: reviewerRouter,
  attestation: attestationRouter,
  stake: stakeRouter,
  repo: repoRouter,
});

export type AppRouter = typeof appRouter;
