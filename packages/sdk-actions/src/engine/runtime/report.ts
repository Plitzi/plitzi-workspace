import { serverLog } from '@plitzi/sdk-kernel/log';
import { statsRecorderFor } from '@plitzi/sdk-kernel/stats';

import type { EngineServerConfig } from '../../types';
import type { ActionRejectRecord } from '@plitzi/sdk-shared';

/**
 * Reports a request that never became a run.
 *
 * Its own function rather than a call at each refusal so the two transports cannot end up reporting different
 * things — and so the rule that a report may not fail the answer is written once. A deployment's sink throwing
 * must not turn a clean 401 into a 500: the caller was refused either way, and the refusal is the part that has
 * to reach them.
 *
 * Nothing is filtered here. A duplicate delivery is a well-behaved sender retrying and an invalid signature is a
 * broken integration, but which of those is worth a row in somebody's activity feed is a policy, and policies
 * belong to the deployment.
 */
export const reportReject = async (config: EngineServerConfig, record: ActionRejectRecord): Promise<void> => {
  if (config.stats) {
    statsRecorderFor(config.stats, config.health?.version).refuse(record.reason);
  }

  try {
    await config.action?.onReject?.(record);
  } catch (error) {
    serverLog.error('Actions', 'reject record failed', error);
  }
};
