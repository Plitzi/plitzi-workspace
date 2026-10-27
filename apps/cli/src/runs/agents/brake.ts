import { isRecord } from '@plitzi/sdk-shared/helpers';

import { isNumber, isString, oneOf } from '../core/guards';

/** How a completion ended, as the automatic brake counts it. */
export const BRAKE_KINDS = ['completed', 'refused', 'checks-failed', 'conflict'] as const;

export const isBrakeKind = oneOf(BRAKE_KINDS);

export interface BrakeEvent {
  kind: (typeof BRAKE_KINDS)[number];
  at: string;
}

export const isBrakeEvent = (value: unknown): value is BrakeEvent =>
  isRecord(value) && isBrakeKind(value.kind) && isString(value.at);

/** A run's count of its completions, by how each ended (`RunRecord.completions`). */
export const isCompletions = (value: unknown): value is Record<BrakeEvent['kind'], number> =>
  isRecord(value) && BRAKE_KINDS.every(kind => isNumber(value[kind]));
