import { groupAlike } from './findings/words';
import { RunRefusal } from './refusal';

import type { SaidOfPlitzi } from './findings/types';
import type { Notice } from './notices';
import type { TaskRoundReport } from './taskReports';

/**
 * What it was like to work with Plitzi, said by whoever worked: each agent on each round it completes, the lead as it
 * closes the run. What the records cannot say — what cost the most, what got in the way, what helped, how hard Plitzi
 * was to work with — and what the run combines: the same complaint from three agents is one thing to fix, said three
 * times, and an ease that falls from one run to the next is a change that made Plitzi harder.
 */

export interface Experience {
  /** How Plitzi was to work with, from 1 (fought it) to 5 (it got out of the way). */
  ease: number;
  /** What cost the most — time, tries, tokens — and why. */
  hardest: string;
  /** Each thing of Plitzi that got in the way: a command, a doc, an error, something missing. */
  frictions: string[];
  /** What helped: what a change must not take away. */
  helped: string[];
}

/** The scale an ease is said on, as a refusal and the help say it. */
export const EASE_SCALE = '1 (you fought Plitzi) to 5 (it got out of the way)';

/** The flags an experience is said with, as a command takes them. */
export interface ExperienceFlags {
  ease?: string;
  hardest?: string;
  friction?: string[];
  helped?: string[];
}

/**
 * The experience a command was given, or a refusal naming what is missing — said before anything runs, so a forgotten
 * flag costs no check.
 */
export const experienceFrom = (flags: ExperienceFlags, command: string): Experience => {
  const ease = flags.ease === undefined ? Number.NaN : Number(flags.ease);
  const hardest = flags.hardest?.trim() ?? '';
  const missing = [
    ...(Number.isInteger(ease) && ease >= 1 && ease <= 5 ? [] : [`--ease, ${EASE_SCALE}`]),
    ...(hardest === '' ? ['--hardest "what cost you the most, and why"'] : [])
  ];
  if (missing.length > 0) {
    throw new RunRefusal(
      'invalid',
      `${command} says what it was like to work with Plitzi: ${missing.join('; ')}${flags.ease !== undefined && missing[0]?.startsWith('--ease') ? ` (not "${flags.ease}")` : ''}. Each thing that got in your way: --friction "…" (again for each); what helped: --helped "…"`
    );
  }

  const clean = (said: readonly string[] | undefined): string[] =>
    (said ?? []).map(each => each.trim()).filter(each => each !== '');

  return { ease, hardest, frictions: clean(flags.friction), helped: clean(flags.helped) };
};

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(each => typeof each === 'string');

/** An experience as it was kept: what a file holds is read as one only when it is one. */
export const isExperience = (value: unknown): value is Experience =>
  typeof value === 'object' &&
  value !== null &&
  'ease' in value &&
  typeof value.ease === 'number' &&
  'hardest' in value &&
  typeof value.hardest === 'string' &&
  'frictions' in value &&
  strings(value.frictions) &&
  'helped' in value &&
  strings(value.helped);

/**
 * Everything said of Plitzi, together: the notices as they came, and what got in the way of each round and of the lead —
 * the findings group them, so the same complaint by several is one thing to fix (`findings/workarounds.ts`).
 */
export const saidOfPlitzi = (
  notices: readonly Notice[],
  rounds: readonly TaskRoundReport[],
  lead?: { experience: Experience; at: string }
): SaidOfPlitzi[] => [
  ...notices.map(notice => ({
    at: notice.at,
    by: notice.by,
    text: notice.text,
    ...(notice.task === undefined ? {} : { task: notice.task }),
    ...(notice.on === undefined ? {} : { on: notice.on }),
    as: 'notice' as const
  })),
  ...rounds.flatMap(round =>
    (round.experience?.frictions ?? []).map(text => ({
      at: round.to,
      by: round.agent,
      text,
      task: round.task,
      as: 'friction' as const
    }))
  ),
  ...(lead ? lead.experience.frictions.map(text => ({ at: lead.at, by: 'lead', text, as: 'friction' as const })) : [])
];

/** Something said, with everyone who said it alike. */
export interface SaidBy {
  text: string;
  by: { agent: string; task?: string; round?: number }[];
}

export interface CombinedExperience {
  /** The ease of every round said, the run's median, each agent's, and the rounds said hardest (2 or less). */
  ease: {
    median?: number;
    byAgent: { agent: string; rounds: number; median: number }[];
    lowest: { agent: string; task: string; round: number; ease: number; hardest: string }[];
  };
  /** What cost the most, what got in the way, what helped — each said alike by several grouped, the most said first. */
  hardest: SaidBy[];
  frictions: SaidBy[];
  helped: SaidBy[];
  /** The lead's own, said as it closed the run. */
  lead?: Experience;
  /** Rounds completed with nothing said of them: an older CLI's. */
  unsaid: number;
}

const median = (values: readonly number[]): number | undefined => {
  const sorted = [...values].sort((a, b) => a - b);

  return sorted.length === 0 ? undefined : sorted[Math.floor((sorted.length - 1) / 2)];
};

type Said = { text: string; agent: string; task?: string; round?: number };

const combined = (said: readonly Said[]): SaidBy[] =>
  groupAlike(said, each => each.text)
    .map(group => ({
      text: group[0].text,
      by: group.map(each => ({
        agent: each.agent,
        ...(each.task === undefined ? {} : { task: each.task }),
        ...(each.round === undefined ? {} : { round: each.round })
      }))
    }))
    .sort(
      (a, b) =>
        new Set(b.by.map(each => each.agent)).size - new Set(a.by.map(each => each.agent)).size ||
        b.by.length - a.by.length
    );

/** The run's experience: every round's and the lead's, put together — what several said once, with who said it. */
export const combineExperience = (rounds: readonly TaskRoundReport[], lead?: Experience): CombinedExperience => {
  const said = rounds.flatMap(round => (round.experience ? [{ round, experience: round.experience }] : []));
  const from = (pick: (experience: Experience) => readonly string[]): Said[] => [
    ...said.flatMap(({ round, experience }) =>
      pick(experience).map(text => ({ text, agent: round.agent, task: round.task, round: round.round }))
    ),
    ...(lead ? pick(lead).map(text => ({ text, agent: 'lead' })) : [])
  ];
  const agents = [...new Set(said.map(({ round }) => round.agent))];
  const all = [...said.map(({ experience }) => experience.ease), ...(lead ? [lead.ease] : [])];
  const runMedian = median(all);

  return {
    ease: {
      ...(runMedian === undefined ? {} : { median: runMedian }),
      byAgent: agents.map(agent => {
        const theirs = said.filter(({ round }) => round.agent === agent).map(({ experience }) => experience.ease);

        return { agent, rounds: theirs.length, median: median(theirs) ?? 0 };
      }),
      lowest: said
        .filter(({ experience }) => experience.ease <= 2)
        .map(({ round, experience }) => ({
          agent: round.agent,
          task: round.task,
          round: round.round,
          ease: experience.ease,
          hardest: experience.hardest
        }))
    },
    hardest: combined(from(experience => [experience.hardest])),
    frictions: combined(from(experience => experience.frictions)),
    helped: combined(from(experience => experience.helped)),
    ...(lead ? { lead } : {}),
    unsaid: rounds.length - said.length
  };
};

const whoSaid = (said: SaidBy): string => {
  const agents = [...new Set(said.by.map(each => each.agent))];

  return `${agents.length > 1 ? `${String(agents.length)} said it: ` : ''}${said.by
    .map(
      each =>
        `${each.agent}${each.task ? ` at ${each.task}${each.round && each.round > 1 ? ` (round ${String(each.round)})` : ''}` : ''}`
    )
    .join(', ')}`;
};

/** How many of each list are said in full: the rest are counted, and kept whole in the report's JSON. */
const SHOWN = 12;

const listed = (title: string, items: readonly SaidBy[]): string[] =>
  items.length === 0
    ? []
    : [
        `**${title}**`,
        '',
        ...items.slice(0, SHOWN).map(each => `- ${each.text} — ${whoSaid(each)}`),
        ...(items.length > SHOWN ? [`- … and ${String(items.length - SHOWN)} more`] : []),
        ''
      ];

/** The combined experience as a person reads it. */
export const experienceText = (experience: CombinedExperience): string[] => {
  const { ease } = experience;
  if (ease.median === undefined) {
    return ['Nobody said what it was like: rounds completed before experiences were asked.', ''];
  }

  return [
    `Ease of working with Plitzi, ${EASE_SCALE}: median ${String(ease.median)}${ease.byAgent.length > 0 ? ` — ${ease.byAgent.map(each => `${each.agent} ${String(each.median)} over ${String(each.rounds)} round(s)`).join(', ')}` : ''}${experience.lead ? `; the lead ${String(experience.lead.ease)}` : ''}${experience.unsaid > 0 ? ` (${String(experience.unsaid)} round(s) said nothing)` : ''}.`,
    '',
    ...(ease.lowest.length > 0
      ? [
          '**The hardest rounds** (ease 2 or less)',
          '',
          ...ease.lowest.map(
            each =>
              `- ${each.agent} at ${each.task} (round ${String(each.round)}), ${String(each.ease)}: ${each.hardest}`
          ),
          ''
        ]
      : []),
    ...listed('What cost the most', experience.hardest),
    ...listed('What got in the way', experience.frictions),
    ...listed('What helped — to keep', experience.helped)
  ];
};
