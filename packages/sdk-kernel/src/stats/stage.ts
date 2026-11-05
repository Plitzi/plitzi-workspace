import { statsRecorderFor } from './recorder';
import { bearerMatches } from '../http/bearer';
import { STATS_LOGS_PATH, STATS_PATH } from '../http/probes';
import { isStopping } from '../http/stopping';
import { logQueryOf, readLogTail } from '../log/tail';

import type { ProcessStats } from './types';
import type { BaseContext, Stage } from '../http/types';

export { STATS_LOGS_PATH, STATS_PATH };

/**
 * `GET /_stats`: this process's {@link ProcessStats} — and `GET /_stats/logs` the last lines of its log — for whoever holds its stats secret (`stats.secret`) — always
 * behind it, whether or not the path is also kept off the public network, because a self-hoster may have no network
 * policy to keep it there. A server configured with no `stats` answers nothing here, and the path goes on to what else
 * it serves.
 */
export const statsStage: Stage = ({ req, res, config }) => {
  if ((req.path !== STATS_PATH && req.path !== STATS_LOGS_PATH) || !config.stats) {
    return false;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method !== 'GET') {
    res.setStatus(405);
    res.send(JSON.stringify({ error: `${STATS_PATH} is read with GET` }));

    return true;
  }

  if (!bearerMatches(req.headers.authorization, config.stats.secret)) {
    res.setStatus(401);
    res.send(JSON.stringify({ error: `${STATS_PATH} is read with this server's stats secret, as a bearer token` }));

    return true;
  }

  res.setStatus(200);
  res.send(
    JSON.stringify(
      req.path === STATS_LOGS_PATH
        ? readLogTail(logQueryOf(req.query))
        : withStopping(statsRecorderFor(config.stats, config.health?.version).snapshot(), isStopping(config))
    )
  );

  return true;
};

/** A process told to stop says so: degraded, finishing what it runs — what a deploy looks like on the pools' screen. */
export const withStopping = (stats: ProcessStats, stopping: boolean): ProcessStats =>
  stopping
    ? {
        ...stats,
        health: {
          status: 'degraded',
          reasons: ['stopping: finishing what it runs, taking nothing new', ...stats.health.reasons]
        }
      }
    : stats;

/** What a config's stats ask: refused at start when the secret is too short to be one. */
export const statsConfigProblem = (config: Pick<BaseContext['config'], 'stats'>): string | undefined =>
  config.stats && config.stats.secret.length < 32
    ? '`stats.secret` must be at least 32 characters: /_stats says what this process runs and how it is doing'
    : undefined;
