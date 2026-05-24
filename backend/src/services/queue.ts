import type { PromptStakeJob } from '../lib/types';

export type EnqueueFn = (job: PromptStakeJob) => Promise<void>;

type QueuePublisher = (queueName: string, payload: string) => Promise<void>;

const DEFAULT_QUEUE_NAME = 'gitledger:queue:prompt-stake';

let queueName = DEFAULT_QUEUE_NAME;
let publishImpl: QueuePublisher | null = null;

let enqueueImpl: EnqueueFn = async (job) => {
  if (!publishImpl) {
    throw new Error(`prompt stake queue publisher not configured for job ${JSON.stringify(job)}`);
  }

  await publishImpl(queueName, JSON.stringify(job));
};

export async function enqueuePromptStake(job: PromptStakeJob): Promise<void> {
  return enqueueImpl(job);
}

export function configurePromptStakeQueue(name: string): void {
  queueName = name || DEFAULT_QUEUE_NAME;
}

export function setPromptStakePublisher(publisher: QueuePublisher): void {
  publishImpl = publisher;
}

export function setEnqueuePromptStakeForTests(fn: EnqueueFn): void {
  enqueueImpl = fn;
}

export function resetEnqueuePromptStakeForTests(): void {
  publishImpl = null;
  queueName = DEFAULT_QUEUE_NAME;
  enqueueImpl = async (job) => {
    if (!publishImpl) {
      throw new Error(`prompt stake queue publisher not configured for job ${JSON.stringify(job)}`);
    }
    await publishImpl(queueName, JSON.stringify(job));
  };
}

export function getPromptStakeQueueName(): string {
  return queueName;
}
