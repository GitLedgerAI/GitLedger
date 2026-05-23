import { db } from '../db/client';
import { repos } from '../db/schema';
import { getInstallationRepositories } from './githubApp';

export async function handleInstallationCreated(installationId: number): Promise<void> {
  const repositories = await getInstallationRepositories(installationId);

  for (const repo of repositories) {
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
