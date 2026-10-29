import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { audienceAt } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { writeJson } from '../../../runs/core/files';
import { RunRefusal } from '../../../runs/core/refusal';
import { viewTask } from '../../../runs/core/taskStore';
import { authoredSpace } from '../../../runs/plan/expectations';
import { examplePaths } from '../../../runs/plan/pagesOf';
import { loadRun } from '../../../runs/run';
import { findTask } from '../../../runs/tasks';
import { checkKey } from '../../../runs/tasks/checked';
import { checkAccount } from '../../page/check/account';
import { readsAsMember } from '../../page/visit';
import { runSelf } from '../shell';

import type { LookOptions } from './lookOptions';
import type { Preview } from '../../../runs/copies/preview';
import type { RunContext } from '../../../runs/run';

/**
 * The pages of a look the space declares for signed-in visitors alone, and the account the project names to read them
 * as (`PLITZI_CHECK_USER`) — or why there is none. A run's look read `/moderation` as a guest and failed it as "sent the
 * browser to /", the task's UI never seen.
 */
export const visitorsOnly = async (
  dir: string,
  pages: readonly string[]
): Promise<{ pages: string[]; as?: string; problem?: string } | undefined> => {
  const authored = await authoredSpace(dir);
  // Members only by the router, a gate in place that shows a guest another page (`gated`: a run's /rooms/new), or
  // kept for some permissions (the server withholds those): read as one of them — `--guest` reads a guest's.
  const guarded = authored ? pages.filter(each => readsAsMember(authored, each)) : [];
  if (guarded.length === 0) {
    return undefined;
  }

  const account = await checkAccount(dir);

  return account === undefined
    ? { pages: guarded }
    : 'problem' in account
      ? { pages: guarded, problem: account.problem }
      : { pages: guarded, as: account.username };
};

/**
 * The pages only a signed-out visitor opens — the router asked as both (`audienceAt`): a look signed in reads them as a
 * guest. A run's looks read /sign-in signed in, were sent home, and pictured Home.
 */
export const signedOutOnly = async (dir: string, pages: readonly string[]): Promise<string[]> => {
  const authored = await authoredSpace(dir);

  return authored ? pages.filter(each => audienceAt(authored.schema, each) === 'guests') : [];
};

/** The pages a page check's answer (`--json`) says sent the browser elsewhere — to the sign-in, for a guest. */
export const redirectedPaths = (output: string): string[] => {
  const line = output.trim().split('\n').at(-1) ?? '';
  try {
    const read: unknown = JSON.parse(line);

    return Array.isArray(read)
      ? [
          ...new Set(
            read.flatMap(report =>
              isRecord(report) &&
              typeof report.path === 'string' &&
              Array.isArray(report.issues) &&
              report.issues.some(issue => isRecord(issue) && issue.code === 'redirected')
                ? [report.path]
                : []
            )
          )
        ]
      : [];
  } catch {
    return [];
  }
};

/**
 * Who a look reads its pages as, when nobody said: the project's account (`PLITZI_CHECK_USER`) for the pages the
 * space keeps for signed-in visitors — and for those whose own flows send a guest to the sign-in, found by one quick
 * check as a guest. A run's designers looked at /settings and /messages as guests five times: those pages declare no
 * access, they redirect, and their look pictured the sign-in.
 */
export const readAsFor = async (
  dir: string,
  url: string,
  pages: readonly string[],
  acceptanceAt: readonly string[]
): Promise<{ pages: string[]; as?: string; problem?: string } | undefined> => {
  const declared = await visitorsOnly(dir, pages);
  if (declared?.as !== undefined || (await checkAccount(dir)) === undefined) {
    return declared;
  }

  const { paths: routes } = await examplePaths(url, pages, acceptanceAt);
  const sent =
    routes.length === 0
      ? []
      : redirectedPaths(
          (await runSelf(dir, ['page', 'check', ...routes, '--width', '1440', '--url', url, '--guest', '--json']))
            .output
        );
  if (sent.length === 0) {
    return declared;
  }

  const account = await checkAccount(dir);
  const guarded = [...new Set([...(declared?.pages ?? []), ...sent])];

  return account === undefined
    ? { pages: guarded }
    : 'problem' in account
      ? { pages: guarded, problem: account.problem }
      : { pages: guarded, as: account.username };
};

/**
 * The routes the run before the task does not have — they answer it 404: pages the task adds, pictured alone. Set
 * beside the run before, a run's /messages was compared with the 404 page and read "16% differs", the 404's dress
 * listed as what the new page lacks.
 */
export const newSinceBefore = async (beforeUrl: string, routes: readonly string[]): Promise<Set<string>> => {
  const answers = await Promise.all(
    routes.map(async route => {
      const answer = await fetch(new URL(route, beforeUrl), { redirect: 'manual' }).catch(() => undefined);

      return answer?.status === 404 ? [route] : [];
    })
  );

  return new Set(answers.flat());
};

/** One page of a look beside the run before the task: how much differs, and in which sections. */
export interface BeforeAfter {
  route: string;
  width: string;
  scheme: string;
  changed?: number;
  sections: string[];
  /**
   * The sections whose dress the task changed — a layer added, or one taken away — in a few words: a soft light is a
   * few levels a pixel, under the picture comparison's tolerance, and read "0.1% differs" where a page's light was
   * new.
   */
  dress: string[];
  sideBySide?: string;
  problem?: string;
}

/** A look's server that stopped while it looked — why, and its last lines — or nothing while it serves. */
export const stoppedText = (what: string, served: Pick<Preview, 'stopped'> | undefined): string[] => {
  const stopped = served?.stopped();

  return stopped
    ? [
        `${what} stopped while it was looked at (${stopped.why}): what failed after is no finding of the task's${stopped.said.length > 0 ? ` — it said last: ${stopped.said.join(' | ')}` : ''}`
      ]
    : [];
};

/** A list said once an item, the times it repeats beside it: `radial-gradient(…) ×4`. */
const counted = (items: readonly string[]): string[] => {
  const times = new Map<string, number>();
  items.forEach(item => times.set(item, (times.get(item) ?? 0) + 1));

  return [...times].map(([item, count]) => (count > 1 ? `${item} ×${String(count)}` : item));
};

/**
 * The sections whose dress changed, a change once with every section it is in: a run's look listed one gradient
 * again and again, section by section and within one — a wall of text a designer read for one change.
 */
const dressOf = (decorations: readonly unknown[], listOf: (value: unknown) => string[]): string[] => {
  const bySaid = new Map<string, string[]>();
  for (const section of decorations) {
    if (!isRecord(section) || typeof section.section !== 'string') {
      continue;
    }

    const added = counted(listOf(section.extra));
    const gone = counted([...listOf(section.absent), ...listOf(section.missing)]);
    if (added.length > 0 || gone.length > 0) {
      const said = `${added.length > 0 ? `+ ${added.join('; ')}` : ''}${added.length > 0 && gone.length > 0 ? ' ' : ''}${gone.length > 0 ? `− ${gone.join('; ')}` : ''}`;
      bySaid.set(said, [...(bySaid.get(said) ?? []), section.section]);
    }
  }

  return [...bySaid].map(([said, sections]) => `${sections.join(', ')} ${said}`);
};

/** What `page shot --compare --json` answered: how much differs, by section, and where the pictures went. */
export const comparedOf = (output: string): Omit<BeforeAfter, 'route' | 'width' | 'scheme'> => {
  const at = output.indexOf('{');
  try {
    const answer: unknown = at === -1 ? undefined : JSON.parse(output.slice(at));
    const compare = isRecord(answer) && isRecord(answer.compare) ? answer.compare : undefined;
    if (!compare) {
      return { sections: [], dress: [], problem: output.trim().split('\n').at(-1) ?? 'no comparison' };
    }

    const regions = Array.isArray(compare.regions) ? compare.regions : [];
    const decorations = Array.isArray(compare.decorations) ? compare.decorations : [];
    // Here is the task's page, there the run before it: what is only here it added, what is only there it took away.
    const listOf = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((each): each is string => typeof each === 'string') : [];

    return {
      ...(typeof compare.changed === 'number' ? { changed: compare.changed } : {}),
      sections: regions.flatMap(region =>
        isRecord(region) && typeof region.name === 'string' && typeof region.changed === 'number' && region.changed > 0
          ? [`${region.name} ${String(region.changed)}%`]
          : []
      ),
      dress: dressOf(decorations, listOf),
      ...(typeof compare.sideBySide === 'string' ? { sideBySide: compare.sideBySide } : {})
    };
  } catch {
    return { sections: [], dress: [], problem: 'the comparison could not be read' };
  }
};

/**
 * Each part a `page shot --within a,b` compared, read off its answer — a part's own picture, and its comparison or why it
 * could not be pictured. One of a single part is read as `comparedOf` reads it.
 */
type PartRead = { compared: Omit<BeforeAfter, 'route' | 'width' | 'scheme'>; shot?: string };

export const partsComparedOf = (output: string): PartRead[] => {
  const at = output.indexOf('{');
  let answer: unknown;
  try {
    answer = at === -1 ? undefined : JSON.parse(output.slice(at));
  } catch {
    answer = undefined;
  }

  const parts = isRecord(answer) && Array.isArray(answer.parts) ? answer.parts : undefined;
  if (!parts) {
    return [{ compared: comparedOf(output) }];
  }

  return parts.flatMap((each): PartRead[] => {
    if (!isRecord(each) || typeof each.part !== 'string') {
      return [];
    }

    if (typeof each.problem === 'string') {
      return [
        {
          compared: { sections: [], dress: [], problem: `${each.part}: ${each.problem}` },
          ...(typeof each.own === 'string' ? { shot: each.own } : {})
        }
      ];
    }

    const compare = isRecord(each.compare) ? each.compare : {};
    const changed = typeof compare.changed === 'number' ? compare.changed : undefined;

    return [
      {
        compared: {
          ...(changed === undefined ? {} : { changed }),
          sections: changed ? [`${each.part} ${String(changed)}%`] : [],
          dress: [],
          ...(typeof compare.sideBySide === 'string' ? { sideBySide: compare.sideBySide } : {})
        },
        ...(typeof each.own === 'string' ? { shot: each.own } : {})
      }
    ];
  });
};

export interface Checked {
  code: number;
  output: string;
}

/**
 * The page check of `task look`: its pages, and the click or hover asked — one element of one page, as `page check`
 * takes it, so with several pages each is checked with it apart (`task look --hover` on a task of three
 * pages was refused whole). One browser at a time: each check opens its own.
 */
export const checkWithInteraction = async (
  routes: readonly string[],
  interaction: readonly string[],
  checkOf: (pages: readonly string[], also: readonly string[]) => Promise<Checked>
): Promise<Checked> => {
  if (interaction.length === 0 || routes.length === 1) {
    return checkOf(routes, interaction);
  }

  const all = await checkOf(routes, []);
  const each: Checked[] = [];
  for (const route of routes) {
    each.push(await checkOf([route], interaction));
  }

  return {
    code: [all, ...each].some(one => one.code !== 0) ? 1 : 0,
    output: [
      all.output.trim(),
      ...each.map((one, index) => `With ${interaction.join(' ')} on ${routes[index]}:\n${one.output.trim()}`)
    ].join('\n')
  };
};

/** The pictures a `page shot --steps --json` took after the first: the hovered page, for a look. */
export const picturesOf = (output: string): string[] => {
  try {
    const report: unknown = JSON.parse(output.trim().split('\n').at(-1) ?? '');
    const pictures = isRecord(report) && Array.isArray(report.pictures) ? report.pictures : [];

    return pictures.flatMap(picture => (isRecord(picture) && typeof picture.out === 'string' ? [picture.out] : []));
  } catch {
    return [];
  }
};

/**
 * The picture a shot says it took, as its reader reads it: what its steps left — the last picture — when it played
 * some, `out` being the page before them (a run's designer was shown an empty TARGET LOCK by a look that said the
 * dossier was drawn); a tall page's parts (`tiles`) when it was cut into them — a phone's whole page shrank to 97 px
 * wide in a viewer — else the picture.
 */
export const readablePictures = (output: string, out: string): string[] => {
  const after = picturesOf(output).at(-1);
  if (after !== undefined) {
    return [after];
  }

  try {
    const report: unknown = JSON.parse(output.trim().split('\n').at(-1) ?? '');
    const tiles = isRecord(report) && Array.isArray(report.tiles) ? report.tiles : [];
    const parts = tiles.filter((tile): tile is string => typeof tile === 'string');

    return parts.length > 0 ? parts : [out];
  } catch {
    return [out];
  }
};

const WIDTHS = /^\d{3,4}(,\d{3,4})*$/;

/**
 * The widths and schemes asked for (`--width 1440,768`, `--scheme light,dark`): each width in each scheme — none asked,
 * the team's. Refused when they are not widths or schemes, never pictured on a guess.
 */
export const viewsAsked = (
  options: Pick<LookOptions, 'width' | 'scheme'>
): [string, 'light' | 'dark'][] | undefined => {
  if (options.width === undefined && options.scheme === undefined) {
    return undefined;
  }

  const widths = options.width ?? '1440,390';
  if (!WIDTHS.test(widths)) {
    throw new RunRefusal('invalid', `--width ${widths}: widths in px, separated by commas (1440,390)`);
  }

  const schemes = (options.scheme ?? 'light,dark').split(',').map(each => each.trim());
  const valid = schemes.filter((each): each is 'light' | 'dark' => each === 'light' || each === 'dark');
  if (valid.length !== schemes.length || valid.length === 0) {
    throw new RunRefusal('invalid', `--scheme ${options.scheme ?? ''}: light, dark, or both (light,dark)`);
  }

  return widths.split(',').flatMap(width => valid.map(scheme => [width, scheme] as [string, 'light' | 'dark']));
};

/**
 * The views a look takes by default, held to the schemes the space declares: a scheme it has not is pictured in one it
 * has, once — a run's space is light only, and every look pictured its phone in a dark it never shows.
 */
export const toDeclared = (
  views: readonly (readonly [string, 'light' | 'dark'])[],
  declared: readonly ('light' | 'dark')[]
): (readonly [string, 'light' | 'dark'])[] => {
  if (declared.length === 0) {
    return [...views];
  }

  const held = views.map(([width, scheme]) => [width, declared.includes(scheme) ? scheme : declared[0]] as const);

  return held.filter(([width, scheme], index) => held.findIndex(([w, s]) => w === width && s === scheme) === index);
};

/**
 * With `PLITZI_TIMING=1`, each phase of a look said with how long it took, on stderr: where a look spends its time —
 * a run's looks took 50 s, and nothing said which part.
 */
export const phases = (): ((what: string) => void) => {
  let last = Date.now();

  return what => {
    if (process.env.PLITZI_TIMING === '1') {
      process.stderr.write(chalk.dim(`· ${String(Date.now() - last)} ms: ${what}\n`));
    }

    last = Date.now();
  };
};

/** How many of a look's commands run at once — each a browser: enough to overlap, few enough not to starve the servers. */
export const LOOK_AT_ONCE = 3;

/** How long a look stands for the same look asked again, nothing changed. */
export const LOOKED_FOR_MS = 30 * 60_000;

/** What a look depends on: the task's files as they are, the run's approved work, its ask — and what the look asks. */
export const lookKey = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  asked: Record<string, unknown>
): Promise<string> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = findTask(loaded, taskId);
  const { state, paths } = await viewTask(loaded.paths, task);
  const checked = await checkKey(loaded, paths, task, state.changed ?? []);

  return createHash('sha256')
    .update(JSON.stringify({ checked, status: state.status, round: state.round, asked }))
    .digest('hex');
};

const lookedFile = (cache: string): string => path.join(cache, 'looked.json');

type Kept = Record<string, { at: string; text: string; state?: string; pages?: string[] }>;

/** The looks kept, by key, the ones past `LOOKED_FOR_MS` left out. */
const keptLooks = async (cache: string, now: Date): Promise<Kept> => {
  const read: unknown = await fs
    .readFile(lookedFile(cache), 'utf-8')
    .then(text => JSON.parse(text) as unknown)
    .catch(() => undefined);

  return isRecord(read)
    ? Object.fromEntries(
        Object.entries(read).flatMap(([key, look]) =>
          isRecord(look) &&
          typeof look.at === 'string' &&
          typeof look.text === 'string' &&
          now.getTime() - Date.parse(look.at) < LOOKED_FOR_MS
            ? [
                [
                  key,
                  {
                    at: look.at,
                    text: look.text,
                    ...(typeof look.state === 'string' ? { state: look.state } : {}),
                    ...(Array.isArray(look.pages)
                      ? { pages: look.pages.filter((page): page is string => typeof page === 'string') }
                      : {})
                  }
                ]
              ]
            : []
        )
      )
    : {};
};

/**
 * A look said, kept under its key — every look of the task, not only the last: a round's two looks of different pages
 * each stand ("each look forgets the pages the other covered").
 */
export const keepLook = async (
  cache: string,
  key: string,
  text: string,
  now: Date,
  seen?: { state: string; pages: readonly string[] }
): Promise<void> =>
  writeJson(lookedFile(cache), {
    ...(await keptLooks(cache, now)),
    [key]: { at: now.toISOString(), text, ...(seen ? { state: seen.state, pages: [...seen.pages] } : {}) }
  });

/**
 * The pages looked at already with the task as it is now (`state`: its `lookKey` asking nothing) — a round's second
 * look, of another page, warned that the first one's pages were "not looked at".
 */
export const pagesLooked = async (cache: string, state: string, now: Date): Promise<string[]> => [
  ...new Set(
    Object.values(await keptLooks(cache, now)).flatMap(look => (look.state === state ? (look.pages ?? []) : []))
  )
];

/** The look that still stands for `key`, when one does. */
export const keptLook = async (
  cache: string,
  key: string,
  now: Date
): Promise<{ at: string; text: string } | undefined> => {
  const kept = await keptLooks(cache, now);

  return Object.hasOwn(kept, key) ? kept[key] : undefined;
};

/**
 * A picture's clip as `page shot` takes it: a part drawn more than once — a component's instances — pictured where the
 * most of the task's elements show (`--showing`), never one of several parts at once.
 */
export const clipArgs = (clip: string | undefined, showing: readonly string[]): string[] =>
  clip === undefined
    ? []
    : ['--within', clip, ...(showing.length > 0 && !clip.includes(',') ? ['--showing', showing.join(',')] : [])];
