// Audit export generator for Track 1.
//
// Produces signed evidence exports in three formats:
//   • json  — canonical JSON for programmatic ingest
//   • csv   — flat CSV for auditors importing to Excel
//   • pdf   — HTML rendering with print CSS; browser-renders to PDF on the
//             user's machine. Track 1 ships HTML-as-PDF intentionally — moving
//             to true server-side PDF (pdfkit / @react-pdf) is a future hook
//             once the volume justifies the dep.
//
// Every export is signed by the existing SIGNER_PRIVATE_KEY via EIP-191
// (`personal_sign`). The signature + content hash are stored on the audit
// job row so auditors can verify offline against the signer address.

import { createHash } from 'node:crypto';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import {
  attestations,
  enterpriseAuditJobs,
  enterpriseEvents,
  enterpriseOrgRepos,
  enterpriseOrgs,
} from '../db/schema';
import { signerAccount } from '../chain/client';

export type AuditFormat = 'pdf' | 'json' | 'csv';

const MIME: Record<AuditFormat, string> = {
  json: 'application/json',
  csv: 'text/csv',
  pdf: 'text/html',
};

type AttestationRow = typeof attestations.$inferSelect;

async function fetchAttestationsForOrg(
  orgSlug: string,
  dateFrom: string,
  dateTo: string,
): Promise<AttestationRow[]> {
  const repoRows = await db
    .select({ repoSlug: enterpriseOrgRepos.repoSlug })
    .from(enterpriseOrgRepos)
    .where(eq(enterpriseOrgRepos.orgSlug, orgSlug));
  const repoSlugs = repoRows.map((r) => r.repoSlug);
  if (repoSlugs.length === 0) return [];

  // Cast to start/end of day, UTC.
  const from = new Date(`${dateFrom}T00:00:00Z`);
  const to = new Date(`${dateTo}T23:59:59Z`);

  const rows = await db
    .select()
    .from(attestations)
    .where(
      and(
        gte(attestations.reviewedAt, from),
        lte(attestations.reviewedAt, to),
      ),
    )
    .orderBy(asc(attestations.reviewedAt));

  return rows.filter((r) => r.repoSlug && repoSlugs.includes(r.repoSlug));
}

function renderJson(orgSlug: string, dateFrom: string, dateTo: string, rows: AttestationRow[]): string {
  return JSON.stringify(
    {
      orgSlug,
      dateFrom,
      dateTo,
      generatedAt: new Date().toISOString(),
      attestationCount: rows.length,
      attestations: rows.map((r) => ({
        uid: r.uid,
        basename: r.basename,
        reviewerAddress: r.reviewerAddress,
        repoSlug: r.repoSlug,
        prId: r.prId,
        prTitle: r.prTitle,
        stakeAmountUsdc: Number(r.stakeAmount ?? 0),
        verdict: r.verdict,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
        txHash: r.txHash,
      })),
    },
    null,
    2,
  );
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function renderCsv(rows: AttestationRow[]): string {
  const header = [
    'uid',
    'basename',
    'reviewer_address',
    'repo_slug',
    'pr_id',
    'pr_title',
    'stake_amount_usdc',
    'verdict',
    'reviewed_at',
    'resolved_at',
    'tx_hash',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.uid,
        r.basename,
        r.reviewerAddress,
        r.repoSlug,
        r.prId,
        r.prTitle,
        Number(r.stakeAmount ?? 0),
        r.verdict,
        r.reviewedAt?.toISOString() ?? '',
        r.resolvedAt?.toISOString() ?? '',
        r.txHash,
      ]
        .map(escapeCsv)
        .join(','),
    );
  }
  return lines.join('\n');
}

function renderHtmlForPdf(
  orgSlug: string,
  dateFrom: string,
  dateTo: string,
  rows: AttestationRow[],
): string {
  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.uid ?? '')}</td>
        <td>${escapeHtml(r.basename ?? '')}</td>
        <td>${escapeHtml(r.repoSlug ?? '')}</td>
        <td>#${r.prId ?? ''}</td>
        <td>$${(Number(r.stakeAmount ?? 0) / 1_000_000).toFixed(2)}</td>
        <td>${escapeHtml(r.verdict ?? '')}</td>
        <td>${r.reviewedAt?.toISOString().slice(0, 10) ?? ''}</td>
        <td class="mono">${escapeHtml((r.txHash ?? '').slice(0, 14))}…</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>GitLedger Audit Export · ${orgSlug} · ${dateFrom} → ${dateTo}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { padding: 6px 8px; border-bottom: 1px solid #ddd; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; text-transform: uppercase; letter-spacing: 0.08em; font-size: 10px; color: #555; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #999; font-size: 10px; color: #444; }
  @media print { body { margin: 12mm; } }
</style>
</head>
<body>
  <h1>SOC2 CC7.2 Change Management Evidence</h1>
  <div class="sub">
    Organization: <b>${escapeHtml(orgSlug)}</b> · Window: <b>${dateFrom}</b> → <b>${dateTo}</b>
    · Generated: ${new Date().toISOString()} · ${rows.length} attestations
  </div>
  <table>
    <thead>
      <tr>
        <th>EAS UID</th><th>Reviewer</th><th>Repo</th><th>PR</th><th>Stake</th>
        <th>Verdict</th><th>Reviewed</th><th>Tx</th>
      </tr>
    </thead>
    <tbody>${tableRows || '<tr><td colspan="8">No attestations in this window.</td></tr>'}</tbody>
  </table>
  <div class="footer">
    Signer address: <span class="mono">${signerAccount.address}</span><br>
    Content SHA-256 + EIP-191 signature appended at delivery time. Verify with:<br>
    <span class="mono">viem.verifyMessage({ address, message: contentHash, signature })</span>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sha256Hex(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

async function signContentHash(hashHex: string): Promise<string> {
  return signerAccount.signMessage({ message: hashHex });
}

export async function runAuditExport(input: {
  orgSlug: string;
  format: AuditFormat;
  dateFrom: string;
  dateTo: string;
}): Promise<{ id: string; status: 'ready' | 'failed'; reason?: string }> {
  // Verify org exists.
  const org = await db.query.enterpriseOrgs.findFirst({
    where: eq(enterpriseOrgs.orgSlug, input.orgSlug),
  });
  if (!org) return { id: '', status: 'failed', reason: 'org_not_found' };

  // Insert job row up-front so the UI sees it queued.
  const inserted = await db
    .insert(enterpriseAuditJobs)
    .values({
      orgSlug: input.orgSlug,
      format: input.format,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      status: 'running',
    })
    .returning();
  const job = inserted[0];
  if (!job) return { id: '', status: 'failed', reason: 'insert_failed' };

  try {
    const rows = await fetchAttestationsForOrg(input.orgSlug, input.dateFrom, input.dateTo);

    const content =
      input.format === 'json'
        ? renderJson(input.orgSlug, input.dateFrom, input.dateTo, rows)
        : input.format === 'csv'
          ? renderCsv(rows)
          : renderHtmlForPdf(input.orgSlug, input.dateFrom, input.dateTo, rows);

    const contentHash = sha256Hex(content);
    const signature = await signContentHash(contentHash);
    const generatedAt = new Date();

    await db
      .update(enterpriseAuditJobs)
      .set({
        attestationCount: rows.length,
        status: 'ready',
        contentText: content,
        contentMime: MIME[input.format],
        contentHash,
        signature,
        signedBy: signerAccount.address,
        generatedAt,
      })
      .where(eq(enterpriseAuditJobs.id, job.id));

    // Audit-trail event so it shows up on the compliance dashboard.
    await db.insert(enterpriseEvents).values({
      orgSlug: input.orgSlug,
      kind: 'export_generated',
      reason: `${input.format.toUpperCase()} export · ${input.dateFrom} → ${input.dateTo} · ${rows.length} attestations`,
    });

    return { id: job.id, status: 'ready' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[enterprise-audit] export failed', { jobId: job.id, error: reason });
    await db
      .update(enterpriseAuditJobs)
      .set({ status: 'failed' })
      .where(eq(enterpriseAuditJobs.id, job.id));
    return { id: job.id, status: 'failed', reason };
  }
}

// Used by the /enterprise/audit/download/:id HTTP route.
export async function fetchAuditDownload(
  orgSlug: string,
  id: string,
): Promise<{ ok: boolean; mime?: string; body?: string; filename?: string; error?: string }> {
  const row = await db.query.enterpriseAuditJobs.findFirst({
    where: and(eq(enterpriseAuditJobs.id, id), eq(enterpriseAuditJobs.orgSlug, orgSlug)),
  });
  if (!row) return { ok: false, error: 'not_found' };
  if (row.status !== 'ready' || !row.contentText) return { ok: false, error: 'not_ready' };

  const ext = row.format === 'pdf' ? 'html' : row.format;
  const filename = `gitledger-audit-${row.orgSlug}-${row.dateFrom}-${row.dateTo}.${ext}`;
  return {
    ok: true,
    mime: row.contentMime ?? MIME[row.format as AuditFormat] ?? 'text/plain',
    body: row.contentText,
    filename,
  };
}
