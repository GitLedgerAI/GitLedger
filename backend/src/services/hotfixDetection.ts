import { getPullRequestFiles } from './githubApi';

// Narrower than the batch oracle's regex: only matches the explicit "hotfix" word
// (in title or branch), since the realtime webhook path acts immediately on merge
// and we don't want to slash on every "fix typo" PR.
const HOTFIX_TITLE = /\bhotfix\b/i;

export function isHotfixTitle(title: string | null | undefined): boolean {
  return !!title && HOTFIX_TITLE.test(title);
}

export function bodyReferencesPrId(body: string | null | undefined, prId: number): boolean {
  if (!body) return false;
  // Match #123, GH-123, or just the number standalone (#-prefix is the GitHub convention).
  const re = new RegExp(`(^|\\W)#?${prId}(\\W|$)`);
  return re.test(body);
}

/** True if hotfixPr and stakedPr touch at least one shared file path. */
export async function hotfixSharesFiles(
  repoSlug: string,
  hotfixPrId: number,
  stakedPrId: number,
): Promise<boolean> {
  const [hotfixFiles, stakedFiles] = await Promise.all([
    getPullRequestFiles(repoSlug, hotfixPrId),
    getPullRequestFiles(repoSlug, stakedPrId),
  ]);
  if (hotfixFiles.length === 0 || stakedFiles.length === 0) return false;
  const stakedSet = new Set(stakedFiles);
  return hotfixFiles.some((f) => stakedSet.has(f));
}

export type HotfixMatch = {
  matches: boolean;
  reason: 'body_ref' | 'file_overlap' | null;
};

/**
 * Decide whether a candidate hotfix PR targets a given staked PR.
 *
 * Two signals:
 *   1. The hotfix body references the staked PR number (cheap, no API call).
 *   2. The two PRs share at least one changed file (catches hotfixes with empty bodies).
 */
export async function hotfixMatchesStakedPr(params: {
  repoSlug: string;
  hotfixPrId: number;
  hotfixBody: string | null | undefined;
  stakedPrId: number;
}): Promise<HotfixMatch> {
  if (bodyReferencesPrId(params.hotfixBody, params.stakedPrId)) {
    return { matches: true, reason: 'body_ref' };
  }
  if (await hotfixSharesFiles(params.repoSlug, params.hotfixPrId, params.stakedPrId)) {
    return { matches: true, reason: 'file_overlap' };
  }
  return { matches: false, reason: null };
}
