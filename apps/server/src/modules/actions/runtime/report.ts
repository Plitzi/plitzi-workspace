import type { ActionRejectRecord, SSRPageServerConfig } from '@plitzi/sdk-shared';

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
export const reportReject = async (config: SSRPageServerConfig, record: ActionRejectRecord): Promise<void> => {
  try {
    await config.action?.onReject?.(record);
  } catch (error) {
    console.error('[Actions] reject record failed:', error);
  }
};
