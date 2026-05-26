import { db } from '../db/client';
import { enterpriseOrgMembers, reviewers } from '../db/schema';
import { and, eq } from 'drizzle-orm';
import { env } from '../config/env';

export type UserRole = 'anonymous' | 'reviewer' | 'admin' | 'internal_service';
export type EnterpriseRole = 'owner' | 'admin' | 'auditor' | 'member';

export type TRPCContext = {
  walletAddress: string | null;
  role: UserRole;
  enterpriseOrgSlug: string | null;
  enterpriseRole: EnterpriseRole | null;
};

function parseBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

async function resolveEnterprise(
  walletAddress: string | null,
  orgSlug: string | null,
  role: UserRole,
): Promise<{ enterpriseOrgSlug: string | null; enterpriseRole: EnterpriseRole | null }> {
  if (!orgSlug) return { enterpriseOrgSlug: null, enterpriseRole: null };

  // Admin / internal tokens always pass; the org slug is honored for scoping.
  if (role === 'admin' || role === 'internal_service') {
    return { enterpriseOrgSlug: orgSlug, enterpriseRole: 'owner' };
  }

  if (!walletAddress) return { enterpriseOrgSlug: orgSlug, enterpriseRole: null };

  const row = await db.query.enterpriseOrgMembers.findFirst({
    where: and(
      eq(enterpriseOrgMembers.orgSlug, orgSlug),
      eq(enterpriseOrgMembers.address, walletAddress),
    ),
  });
  if (!row) return { enterpriseOrgSlug: orgSlug, enterpriseRole: null };
  return { enterpriseOrgSlug: orgSlug, enterpriseRole: row.role as EnterpriseRole };
}

export async function createTRPCContext(req: Request): Promise<TRPCContext> {
  const orgHeader = req.headers.get('x-enterprise-org');
  const orgSlug = orgHeader ? orgHeader.trim().toLowerCase() : null;

  const token = parseBearerToken(req);
  if (token && token === env.ADMIN_API_TOKEN) {
    const enterprise = await resolveEnterprise(null, orgSlug, 'admin');
    return { walletAddress: null, role: 'admin', ...enterprise };
  }
  if (token && token === env.INTERNAL_SERVICE_TOKEN) {
    const enterprise = await resolveEnterprise(null, orgSlug, 'internal_service');
    return { walletAddress: null, role: 'internal_service', ...enterprise };
  }

  const walletHeader = req.headers.get('x-wallet-address');
  const walletAddress = walletHeader ? walletHeader.toLowerCase() : null;
  if (walletAddress) {
    const enterprise = await resolveEnterprise(walletAddress, orgSlug, 'reviewer');
    return { walletAddress, role: 'reviewer', ...enterprise };
  }

  return { walletAddress: null, role: 'anonymous', enterpriseOrgSlug: orgSlug, enterpriseRole: null };
}

export async function reviewerExists(address: string): Promise<boolean> {
  const row = await db.query.reviewers.findFirst({ where: eq(reviewers.address, address.toLowerCase()) });
  return Boolean(row);
}
