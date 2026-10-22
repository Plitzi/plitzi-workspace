import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { act, runOf, runSelf } from './shell';
import { list } from './text';
import { answering, freePort } from '../../runs/acceptance';
import { designSkipText, isDesignSkip } from '../../runs/designSkip';
import { readOwnership } from '../../runs/ownership';
import { examplePaths, pagesOf } from '../../runs/pagesOf';
import { runPaths, taskPaths } from '../../runs/paths';
import { startBeforePreview, startTaskPreview } from '../../runs/preview';
import { RunRefusal } from '../../runs/refusal';
import { loadRun, logRun } from '../../runs/run';
import { withLock } from '../../runs/store';
import { findingsOf, taskParts } from '../../runs/taskParts';
import { findTask, notReviewedIn, reviewTask } from '../../runs/tasks';
import { viewTask } from '../../runs/taskStore';
import { readTeam } from '../../runs/team';

import type { RunCommandOptions } from './shell';
import type { Preview } from '../../runs/preview';
import type { RunContext } from '../../runs/run';

/**
 * A task in review: shown, looked at, reviewed — and reassigned or reverted.
 */

/**
 * `plitzi task look`: a task in review, looked at in one command — its copy served, `page check` run from the copy
 * at 1440 and 390, and a picture of each page light at 1440 and dark at 390 — then the server stopped. What a lead does
 * by hand in four or five, between every agent's completion and its approval: the wait every agent idles through.
 */
/** What a task changed, as of its last `complete`. */
const viewTaskOf = async (
  ctx: RunContext,
  runId: string,
  taskId: string
): Promise<{ changed: string[]; designing: boolean }> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const { state } = await viewTask(loaded.paths, findTask(loaded, taskId));

  // The caller is the designer whose UI review it is: its look is set beside the run before it unless it says not.
  return { changed: state.changed ?? [], designing: state.design?.status === 'due' && state.design.by === ctx.agent };
};

export interface LookOptions extends RunCommandOptions {
  /** Clicked once each page settles, as `page check --click`: an open state looked at, not only the page at rest. */
  click?: string;
  /** The visitor's time zone (IANA) every page is read in: the machine's when left out. */
  timezone?: string;
  /**
   * The pointer put over it once each page settles, as `page check --hover`: what that changes said, and the page
   * pictured with it there — at 1440 alone, as a phone has no pointer to hover with.
   */
  hover?: string;
  /** Read in the page, as `page check --element`: each one's attributes, box and classes. */
  element?: string[];
  /** Each page set beside the run before the task — its approved work — and what changed, section by section. */
  before?: boolean;
  /** The status its pages are meant to be sent with, as `page check --status`: a 404 page looked at as one. */
  status?: number;
  /** The widths looked at and pictured, in place of 1440 and 390 — `page shot`'s, so the two are said the same. */
  width?: string;
  /** The schemes pictured at each width, in place of light at 1440 and dark at 390. */
  scheme?: string;
}

/** One page of a look beside the run before the task: how much differs, and in which sections. */
interface BeforeAfter {
  route: string;
  width: string;
  scheme: string;
  changed?: number;
  sections: string[];
  /**
   * The sections whose dress the task changed — a layer added, or one taken away — in a few words: a soft light is a
   * few levels a pixel, under the picture comparison's tolerance, and read "0.1% differs" where a page's light was
   * new (velada-dress, /artistas).
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
      dress: decorations.flatMap(section => {
        if (!isRecord(section) || typeof section.section !== 'string') {
          return [];
        }

        const added = listOf(section.extra);
        const gone = [...listOf(section.absent), ...listOf(section.missing)];

        return added.length > 0 || gone.length > 0
          ? [
              `${section.section}${added.length > 0 ? ` + ${added.join('; ')}` : ''}${gone.length > 0 ? ` − ${gone.join('; ')}` : ''}`
            ]
          : [];
      }),
      ...(typeof compare.sideBySide === 'string' ? { sideBySide: compare.sideBySide } : {})
    };
  } catch {
    return { sections: [], dress: [], problem: 'the comparison could not be read' };
  }
};

interface Checked {
  code: number;
  output: string;
}

/**
 * The page check of `task look`: its pages, and the click or hover asked — one element of one page, as `page check`
 * takes it, so with several pages each is checked with it apart (velada-dress: `task look --hover` on a task of three
 * pages was refused whole). One browser at a time: each check opens its own.
 */
/** The pages `page same --json` read the same on both servers: what a look leaves unpictured. */
export const samePaths = (output: string): string[] => {
  const line = output.trim().split('\n').at(-1) ?? '';
  try {
    const read: unknown = JSON.parse(line);
    const pages = isRecord(read) && Array.isArray(read.pages) ? (read.pages as unknown[]) : [];

    return pages.flatMap(page =>
      isRecord(page) && page.same === true && typeof page.path === 'string' ? [page.path] : []
    );
  } catch {
    return [];
  }
};

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
const picturesOf = (output: string): string[] => {
  try {
    const report: unknown = JSON.parse(output.trim().split('\n').at(-1) ?? '');
    const pictures = isRecord(report) && Array.isArray(report.pictures) ? report.pictures : [];

    return pictures.flatMap(picture => (isRecord(picture) && typeof picture.out === 'string' ? [picture.out] : []));
  } catch {
    return [];
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

/** How many of a task's parts of a page are pictured: a look is read by a model, and each picture costs it. */
const PARTS_PICTURED = 3;

export const taskLook = (taskId: string, paths: string[], options: LookOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      if (options.click && options.hover) {
        throw new RunRefusal(
          'invalid',
          'One interaction a look: --click an element, or --hover one — two looks for both'
        );
      }

      // One look of a task at a time: two served its copy at once, and the first to finish stopped the server the
      // other was picturing — a lead's look and its designer's, on la-velada's t-home-details.
      return withLock(
        taskPaths(runPaths(ctx.root, runId), taskId).lookLock,
        async () => {
          const preview = await startTaskPreview(ctx, runId, taskId, await freePort(), { quiet: true });
          // The run before it, once started: stopped with the copy's server whatever ends the look.
          const stops: (() => void)[] = [];
          try {
            if (!(await answering(preview.url, 60_000))) {
              throw new RunRefusal('invalid', `${taskId}'s copy did not answer on ${preview.url} within a minute`, {
                task: taskId
              });
            }

            // The desktop light and the phone dark — every width in both schemes when the team asks its reviews high
            // (`options.designReview`): design-2 took the other two by hand, the team's standard asking for both.
            const precision = (await readTeam(ctx.root).catch(() => undefined))?.options?.designReview;
            const asked = viewsAsked(options);
            const views: readonly (readonly [string, 'light' | 'dark'])[] = asked
              ? asked
              : precision === 'high'
                ? [
                    ['1440', 'light'],
                    ['1440', 'dark'],
                    ['390', 'light'],
                    ['390', 'dark']
                  ]
                : [
                    ['1440', 'light'],
                    ['390', 'dark']
                  ];
            // No page named: the pages its changes are drawn at, by the files that changed — else the home page.
            // Read off the copy served: a page the task makes is one to look at too.
            const { changed, designing } = await viewTaskOf(ctx, runId, taskId);
            // Every page its changes are drawn at — a shared file's too: named pages are looked at, and the others
            // said (velada-polish: design-2 looked at /combates twice, and the home its card change broke was the lead's
            // to find).
            const drawnAt = await pagesOf(preview.dir, changed);
            const owned = paths.length > 0 ? [] : drawnAt;
            const notLooked = paths.length > 0 ? drawnAt.filter(page => !paths.includes(page)) : [];
            // A part of a page others build too: its own elements pictured, its own findings kept — the rest is theirs.
            const parts = await taskParts(preview.dir, changed);
            // More parts than are pictured apart: the page whole, never the first three of them — velada-dress's t-home
            // changed six sections, and the sede, info and faq went unseen.
            const many = parts !== undefined && !parts.ownsRoot && parts.tops.length > PARTS_PICTURED;
            const clips = parts && !parts.ownsRoot && !many ? parts.tops : [];
            // A page with a parameter in its address (`/boxeadores/:slug`) is opened where the site's own links go.
            const { paths: routes, unreached } = await examplePaths(
              preview.url,
              paths.length > 0 ? paths : owned.length > 0 ? owned : ['/']
            );
            // Every page read in one visitor's zone: the machine's, unless said — and said under the pictures either way.
            const zone = options.timezone ? ['--timezone', options.timezone] : [];
            const interaction = [
              ...(options.click ? ['--click', options.click] : []),
              ...(options.hover ? ['--hover', options.hover] : [])
            ];
            // Beside the run before it: what the task moved, section by section — and that nothing else did. Started first:
            // the pages a shared file of it reaches are read on both before any is pictured.
            const before =
              (options.before ?? designing)
                ? await startBeforePreview(ctx, runId, taskId, await freePort())
                : undefined;
            if (before) {
              stops.push(() => {
                before.stop();
              });
            }

            if (before && !(await answering(before.url, 60_000))) {
              throw new RunRefusal(
                'invalid',
                `The run before ${taskId} did not answer on ${before.url} within a minute`,
                {
                  task: taskId
                }
              );
            }

            // A page only a shared file of it reaches, drawn the same as the run before it — every element, box and style
            // read on both — is not pictured: velada-fidelity's look pictured nine pages for two tokens added (204 s).
            const unchanged = new Set<string>();
            if (before && paths.length === 0) {
              const ownership = await readOwnership(preview.dir);
              const direct = await pagesOf(
                preview.dir,
                changed.filter(file => ownership.ownerOf.has(file))
              );
              const { paths: reachedOnly } = await examplePaths(
                preview.url,
                owned.filter(page => !direct.includes(page))
              );
              if (reachedOnly.length > 0) {
                const same = await runSelf(preview.dir, [
                  'page',
                  'same',
                  ...reachedOnly,
                  '--url',
                  preview.url,
                  '--than',
                  before.url,
                  '--json'
                ]);
                samePaths(same.output).forEach(page => unchanged.add(page));
              }
            }

            const pictured = routes.filter(route => !unchanged.has(route));
            const checkOf = (pages: readonly string[], also: readonly string[]) =>
              runSelf(preview.dir, [
                'page',
                'check',
                ...pages,
                '--width',
                [...new Set(views.map(([width]) => width))].join(','),
                '--url',
                preview.url,
                ...zone,
                ...(options.status === undefined ? [] : ['--status', String(options.status)]),
                ...also,
                ...(options.element ?? []).flatMap(id => ['--element', id])
              ]);
            const check = await checkWithInteraction(routes, interaction, checkOf);
            const shots: string[] = [];
            for (const route of pictured) {
              for (const clip of clips.length > 0 ? clips : [undefined]) {
                for (const [width, scheme] of views) {
                  const name = `${taskId}${route === '/' ? '-home' : `-${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`}${clip ? `-${clip}` : ''}-${width}-${scheme}.png`;
                  const out = path.join(runPaths(ctx.root, runId).shots, name);
                  const shot = await runSelf(preview.dir, [
                    'page',
                    'shot',
                    route,
                    '--url',
                    preview.url,
                    ...zone,
                    '--width',
                    width,
                    '--scheme',
                    scheme,
                    ...(clip ? ['--clip', clip] : []),
                    '-o',
                    out
                  ]);
                  if (shot.code === 0) {
                    shots.push(out);
                  }

                  // Pictured apart: an element not on the page loses the hover's picture, not the page's at rest.
                  if (options.hover !== undefined && scheme === 'light') {
                    const hovered = await runSelf(preview.dir, [
                      'page',
                      'shot',
                      route,
                      '--url',
                      preview.url,
                      ...zone,
                      '--width',
                      width,
                      '--scheme',
                      scheme,
                      ...(clip ? ['--clip', clip] : []),
                      '--steps',
                      `hover ${JSON.stringify(options.hover)}; wait 600; shot hovering ${options.hover}`,
                      '--json',
                      '-o',
                      out.replace(/\.png$/, '-hover.png')
                    ]);
                    shots.push(...(hovered.code === 0 ? picturesOf(hovered.output) : []));
                  }
                }
              }
            }

            const compared: BeforeAfter[] = [];
            const stoppedUnder: string[] = [];
            try {
              for (const route of before ? pictured : []) {
                for (const [width, scheme] of views) {
                  // Named for what it is — the page after the task, set beside the run before it in `-after-compare.png`:
                  // `-before.png` was the after picture (velada-polish's design-1, the same md5 as the look's own).
                  const name = `${taskId}${route === '/' ? '-home' : `-${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`}-${width}-${scheme}-after.png`;
                  const shot = await runSelf(preview.dir, [
                    'page',
                    'shot',
                    route,
                    '--url',
                    preview.url,
                    ...zone,
                    '--compare',
                    before?.url ?? '',
                    '--width',
                    width,
                    '--scheme',
                    scheme,
                    '--json',
                    '-o',
                    path.join(runPaths(ctx.root, runId).shots, name)
                  ]);
                  compared.push({ route, width, scheme, ...comparedOf(shot.output) });
                }
              }
            } finally {
              // Stopped under the look, it is said with why, before this look stops it: a picture that failed for it
              // is no finding of the task's (velada-polish: every picture failed, the servers' output thrown away).
              stoppedUnder.push(
                ...stoppedText("its copy's server", preview),
                ...stoppedText('the run before it', before)
              );
              before?.stop();
            }

            const kept = parts && !parts.ownsRoot ? findingsOf(check.output.trim(), parts) : undefined;

            const notReviewed = await notReviewedIn(ctx, runId, taskId);
            await logRun(ctx, runPaths(ctx.root, runId), {
              action: 'look',
              task: taskId,
              paths: routes,
              ok: check.code === 0,
              ...(kept && kept.apart > 0 ? { apart: kept.apart } : {})
            });

            return {
              task: taskId,
              url: preview.url,
              ok: check.code === 0,
              check: kept?.text ?? check.output.trim(),
              ...(kept && kept.apart > 0 ? { apart: kept.apart } : {}),
              ...(clips.length > 0 ? { parts: clips } : {}),
              ...(many ? { wholeFor: parts.tops } : {}),
              ...(unreached.length > 0 ? { unreached } : {}),
              shots,
              ...(unchanged.size > 0 ? { unchanged: [...unchanged] } : {}),
              timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
              ...(compared.length > 0 ? { compared } : {}),
              ...(preview.borrowed === undefined ? {} : { borrowed: preview.borrowed }),
              ...(stoppedUnder.length > 0 ? { stoppedUnder } : {}),
              ...(notLooked.length > 0 ? { notLooked } : {}),
              ...(notReviewed.length > 0 ? { notReviewed } : {})
            };
          } finally {
            stops.forEach(stop => {
              stop();
            });
            preview.stop();
          }
        },
        { waitMs: 10 * 60_000, ttlMs: 15 * 60_000 }
      );
    },
    looked =>
      [
        chalk.bold(
          looked.borrowed === undefined
            ? `${looked.task}, as it went to review (served from its copy, now stopped):`
            : `${looked.task}, as its copy is now — served by ${looked.borrowed.by === 'agent' ? "its agent's own server" : 'the server a picture of it kept'} on :${String(looked.borrowed.port)}, left running (it holds the copy's state):`
        ),
        ...(looked.stoppedUnder ?? []).map(line => chalk.yellow(`⚠ ${line}`)),
        ...(looked.notLooked
          ? [
              chalk.yellow(
                `⚠ Its changes are drawn at ${list(looked.notLooked)} too — a file it changed is read there — not looked at: plitzi task look ${looked.task}${looked.notLooked.map(page => ` ${page}`).join('')} --before`
              )
            ]
          : []),
        ...(looked.notReviewed
          ? [
              chalk.yellow(
                `⚠ Its copy changed after it went to review: ${list(looked.notReviewed)} — what is served is not what an approval merges (that is what went to review). Ask it why (plitzi task message ${looked.task} "…"), or send it back (--changes) to complete again`
              )
            ]
          : []),
        ...(looked.parts
          ? [`Its part of the page, pictured alone: ${looked.parts.join(', ')} — the rest is other tasks'`]
          : []),
        ...(looked.wholeFor
          ? [`Its parts — ${looked.wholeFor.join(', ')} — pictured with the page whole: too many to picture apart`]
          : []),
        ...(looked.unreached
          ? [
              chalk.yellow(
                `⚠ No link of the site reaches ${list(looked.unreached)}: not looked at — name one: plitzi task look ${looked.task} <its address>`
              )
            ]
          : []),
        looked.check,
        ...(looked.apart ? [chalk.dim(`  · ${String(looked.apart)} finding(s) on other tasks' parts left out`)] : []),
        ...(looked.unchanged
          ? [
              chalk.dim(
                `Drawn the same as the run before it — every element, box and style read on both, so not pictured: ${list(looked.unchanged)} (a shared file of it reaches them; plitzi task look ${looked.task} <page> pictures one anyway)`
              )
            ]
          : []),
        ...(looked.shots.length > 0
          ? [
              `Pictures — a browser in ${looked.timezone}, its language en-US (--timezone for another zone):`,
              ...looked.shots.map(each => `  ${each}`)
            ]
          : ['No picture could be taken.']),
        ...(looked.compared
          ? [
              "Beside the run before it (its approved work, without this task) — motion reduced and another site's pictures stood in for on both sides, so only what the project changed differs; each side by side (after | before) in its -after-compare.png:",
              ...looked.compared.map(each =>
                each.problem
                  ? chalk.yellow(`  ${each.route} at ${each.width} ${each.scheme}: ${each.problem}`)
                  : `  ${each.route} at ${each.width} ${each.scheme}: ${(each.changed === 0 || each.sections.length === 0) && each.dress.length === 0 ? 'nothing changed' : `${String(each.changed ?? 0)}% differs${each.sections.length > 0 ? ` — ${each.sections.join(', ')}` : ''}${each.dress.length > 0 ? ` · its dress: ${each.dress.join(' · ')}` : ''}`}${each.sideBySide ? chalk.dim(` · ${each.sideBySide}`) : ''}`
              )
            ]
          : []),
        `Then: plitzi task review ${looked.task} --approve | --changes "…"`
      ].join('\n')
  );

export interface ReviewOptions extends RunCommandOptions {
  approve?: boolean;
  /** Approve over a change made in the project while the task worked: its version wins, said and the other kept. */
  overwrite?: boolean;
  /** Approve with a change made in the project while the task worked: the two put together line by line. */
  merge?: boolean;
  changes?: string;
  on?: string;
  file?: string;
  /** Approve a task whose UI waits for a designer's review without it, saying why: kept in its state and the report. */
  skipDesign?: string;
  /** With --approve: what the reviewer saw and does not ask to change — kept with the task, read by the lead. */
  note?: string;
}

export const taskReview = (taskId: string, options: ReviewOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      if (options.approve === (options.changes !== undefined)) {
        throw new RunRefusal('invalid', 'Review with --approve, or with --changes "what to change" — one of them');
      }

      if (options.note !== undefined && !options.approve) {
        throw new RunRefusal('invalid', '--note goes with --approve: with --changes, what to change is the note');
      }

      if (options.skipDesign !== undefined && !isDesignSkip(options.skipDesign)) {
        throw new RunRefusal(
          'invalid',
          `--skip-design says why the lead approves without the designer's review: --skip-design lead (you looked at its UI yourself, as a designer would — both schemes, the phone width) or --skip-design no-ui (it changes nothing a visitor sees), not "${options.skipDesign}"`
        );
      }

      if (options.overwrite && options.merge) {
        throw new RunRefusal(
          'invalid',
          'A change in the project is merged (--merge) or written over (--overwrite): one of them'
        );
      }

      return reviewTask(
        ctx,
        await runOf(ctx, options),
        taskId,
        options.approve ? 'approve' : 'changes',
        options.changes === undefined
          ? options.note === undefined
            ? []
            : [{ note: options.note }]
          : [
              {
                note: options.changes,
                ...(options.on ? { element: options.on } : {}),
                ...(options.file ? { file: options.file } : {})
              }
            ],
        options.merge ? 'merge' : options.overwrite ? 'overwrite' : 'refuse',
        isDesignSkip(options.skipDesign) ? { skipDesign: options.skipDesign } : {}
      );
    },
    reviewed =>
      reviewed.design === 'approved'
        ? `${taskId}'s UI approved: the lead reviews it now and gives the final word. Next: plitzi task next --role designer --follow --take`
        : reviewed.verdict === 'approve'
          ? [
              `${taskId} approved: ${list(reviewed.merged ?? [])} in the run's work.`,
              ...(reviewed.design === 'skipped' ? [`  · ${designSkipText(reviewed.designSkip)}`] : []),
              ...((reviewed.joined ?? []).length > 0
                ? [`  Put together with the change made in the project meanwhile: ${list(reviewed.joined ?? [])}`]
                : []),
              ...((reviewed.fulfilled ?? []).length > 0
                ? [`  Its requests went in: ${list(reviewed.fulfilled ?? [])} — a holder's copy brings them`]
                : []),
              ...(reviewed.unmerged
                ? [
                    chalk.yellow(
                      `  ⚠ Its request on ${list(reviewed.unmerged.files)} did not go in — ${reviewed.unmerged.reason}: an integration task applies it`
                    )
                  ]
                : []),
              ...((reviewed.granted ?? []).length > 0 ? [`  Handed on: ${list(reviewed.granted ?? [])}`] : []),
              ...((reviewed.ready ?? []).length > 0 ? [`  Ready now: ${list(reviewed.ready ?? [])}`] : []),
              ...(reviewed.previewProblem
                ? [
                    chalk.yellow(
                      `  ⚠ The run's preview did not take it in: ${reviewed.previewProblem} — restart it (npm run start:preview)`
                    )
                  ]
                : []),
              ...notReviewedText(reviewed.notReviewed, 'approve')
            ].join('\n')
          : [
              reviewed.toLead
                ? `${taskId}: ${String(reviewed.round)} rounds of changes — blocked for the lead to decide.`
                : `${taskId}: changes requested (round ${String(reviewed.round)}); it goes back to the same task.`,
              ...(reviewed.goesFirst
                ? [`  ${list(reviewed.goesFirst)} wait on it: its agent, at another task, was told it goes first`]
                : []),
              ...notReviewedText(reviewed.notReviewed, 'changes')
            ].join('\n')
  );

/** What its copy holds that the review did not see — written after `complete`: kept out, and said. */
const notReviewedText = (files: readonly string[] | undefined, verdict: 'approve' | 'changes'): string[] =>
  files && files.length > 0
    ? [
        `  ⚠ Written in its copy after it went to review, so not what you reviewed: ${list(files)} — ${
          verdict === 'approve'
            ? 'what went to review is what was merged; that went with its copy'
            : 'it stays in its copy, and goes to review with its next complete'
        }`
      ]
    : [];
