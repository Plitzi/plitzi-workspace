import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { PROJECT_STATE } from '@plitzi/sdk-shared/project';

import {
  checkWithInteraction,
  partsComparedOf,
  elsewhereOf,
  picturesOf,
  readablePictures,
  samePaths,
  stoppedText,
  keepLook,
  keptLook,
  lookKey,
  LOOK_AT_ONCE,
  phases,
  toDeclared,
  viewsAsked
} from './lookParts';
import { lookText } from './lookText';
import { act, runOf, runSelf } from './shell';
import { takeOnRead } from './takeOnRead';
import { list } from './text';
import { answering, freePort } from '../../runs/acceptance';
import { designSkipText, isDesignSkip } from '../../runs/designSkip';
import { inTurns } from '../../runs/inTurns';
import { readOwnership } from '../../runs/ownership';
import {
  acceptanceAccount,
  acceptancePages,
  acceptanceStatuses,
  examplePaths,
  pagesOf,
  pagesToLook
} from '../../runs/pagesOf';
import { runPaths, taskPaths } from '../../runs/paths';
import { startBeforePreview, startTaskPreview } from '../../runs/preview';
import { RunRefusal } from '../../runs/refusal';
import { loadRun, logRun } from '../../runs/run';
import { withLock } from '../../runs/store';
import { findingsOf, taskParts } from '../../runs/taskParts';
import { findTask, notReviewedIn, reviewTask } from '../../runs/tasks';
import { viewTask } from '../../runs/taskStore';
import { readTeam } from '../../runs/team';
import { checkAccount, sessionCookie } from '../check/account';
import { projectSpace } from '../check/space';

import type { BeforeAfter } from './lookParts';
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
const viewTaskOf = async (
  ctx: RunContext,
  runId: string,
  taskId: string
): Promise<{
  changed: string[];
  designing: boolean;
  acceptanceAt: string[];
  acceptanceAs?: string;
  byStatus: { page: string; status: number }[];
}> => {
  const loaded = await loadRun(ctx, runId, { anyMachine: true, anyVersion: true });
  const task = findTask(loaded, taskId);
  const { state } = await viewTask(loaded.paths, task);

  // The caller is the designer whose UI review it is: its look is set beside the run before it unless it says not.
  return {
    changed: state.changed ?? [],
    designing: state.design?.status === 'due' && state.design.by === ctx.agent,
    acceptanceAt: acceptancePages(task.acceptance),
    byStatus: acceptanceStatuses(task.acceptance),
    ...(acceptanceAccount(task.acceptance) === undefined ? {} : { acceptanceAs: acceptanceAccount(task.acceptance) })
  };
};

export interface LookOptions extends RunCommandOptions {
  /** Looked at anew, though it was looked at already as asked and nothing changed since. */
  fresh?: boolean;
  /** Clicked once each page settles, as `page check --click`: an open state looked at, not only the page at rest. */
  click?: string;
  /** The visitor's time zone (IANA) every page is read in: the machine's when left out. */
  timezone?: string;
  /**
   * The pointer put over it once each page settles, as `page check --hover`: what that changes said, and the page
   * pictured with it there — at 1440 alone, as a phone has no pointer to hover with.
   */
  hover?: string;
  /** Signed in first as this account, as `page check --as`: the password from `PLITZI_CHECK_PASSWORD`. */
  as?: string;
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

/** How many of a task's parts of a page are pictured: a look is read by a model, and each picture costs it. */
const PARTS_PICTURED = 3;

/** The look itself, once its task is locked: its copy served, checked, pictured and set beside the run before it. */
export const lookAt = (ctx: RunContext, runId: string, taskId: string, paths: string[], options: LookOptions) =>
  // One look of a task at a time: two served its copy at once, and the first to finish stopped the server the
  // other was picturing — a lead's look and its designer's, on la-velada's t-home-details.
  withLock(
    taskPaths(runPaths(ctx.root, runId), taskId).lookLock,
    async () => {
      const mark = phases();
      const preview = await startTaskPreview(ctx, runId, taskId, await freePort(), { quiet: true });
      // The run before it, once started: stopped with the copy's server whatever ends the look.
      const stops: (() => void)[] = [];
      try {
        if (!(await answering(preview.url, 60_000))) {
          throw new RunRefusal('invalid', `${taskId}'s copy did not answer on ${preview.url} within a minute`, {
            task: taskId
          });
        }

        mark('its copy served');

        // The desktop light and the phone dark — every width in both schemes when the team asks its reviews high
        // (`options.designReview`): design-2 took the other two by hand, the team's standard asking for both.
        const precision = (await readTeam(ctx.root).catch(() => undefined))?.options?.designReview;
        const asked = viewsAsked(options);
        const teams: readonly (readonly [string, 'light' | 'dark'])[] =
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
        const space = asked ? undefined : await projectSpace(preview.dir);
        const views = asked ?? toDeclared(teams, space && !('problem' in space) ? space.schemes : []);
        // No page named: the pages its changes are drawn at, by the files that changed — else its acceptance's, else home.
        // Read off the copy served: a page the task makes is one to look at too.
        const {
          changed,
          designing,
          acceptanceAt: checked,
          acceptanceAs,
          byStatus
        } = await viewTaskOf(ctx, runId, taskId);
        // A page its acceptance checks with a status of its own is looked at with it, apart — said below the look.
        const ownStatus = options.status === undefined ? byStatus : [];
        const acceptanceAt = checked.filter(page => !ownStatus.some(each => each.page === page));
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
        // Its files drawn at no page (a plugin's): the pages its acceptance checks, before the home page — encore-2's
        // look at the Reactions plugin's CSS pictured the home page, where no reaction is.
        // Read signed in when asked: a task whose UI is for signed-in visitors looked at as one (encore's designers saw
        // only the guest's page of settings, a vote or the host's controls).
        // Not told who to read it as: as its acceptance checks it — a page for signed-in visitors read signed in.
        const as = options.as ?? acceptanceAs;
        // Its links followed as that account too: a page only it has a link to (`/u/:username`) is found.
        const account = as === undefined ? undefined : await checkAccount(preview.dir, as);
        const cookie =
          account === undefined || 'problem' in account ? undefined : await sessionCookie(preview.url, account);
        const { paths: routes, unreached } = await examplePaths(
          preview.url,
          pagesToLook(paths, owned, acceptanceAt),
          acceptanceAt,
          typeof cookie === 'string' ? cookie : undefined
        );
        // Every page read in one visitor's zone: the machine's, unless said — and said under the pictures either way.
        const zone = options.timezone ? ['--timezone', options.timezone] : [];
        const signedIn = as ? ['--as', as] : [];
        const interaction = [
          ...(options.click ? ['--click', options.click] : []),
          ...(options.hover ? ['--hover', options.hover] : [])
        ];
        // The pages only a shared file of it reaches — a data file every page reads, a theme: read beside the run
        // before it, and pictured only where they changed.
        const ownership = await readOwnership(preview.dir);
        const direct = await pagesOf(
          preview.dir,
          changed.filter(file => ownership.ownerOf.has(file))
        );
        const reached = paths.length === 0 ? owned.filter(page => !direct.includes(page)) : [];
        // Beside the run before it: what the task moved, section by section — and that nothing else did. Started first:
        // the pages a shared file of it reaches are read on both before any is pictured. A lead's look starts it too
        // when such pages are there: lx-controls' look at a carousel pictured all eight pages its data file reaches (61 s).
        const before =
          (options.before ?? (designing || reached.length > 0))
            ? await startBeforePreview(ctx, runId, taskId, await freePort())
            : undefined;
        if (before) {
          stops.push(() => {
            before.stop();
          });
        }

        if (before && !(await answering(before.url, 60_000))) {
          mark('the run before it, not served');
          throw new RunRefusal('invalid', `The run before ${taskId} did not answer on ${before.url} within a minute`, {
            task: taskId
          });
        }

        // A page only a shared file of it reaches, drawn the same as the run before it — every element, box and style
        // read on both — is not pictured: velada-fidelity's look pictured nine pages for two tokens added (204 s).
        const unchanged = new Set<string>();
        if (before && reached.length > 0) {
          const { paths: reachedOnly } = await examplePaths(preview.url, reached);
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

        mark('the run before it served, the pages its shared files reach read');
        const pictured = routes.filter(route => !unchanged.has(route));
        const checkOf = (pages: readonly string[], also: readonly string[]) =>
          runSelf(preview.dir, [
            'page',
            'check',
            ...pages,
            '--width',
            [...new Set(views.map(([width]) => width))].join(','),
            // Light and dark read too: a ground fixed under the theme's text (velada-fidelity's judges' rows).
            '--themes',
            // Another site's pictures stood in for: a look is of the task's change — a third party's CDN, throttling a
            // look's pages at once, held the check up to its budget, and failed it now and then.
            '--stand-ins',
            '--url',
            preview.url,
            ...zone,
            ...signedIn,
            ...(options.status === undefined ? [] : ['--status', String(options.status)]),
            ...also,
            ...(options.element ?? []).flatMap(id => ['--element', id])
          ]);
        // Its pages checked, its pictures taken and set beside the run before it, and the rest of each page read —
        // at once, a few at a time: each is a page or two in a browser of its own, and one after another they were
        // most of a look (the sanity run: 25 s, 22 of them waiting in turn).
        const partsBeside = before !== undefined && clips.length > 0;
        // Why a picture was not taken, kept to be said: "No picture could be taken" alone left encore-3's reviewers to
        // page through it themselves — a page for the signed-in, a part new since the run before.
        const unpictured: { what: string; why: string }[] = [];
        const notTaken = (what: string, output: string): void => {
          const why = output
            .split('\n')
            .map(line => line.trim())
            .find(line => line !== '' && !line.startsWith('{'));
          unpictured.push({ what, why: why ?? 'the picture failed, saying nothing' });
        };
        const named = (route: string, clip: string | undefined, width: string, scheme: string, after = false) =>
          path.join(
            runPaths(ctx.root, runId).shots,
            `${taskId}${route === '/' ? '-home' : `-${route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`}${clip ? `-${clip}` : ''}-${width}-${scheme}${after ? '-after' : ''}.png`
          );
        const own = (partsBeside ? [] : pictured).flatMap(route =>
          (clips.length > 0 ? clips : [undefined]).flatMap(clip =>
            views.map(([width, scheme]) => async (): Promise<string[]> => {
              const out = named(route, clip, width, scheme);
              const shot = await runSelf(preview.dir, [
                'page',
                'shot',
                route,
                '--url',
                preview.url,
                ...zone,
                ...signedIn,
                '--width',
                width,
                '--scheme',
                scheme,
                ...(clip ? ['--clip', clip] : []),
                '--json',
                '-o',
                out
              ]);
              // Pictured apart: an element not on the page loses the hover's picture, not the page's at rest.
              const hovered =
                options.hover !== undefined && scheme === 'light'
                  ? await runSelf(preview.dir, [
                      'page',
                      'shot',
                      route,
                      '--url',
                      preview.url,
                      ...zone,
                      ...signedIn,
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
                    ])
                  : undefined;

              if (shot.code !== 0) {
                notTaken(`${route}${clip ? ` ${clip}` : ''} at ${width} ${scheme}`, shot.output);
              }

              return [
                ...(shot.code === 0 ? readablePictures(shot.output, out) : []),
                ...(hovered && hovered.code === 0 ? picturesOf(hovered.output) : [])
              ];
            })
          )
        );
        // Beside the run before it: its parts alone when it has some, else the page. Its parts, all of them, in one
        // comparison a page and a view — each side loaded once (a part a comparison loaded the home 24 times a look).
        const beside = (before ? pictured : []).flatMap(route =>
          views.map(([width, scheme]) => async () => {
            const clip = partsBeside ? clips.join(',') : undefined;
            // Named for what it is — the page after the task, set beside the run before it in `-after-compare.png`:
            // `-before.png` was the after picture (velada-polish's design-1, the same md5 as the look's own).
            const out = named(route, partsBeside && clips.length === 1 ? clips[0] : undefined, width, scheme, true);
            const shot = await runSelf(preview.dir, [
              'page',
              'shot',
              route,
              '--url',
              preview.url,
              ...zone,
              ...signedIn,
              '--compare',
              before?.url ?? '',
              ...(clip ? ['--clip', clip] : []),
              '--width',
              width,
              '--scheme',
              scheme,
              '--json',
              '-o',
              out
            ]);

            if (shot.code !== 0) {
              // Set beside nothing — a part new since the run before, absent there — it is pictured alone, said so.
              const alone = await runSelf(preview.dir, [
                'page',
                'shot',
                route,
                '--url',
                preview.url,
                ...zone,
                ...signedIn,
                ...(clip ? ['--clip', clip] : []),
                '--width',
                width,
                '--scheme',
                scheme,
                '-o',
                out
              ]);
              notTaken(
                `${route}${clip ? ` ${clip}` : ''} at ${width} ${scheme}, beside the run before${alone.code === 0 ? ' (pictured alone instead)' : ''}`,
                shot.output
              );

              // Pictured, compared with nothing: no section of it set beside anything.
              return alone.code === 0
                ? [
                    {
                      compared: { route, width, scheme, sections: [], dress: [], problem: 'new since the run before' },
                      shot: out
                    }
                  ]
                : [];
            }

            return partsComparedOf(shot.output).map(each => ({
              compared: { route, width, scheme, ...each.compared },
              ...(each.shot ? { shot: each.shot } : clip ? { shot: out } : {})
            }));
          })
        );
        // Its parts compared alone: that nothing else of the page moved is read, not pictured (`page same`).
        const rest = partsBeside
          ? pictured.map(route => async () => {
              const read = await runSelf(preview.dir, [
                'page',
                'same',
                route,
                '--url',
                preview.url,
                '--than',
                before.url,
                '--except',
                clips.join(','),
                '--json'
              ]);
              const differs = elsewhereOf(read.output);

              return differs ? { route, ...differs } : undefined;
            })
          : [];
        const stoppedUnder: string[] = [];
        let check: { code: number; output: string };
        let shots: string[];
        let compared: BeforeAfter[];
        let movedElsewhere: { route: string; here: string; there: string }[];
        try {
          const [checked, pictures, set, read] = await Promise.all([
            checkWithInteraction(routes, interaction, checkOf),
            inTurns(own, LOOK_AT_ONCE),
            inTurns(beside, LOOK_AT_ONCE),
            inTurns(rest, LOOK_AT_ONCE)
          ]);
          check = checked;
          shots = [...pictures.flat(), ...set.flat().flatMap(each => (each.shot ? [each.shot] : []))];
          compared = set.flat().map(each => each.compared);
          movedElsewhere = read.flatMap(each => (each ? [each] : []));
        } finally {
          // Stopped under the look, it is said with why, before this look stops it: a picture that failed for it
          // is no finding of the task's (velada-polish: every picture failed, the servers' output thrown away).
          stoppedUnder.push(...stoppedText("its copy's server", preview), ...stoppedText('the run before it', before));
          before?.stop();
        }

        mark('checked, pictured and set beside the run before it, at once');
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
          ...(as !== undefined && options.as === undefined ? { signedInAs: as } : {}),
          ok: check.code === 0,
          check: kept?.text ?? check.output.trim(),
          ...(kept && kept.apart > 0 ? { apart: kept.apart } : {}),
          ...(clips.length > 0 ? { parts: clips } : {}),
          ...(many ? { wholeFor: parts.tops } : {}),
          ...(unreached.length > 0 ? { unreached } : {}),
          shots,
          ...(unpictured.length > 0 ? { unpictured } : {}),
          ...(unchanged.size > 0 ? { unchanged: [...unchanged] } : {}),
          ...(movedElsewhere.length > 0 ? { movedElsewhere } : {}),
          timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          ...(compared.length > 0 ? { compared } : {}),
          // Its copy served with the state its plays left: the run before it starts cold (encore-4: the song playing
          // differed on the two sides, the copy's queue played by its agent).
          ...(compared.length > 0 &&
          (await fs.readdir(path.join(preview.dir, PROJECT_STATE)).catch(() => [])).length > 0
            ? { warmCopy: true }
            : {}),
          ...(before === undefined ? { notBeside: true } : {}),
          ...(preview.borrowed === undefined ? {} : { borrowed: preview.borrowed }),
          ...(stoppedUnder.length > 0 ? { stoppedUnder } : {}),
          ...(notLooked.length > 0 ? { notLooked } : {}),
          ...(ownStatus.length > 0 ? { ownStatus } : {}),
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

export const taskLook = (taskId: string, paths: string[], options: LookOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      await takeOnRead(ctx, runId, taskId);

      if (options.click && options.hover) {
        throw new RunRefusal(
          'invalid',
          'One interaction a look: --click an element, or --hover one — two looks for both'
        );
      }

      // Looked at already, as asked now, and nothing changed since — the task, the run's approved work: said again, not
      // looked at again (--fresh looks). A lead looking after the designer, an agent looking twice, paid 8 s each.
      const { cache } = taskPaths(runPaths(ctx.root, runId), taskId);
      const key = await lookKey(ctx, runId, taskId, {
        paths,
        ...options,
        fresh: undefined,
        json: undefined,
        token: undefined
      });
      const before = options.fresh ? undefined : await keptLook(cache, key, ctx.now());
      if (before) {
        return { kind: 'again' as const, again: before };
      }

      const looked = await lookAt(ctx, runId, taskId, paths, options);
      await keepLook(cache, key, lookText(looked), ctx.now());

      return { kind: 'looked' as const, looked };
    },
    answer =>
      answer.kind === 'again'
        ? [
            chalk.dim(
              `As looked at ${answer.again.at.slice(11, 16)} UTC — the task, the run's approved work and what you asked are as they were, so this is that look again (--fresh looks anew):`
            ),
            answer.again.text
          ].join('\n')
        : lookText(answer.looked)
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
              // The lead went first while a designer was at it: said to the lead too, not only to the designer.
              ...(reviewed.designBy
                ? [`  · ${reviewed.designBy} was at its UI review: told to drop it, and to tell you what it found`]
                : []),
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
