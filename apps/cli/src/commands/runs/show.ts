import chalk from 'chalk';

import { act, ownTask, runOf } from './shell';
import { takeOnRead } from './takeOnRead';
import { list, messageLines, outsideLines, secondRunText } from './text';
import { acceptanceText } from '../../runs/model';
import { FROM_TEXT, showTask, showTaskFile } from '../../runs/show';

import type { RunCommandOptions } from './shell';

/** `plitzi task show <task> <file>`: the file whole, where the diff is read from — the text alone, to read or to pipe. */
const taskShowFile = (
  taskId: string | undefined,
  file: string,
  options: RunCommandOptions & { diff?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);

      return showTaskFile(ctx, runId, taskId ?? (await ownTask(ctx, runId)), file);
    },
    shown =>
      options.diff === true
        ? (shown.diff ?? `${shown.file} of ${shown.task}: not text — no diff`)
        : shown.text === undefined
          ? `${shown.file} of ${shown.task} (${FROM_TEXT[shown.from]}): ${shown.binary ? 'not text — not shown' : 'removed by it'}`
          : shown.text
  );

const taskShowSummary = (named: string | undefined, options: RunCommandOptions & { full?: boolean }): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const taskId = named ?? (await ownTask(ctx, runId));
      await takeOnRead(ctx, runId, taskId);

      return showTask(ctx, runId, taskId, { full: options.full ?? false });
    },
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
                const mark = result?.amended
                  ? '↻'
                  : result
                    ? result.ok
                      ? '✓'
                      : '✗'
                    : shown.status === 'done'
                      ? '✓'
                      : '☐';

                return `  ${mark} ${acceptanceText(each)}${typeof each === 'string' ? '' : chalk.dim(`  [check: ${each.check}]`)}${result ? secondRunText(result) : ''}${result?.amended ? chalk.dim(' — amended once done: held at the finish') : ''}${result && !result.ok && !result.amended ? `\n${(result.output ?? []).map(line => `      ${line}`).join('\n')}` : ''}`;
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
        ...shown.requests.flatMap(each => [
          `  ↗ request on ${each.file}${each.task === shown.task.id ? '' : ` from ${each.task}`}: ${each.summary}`,
          ...(each.diff ? each.diff.split('\n').map(line => `      ${line}`) : [])
        ]),
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
            : each.withheld !== undefined
              ? [
                  `  ${each.file}: ${String(each.withheld)} lines of diff, not shown — plitzi task show ${shown.task.id} ${each.file} --diff (or --full for every file)`
                ]
              : [each.diff ?? '', ...(each.more ? [`  … ${String(each.more)} more lines (--full shows them)`] : [])]
        ),
        ...(shown.next.length > 0 ? ['Next', ...shown.next.map(each => `  ${each}`)] : [])
      ].join('\n');
    }
  );

/** `plitzi task show`: the task as its lead reviews it — or, with a file, that file whole. */
export const taskShow = (
  first: string | undefined,
  second: string | undefined,
  options: RunCommandOptions & { full?: boolean; diff?: boolean }
): Promise<void> => {
  // A path alone is a file of the task one holds or reviews: a task id has no slash.
  const [taskId, file] = second === undefined && first?.includes('/') === true ? [undefined, first] : [first, second];

  return file === undefined ? taskShowSummary(taskId, options) : taskShowFile(taskId, file, options);
};
