import { gaugesText, METRICS_CONTENT_TYPE, metricsText } from './metrics';
import { statsRecorderFor } from './recorder';
import { bearerMatches } from '../http/bearer';
import { STATS_LOGS_PATH, STATS_METRICS_PATH, STATS_PATH } from '../http/probes';
import { isStopping } from '../http/stopping';
import { serverLog } from '../log/serverLog';
import { logQueryOf, readLogTail } from '../log/tail';

import type { ProcessStats, StatsConfig, StatsGauge } from './types';
import type { BaseContext, Stage } from '../http/types';

export { STATS_LOGS_PATH, STATS_METRICS_PATH, STATS_PATH };

const PATHS = new Set([STATS_PATH, STATS_LOGS_PATH, STATS_METRICS_PATH]);

/**
 * The deployment's own figures, checked as Prometheus would read them. One that fails — its read rejected, or a name a
 * scraper refuses — is said in the log and by `plitzi_stats_gauges_failed`, and the answer keeps the process's own.
 */
export const deploymentGauges = async (stats: StatsConfig): Promise<StatsGauge[]> => {
  if (!stats.gauges) {
    return [];
  }

  try {
    const gauges = await stats.gauges();
    gaugesText(gauges);

    return gauges;
  } catch (error) {
    serverLog.error('Stats', "the deployment's own metrics could not be read; the process's are answered", error);

    return [
      {
        name: 'plitzi_stats_gauges_failed',
        help: "1 when the deployment's own figures could not be read: its log says why",
        value: 1
      }
    ];
  }
};

/**
 * `GET /_stats`: this process's {@link ProcessStats} — `GET /_stats/logs` the last lines of its log, and
 * `GET /_stats/metrics` its stats as Prometheus metrics with the deployment's own after them — for whoever holds its stats
 * secret (`stats.secret`) — always behind it, whether or not the path is also kept off the public network, because a
 * self-hoster may have no network policy to keep it there. A server configured with no `stats` answers nothing here,
 * and the path goes on to what else it serves.
 */
export const statsStage: Stage = async ({ req, res, config }) => {
  const { stats } = config;
  if (!PATHS.has(req.path) || !stats) {
    return false;
  }

  const metrics = req.path === STATS_METRICS_PATH;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setStatus(405);
    res.send(JSON.stringify({ error: `${req.path} is read with GET` }));

    return true;
  }

  if (!bearerMatches(req.headers.authorization, stats.secret)) {
    res.setStatus(401);
    res.send(JSON.stringify({ error: `${req.path} is read with this server's stats secret, as a bearer token` }));

    return true;
  }

  const snapshot = (): ProcessStats =>
    withStopping(statsRecorderFor(stats, config.health?.version).snapshot(), isStopping(config));
  if (metrics) {
    const extra = await deploymentGauges(stats);
    res.setHeader('Content-Type', METRICS_CONTENT_TYPE);
    res.setStatus(200);
    res.send(metricsText(snapshot(), extra));

    return true;
  }

  res.setStatus(200);
  res.send(JSON.stringify(req.path === STATS_LOGS_PATH ? readLogTail(logQueryOf(req.query)) : snapshot()));

  return true;
};

/** A process told to stop says so: `stopping`, finishing what it runs — what a deploy looks like on the pools' screen. */
export const withStopping = (stats: ProcessStats, stopping: boolean): ProcessStats =>
  stopping
    ? {
        ...stats,
        health: {
          status: 'stopping',
          reasons: ['stopping: finishing what it runs, taking nothing new', ...stats.health.reasons]
        }
      }
    : stats;

/** What a config's stats ask: refused at start when the secret is too short to be one. */
export const statsConfigProblem = (config: Pick<BaseContext['config'], 'stats'>): string | undefined =>
  config.stats && config.stats.secret.length < 32
    ? '`stats.secret` must be at least 32 characters: /_stats says what this process runs and how it is doing'
    : undefined;
