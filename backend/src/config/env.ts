import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  BASE_RPC_URL: z.string().url(),
  GITLEDGER_CONTRACT: z.string().min(1),
  EAS_SCHEMA_UID: z.string().min(1),
});

export const env = envSchema.parse(process.env);
