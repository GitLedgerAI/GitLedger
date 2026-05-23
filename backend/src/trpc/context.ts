import { db } from '../db/client';
import { reviewers } from '../db/schema';
import { eq } from 'drizzle-orm';

export type UserRole = 'reviewer' | 'admin' | 'internal';

export type TRPCContext = {
  walletAddress: string | null;
  role: UserRole;
};

export async function createTRPCContext(req: Request): Promise<TRPCContext> {
  const walletHeader = req.headers.get('x-wallet-address');
  const roleHeader = (req.headers.get('x-user-role') ?? 'reviewer').toLowerCase();

  const walletAddress = walletHeader ? walletHeader.toLowerCase() : null;
  const role: UserRole = roleHeader === 'admin' || roleHeader === 'internal' ? (roleHeader as UserRole) : 'reviewer';

  return { walletAddress, role };
}

export async function reviewerExists(address: string): Promise<boolean> {
  const row = await db.query.reviewers.findFirst({ where: eq(reviewers.address, address.toLowerCase()) });
  return Boolean(row);
}
