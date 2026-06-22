import { createStoreHook } from '@plitzi/nexus/react';

export type BatchState = { firstName: string; lastName: string; age: number; city: string };

export const BATCH_INITIAL: BatchState = { firstName: 'Ada', lastName: 'Lovelace', age: 36, city: 'London' };

// Each click rotates to the next person; consecutive entries differ in all four fields, so every write is a real
// change (no UNCHANGED short-circuit) and the wake count is an honest 4 vs 1.
export const PEOPLE: BatchState[] = [
  { firstName: 'Grace', lastName: 'Hopper', age: 85, city: 'New York' },
  { firstName: 'Alan', lastName: 'Turing', age: 41, city: 'Manchester' },
  { firstName: 'Katherine', lastName: 'Johnson', age: 101, city: 'Hampton' },
  { firstName: 'Ada', lastName: 'Lovelace', age: 36, city: 'London' }
];

export const { useStore: useBatchStore } = createStoreHook<BatchState>();
