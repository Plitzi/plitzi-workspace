import chalk from 'chalk';

import { acceptanceText } from '../../../runs/core/model';
import { roleOf } from '../../../runs/plan/spike';
import { FROM_TEXT, showTask, showTaskFile } from '../../../runs/view/show';
import { takeOnRead } from '../review/takeOnRead';
import { act, ownTask, runOf } from '../shell';
import { list, messageLines, outsideLines, secondRunText } from '../text';

import type { ShownFile, TaskShown } from '../../../runs/view/show';
import type { RunCommandOptions } from '../shell';

/** How much of a brief's finding `task show` says without --full: the rule it sets, not the whole page of it. */
const BRIEF_CHARS = 600;

/** `plitzi task show <task> <file>`: the file whole, where the diff is read from — the text alone, to read or to pipe. */
const taskShowFiles = (
  taskId: string | undefined,
  files: readonly string[],
  options: RunCommandOptions & { diff?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const task = taskId ?? (await ownTask(ctx, runId));
      const shown = [];
      for (const file of files) {
        shown.push(await showTaskFile(ctx, runId, task, file));
      }

      // One file is one object, as --json always gave it; several, a list.
      return shown.length === 1 ? shown[0] : shown;
    },
    // Several files, each under its name: a designer asked for two at once and was refused "too many arguments".
    answered =>
      (Array.isArray(answered) ? answered : [answered])
        .map((each, _index, shown) => {
          const text =
            options.diff === true
              ? (each.diff ?? `${each.file} of ${each.task}: not text — no diff`)
              : each.text === undefined
                ? `${each.file} of ${each.task} (${FROM_TEXT[each.from]}): ${each.binary ? 'not text — not shown' : 'removed by it'}`
                : each.text;

          return shown.length > 1 ? `${chalk.bold(`── ${each.file}`)}\n${text}` : text;
        })
        .join('\n')
  );

/** Notes shown on a summary: the latest, each clipped — a lead read one task's 16k four times in nine minutes. */
const NOTES_SHOWN = 10;
const NOTE_CHARS = 300;

/**
 * A task's notes, the last ones — each cut where long, saying the command that gives it whole: said inside `task next`
 * too, a bare "--full" was tried on `task context`, which has none.
 */
export const notesLines = (notes: readonly { by: string; text: string }[], full: boolean, task: string): string[] => {
  const whole = `plitzi task show ${task} --full`;
  const shown = full ? notes : notes.slice(-NOTES_SHOWN);
  const earlier = notes.length - shown.length;

  return notes.length === 0
    ? []
    : [
        `Notes${earlier > 0 ? chalk.dim(` (the last ${String(shown.length)} — ${String(earlier)} earlier: ${whole})`) : ''}`,
        ...shown.map(
          note =>
            `  ${note.by}: ${full || note.text.length <= NOTE_CHARS ? note.text : `${note.text.slice(0, NOTE_CHARS).trimEnd()}… (whole: ${whole})`}`
        )
      ];
};

/** The round it is in, as `task next` says it: in review, the one being reviewed — after `round` reviews. */
export const roundText = ({ status, round }: { status: string; round: number }): string =>
  status === 'in-review' ? `, round ${String(round + 1)}` : round > 0 ? `, round ${String(round)}` : '';

/** A task as `task show` says it: its acceptance, its brief, its checks, its diff — what a reviewer starts from. */
export const shownText = (
  shown: TaskShown,
  full = false,
  /** Handed with a review (`task next`), whose lines say each acceptance line and its result already: not again. */
  { acceptance = true }: { acceptance?: boolean } = {}
): string => {
  const { knownFailure } = typeof shown.checks === 'object' ? shown.checks : { knownFailure: undefined };

  return [
    chalk.bold(
      `${shown.task.id} — ${shown.task.title} · ${shown.status}${roundText(shown)}${shown.holder ? ` · ${shown.holder}` : ''}`
    ),
    `  ${roleOf(shown.task)} · its files: ${shown.task.files.join(', ')}`,
    ...(acceptance && shown.task.acceptance.length > 0
      ? [
          'Acceptance',
          ...shown.task.acceptance.map(each => {
            const result = shown.accepted?.find(one => one.said === acceptanceText(each));
            const mark = result?.amended ? '↻' : result ? (result.ok ? '✓' : '✗') : shown.status === 'done' ? '✓' : '☐';

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
              `  · ${full || each.text.length <= BRIEF_CHARS ? each.text : `${each.text.slice(0, BRIEF_CHARS)}… (whole: plitzi task show ${shown.task.id} --full)`}`
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
      ? ['Agreed — check it holds', ...shown.agreements.map(each => `  ⇄ ${each.from} → ${each.to}: ${each.change}`)]
      : []),
    ...shown.unanswered.map(each =>
      chalk.yellow(`  ⇄ unanswered ${each.id}: ${each.from} → ${each.to}: ${each.change}`)
    ),
    ...shown.requests.flatMap(each => [
      `  ↗ request on ${each.file}${each.task === shown.task.id ? '' : ` from ${each.task}`}: ${each.summary}`,
      ...(each.diff ? each.diff.split('\n').map(line => `      ${line}`) : [])
    ]),
    ...notesLines(shown.notes, full, shown.task.id),
    ...(shown.messages.length > 0 ? ['Said', ...messageLines(shown.messages)] : []),
    `Changed (${FROM_TEXT[shown.from]}): ${changedText(shown.files)}`,
    ...(shown.notReviewed
      ? [
          chalk.yellow(
            `  ⚠ Its copy holds what did not go to review: ${list(shown.notReviewed)} — not shown, never merged`
          )
        ]
      : []),
    ...(shown.unwritten
      ? [
          chalk.yellow(
            `  ⚠ Its card names ${list(shown.unwritten)}, which its work did not write — what it wrote instead is above`
          )
        ]
      : []),
    ...outsideLines(shown),
    ...shown.files.flatMap(each =>
      each.binary
        ? [`  ${each.file}: not text — not shown`]
        : each.withheld !== undefined
          ? []
          : [
              each.diff ?? '',
              ...(each.more ? [`  … ${String(each.more)} more lines (--full shows them)`] : []),
              ...(each.alike
                ? [`  The same change in ${String(each.alike.length)} more: ${each.alike.join(', ')}`]
                : [])
            ]
    ),
    ...withheldLines(shown.task.id, shown.files, full),
    ...(shown.next.length > 0 ? ['Next', ...shown.next.map(each => `  ${each}`)] : [])
  ].join('\n');
};

const taskShowSummary = (named: string | undefined, options: RunCommandOptions & { full?: boolean }): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const taskId = named ?? (await ownTask(ctx, runId));
      await takeOnRead(ctx, runId, taskId);

      return showTask(ctx, runId, taskId, { full: options.full ?? false });
    },
    shown => shownText(shown, options.full === true)
  );

/** The files it changed, by how — those changed alike among them: a run's list said "(changed)" after each of 34. */
const changedText = (files: readonly ShownFile[]): string => {
  const byChange = new Map<ShownFile['change'], string[]>();
  for (const each of files) {
    byChange.set(each.change, [...(byChange.get(each.change) ?? []), each.file, ...(each.alike ?? [])]);
  }

  return byChange.size === 0 ? '—' : [...byChange].map(([change, names]) => `${change} ${names.join(', ')}`).join('; ');
};

/**
 * The files whose diff the answer leaves out, in one line with how to read one: a run's tester read the same hint 31
 * times over, 5k characters of it.
 */
const withheldLines = (task: string, files: readonly ShownFile[], full: boolean): string[] => {
  const left = files.flatMap(each =>
    each.withheld === undefined
      ? []
      : [`${each.file} (${String(each.withheld)} lines${each.alike ? `, the same in ${each.alike.join(', ')}` : ''})`]
  );

  return left.length === 0
    ? []
    : [
        `  Not shown, ${String(left.length)} file${left.length === 1 ? '' : 's'}: ${left.join(', ')} — plitzi task show ${task} <file> --diff${full ? '' : `, or plitzi task show ${task} --full for every file that fits one answer`}`
      ];
};

/** `plitzi task show`: the task as its lead reviews it — or, with a file, that file whole. */
export const taskShow = (
  first: string | undefined,
  rest: readonly string[],
  options: RunCommandOptions & { full?: boolean; diff?: boolean }
): Promise<void> => {
  // A path first is a file of the task one holds or reviews: a task id has no slash.
  const [taskId, files] = first?.includes('/') === true ? [undefined, [first, ...rest]] : [first, rest];

  return files.length === 0 ? taskShowSummary(taskId, options) : taskShowFiles(taskId, files, options);
};
