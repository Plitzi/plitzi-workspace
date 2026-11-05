import type { ActionRunRecord } from '../types';
import type { RunEnd, StatsRecorder } from '@plitzi/sdk-kernel/stats';

/**
 * How a run's end reads to the process's stats: nothing when it answered; a limit when it reached one, or its code
 * refused — the run's own doing, which no error rate counts; and why it failed otherwise.
 */
const endOf = (record: ActionRunRecord): RunEnd | undefined => {
  if (record.status === 'completed' || record.status === 'skipped') {
    return undefined;
  }

  if (record.limit) {
    return { limit: record.limit };
  }

  if (record.refused) {
    return { refused: true };
  }

  return { failed: record.reason ?? (record.status === 'aborted' ? 'aborted' : 'error') };
};

/**
 * The deployment's `onRun` with the process's stats fed first (`stats`): each run's duration, how it ended, and
 * which action of which space it was — what a slow minute on the pools' screen is traced back to.
 * A stats update cannot throw, so the deployment's own record is never kept from running.
 */
export const recordedRun =
  (stats: StatsRecorder, onRun?: (record: ActionRunRecord) => void | Promise<void>) =>
  async (record: ActionRunRecord): Promise<void> => {
    stats.run(record.durationMs, endOf(record), {
      spaceId: record.spaceId,
      kind: 'action',
      name: record.actionId,
      trigger: record.trigger,
      runId: record.runId
    });
    await onRun?.(record);
  };
