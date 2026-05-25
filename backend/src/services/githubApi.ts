import { env } from '../config/env';

const GH_HEADERS = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${env.GITHUB_TOKEN}`,
  'X-GitHub-Api-Version': '2022-11-28',
};

export async function getPullRequest(repoSlug: string, prId: number) {
  const res = await fetch(`https://api.github.com/repos/${repoSlug}/pulls/${prId}`, { headers: GH_HEADERS });
  if (!res.ok) return null;
  const pr = await res.json();
  return {
    prTitle: pr.title as string,
    additions: Number(pr.additions ?? 0),
    deletions: Number(pr.deletions ?? 0),
    changedFiles: Number(pr.changed_files ?? 0),
    author: (pr.user?.login ?? '') as string,
    languagesUrl: (pr.base?.repo?.languages_url ?? '') as string,
  };
}

export async function getRepo(repoSlug: string) {
  const res = await fetch(`https://api.github.com/repos/${repoSlug}`, { headers: GH_HEADERS });
  if (!res.ok) return null;
  const repo = await res.json();
  return {
    name: (repo.name ?? '') as string,
    owner: (repo.owner?.login ?? '') as string,
    stars: Number(repo.stargazers_count ?? 0),
    language: (repo.language ?? '') as string,
    languagesUrl: (repo.languages_url ?? '') as string,
  };
}

export async function getPullRequestFiles(repoSlug: string, prId: number): Promise<string[]> {
  const files: string[] = [];
  // GitHub returns max 100 files per page; cap at 3 pages (300 files) to keep webhook latency bounded.
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${repoSlug}/pulls/${prId}/files?per_page=100&page=${page}`,
      { headers: GH_HEADERS },
    );
    if (!res.ok) break;
    const batch = (await res.json()) as Array<{ filename?: string }>;
    if (!Array.isArray(batch) || batch.length === 0) break;
    for (const f of batch) if (f.filename) files.push(f.filename);
    if (batch.length < 100) break;
  }
  return files;
}

export async function getLanguages(languagesUrl: string): Promise<string[]> {
  if (!languagesUrl) return [];
  const res = await fetch(languagesUrl, { headers: GH_HEADERS });
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, number>;
  return Object.keys(data);
}
