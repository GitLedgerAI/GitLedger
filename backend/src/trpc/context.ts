import { db } from '../db/client';
import { reviewers } from '../db/schema';
import { eq } from 'drizzle-orm';
import { env } from '../config/env';

export type UserRole = 'anonymous' | 'reviewer' | 'admin' | 'internal_service';

export type TRPCContext = {
  walletAddress: string | null;
  role: UserRole;
};

function parseBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

export async function createTRPCContext(req: Request): Promise<TRPCContext> {
  const token = parseBearerToken(req);
  if (token && token === env.ADMIN_API_TOKEN) {
    return { walletAddress: null, role: 'admin' };
  }
  if (token && token === env.INTERNAL_SERVICE_TOKEN) {
    return { walletAddress: null, role: 'internal_service' };
  }

  const walletHeader = req.headers.get('x-wallet-address');
  const walletAddress = walletHeader ? walletHeader.toLowerCase() : null;
  if (walletAddress) {
    return { walletAddress, role: 'reviewer' };
  }

  return { walletAddress: null, role: 'anonymous' };
}

export async function reviewerExists(address: string): Promise<boolean> {
  const row = await db.query.reviewers.findFirst({ where: eq(reviewers.address, address.toLowerCase()) });
  return Boolean(row);
}
