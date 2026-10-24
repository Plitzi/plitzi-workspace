import { isRunning, processTable, readLaunch, startedWithin } from './launch';
import { runningAgents } from './onDemand';
import { DEFAULTS } from './taskStore';
import { startedAgents } from './team';

import type { RunPaths } from './paths';
import type { TaskView } from './taskStore';
import type { Team } from './team';

/** Which agents of a run are running now — what the lead's view and a gentle stop (`run upgrade`) both read. */
export interface AgentsNow {
  /** Launched by the CLI, and its process has ended: not running, whatever the log's last word of them. */
  gone: Set<string>;
  /** Launched within its grace and silent since: running, its tasks not silent. */
  starting: Set<string>;
  running: Set<string>;
}

export const agentsNow = async (
  paths: RunPaths,
  views: readonly TaskView[],
  team: Team | undefined,
  log: readonly Record<string, unknown>[],
  now: Date
): Promise<AgentsNow> => {
  const grace =
    team?.options?.startGraceMinutes === undefined ? DEFAULTS.startGraceMs : team.options.startGraceMinutes * 60_000;
  // What the CLI launched of the team and of the tasks' owners: its process, when, its session.
  const launches = new Map(
    (
      await Promise.all(
        [
          ...new Set([
            ...(team ? startedAgents(team) : []).map(each => each.agent),
            ...views.flatMap(view => (view.owner ? [view.owner.agent] : []))
          ])
        ].map(async agent => [agent, await readLaunch(paths, agent)] as const)
      )
    ).flatMap(([agent, launch]) => (launch ? [[agent, launch] as const] : []))
  );
  const table = processTable();
  // Launched and its process gone: not running, whatever its last word in the log was — encore's designers ended on a
  // 'waiting', read running for good, and no designer was asked for the UI reviews that waited on none.
  const gone = new Set([...launches].filter(([, launch]) => !isRunning(launch, table)).map(([agent]) => agent));
  // An agent just started has said nothing yet — its harness loading, its skills read: the tasks it holds are not
  // silent, and it is running, until its grace is over or it stopped since (encore: every agent started again after the
  // machine went down read "no signal" and "not running" at once, its last word from before).
  const starting = new Set(
    [...launches]
      .filter(
        ([agent, launch]) =>
          !gone.has(agent) &&
          startedWithin(launch, now, grace) &&
          !log.some(
            entry =>
              entry.by === agent &&
              entry.action === 'stops' &&
              typeof entry.at === 'string' &&
              Date.parse(entry.at) >= Date.parse(launch.startedAt)
          )
      )
      .map(([agent]) => agent)
  );

  // Launched by the CLI, its process says whether it runs — never the log's last word, which a stop followed by a
  // notice read as alive and a busy agent's quiet read as gone (encore-2's watch asked for dev-1, running, while dev-2
  // and dev-3 waited stopped). Started by hand, the log is all there is.
  const byLog = runningAgents(log);
  const running = new Set([
    ...[...launches].filter(([agent]) => !gone.has(agent)).map(([agent]) => agent),
    ...[...byLog].filter(agent => !launches.has(agent)),
    ...starting
  ]);

  return { gone, starting, running };
};
