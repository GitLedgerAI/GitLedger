import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { repos } from '../db/schema';
import { getInstallationRepositories } from './githubApp';

export async function handleInstallationCreated(installationId: number): Promise<void> {
  const repositories = await getInstallationRepositories(installationId);

  for (const repo of repositories) {
    if (!repo.full_name) continue;
    await db
      .insert(repos)
      .values({
        slug: repo.full_name,
        ghInstallId: installationId,
        stakeEnabled: true,
      })
      .onConflictDoUpdate({
        target: repos.slug,
        set: {
          ghInstallId: installationId,
          stakeEnabled: true,
        },
      });
  }
}

export async function handleInstallationDeleted(installationId: number): Promise<void> {
  await db
    .update(repos)
    .set({
      stakeEnabled: false,
      ghInstallId: null,
    })
    .where(eq(repos.ghInstallId, installationId));
}

export async function handleInstallationRepositoriesAdded(
  installationId: number,
  repositoriesAdded: Array<{ full_name?: string }>,
): Promise<void> {
  for (const repo of repositoriesAdded) {
    if (!repo.full_name) continue;
    await db
      .insert(repos)
      .values({
        slug: repo.full_name,
        ghInstallId: installationId,
        stakeEnabled: true,
      })
      .onConflictDoUpdate({
        target: repos.slug,
        set: {
          ghInstallId: installationId,
          stakeEnabled: true,
        },
      });
  }
}

export async function handleInstallationRepositoriesRemoved(
  installationId: number,
  repositoriesRemoved: Array<{ full_name?: string }>,
): Promise<void> {
  const slugs = repositoriesRemoved.map((r) => r.full_name).filter((v): v is string => Boolean(v));
  if (slugs.length === 0) return;

  await db
    .update(repos)
    .set({
      stakeEnabled: false,
      ghInstallId: null,
    })
    .where(and(eq(repos.ghInstallId, installationId), inArray(repos.slug, slugs)));
}
