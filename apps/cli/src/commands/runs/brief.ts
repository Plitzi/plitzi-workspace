import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { act, either } from './shell';
import { nearLimit } from './text';
import { MAX_LINES } from '../../lint/rules/fileTooLong';
import { namesServedCopy } from '../../runs/acceptance';
import { acceptanceText } from '../../runs/model';
import { importedApis } from '../../runs/moduleApis';
import { taskContext } from '../../runs/tasks';
import { describeData } from '../data';

import type { RunCommandOptions } from './shell';
import type { TaskContext } from '../../runs/tasks';

/**
 * `plitzi task context`: the brief, in text — with `--files`, the task's files and the shape of the data they import.
 */

/** A JSON file a module imports (`import pets from '../../data/pets.json' with …`), by its project path. */
const dataImports = (file: string, text: string): string[] =>
  [...text.matchAll(/from\s+['"](\.{1,2}\/[^'"]+\.json)['"]/g)].map(match =>
    path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]))
  );

/**
 * With `--files`: what an agent reads before it writes, in the same answer — each of its files as it is, and the shape
 * of each JSON file they import (as `plitzi data describe` says it): the cold start's `cat`s, in one call.
 */
const filesOf = async (root: string, context: TaskContext): Promise<{ file: string; shape: string }[]> => {
  const data = [...new Set(context.files.flatMap(each => (each.text ? dataImports(each.file, each.text) : [])))].sort();
  const shapes: { file: string; shape: string }[] = [];
  for (const file of data) {
    const text = await fs.readFile(path.join(root, file), 'utf-8').catch(() => undefined);
    if (text !== undefined) {
      try {
        shapes.push({ file, shape: describeData(JSON.parse(text)).shape });
      } catch {
        shapes.push({ file, shape: 'not JSON this can read' });
      }
    }
  }

  return shapes;
};

export const taskContextCommand = (
  taskId: string | undefined,
  options: RunCommandOptions & { files?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const target = await either(ctx, options, taskId);
      const context = await taskContext(ctx, target.runId, target.taskId);

      return options.files
        ? { ...context, data: await filesOf(ctx.root, context), imports: await importedApis(ctx.root, context.files) }
        : context;
    },
    context =>
      [
        briefOf(context),
        ...('data' in context
          ? [
              ...context.files.flatMap(each =>
                each.text === undefined
                  ? each.toCreate
                    ? [chalk.bold(`── ${each.file} — to create`)]
                    : []
                  : [chalk.bold(`── ${each.file} (${String(each.text.split('\n').length)} lines)`), each.text.trimEnd()]
              ),
              ...context.data.flatMap(each => [chalk.bold(`── ${each.file}, its shape`), each.shape]),
              ...(context.imports.length > 0
                ? [
                    chalk.bold(
                      '── What these files import from the rest of the project — how each is called, not its body (read the file only for what this does not say):'
                    ),
                    ...context.imports.flatMap(each => [each.file, ...each.names.map(name => `  ${name}`)])
                  ]
                : [])
            ]
          : [])
      ].join('\n')
  );

/**
 * A task in a page an agent reads before it starts: what is asked, what holds for the whole run, what was decided with
 * others, what a review asked — and only where the rest is (`--json`: every file's text, every related task's notes).
 */
const briefOf = (context: TaskContext): string => {
  const { task, state } = context;
  const files = context.files.map(file => `${file.file}${file.toCreate ? ' (to create)' : ''}`);
  const comments = context.review?.verdict === 'changes' ? context.review.comments : [];
  const notesShown = state.notes.filter(
    note => !(comments.length > 0 && note.text.startsWith(`Review ${String(context.review?.round ?? 0)}: `))
  );
  const unanswered = context.proposals.incoming.filter(each => each.answer === undefined);

  return [
    ...(context.primer === undefined
      ? []
      : [
          chalk.bold('The run’s primer — the lead’s, for every task: read it before anything else'),
          context.primer.trim(),
          ''
        ]),
    chalk.bold(`${task.id} — ${task.title}`),
    `  ${task.role ?? 'developer'} · ${state.status}${state.round > 0 ? `, round ${String(state.round)}` : ''}${context.holder ? ` · ${context.holder}` : ''}`,
    `Its files: ${files.join(', ')}${task.touches && task.touches.length > 0 ? ` · it will touch: ${task.touches.join(', ')}` : ''}`,
    // What the work needs beyond them is not refused: it is said how it goes in.
    '  A file beyond these the work needs: change it in your copy — it goes in by turns at complete when nobody holds it (plitzi task claim <file> holds it while you work; one another task holds becomes a request)',
    ...(task.acceptance.length > 0
      ? [
          'Acceptance — a line with a check is run at complete; run it yourself in your copy first',
          ...(task.acceptance.some(each => typeof each !== 'string' && namesServedCopy(each.check))
            ? [
                '  (At complete, the copy is served and $PLITZI_URL / $PLITZI_PORT are written into the check — PORT is set, for a Playwright spec. To run one yourself: start the copy on a free port (PORT=<port> npm start), put http://127.0.0.1:<port> where the check says $PLITZI_URL, and stop that server before complete, which starts its own)'
              ]
            : []),
          ...task.acceptance.map(
            each => `  ☐ ${acceptanceText(each)}${typeof each === 'string' ? '' : `\n      check: ${each.check}`}`
          )
        ]
      : []),
    ...(context.runNotes.length > 0
      ? ['What holds for the whole run', ...context.runNotes.map(note => `  · ${note}`)]
      : []),
    ...(comments.length > 0
      ? [
          `Review ${String(context.review?.round ?? 0)} asked`,
          ...comments.map(comment => `  ↺ ${comment.note}${comment.element ? ` (on ${comment.element})` : ''}`)
        ]
      : []),
    ...(context.proposals.agreements.length > 0
      ? [
          'Agreed — keep to it',
          ...context.proposals.agreements.map(each => `  ⇄ ${each.from} → ${each.to}: ${each.change}`)
        ]
      : []),
    ...unanswered.map(each => chalk.yellow(`  ⇄ to answer first, ${each.id} from ${each.from}: ${each.change}`)),
    ...context.contracts.map(each => `  contract on ${each.resource} (${each.owner}): ${each.note}`),
    ...context.requests.map(each => `  ↗ request on ${each.file} from ${each.task}: ${each.summary}`),
    // What the review asked is said above: its note is not said twice.
    ...(notesShown.length > 0 ? ['Its notes', ...notesShown.slice(-5).map(note => `  ${note.by}: ${note.text}`)] : []),
    ...(context.related.length > 0
      ? [`Related: ${context.related.map(each => `${each.task} (${each.status})`).join(', ')}`]
      : []),
    ...context.related.flatMap(each =>
      each.asked
        ? [
            `What ${each.task} was asked — it is done before this one:`,
            ...each.asked.acceptance.map(line => `  ☐ ${line}`),
            ...each.asked.reviews.map(line => `  ↺ ${line}`)
          ]
        : []
    ),
    // A file near the line has little room: where the new part goes is decided before the first edit, not after.
    ...nearLimit(context).map(each =>
      chalk.yellow(
        `  ⚠ ${each.file} is ${String(each.lines)} non-blank lines of ${String(MAX_LINES)}: what you add likely goes in a module of its own, beside it`
      )
    ),
    ...(context.reading.length > 0
      ? [`Read first, for these files — the rest of the skills when the work asks: ${context.reading.join(', ')}`]
      : []),
    `${context.projectNotes ? 'The project’s notes: NOTES.md — read it. ' : ''}Every file's text and every related task's notes: --json.`
  ].join('\n');
};
