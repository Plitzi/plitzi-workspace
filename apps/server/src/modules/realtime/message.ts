import type { RealtimeMessage } from '@plitzi/sdk-shared';

/** A message as a transport or a store carried it — written by this module, but read from something that is not. */
export const isMessage = (value: unknown): value is RealtimeMessage =>
  typeof value === 'object' &&
  value !== null &&
  'topic' in value &&
  typeof value.topic === 'string' &&
  'type' in value &&
  typeof value.type === 'string' &&
  'from' in value &&
  typeof value.from === 'string' &&
  'at' in value &&
  typeof value.at === 'number';
