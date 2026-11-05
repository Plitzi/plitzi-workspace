import type { ActionRunRecord } from '../types';
import type { StatsRecorder } from '@plitzi/sdk-kernel/stats';

/** What a run's end says to the process's stats: nothing when it answered, and why when it did not. */
const failureOf = (record: ActionRunRecord): string | undefined => {
  if (record.status === 'completed' || record.status === 'skipped') {
    return undefined;
  }

  return record.reason ?? (record.status === 'aborted' ? 'aborted' : 'error');
};

/**
 * The deployment's `onRun` with the process's stats fed first (`stats`): each run's duration, why when it failed, and
 * which action of which space it was — what a slow minute on the pools' screen is traced back to.
 * A stats update cannot throw, so the deployment's own record is never kept from running.
 */
export const recordedRun =
  (stats: StatsRecorder, onRun?: (record: ActionRunRecord) => void | Promise<void>) =>
  async (record: ActionRunRecord): Promise<void> => {
    stats.run(record.durationMs, failureOf(record), {
      spaceId: record.spaceId,
      kind: 'action',
      name: record.actionId,
      trigger: record.trigger,
      runId: record.runId
    });
    await onRun?.(record);
  };
