import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/client';
import { promptStakeJobs } from '../db/schema';

export type PromptStakeJobStatus = 'received' | 'processed' | 'failed';

export async function listPromptStakeJobs(limit: number, status?: PromptStakeJobStatus) {
  const whereClause = status ? eq(promptStakeJobs.status, status) : undefined;

  if (whereClause) {
    return db
      .select()
      .from(promptStakeJobs)
      .where(and(whereClause))
      .orderBy(desc(promptStakeJobs.receivedAt))
      .limit(limit);
  }

  return db.select().from(promptStakeJobs).orderBy(desc(promptStakeJobs.receivedAt)).limit(limit);
}
