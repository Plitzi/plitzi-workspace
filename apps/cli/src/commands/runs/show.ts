import chalk from 'chalk';

import { act, ownTask, runOf } from './shell';
import { takeOnRead } from './takeOnRead';
import { list, messageLines, outsideLines, secondRunText } from './text';
import { acceptanceText } from '../../runs/model';
import { FROM_TEXT, showTask, showTaskFile } from '../../runs/show';
import { roleOf } from '../../runs/spike';

import type { RunCommandOptions } from './shell';

/** How much of a brief's finding `task show` says without --full: the rule it sets, not the whole page of it. */
const BRIEF_CHARS = 600;

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

/** Notes shown on a summary: the latest, each clipped — a lead read one task's 16k four times in nine minutes. */
const NOTES_SHOWN = 10;
const NOTE_CHARS = 300;

export const notesLines = (notes: readonly { by: string; text: string }[], full: boolean): string[] => {
  const shown = full ? notes : notes.slice(-NOTES_SHOWN);
  const earlier = notes.length - shown.length;

  return notes.length === 0
    ? []
    : [
        `Notes${earlier > 0 ? chalk.dim(` (the last ${String(shown.length)} — ${String(earlier)} earlier: --full)`) : ''}`,
        ...shown.map(
          note =>
            `  ${note.by}: ${full || note.text.length <= NOTE_CHARS ? note.text : `${note.text.slice(0, NOTE_CHARS).trimEnd()}… (whole: --full)`}`
        )
      ];
};

/** The round it is in, as `task next` says it: in review, the one being reviewed — after `round` reviews. */
export const roundText = ({ status, round }: { status: string; round: number }): string =>
  status === 'in-review' ? `, round ${String(round + 1)}` : round > 0 ? `, round ${String(round)}` : '';

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
          `${shown.task.id} — ${shown.task.title} · ${shown.status}${roundText(shown)}${shown.holder ? ` · ${shown.holder}` : ''}`
        ),
        `  ${roleOf(shown.task)} · its files: ${shown.task.files.join(', ')}`,
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
        // What it was asked in detail, beside its lines: a reviewer reads both (a run's tester had neither rule).
        ...(shown.findings
          ? [
              'Its brief — what was found for it',
              ...shown.findings.map(
                each =>
                  `  · ${options.full === true || each.text.length <= BRIEF_CHARS ? each.text : `${each.text.slice(0, BRIEF_CHARS)}… (whole: --full)`}`
              )
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
        ...notesLines(shown.notes, options.full === true),
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
                  `  ${each.file}: ${String(each.withheld)} lines of diff, not shown — plitzi task show ${shown.task.id} ${each.file} --diff${options.full === true ? '' : ' (or --full for every file that fits one answer)'}`
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
