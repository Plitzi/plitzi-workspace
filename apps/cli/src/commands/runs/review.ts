import path from 'node:path';

import chalk from 'chalk';

import { act, runOf, runSelf } from './shell';
import { list, messageLines, outsideLines } from './text';
import { answering, freePort } from '../../runs/acceptance';
import { acceptanceText } from '../../runs/model';
import { pagesOf } from '../../runs/pagesOf';
import { runPaths } from '../../runs/paths';
import { startTaskPreview } from '../../runs/preview';
import { RunRefusal } from '../../runs/refusal';
import { loadRun } from '../../runs/run';
import { showTask } from '../../runs/show';
import { findingsOf, taskParts } from '../../runs/taskParts';
import { findTask, notReviewedIn, reassignTask, revertTask, reviewTask } from '../../runs/tasks';
import { viewTask } from '../../runs/taskStore';

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
  /** Read in the page, as `page check --element`: each one's attributes, box and classes. */
  element?: string[];
}

/** How many of a task's parts of a page are pictured: a look is read by a model, and each picture costs it. */
const PARTS_PICTURED = 3;

export const taskLook = (taskId: string, paths: string[], options: LookOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const preview = await startTaskPreview(ctx, runId, taskId, await freePort(), { quiet: true });
      try {
        if (!(await answering(preview.url, 60_000))) {
          throw new RunRefusal('invalid', `${taskId}'s copy did not answer on ${preview.url} within a minute`, {
            task: taskId
          });
        }

        // No page named: the pages its changes are drawn at, by the files that changed — else the home page.
        // Read off the copy served: a page the task makes is one to look at too.
        const changed = (await viewTaskOf(ctx, runId, taskId)).changed;
        const owned = paths.length > 0 ? [] : await pagesOf(preview.dir, changed);
        // A part of a page others build too: its own elements pictured, its own findings kept — the rest is theirs.
        const parts = await taskParts(preview.dir, changed);
        const clips = parts && !parts.ownsRoot ? parts.tops.slice(0, PARTS_PICTURED) : [];
        const routes = paths.length > 0 ? paths : owned.length > 0 ? owned : ['/'];
        const check = await runSelf(preview.dir, [
          'page',
          'check',
          ...routes,
          '--width',
          '1440,390',
          '--url',
          preview.url,
          ...(options.click ? ['--click', options.click] : []),
          ...(options.element ?? []).flatMap(id => ['--element', id])
        ]);
        const shots: string[] = [];
        for (const route of routes) {
          for (const clip of clips.length > 0 ? clips : [undefined]) {
            for (const [width, scheme] of [
              ['1440', 'light'],
              ['390', 'dark']
            ] as const) {
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
            }
          }
        }

        const kept = parts && !parts.ownsRoot ? findingsOf(check.output.trim(), parts) : undefined;

        const notReviewed = await notReviewedIn(ctx, runId, taskId);

        return {
          task: taskId,
          url: preview.url,
          ok: check.code === 0,
          check: kept?.text ?? check.output.trim(),
          ...(kept && kept.apart > 0 ? { apart: kept.apart } : {}),
          ...(clips.length > 0 ? { parts: clips } : {}),
          shots,
          ...(preview.borrowed === undefined ? {} : { borrowed: preview.borrowed }),
          ...(notReviewed.length > 0 ? { notReviewed } : {})
        };
      } finally {
        preview.stop();
      }
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
        looked.check,
        ...(looked.apart ? [chalk.dim(`  · ${String(looked.apart)} finding(s) on other tasks' parts left out`)] : []),
        ...(looked.shots.length > 0
          ? ['Pictures:', ...looked.shots.map(each => `  ${each}`)]
          : ['No picture could be taken.']),
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
  /** Approve a task whose UI waits for a designer's review without it: said so in its state and the report. */
  skipDesign?: boolean;
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
        { skipDesign: options.skipDesign ?? false }
      );
    },
    reviewed =>
      reviewed.design === 'approved'
        ? `${taskId}'s UI approved: the lead reviews it now and gives the final word. Next: plitzi task next --role designer --follow --take`
        : reviewed.verdict === 'approve'
          ? [
              `${taskId} approved: ${list(reviewed.merged ?? [])} in the run's work.`,
              ...(reviewed.design === 'skipped' ? ['  Without its UI review, as you said (--skip-design)'] : []),
              ...((reviewed.joined ?? []).length > 0
                ? [`  Put together with the change made in the project meanwhile: ${list(reviewed.joined ?? [])}`]
                : []),
              ...((reviewed.granted ?? []).length > 0 ? [`  Handed on: ${list(reviewed.granted ?? [])}`] : []),
              ...((reviewed.ready ?? []).length > 0 ? [`  Ready now: ${list(reviewed.ready ?? [])}`] : []),
              ...notReviewedText(reviewed.notReviewed, 'approve')
            ].join('\n')
          : [
              reviewed.toPerson
                ? `${taskId}: ${String(reviewed.round)} rounds of changes — it goes to a person.`
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

export const taskShow = (taskId: string, options: RunCommandOptions & { full?: boolean }): Promise<void> =>
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

                return `  ${mark} ${acceptanceText(each)}${typeof each === 'string' ? '' : chalk.dim(`  [check: ${each.check}]`)}${result && !result.ok ? `\n${(result.output ?? []).map(line => `      ${line}`).join('\n')}` : ''}`;
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
        `Changed (${shown.from === 'submitted' ? 'as it went to review' : shown.from === 'copy' ? 'its copy' : shown.from === 'run' ? 'as approved' : 'nothing yet'}): ${shown.files.length === 0 ? '—' : shown.files.map(each => `${each.file} (${each.change})`).join(', ')}`,
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
