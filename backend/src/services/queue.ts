import type { PromptStakeJob } from '../lib/types';

export type EnqueueFn = (job: PromptStakeJob) => Promise<void>;

let enqueueImpl: EnqueueFn = async (job) => {
  // TODO: Replace with Redis-backed queue worker (BullMQ or custom streams).
  console.info('[queue] prompt-stake', job);
};

export async function enqueuePromptStake(job: PromptStakeJob): Promise<void> {
  return enqueueImpl(job);
}

export function setEnqueuePromptStakeForTests(fn: EnqueueFn): void {
  enqueueImpl = fn;
}

export function resetEnqueuePromptStakeForTests(): void {
  enqueueImpl = async (job) => {
    console.info('[queue] prompt-stake', job);
  };
}
