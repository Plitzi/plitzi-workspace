import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { MAX_LINES } from '../../../lint/rules/fileTooLong';
import { sessionOfProcess } from '../../../runs/agents/session';
import { namesServedCopy } from '../../../runs/copies/acceptance';
import { acceptanceText } from '../../../runs/core/model';
import { runPaths } from '../../../runs/core/paths';
import { answerParts } from '../../../runs/core/usage';
import { importedApis } from '../../../runs/plan/moduleApis';
import { isResearch, roleOf } from '../../../runs/plan/spike';
import { logRun, readRunLog } from '../../../runs/run';
import { taskContext } from '../../../runs/tasks';
import { projectRun } from '../../../scaffold/packageManager';
import { describeData } from '../../project/data';
import { act, either } from '../shell';
import { nearLimit } from '../text';

import type { Finding } from '../../../runs/plan/spike';
import type { RunContext } from '../../../runs/run';
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

export type Brief = TaskContext & {
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

/** How much of a name's doc the brief says beside its signature: what it is for, not all it does. */
const DOC_SHOWN = 60;

/** How many of a module's names the brief says with their signature: past them, by name in a line. */
const NAMES_SIGNED = 8;

/** A name's line with its doc cut to `DOC_SHOWN`, at a word: its signature, how it is called, always whole. */
const signedLine = (line: string): string => {
  const at = line.indexOf(' — ');
  const doc = at === -1 ? '' : line.slice(at + 3);
  if (doc.length <= DOC_SHOWN) {
    return line;
  }

  const cut = doc.slice(0, DOC_SHOWN);

  return `${line.slice(0, at)} — ${cut.slice(0, Math.max(cut.lastIndexOf(' '), DOC_SHOWN / 2)).trimEnd()}…`;
};

/**
 * A module's names as the brief says them: its classes in one line, by name — how a class is "called" says nothing,
 * and a room's forty classes were 3k of an 18k brief, read five times — and the rest each its line, its signature
 * whole and its doc short; past `NAMES_SIGNED`, by name, the module a read away. A run's map component imported 38
 * names from nine modules: 5.6k of a 14.5k brief, half of it docs.
 */
export const importedLines = (names: readonly string[], module = 'the module'): string[] => {
  const classes = names.flatMap(name => CLASS_LINE.exec(name)?.[1] ?? []);
  const rest = names.filter(name => !CLASS_LINE.test(name));
  const unsigned = rest.slice(NAMES_SIGNED).map(name => /^[\w$]+/.exec(name)?.[0] ?? name);

  return [
    ...(classes.length > 0 ? [`  classes: ${classes.join(', ')}`] : []),
    ...rest.slice(0, NAMES_SIGNED).map(name => `  ${signedLine(name)}`),
    ...(unsigned.length > 0 ? [`  also ${unsigned.join(', ')} — how each is called: ${module}`] : [])
  ];
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
        ...context.imports.flatMap(each => [each.file, ...importedLines(each.names, each.file)])
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

/**
 * A task's brief, read as its holder reads it — kept in the run's log by its parts, a part read already in this session
 * left out (`primerRead`, `readBefore`): what `task context` answers, and what `task next` hands with the task it gives.
 */
export const readBrief = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  { files = false, again = false }: { files?: boolean; again?: boolean } = {}
): Promise<Brief> => {
  const context = await taskContext(ctx, runId, taskId);
  const paths = runPaths(ctx.root, runId);
  const mark = context.primer === undefined ? undefined : primerMark(context.primer);
  const reader = { agent: ctx.agent, task: taskId, session: sessionOfProcess().session };
  const log = await readRunLog(paths);
  // A run's briefs carried the lead's 7k primer every time one was read again — 46% of 230k characters re-read.
  const primerRead = mark === undefined || again ? undefined : readInSession(log, reader, 'primer', mark)?.at;
  const whole: Brief = {
    ...context,
    ...(typeof primerRead === 'string' ? { primerRead } : {}),
    whole: files,
    data: await filesOf(context.sourceRoot, context),
    imports: await importedApis(context.sourceRoot, context.files)
  };
  // What each part weighs, for the report: an agent reads its brief again on every turn after, and which part is
  // heavy was guessed (61 briefs, up to 21k characters, read again for 1.1M tokens).
  const parts = partsOf(whole);
  const printed = Object.values(parts).join('\n');
  const seen = primerMark(printed);
  // The same brief asked again in one context is in it already: a run's dev-1 read its 13-18k four times.
  const before = again ? undefined : readInSession(log, reader, 'seen', seen)?.at;
  const brief: Brief =
    typeof before === 'string' ? { ...whole, readBefore: { at: before, chars: printed.length } } : whole;
  const primer = whole.primerRead === undefined ? (context.primer?.trim().length ?? 0) : 0;
  if (brief.readBefore === undefined) {
    answerParts({
      primer,
      brief: parts.brief.length - primer,
      files: parts.files.length,
      shapes: parts.shapes.length,
      imports: parts.imports.length
    });
  }

  await logRun(ctx, paths, {
    action: 'brief',
    task: taskId,
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
};

/**
 * A brief as an agent reads it. The files themselves only with --files: an agent reads the ones it changes with its own
 * reader — one that must read a file before it edits it read each twice. A run's t-body-type: 57 KB with them, 3.5 KB
 * without.
 */
export const briefText = (context: Brief): string =>
  context.readBefore === undefined
    ? Object.values(partsOf(context))
        .filter(part => part !== '')
        .join('\n')
    : `${context.task.id}'s brief is as you read it at ${context.readBefore.at.slice(11, 16)} UTC (${String(context.readBefore.chars)} characters): nothing in it changed since — what is new comes with your commands. Lost from your context? plitzi task context --again`;

export const taskContextCommand = (
  taskId: string | undefined,
  options: RunCommandOptions & { files?: boolean; again?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const target = await either(ctx, options, taskId);

      return readBrief(ctx, target.runId, target.taskId, {
        files: options.files === true,
        again: options.again === true
      });
    },
    briefText
  );

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

/** What the work tasks a task waits on were told before they were built: theirs, each named, read with `task show`. */
const toldText = (related: TaskContext['related']): string[] => {
  const told = related.filter(each => each.research !== true && (each.findings ?? []).length > 0);
  const size = (findings: readonly Finding[]): number =>
    findings.reduce((sum, finding) => sum + finding.text.length, 0);

  return told.length === 0
    ? []
    : [
        `What the tasks it waits on were told before they were built — theirs, a command away (plitzi task show <task>): ${told.map(each => `${each.task} (${String(size(each.findings ?? []))} characters)`).join(', ')}`
      ];
};

/** The files near the line of `MAX_LINES`, said in one line: where what is added to them goes. */
const nearLimitText = (near: readonly { file: string; lines: number }[]): string[] =>
  near.length === 0
    ? []
    : [
        chalk.yellow(
          `  ⚠ Near ${String(MAX_LINES)} non-blank lines: ${near.map(each => `${each.file} (${String(each.lines)})`).join(', ')} — what you add to ${near.length === 1 ? 'it' : 'one'} likely goes in a module of its own, beside it: a new file is yours (no task holds it; it goes in with your complete), though your files do not list it`
        )
      ];

/**
 * A task in a page an agent reads before it starts: what is asked, what holds for the whole run, what was decided with
 * others, what a review asked — and only where the rest is (`--json`: every file's text, every related task's notes).
 */
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
          ...(context.restrictions.length > 0
            ? [
                // The project's rules, said as rules — a ✗ before each read as a warning about the task's own code,
                // to an agent already keeping the rule.
                '  The project’s lint rules for them, as its config says them (task check holds them):',
                ...context.restrictions.map(each => `    · ${each}`)
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
    // What a research card it waits on found is what it builds on, whole. What a work task it waits on was told before
    // it was built is that task's, said in a line: a run's feed task read nine tasks' notes, 15k of its 22k brief.
    ...context.related.flatMap(each =>
      each.research === true
        ? findingsText(`What ${each.task} found — read it before you build`, each.findings ?? [], context.approved)
        : []
    ),
    ...toldText(context.related),
    ...(task.acceptance.length > 0
      ? [
          'Acceptance — a line with a check is run at complete; run it yourself in your copy first',
          ...(task.acceptance.some(each => typeof each !== 'string' && namesServedCopy(each.check))
            ? [
                `  (At complete, the copy is served and $PLITZI_URL / $PLITZI_PORT are written into the check — PORT is set, for a Playwright spec. To run one yourself: start the copy on a free port (PORT=<port> ${projectRun('start')}), put http://127.0.0.1:<port> where the check says $PLITZI_URL, and stop that server before complete, which starts its own)`
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
    // Its acceptance, what it was held to — not how its reviews went — while it is still to be done: a done one's work
    // is in the copy, and what it was asked is a command away (a run's brief held three done tasks' lines, 3.4k of 21k).
    ...context.related.flatMap(each =>
      each.asked && each.status !== 'done'
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
    // A file near the line has little room: where the new part goes is decided before the first edit, not after. Said
    // once for all of them: six files near it were six copies of one sentence.
    ...nearLimitText(nearLimit(context)),
    ...(context.reading.length > 0
      ? [`Read first, for this work — the rest of the skills when the work asks: ${context.reading.join(', ')}`]
      : []),
    `${context.projectNotes ? 'The project’s notes: NOTES.md — read it. ' : ''}Every file's text and every related task's notes: --json.`
  ].join('\n');
};
