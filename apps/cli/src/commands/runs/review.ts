import path from 'node:path';

import chalk from 'chalk';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { act, runOf, runSelf } from './shell';
import { list, messageLines, outsideLines, secondRunText } from './text';
import { answering, freePort } from '../../runs/acceptance';
import { designSkipText, isDesignSkip } from '../../runs/designSkip';
import { acceptanceText } from '../../runs/model';
import { examplePaths, pagesOf } from '../../runs/pagesOf';
import { runPaths, taskPaths } from '../../runs/paths';
import { startBeforePreview, startTaskPreview } from '../../runs/preview';
import { RunRefusal } from '../../runs/refusal';
import { loadRun, logRun } from '../../runs/run';
import { FROM_TEXT, showTask, showTaskFile } from '../../runs/show';
import { withLock } from '../../runs/store';
import { findingsOf, taskParts } from '../../runs/taskParts';
import { findTask, notReviewedIn, reassignTask, revertTask, reviewTask } from '../../runs/tasks';
import { viewTask } from '../../runs/taskStore';
import { readTeam } from '../../runs/team';

import type { RunCommandOptions } from './shell';
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
const viewTaskOf = async (ctx: RunContext, runId: string, taskId: string): Promise<{ changed: string[] }> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });

  return { changed: (await viewTask(loaded.paths, findTask(loaded, taskId))).state.changed ?? [] };
};

export interface LookOptions extends RunCommandOptions {
  /** Clicked once each page settles, as `page check --click`: an open state looked at, not only the page at rest. */
  click?: string;
  /**
   * The pointer put over it once each page settles, as `page check --hover`: what that changes said, and the page
   * pictured with it there — at 1440 alone, as a phone has no pointer to hover with.
   */
  hover?: string;
  /** Read in the page, as `page check --element`: each one's attributes, box and classes. */
  element?: string[];
  /** Each page set beside the run before the task — its approved work — and what changed, section by section. */
  before?: boolean;
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
          try {
            if (!(await answering(preview.url, 60_000))) {
              throw new RunRefusal('invalid', `${taskId}'s copy did not answer on ${preview.url} within a minute`, {
                task: taskId
              });
            }

            // The desktop light and the phone dark — every width in both schemes when the team asks its reviews high
            // (`options.designReview`): design-2 took the other two by hand, the team's standard asking for both.
            const precision = (await readTeam(ctx.root).catch(() => undefined))?.options?.designReview;
            const views: readonly (readonly ['1440' | '390', 'light' | 'dark'])[] =
              precision === 'high'
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
            const changed = (await viewTaskOf(ctx, runId, taskId)).changed;
            const owned = paths.length > 0 ? [] : await pagesOf(preview.dir, changed);
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
            const interaction = [
              ...(options.click ? ['--click', options.click] : []),
              ...(options.hover ? ['--hover', options.hover] : [])
            ];
            const checkOf = (pages: readonly string[], also: readonly string[]) =>
              runSelf(preview.dir, [
                'page',
                'check',
                ...pages,
                '--width',
                '1440,390',
                '--url',
                preview.url,
                ...also,
                ...(options.element ?? []).flatMap(id => ['--element', id])
              ]);
            const check = await checkWithInteraction(routes, interaction, checkOf);
            const shots: string[] = [];
            for (const route of routes) {
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

            // Beside the run before it: what the task moved, section by section — and that nothing else did.
            const before = options.before ? await startBeforePreview(ctx, runId, taskId, await freePort()) : undefined;
            const compared: BeforeAfter[] = [];
            try {
              if (before && !(await answering(before.url, 60_000))) {
                throw new RunRefusal(
                  'invalid',
                  `The run before ${taskId} did not answer on ${before.url} within a minute`,
                  {
                    task: taskId
                  }
                );
              }

              for (const route of before ? routes : []) {
                for (const [width, scheme] of views) {
                  const name = `${taskId}${route === '/' ? '-home' : `-${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`}-${width}-${scheme}-before.png`;
                  const shot = await runSelf(preview.dir, [
                    'page',
                    'shot',
                    route,
                    '--url',
                    preview.url,
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
              ...(compared.length > 0 ? { compared } : {}),
              ...(preview.borrowed === undefined ? {} : { borrowed: preview.borrowed }),
              ...(notReviewed.length > 0 ? { notReviewed } : {})
            };
          } finally {
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
            : `${looked.task}, as its copy is now — served by its agent's own server on :${String(looked.borrowed)}, left running (it holds the copy's state):`
        ),
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
        ...(looked.shots.length > 0
          ? ['Pictures:', ...looked.shots.map(each => `  ${each}`)]
          : ['No picture could be taken.']),
        ...(looked.compared
          ? [
              'Beside the run before it (its approved work, without this task):',
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

export const taskReassign = (taskId: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => reassignTask(ctx, await runOf(ctx, options), taskId),
    reassigned =>
      `${taskId} is ready again${reassigned.from ? `; ${reassigned.from}'s token is revoked` : ''}. ${
        reassigned.reviewedRound === undefined
          ? 'It was never reviewed: it starts from scratch.'
          : `It starts again from the version its review ${String(reassigned.reviewedRound)} saw.`
      } What its agent started in the copy — its own server — is not the CLI's to stop: stop it.${
        reassigned.released.length > 0
          ? ` Let go of what it held by turns: ${reassigned.released.join(', ')}${reassigned.granted.length > 0 ? ` — to ${reassigned.granted.join(', ')}` : ''}${reassigned.settled.length > 0 ? `; merged: ${reassigned.settled.join(', ')}` : ''}${reassigned.integrations.length > 0 ? `; to integrate: ${reassigned.integrations.join(', ')}` : ''}.`
          : ''
      }`
  );

export const taskRevert = (taskId: string, options: RunCommandOptions & { reason?: string }): Promise<void> =>
  act(
    options,
    async ctx => revertTask(ctx, await runOf(ctx, options), taskId, options.reason),
    reverted =>
      [
        `${taskId} reverted in the run's work: ${list(reverted.reverted)}.`,
        ...(reverted.kept.length > 0
          ? [`  Not reverted — another task changed them since: ${reverted.kept.join(', ')}`]
          : []),
        ...(reverted.dependants.length > 0 ? [`  Built on it: ${reverted.dependants.join(', ')} — check them`] : [])
      ].join('\n')
  );

/** `plitzi task show <task> <file>`: the file whole, where the diff is read from — the text alone, to read or to pipe. */
const taskShowFile = (taskId: string, file: string, options: RunCommandOptions & { diff?: boolean }): Promise<void> =>
  act(
    options,
    async ctx => showTaskFile(ctx, await runOf(ctx, options), taskId, file),
    shown =>
      options.diff === true
        ? (shown.diff ?? `${shown.file} of ${shown.task}: not text — no diff`)
        : shown.text === undefined
          ? `${shown.file} of ${shown.task} (${FROM_TEXT[shown.from]}): ${shown.binary ? 'not text — not shown' : 'removed by it'}`
          : shown.text
  );

const taskShowSummary = (taskId: string, options: RunCommandOptions & { full?: boolean }): Promise<void> =>
  act(
    options,
    async ctx => showTask(ctx, await runOf(ctx, options), taskId, { full: options.full ?? false }),
    shown => {
      const { knownFailure } = typeof shown.checks === 'object' ? shown.checks : { knownFailure: undefined };

      return [
        chalk.bold(
          `${shown.task.id} — ${shown.task.title} · ${shown.status}${shown.round > 0 ? `, round ${String(shown.round)}` : ''}${shown.holder ? ` · ${shown.holder}` : ''}`
        ),
        `  ${shown.task.role ?? 'developer'} · its files: ${shown.task.files.join(', ')}`,
        ...(shown.task.acceptance.length > 0
          ? [
              'Acceptance',
              ...shown.task.acceptance.map(each => {
                const result = shown.accepted?.find(one => one.said === acceptanceText(each));
                const mark = result ? (result.ok ? '✓' : '✗') : shown.status === 'done' ? '✓' : '☐';

                return `  ${mark} ${acceptanceText(each)}${typeof each === 'string' ? '' : chalk.dim(`  [check: ${each.check}]`)}${result ? secondRunText(result) : ''}${result && !result.ok ? `\n${(result.output ?? []).map(line => `      ${line}`).join('\n')}` : ''}`;
              })
            ]
          : []),
        knownFailure
          ? chalk.yellow(
              `Checks: failing (${knownFailure.failing.join(', ')}) — ${knownFailure.why}${knownFailure.fixedBy ? `; ${knownFailure.fixedBy} fixes it` : ''}`
            )
          : `Checks: ${shown.checks === 'passed' ? 'passed at complete' : 'not run yet'}`,
        ...(shown.warnings ?? []).map(warning => chalk.yellow(`  ⚠ ${warning}`)),
        ...(shown.agreements.length > 0
          ? [
              'Agreed — check it holds',
              ...shown.agreements.map(each => `  ⇄ ${each.from} → ${each.to}: ${each.change}`)
            ]
          : []),
        ...shown.unanswered.map(each =>
          chalk.yellow(`  ⇄ unanswered ${each.id}: ${each.from} → ${each.to}: ${each.change}`)
        ),
        ...shown.requests.map(each => `  ↗ request on ${each.file}: ${each.summary}`),
        ...(shown.notes.length > 0 ? ['Notes', ...shown.notes.map(note => `  ${note.by}: ${note.text}`)] : []),
        ...(shown.messages.length > 0 ? ['Said', ...messageLines(shown.messages)] : []),
        `Changed (${FROM_TEXT[shown.from]}): ${shown.files.length === 0 ? '—' : shown.files.map(each => `${each.file} (${each.change})`).join(', ')}`,
        ...(shown.notReviewed
          ? [
              chalk.yellow(
                `  ⚠ Its copy holds what did not go to review: ${list(shown.notReviewed)} — not shown, never merged`
              )
            ]
          : []),
        ...outsideLines(shown),
        ...shown.files.flatMap(each =>
          each.binary
            ? [`  ${each.file}: not text — not shown`]
            : [each.diff ?? '', ...(each.more ? [`  … ${String(each.more)} more lines (--full shows them)`] : [])]
        ),
        ...(shown.next.length > 0 ? ['Next', ...shown.next.map(each => `  ${each}`)] : [])
      ].join('\n');
    }
  );

/** `plitzi task show`: the task as its lead reviews it — or, with a file, that file whole. */
export const taskShow = (
  taskId: string,
  file: string | undefined,
  options: RunCommandOptions & { full?: boolean; diff?: boolean }
): Promise<void> => (file === undefined ? taskShowSummary(taskId, options) : taskShowFile(taskId, file, options));
