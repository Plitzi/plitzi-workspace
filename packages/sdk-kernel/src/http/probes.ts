/** Where a process answers its stats (`statsStage`): a path of the kernel's, read by the pools' reader. */
export const STATS_PATH = '/_stats';

/** Where it answers the last lines of its log, behind the same secret (`readLogTail`). */
export const STATS_LOGS_PATH = `${STATS_PATH}/logs`;

/** Where it answers its stats as Prometheus metrics, behind the same secret (`metricsText`). */
export const STATS_METRICS_PATH = `${STATS_PATH}/metrics`;
