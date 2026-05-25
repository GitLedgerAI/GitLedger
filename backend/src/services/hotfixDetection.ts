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
  if (hotfixFiles.length === 0 || stakedFiles.length === 0) {
    console.log('[hotfix-match] file overlap: one side empty (likely GitHub API miss)', {
      repoSlug,
      hotfixPrId,
      stakedPrId,
      hotfixFileCount: hotfixFiles.length,
      stakedFileCount: stakedFiles.length,
    });
    return false;
  }
  const stakedSet = new Set(stakedFiles);
  const overlap = hotfixFiles.filter((f) => stakedSet.has(f));
  console.log('[hotfix-match] file overlap result', {
    repoSlug,
    hotfixPrId,
    stakedPrId,
    hotfixFileCount: hotfixFiles.length,
    stakedFileCount: stakedFiles.length,
    overlapCount: overlap.length,
    overlapSample: overlap.slice(0, 5),
  });
  return overlap.length > 0;
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
  const bodyRef = bodyReferencesPrId(params.hotfixBody, params.stakedPrId);
  console.log('[hotfix-match] body-reference check', {
    repoSlug: params.repoSlug,
    hotfixPrId: params.hotfixPrId,
    stakedPrId: params.stakedPrId,
    bodyHasRef: bodyRef,
    bodyLength: params.hotfixBody?.length ?? 0,
  });
  if (bodyRef) {
    return { matches: true, reason: 'body_ref' };
  }
  if (await hotfixSharesFiles(params.repoSlug, params.hotfixPrId, params.stakedPrId)) {
    return { matches: true, reason: 'file_overlap' };
  }
  console.log('[hotfix-match] no signal matched — not a hotfix for this stake', {
    repoSlug: params.repoSlug,
    hotfixPrId: params.hotfixPrId,
    stakedPrId: params.stakedPrId,
  });
  return { matches: false, reason: null };
}
