import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { MAX_LINES } from '../../../lint/rules/fileTooLong';
import { sessionOfProcess } from '../../../runs/agents/session';
import { namesServedCopy } from '../../../runs/copies/acceptance';
import { acceptanceText } from '../../../runs/core/model';
import { runPaths } from '../../../runs/core/paths';
import { importedApis } from '../../../runs/plan/moduleApis';
import { isResearch, roleOf } from '../../../runs/plan/spike';
import { logRun, readRunLog } from '../../../runs/run';
import { taskContext } from '../../../runs/tasks';
import { describeData } from '../../project/data';
import { act, either } from '../shell';
import { nearLimit } from '../text';

import type { Finding } from '../../../runs/plan/spike';
import type { TaskContext } from '../../../runs/tasks';
import type { RunCommandOptions } from '../shell';

/**
 * `plitzi task context`: the brief, in text — the shape of the data its files import and how what they import is called;
 * with `--files`, the files themselves too.
 */

/** A JSON file a module imports (`import pets from '../../data/pets.json' with …`), by its project path. */
const dataImports = (file: string, text: string): string[] =>
  [...text.matchAll(/from\s+['"](\.{1,2}\/[^'"]+\.json)['"]/g)].map(match =>
    path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]))
  );

/**
 * The shape of each JSON file a task's files import (as `plitzi data describe` says it) — and, with `--files`, the
 * files as they are: the cold start's `cat`s, in one call, for a harness that has no reader of its own.
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

type Brief = TaskContext & {
  /** When this agent read the primer whole on this task, unchanged since: said in a line, not again. */
  primerRead?: string;
  /** When this agent read this very brief in this session of its harness: said in a line, not again. */
  readBefore?: { at: string; chars: number };
  whole: boolean;
  data: Awaited<ReturnType<typeof filesOf>>;
  imports: Awaited<ReturnType<typeof importedApis>>;
};

/** A class a module declares (`roomAmbient = styles('room-ambient', …) — …`): read by its name alone. */
const CLASS_LINE = /^(\w+) = styles\(/;

/**
 * A module's names as the brief says them: its classes in one line, by name — how a class is "called" says nothing,
 * and a room's forty classes were 3k of an 18k brief, read five times — and the rest, each its line.
 */
export const importedLines = (names: readonly string[]): string[] => {
  const classes = names.flatMap(name => CLASS_LINE.exec(name)?.[1] ?? []);
  const rest = names.filter(name => !CLASS_LINE.test(name));

  return [...(classes.length > 0 ? [`  classes: ${classes.join(', ')}`] : []), ...rest.map(name => `  ${name}`)];
};

/** The brief's parts as printed: the task's own, the files themselves (`--files`), the data's shapes, what they import. */
const partsOf = (context: Brief): { brief: string; files: string; shapes: string; imports: string } => ({
  brief: briefOf(context),
  files: (context.whole
    ? context.files.flatMap(each =>
        each.text === undefined
          ? each.toCreate
            ? [chalk.bold(`── ${each.file} — to create`)]
            : []
          : [chalk.bold(`── ${each.file} (${String(each.text.split('\n').length)} lines)`), each.text.trimEnd()]
      )
    : []
  ).join('\n'),
  shapes: context.data.flatMap(each => [chalk.bold(`── ${each.file}, its shape`), each.shape]).join('\n'),
  imports: (context.imports.length > 0
    ? [
        chalk.bold(
          '── What these files import from the rest of the project — how each is called, not its body (read the file only for what this does not say):'
        ),
        ...context.imports.flatMap(each => [each.file, ...importedLines(each.names)])
      ]
    : []
  ).join('\n')
});

/** A text as the log marks it: read once by an agent on a task, it is not printed whole again while unchanged. */
export const primerMark = (primer: string): string => createHash('sha256').update(primer).digest('hex').slice(0, 12);

/**
 * When `agent` read what `field` marks on `task` in `session` — what its context holds still. Another session is a fresh
 * context, which read none of it: a run starts its agents afresh after each task or review, and the primer withheld
 * from one restarted for its round 2 was never read by it.
 */
export const readInSession = (
  log: readonly Record<string, unknown>[],
  { agent, task, session }: { agent: string; task: string; session: string | undefined },
  field: 'primer' | 'seen',
  mark: string
): Record<string, unknown> | undefined =>
  log.findLast(
    entry =>
      entry.action === 'brief' &&
      entry.by === agent &&
      entry.task === task &&
      entry.session === session &&
      entry[field] === mark
  );

export const taskContextCommand = (
  taskId: string | undefined,
  options: RunCommandOptions & { files?: boolean; again?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const target = await either(ctx, options, taskId);
      const context = await taskContext(ctx, target.runId, target.taskId);
      const paths = runPaths(ctx.root, target.runId);
      const mark = context.primer === undefined ? undefined : primerMark(context.primer);
      const reader = { agent: ctx.agent, task: target.taskId, session: sessionOfProcess().session };
      const log = await readRunLog(paths);
      // A run's briefs carried the lead's 7k primer every time one was read again — 46% of 230k characters re-read.
      const primerRead =
        mark === undefined || options.again === true ? undefined : readInSession(log, reader, 'primer', mark)?.at;
      const whole: Brief = {
        ...context,
        ...(typeof primerRead === 'string' ? { primerRead } : {}),
        whole: options.files === true,
        data: await filesOf(context.sourceRoot, context),
        imports: await importedApis(context.sourceRoot, context.files)
      };
      // What each part weighs, for the report: an agent reads its brief again on every turn after, and which part is
      // heavy was guessed (61 briefs, up to 21k characters, read again for 1.1M tokens).
      const parts = partsOf(whole);
      const printed = Object.values(parts).join('\n');
      const seen = primerMark(printed);
      // The same brief asked again in one context is in it already: a run's dev-1 read its 13-18k four times.
      const before = options.again === true ? undefined : readInSession(log, reader, 'seen', seen)?.at;
      const brief: Brief =
        typeof before === 'string' ? { ...whole, readBefore: { at: before, chars: printed.length } } : whole;
      const primer = whole.primerRead === undefined ? (context.primer?.trim().length ?? 0) : 0;
      await logRun(ctx, paths, {
        action: 'brief',
        task: target.taskId,
        seen,
        ...(reader.session === undefined ? {} : { session: reader.session }),
        ...(mark === undefined || whole.primerRead !== undefined ? {} : { primer: mark }),
        parts:
          brief.readBefore === undefined
            ? {
                primer,
                brief: parts.brief.length - primer,
                files: parts.files.length,
                shapes: parts.shapes.length,
                imports: parts.imports.length
              }
            : { primer: 0, brief: 0, files: 0, shapes: 0, imports: 0 }
      });

      return brief;
    },
    // The files themselves only with --files: an agent reads the ones it changes with its own reader — one that must
    // read a file before it edits it read each twice. A run's t-body-type: 57 KB with them, 3.5 KB without.
    context =>
      context.readBefore === undefined
        ? Object.values(partsOf(context))
            .filter(part => part !== '')
            .join('\n')
        : `${context.task.id}'s brief is as you read it at ${context.readBefore.at.slice(11, 16)} UTC (${String(context.readBefore.chars)} characters): nothing in it changed since — what is new comes with your commands. Lost from your context? plitzi task context --again`
  );

/**
 * A task in a page an agent reads before it starts: what is asked, what holds for the whole run, what was decided with
 * others, what a review asked — and only where the rest is (`--json`: every file's text, every related task's notes).
 */
/**
 * What a brief says of a related task and of a note: enough to act on, the whole one command away. Read again on every
 * turn of the task, a run's briefs ran to 17k characters — 4k of it what two tasks before it were asked and how
 * their reviews went, their work already in the copy.
 */
const RELATED_LINES = 6;
const LINE_SHOWN = 200;
const NOTE_SHOWN = 300;

const clipped = (text: string, most: number, whole: string): string =>
  text.length <= most ? text : `${text.slice(0, most).trimEnd()}… (${whole})`;

/** A finding, with what the run approved of the task's files since it was written: what it may no longer say right. */
const findingsText = (title: string, findings: readonly Finding[], approved: TaskContext['approved']): string[] =>
  findings.length > 0
    ? [
        title,
        ...findings.map(each => {
          const since = approved.filter(file => file.at > each.at);

          return `  ◇ ${each.question} — ${each.text} (${each.by}, ${each.at.slice(11, 16)} UTC)${
            since.length > 0
              ? chalk.yellow(
                  ` — changed since by the run: ${since.map(file => `${file.file} (${file.task})`).join(', ')}; read them before you build on it`
                )
              : ''
          }`;
        })
      ]
    : [];

export const briefOf = (context: TaskContext & { primerRead?: string }): string => {
  const { task, state } = context;
  const files = context.files.map(
    file =>
      `${file.file}${file.toCreate ? ' (to create)' : file.text === undefined ? '' : ` (${String(file.text.split('\n').length)} lines)`}`
  );
  const comments = context.review?.verdict === 'changes' ? context.review.comments : [];
  const notesShown = state.notes.filter(
    note => !(comments.length > 0 && note.kind === 'review' && note.round === (context.review?.round ?? 0))
  );
  const unanswered = context.proposals.incoming.filter(each => each.answer === undefined);

  return [
    ...(context.primer === undefined
      ? []
      : context.primerRead !== undefined
        ? [
            chalk.dim(
              `The run’s primer: as you read it at ${context.primerRead.slice(11, 16)} UTC, unchanged — whole again: plitzi task context --again`
            ),
            ''
          ]
        : [
            chalk.bold('The run’s primer — the lead’s, for every task: read it before anything else'),
            context.primer.trim(),
            ''
          ]),
    chalk.bold(`${task.id} — ${task.title}`),
    `  ${roleOf(task)} · ${state.status}${state.round > 0 ? `, round ${String(state.round)}` : ''}${context.holder ? ` · ${context.holder}` : ''}`,
    // Research writes no file: what it is to find out says it all (a scout read "Its files:" and how a file goes in).
    ...(isResearch(task)
      ? []
      : [
          `Its files: ${files.join(', ')}${task.touches && task.touches.length > 0 ? ` · it will touch: ${task.touches.join(', ')}` : ''}`,
          ...(context.neighbours.length > 0
            ? [
                `  Beside them, another task's — write nothing there: ${context.neighbours.map(each => `${each.file} (${each.task}, a ${each.role}'s)`).join(', ')}`
              ]
            : []),
          // What the work needs beyond them is not refused: it is said how it goes in.
          '  A file beyond these the work needs: change it in your copy — it goes in by turns at complete when nobody holds it (plitzi task claim <file> holds it while you work; one another task holds becomes a request)'
        ]),
    // What it is to find out, before anything is built — and what was found already: by it, and by what it waits for.
    ...(isResearch(task) && state.status !== 'done'
      ? [
          chalk.blue(
            `◇ Research — find out: ${task.spike ?? 'what it needs'}. Read, compare, measure; write nothing; then say what you found and its result, the tasks it makes, each with its "findings" and a line a command proves — seen first with plitzi run open <stage.json> --dry-run --lines — plitzi task complete --found "…" --tasks <stage.json>`
          )
        ]
      : []),
    ...findingsText(`What ${task.id}'s spikes found`, state.findings ?? [], context.approved),
    ...context.related.flatMap(each =>
      findingsText(`What ${each.task} found — read it before you build`, each.findings ?? [], context.approved)
    ),
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
    ...(notesShown.length > 0
      ? [
          'Its notes',
          ...notesShown.slice(-5).map(note => `  ${note.by}: ${clipped(note.text, NOTE_SHOWN, 'whole: --json')}`)
        ]
      : []),
    ...(context.related.length > 0
      ? [`Related: ${context.related.map(each => `${each.task} (${each.status})`).join(', ')}`]
      : []),
    // Its acceptance, what it was held to — not how its reviews went: its work is in the copy.
    ...context.related.flatMap(each =>
      each.asked
        ? [
            `What ${each.task} was asked — it is done before this one:`,
            ...each.asked.acceptance
              .slice(0, RELATED_LINES)
              .map(line => `  ☐ ${clipped(line, LINE_SHOWN, `plitzi task show ${each.task}`)}`),
            ...(each.asked.acceptance.length > RELATED_LINES
              ? [`  … ${String(each.asked.acceptance.length - RELATED_LINES)} more: plitzi task show ${each.task}`]
              : [])
          ]
        : []
    ),
    // A file near the line has little room: where the new part goes is decided before the first edit, not after.
    ...nearLimit(context).map(each =>
      chalk.yellow(
        `  ⚠ ${each.file} is ${String(each.lines)} non-blank lines of ${String(MAX_LINES)}: what you add likely goes in a module of its own, beside it — a new file is yours (no task holds it; it goes in with your complete), though your files do not list it`
      )
    ),
    ...(context.reading.length > 0
      ? [`Read first, for this work — the rest of the skills when the work asks: ${context.reading.join(', ')}`]
      : []),
    `${context.projectNotes ? 'The project’s notes: NOTES.md — read it. ' : ''}Every file's text and every related task's notes: --json.`
  ].join('\n');
};
