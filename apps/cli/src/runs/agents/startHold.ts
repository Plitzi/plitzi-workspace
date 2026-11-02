import { readLaunch } from './launch';
import { lastLineOf, sessionOf } from './sessionEnd';

import type { Harness } from './agentPrompt';
import type { Launch } from './launch';
import type { RunPaths } from '../core/paths';

/**
 * An agent whose harness ends as it starts is not started again in a loop: a run's keeper started its eight agents 4379
 * times in 40 minutes, Claude Code past its 5-hour limit — each start a line on the board and nothing done. A start is
 * held for one of three things, said each with how it ends:
 *
 * - the harness's limit, read off the line its session ended on: every agent in that harness waits until it resets;
 * - an agent ending as it starts, again and again — a login gone, a harness broken: held until the lead, having looked,
 *   allows it (the maintainer: "el lead debe revisar y permitir"), which is one more try;
 * - a person or the lead stopping it (`run hold`): held until allowed (`run allow`).
 */

/** Ended this soon after its start with no word to the run, a harness is taken as having failed to start. */
export const QUICK_END_MS = 60_000;

/** Ended at its start this many times in a row, an agent is held until allowed. */
export const QUICK_ENDS_HELD = 3;

/** A limit whose reset could not be read: its harness is tried again after this. */
const LIMIT_UNREAD_MS = 15 * 60_000;

/** A reset time already past by at most this is the harness's rounding: tried again `JUST_RESET_MS` after. */
const ROUNDED_MS = 60 * 60_000;
const JUST_RESET_MS = 5 * 60_000;

/** What holds a start: the harness's limit, the agent ending as it starts, or someone stopping it. */
export type HoldWhy = 'limit' | 'quick-ends' | 'stopped';

/** A start held: why, and what ends it. */
export interface StartHold {
  agent: string;
  why: HoldWhy;
  /** The harness it was started in: whose limit, whose failure. */
  harness?: Harness;
  /** For `limit`: when the run starts it again by itself. The others wait to be allowed. */
  until?: string;
  /** The harness's own words: its limit line, or the last line it wrote. */
  line?: string;
  /** For `quick-ends`: how many times in a row — and its output, to look at. */
  ends?: number;
  log?: string;
  /** For `stopped`: who stopped it. */
  by?: string;
  /** Since when: the stop, or the session that ended on the limit. */
  since?: string;
}

/**
 * A harness's own line saying it is past its limit — Claude Code's "You've hit your 5-hour limit · resets 8:40pm
 * (Europe/Lisbon)", also after "automatic compaction failed:", and its older "Claude AI usage limit reached|<epoch>".
 * Read from the start of a line: an agent's prose about a limit is no harness's.
 */
const LIMIT_LINE = /^(?:.*?:\s+)?(?:you'?ve hit your [\w -]*limit|claude ai usage limit reached)\b/i;

/**
 * The limit a session ended on: said on its last line — a harness stopped by it says so last. One said earlier and
 * followed by work was another session's, or passed (a run's dev-2 worked to its end below an hour-old limit line).
 */
export const limitLineIn = (text: string): string | undefined => {
  const last = lastLineOf(text);

  return last !== undefined && LIMIT_LINE.test(last) ? last : undefined;
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const RESET =
  /\b(?:resets|try again at)\s+(?:(?<month>[a-z]{3})[a-z]*\s+(?<day>\d{1,2}),?\s+(?:at\s+)?)?(?<hour>\d{1,2})(?::(?<minute>\d{2}))?\s*(?<meridiem>[ap]m)?\s*(?:\((?<zone>[^)]+)\))?/i;

/** The wall clock `zone` reads at an instant, as if it were UTC. */
const wallOf = (at: number, zone: string): number => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    })
      .formatToParts(at)
      .map(part => [part.type, Number(part.value)])
  );

  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
};

/** The instant `zone`'s wall clock reads that date and time: its offset taken twice, for a day the clocks change. */
const instantIn = (year: number, month: number, day: number, hour: number, minute: number, zone: string): number => {
  const asUtc = Date.UTC(year, month, day, hour, minute);
  const first = asUtc - (wallOf(asUtc, zone) - asUtc);

  return asUtc - (wallOf(first, zone) - first);
};

/**
 * When a limit line says its harness resets, the first such time after the line was written — in the zone it names,
 * else this machine's, where the harness runs. `undefined` when it says no time this reads, or names no zone there is.
 */
export const resetOf = (line: string, after: number): number | undefined => {
  const epoch = /\|(\d{10})\b/.exec(line);
  if (epoch) {
    return Number(epoch[1]) * 1000;
  }

  const said = RESET.exec(line);
  if (!said) {
    return undefined;
  }

  const group = (name: string): string | undefined => said.groups?.[name];
  const monthName = group('month');
  const dayText = group('day');
  const hourText = group('hour');
  const minuteText = group('minute');
  const meridiem = group('meridiem');
  const named = group('zone');
  const zone = named ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hour12 = Number(hourText);
  const hour = meridiem === undefined ? hour12 : (hour12 % 12) + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  const month = monthName === undefined ? -1 : MONTHS.indexOf(monthName.toLowerCase());
  if (hour > 23 || minute > 59 || (monthName !== undefined && month < 0)) {
    return undefined;
  }

  try {
    const today = new Date(wallOf(after, zone));
    if (month >= 0) {
      const year = today.getUTCFullYear();
      const at = instantIn(year, month, Number(dayText), hour, minute, zone);

      return at > after ? at : instantIn(year + 1, month, Number(dayText), hour, minute, zone);
    }

    const at = instantIn(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), hour, minute, zone);

    if (at > after) {
      return at;
    }

    // Said a little after the time it names, the harness rounded its reset down: it is now, not tomorrow (a run's
    // sessions wrote "resets 8:40pm" at 20:42 for minutes).
    return after - at <= ROUNDED_MS
      ? after + JUST_RESET_MS
      : instantIn(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1, hour, minute, zone);
  } catch {
    // A zone this machine does not know (`RangeError`): its time is not read, and the harness is tried again later.
    return undefined;
  }
};

/** Whether a launch's session ended at its start: within `QUICK_END_MS`, and nothing of it reached the run's log. */
const endedAtStart = (
  agent: string,
  launch: Launch,
  endedAt: number,
  log: readonly Record<string, unknown>[]
): boolean =>
  endedAt - Date.parse(launch.startedAt) < QUICK_END_MS &&
  !log.some(entry => entry.by === agent && typeof entry.at === 'string' && entry.at >= launch.startedAt);

/**
 * How many times in a row the agent's sessions ended at their start, its last launch's counted — kept on the next
 * launch (`Launch.quickEnds`). Its last session still running is none.
 */
export const quickEndsOf = async (
  agent: string,
  launch: Launch | undefined,
  log: readonly Record<string, unknown>[]
): Promise<number> => {
  const session = launch && (await sessionOf(launch));

  return launch && session && endedAtStart(agent, launch, session.endedAt, log) ? (launch.quickEnds ?? 0) + 1 : 0;
};

const stringAt = (entry: Record<string, unknown>): string => (typeof entry.at === 'string' ? entry.at : '');

/** When the agent was last allowed to start (`run allow`): what held it before is lifted. */
const allowedAt = (agent: string, log: readonly Record<string, unknown>[]): string =>
  log
    .filter(entry => entry.action === 'starts-allowed' && Array.isArray(entry.agents) && entry.agents.includes(agent))
    .reduce((latest, entry) => (stringAt(entry) > latest ? stringAt(entry) : latest), '');

/** A stop of the agent's (`run hold`) not allowed since: held whatever its process. */
const stoppedHold = (agent: string, log: readonly Record<string, unknown>[]): StartHold | undefined => {
  const stop = log.findLast(entry => entry.action === 'agent-held' && entry.agent === agent);
  if (!stop || stringAt(stop) <= allowedAt(agent, log)) {
    return undefined;
  }

  return { agent, why: 'stopped', since: stringAt(stop), by: typeof stop.by === 'string' ? stop.by : 'someone' };
};

/** The hold its last session left: its limit, or its ending as it started — none once allowed since it ended. */
export const sessionHold = async (
  agent: string,
  launch: Launch,
  log: readonly Record<string, unknown>[],
  now: number
): Promise<StartHold | undefined> => {
  const session = await sessionOf(launch);
  if (!session || new Date(session.endedAt).toISOString() <= allowedAt(agent, log)) {
    return undefined;
  }

  const limit = limitLineIn(session.text);
  if (limit !== undefined) {
    const until = resetOf(limit, session.endedAt) ?? session.endedAt + LIMIT_UNREAD_MS;

    return until > now
      ? {
          agent,
          harness: launch.harness,
          until: new Date(until).toISOString(),
          why: 'limit',
          line: limit,
          since: new Date(session.endedAt).toISOString()
        }
      : undefined;
  }

  const ends = endedAtStart(agent, launch, session.endedAt, log) ? (launch.quickEnds ?? 0) + 1 : 0;
  const line = lastLineOf(session.text);

  return ends >= QUICK_ENDS_HELD
    ? {
        agent,
        harness: launch.harness,
        why: 'quick-ends',
        ends,
        log: launch.log,
        ...(line === undefined ? {} : { line })
      }
    : undefined;
};

/**
 * The holds on the team's agents not running: each one's own — stopped, or what its last session left — and a
 * harness's limit laid on every agent the run would start in it: the limit is the account's, so the next one started in
 * it ends the same way.
 */
export const startHolds = async (
  paths: RunPaths,
  /** The team's agents not running, and the harness the run starts them in (`options.launch`). */
  team: { notRunning: readonly string[]; harness: string | undefined },
  log: readonly Record<string, unknown>[],
  now: number
): Promise<Map<string, StartHold>> => {
  const own = (
    await Promise.all(
      team.notRunning.map(async agent => {
        const stopped = stoppedHold(agent, log);
        if (stopped) {
          return stopped;
        }

        const launch = await readLaunch(paths, agent);

        return launch ? await sessionHold(agent, launch, log, now) : undefined;
      })
    )
  ).filter(hold => hold !== undefined);
  const limit = own
    .filter(hold => hold.why === 'limit' && hold.harness === team.harness)
    .reduce<StartHold | undefined>(
      (latest, hold) => (latest && (latest.until ?? '') >= (hold.until ?? '') ? latest : hold),
      undefined
    );
  const holds = new Map(own.map(hold => [hold.agent, hold] as const));
  if (limit) {
    // Its own stop or failure says more of an agent than its harness's limit: kept.
    // One allowed since the limit was read is started: the person said the harness can (a plan raised).
    for (const agent of team.notRunning.filter(
      each => (!holds.has(each) || holds.get(each)?.why === 'limit') && allowedAt(each, log) < (limit.since ?? '')
    )) {
      holds.set(agent, { ...limit, agent });
    }
  }

  return holds;
};

const clockOf = (at: string | undefined): string => `${(at ?? '').slice(11, 16)} UTC`;

const allowCommand = (agents: readonly string[]): string => `plitzi run allow ${agents.join(' ')}`;

/** Holds alike — one harness's limit, one failure's line, one stop — told once, naming who they hold. */
const grouped = (holds: readonly StartHold[], key: (hold: StartHold) => string): StartHold[][] => {
  const groups = new Map<string, StartHold[]>();
  for (const hold of holds) {
    groups.set(key(hold), [...(groups.get(key(hold)) ?? []), hold]);
  }

  return [...groups.values()];
};

const names = (group: readonly StartHold[]): string[] => group.map(each => each.agent);

/** A start held, as the lead and the person are told it — and whose it is to act on. */
export interface HoldNotice {
  subject: string;
  text: string;
  who: 'lead' | 'person';
}

/**
 * The holds as they are told: a harness's limit once, the person's — the account is theirs; agents ending as they start,
 * the lead's to look at and allow; a stop, its own. Nothing is lost: the work stays in the copies.
 */
export const holdNotices = (holds: ReadonlyMap<string, StartHold>): HoldNotice[] => {
  const all = [...holds.values()];

  return [
    ...grouped(
      all.filter(each => each.why === 'limit'),
      each => `${each.harness ?? ''} ${each.until ?? ''}`
    ).map(group => ({
      subject: `limit ${group[0].harness ?? ''}`,
      text: `${group[0].harness ?? 'The harness'} is past its limit ("${group[0].line ?? ''}"): the run starts none of its agents in it until ${clockOf(group[0].until)}, then by itself — ${names(group).join(', ')} wait, their work kept in their copies. Started sooner (a plan raised): ${allowCommand(names(group))}`,
      who: 'person' as const
    })),
    ...grouped(
      all.filter(each => each.why === 'quick-ends'),
      each => each.line ?? ''
    ).map(group => ({
      subject: `quick-ends ${names(group).join(' ')}`,
      text: `${names(group).join(', ')} ended as ${group.length === 1 ? 'it' : 'they'} started ${String(QUICK_ENDS_HELD)} times in a row or more, saying nothing to the run — ${group[0].harness ?? 'the harness'}'s last line: "${group[0].line ?? '(nothing)'}" (all of it: ${group[0].log ?? 'its agent.log'}). The run starts ${group.length === 1 ? 'it' : 'them'} no more by itself: see what the line says — the harness's login, its install, its plan — and once it can start, ${allowCommand(names(group))} (one more try each)`,
      who: 'lead' as const
    })),
    ...grouped(
      all.filter(each => each.why === 'stopped'),
      each => each.by ?? ''
    ).map(group => ({
      subject: `stopped ${names(group).join(' ')}`,
      text: `${names(group).join(', ')} stopped by ${group[0].by ?? 'someone'} (run hold): the run starts ${group.length === 1 ? 'it' : 'them'} no more until allowed — ${allowCommand(names(group))}; what ${group.length === 1 ? 'it holds stays in its' : 'they hold stays in their'} hands`,
      who: 'person' as const
    }))
  ];
};

/** What holds it, in a few words: its harness's limit until when, its ending as it starts, or who stopped it. */
export const holdReason = (hold: StartHold): string =>
  hold.why === 'limit'
    ? `waiting for ${hold.harness ?? 'its harness'}'s limit, until ${clockOf(hold.until)}`
    : hold.why === 'quick-ends'
      ? `held: it ended as it started ${String(hold.ends ?? QUICK_ENDS_HELD)} times`
      : `held by ${hold.by ?? 'someone'} since ${clockOf(hold.since)}`;

/** What an agent held is at, for its row: what holds it, and what ends it. */
export const holdDoing = (hold: StartHold): string =>
  `${holdReason(hold)} — ${hold.why === 'limit' ? 'started again then, by itself' : `${hold.why === 'quick-ends' ? 'the lead allows it: ' : ''}${allowCommand([hold.agent])}`}`;
