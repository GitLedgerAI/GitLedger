// SIEM outbound forwarder for Track 1.
//
// Fan out compliance events to per-org webhook configs (Splunk, Datadog,
// Vanta, Drata, Secureframe, or custom HTTPS). Each delivery is signed with
// HMAC-SHA256 over the raw body using the config's `endpoint_secret`, and
// retried 3x with exponential backoff. This is intentionally simple —
// moving to a Redis-backed BullMQ queue is a future optimization once
// volume warrants it.

import { createHmac, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { enterpriseSiemConfigs } from '../db/schema';

export type SiemEventKind =
  | 'stake.locked'
  | 'review.clean'
  | 'review.slashed'
  | 'policy.violation';

export type SiemDeliveryInput = {
  orgSlug: string;
  event: SiemEventKind;
  payload: Record<string, unknown>;
};

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [0, 500, 2500];

function transformPayloadFor(kind: string, base: Record<string, unknown>): Record<string, unknown> {
  // Vendor-specific adapters live here. Right now all destinations get the
  // raw payload; Vanta/Drata mappers are stubbed for the backend dev to
  // expand based on their integration docs.
  switch (kind) {
    case 'vanta':
      return { source: 'gitledger', kind: 'evidence.upload', evidence: base };
    case 'drata':
      return { provider: 'gitledger', payload: base };
    case 'secureframe':
      return { integration: 'gitledger', event: base };
    default:
      return base;
  }
}

async function deliverOnce(
  url: string,
  rawBody: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: rawBody,
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function deliverWithRetry(
  url: string,
  rawBody: string,
  headers: Record<string, string>,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  let lastError: { ok: boolean; status?: number; error?: string } = { ok: false };
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
    const r = await deliverOnce(url, rawBody, headers);
    if (r.ok) return r;
    lastError = r;
  }
  return lastError;
}

export async function fanoutSiemEvent(input: SiemDeliveryInput): Promise<void> {
  const configs = await db
    .select()
    .from(enterpriseSiemConfigs)
    .where(eq(enterpriseSiemConfigs.orgSlug, input.orgSlug));

  const targets = configs.filter(
    (c) => c.enabled && Array.isArray(c.events) && c.events.includes(input.event),
  );
  if (targets.length === 0) return;

  await Promise.all(targets.map((cfg) => deliverToConfig(cfg, input.event, input.payload)));
}

async function deliverToConfig(
  cfg: typeof enterpriseSiemConfigs.$inferSelect,
  event: SiemEventKind,
  payload: Record<string, unknown>,
): Promise<void> {
  const transformed = transformPayloadFor(cfg.kind, { event, ...payload });
  const deliveryId = randomUUID();
  const rawBody = JSON.stringify(transformed);
  const signature = createHmac('sha256', cfg.endpointSecret).update(rawBody).digest('hex');

  const headers: Record<string, string> = {
    'X-GitLedger-Event': event,
    'X-GitLedger-Delivery': deliveryId,
    'X-GitLedger-Signature': `hmac-sha256=${signature}`,
  };

  const result = await deliverWithRetry(cfg.endpointUrl, rawBody, headers);

  await db
    .update(enterpriseSiemConfigs)
    .set({
      lastDeliveredAt: new Date(),
      lastDeliveryStatus: result.ok ? 'ok' : 'failed',
      lastDeliveryError: result.ok ? null : result.error ?? `status ${result.status}`,
    })
    .where(eq(enterpriseSiemConfigs.id, cfg.id))
    .catch((err) => {
      console.error('[enterprise-siem] failed to update delivery status', {
        configId: cfg.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

  if (!result.ok) {
    console.warn('[enterprise-siem] delivery failed after retries', {
      configId: cfg.id,
      kind: cfg.kind,
      event,
      error: result.error,
      status: result.status,
    });
  }
}

// Triggered by the SIEM `test` mutation. Builds a synthetic review.slashed
// payload and delivers once (no retry) so the customer gets fast feedback.
export async function testSiemDelivery(input: {
  orgSlug: string;
  configId: string;
}): Promise<{ ok: boolean; deliveredAt: string; error?: string }> {
  const cfg = await db.query.enterpriseSiemConfigs.findFirst({
    where: eq(enterpriseSiemConfigs.id, input.configId),
  });
  if (!cfg || cfg.orgSlug !== input.orgSlug) {
    return { ok: false, deliveredAt: new Date().toISOString(), error: 'config_not_found' };
  }

  const payload: Record<string, unknown> = {
    orgSlug: input.orgSlug,
    repoSlug: 'gitledger/test',
    prId: 0,
    pathPattern: 'src/test/**',
    reviewer: { basename: 'test.base.eth', address: '0x0000000000000000000000000000000000000001' },
    amountUsdc: 1_000_000,
    attestationUid: '0xtest',
    occurredAt: new Date().toISOString(),
    test: true,
  };

  const transformed = transformPayloadFor(cfg.kind, { event: 'review.slashed', ...payload });
  const rawBody = JSON.stringify(transformed);
  const signature = createHmac('sha256', cfg.endpointSecret).update(rawBody).digest('hex');

  const result = await deliverOnce(cfg.endpointUrl, rawBody, {
    'X-GitLedger-Event': 'review.slashed',
    'X-GitLedger-Delivery': randomUUID(),
    'X-GitLedger-Signature': `hmac-sha256=${signature}`,
    'X-GitLedger-Test': 'true',
  });

  const deliveredAt = new Date();
  await db
    .update(enterpriseSiemConfigs)
    .set({
      lastDeliveredAt: deliveredAt,
      lastDeliveryStatus: result.ok ? 'ok' : 'failed',
      lastDeliveryError: result.ok ? null : result.error ?? `status ${result.status}`,
    })
    .where(eq(enterpriseSiemConfigs.id, cfg.id));

  return {
    ok: result.ok,
    deliveredAt: deliveredAt.toISOString(),
    error: result.ok ? undefined : result.error ?? `status ${result.status}`,
  };
}
