import { z } from 'zod';

function normalizePrivateKey(input: string): `0x${string}` {
  const trimmed = input.trim();
  const noPrefix = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (!/^[0-9a-fA-F]{64}$/.test(noPrefix)) {
    throw new Error('SIGNER_PRIVATE_KEY must be 32-byte hex (64 hex chars), with optional 0x prefix');
  }
  return `0x${noPrefix.toLowerCase()}`;
}

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  PROMPT_STAKE_QUEUE_NAME: z.string().default('gitledger:queue:prompt-stake'),
  PROMPT_STAKE_DLQ_NAME: z.string().default('gitledger:queue:prompt-stake:dlq'),
  PROMPT_STAKE_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  NOTIFIER_WEBHOOK_URL: z.string().url().optional(),
  INTERNAL_API_TOKEN: z.string().min(1),
  ADMIN_API_TOKEN: z.string().min(1).default('dev_admin_token'),
  INTERNAL_SERVICE_TOKEN: z.string().min(1).default('dev_internal_service_token'),
  BASE_RPC_URL: z.string().url(),
  SIGNER_PRIVATE_KEY: z.string().min(1).transform(normalizePrivateKey),
  GITLEDGER_CONTRACT: z.string().min(1),
  EAS_CONTRACT_BASE: z.string().min(1),
  EAS_SCHEMA_UID: z.string().min(1),
  TREASURY_ADDRESS: z.string().min(1),
  GITHUB_OAUTH_CLIENT_ID: z.string().min(1).default('dev_github_oauth_client_id'),
  GITHUB_OAUTH_CLIENT_SECRET: z.string().min(1).default('dev_github_oauth_client_secret'),
  SESSION_SECRET: z.string().min(1).default('dev_session_secret_change_me'),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_WEBHOOK_URL: z.string().url(),
  GITHUB_TOKEN: z.string().min(1),
  ORACLE_MODE: z.enum(['backend', 'chainlink']).default('backend'),
  ORACLE_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(86400),
  ORACLE_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
});

export const env = envSchema.parse(process.env);
