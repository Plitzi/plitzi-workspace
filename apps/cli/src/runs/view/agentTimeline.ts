import { stoppedAgents } from '../agents/onDemand';

/**
 * Each agent's life in the run, read off its log: when it was started, what it took, completed and reviewed, when it
 * waited and stopped and why — and the minutes it was at work, stopped, or silent without having stopped. Kept in the
 * report so a run is read whole after it is gone: a run's tester and designers read "no signal" for half an hour,
 * and only the run's folder, copied aside before the finish, said why (Carlos: "esa información, agrégala al reporte").
 */

/** One moment of an agent's life: when, and what, in a few words. */
export interface AgentMoment {
  at: string;
  what: string;
}

export interface AgentTimeline {
  agent: string;
  moments: AgentMoment[];
  /** How many times it was started by the CLI (`run agent --launch`, the keeper, the lead's watch). */
  launches: number;
  /** Each stop, with why — one task a session, nothing left, a run that stops. */
  stops: AgentMoment[];
  /** Minutes at work or waiting for it, stopped, and silent — nothing logged past `SILENT_MS` while neither. */
  minutes: { active: number; stopped: number; silent: number };
  /** The silences themselves: what the board reads as no signal when its presence is not marked either. */
  silences: { from: string; minutes: number }[];
}

/** Nothing logged by an agent for this long, while it was neither stopped nor waiting, is a silence worth saying. */
const SILENT_MS = 10 * 60_000;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** What a log entry says of the agent, in a few words — nothing for what says nothing of its life. */
const momentOf = (entry: Record<string, unknown>): string | undefined => {
  switch (entry.action) {
    case 'launch':
      return entry.resumed === true ? 'started again, its session resumed' : 'started';
    case 'joined':
      return 'joined the run';
    case 'take':
      return `took ${text(entry.task)}`;
    case 'complete':
      return `completed ${text(entry.task)}`;
    case 'review-taken':
      return `took the review of ${text(entry.task)}`;
    case 'review':
      return `reviewed ${text(entry.task)}: ${text(entry.verdict)}`;
    case 'waiting':
      return `waited: ${text(entry.why).slice(0, 120)}`;
    case 'stops':
      return `stopped: ${text(entry.why).slice(0, 160)}`;
    case 'refused':
      return `refused (${text(entry.code)})`;
    default:
      return undefined;
  }
};

const minutesBetween = (from: string, to: number): number => Math.max(0, (to - Date.parse(from)) / 60_000);

/** Every agent's timeline, from the run's log, to `end`. The lead and the person are not agents of it. */
export const agentTimelines = (log: readonly Record<string, unknown>[], end: Date): AgentTimeline[] => {
  const agents = [
    ...new Set(
      log.flatMap(entry => [
        // `unnamed`: a call no agent's token named (a refusal of `identity`) — said with the refusals, it is no agent.
        ...(typeof entry.by === 'string' && !['lead', 'plitzi', 'person', 'unnamed'].includes(entry.by)
          ? [entry.by]
          : []),
        ...(entry.action === 'launch' && typeof entry.agent === 'string' && entry.agent !== 'lead' ? [entry.agent] : [])
      ])
    )
  ].sort();

  return agents.map(agent => {
    const own = log.filter(
      entry =>
        typeof entry.at === 'string' && (entry.by === agent || (entry.action === 'launch' && entry.agent === agent))
    );
    const moments: AgentMoment[] = [];
    for (const entry of own) {
      const what = momentOf(entry);
      // Waits that say the same in a row are one: its follow said it again, nothing changed.
      if (what !== undefined && !(what.startsWith('waited') && moments.at(-1)?.what === what)) {
        moments.push({ at: text(entry.at), what });
      }
    }

    const minutes = { active: 0, stopped: 0, silent: 0 };
    const silences: { from: string; minutes: number }[] = [];
    for (const [index, entry] of own.entries()) {
      if (Date.parse(text(entry.at)) >= end.getTime()) {
        break;
      }

      const next = own.at(index + 1);
      const until = Math.min(next ? Date.parse(text(next.at)) : end.getTime(), end.getTime());
      const span = minutesBetween(text(entry.at), until);
      // Stopped as the board reads it: after a stop, until it comes back for work or is started again.
      const stopped = stoppedAgents(own.slice(0, index + 1)).has(agent) && entry.action !== 'launch';
      if (stopped) {
        minutes.stopped += span;
      } else if (entry.action !== 'waiting' && span * 60_000 > SILENT_MS) {
        minutes.silent += span;
        silences.push({ from: text(entry.at), minutes: Math.round(span) });
      } else {
        minutes.active += span;
      }
    }

    return {
      agent,
      moments,
      launches: own.filter(entry => entry.action === 'launch').length,
      stops: moments.filter(moment => moment.what.startsWith('stopped')),
      minutes: {
        active: Math.round(minutes.active),
        stopped: Math.round(minutes.stopped),
        silent: Math.round(minutes.silent)
      },
      silences
    };
  });
};

const clock = (at: string): string => at.slice(11, 16);

/** The timelines for the report: a line of figures each, then its moments. */
export const timelinesText = (timelines: readonly AgentTimeline[]): string[] =>
  timelines.length === 0
    ? []
    : [
        '## The agents, as they went',
        '',
        ...timelines.flatMap(each => [
          `- **${each.agent}** — ${String(each.minutes.active)} min at work or waiting, ${String(each.minutes.stopped)} stopped, ${String(each.minutes.silent)} silent; started ${String(each.launches)}×, stopped ${String(each.stops.length)}×${each.silences.length > 0 ? ` · silent from ${each.silences.map(silence => `${clock(silence.from)} (${String(silence.minutes)} min)`).join(', ')}` : ''}`,
          `  ${each.moments.map(moment => `${clock(moment.at)} ${moment.what}`).join(' · ')}`
        ]),
        ''
      ];
