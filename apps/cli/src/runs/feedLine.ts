import { isRecord } from '@plitzi/sdk-shared/helpers';

import { designSkipText, isDesignSkip } from './designSkip';
import { commandName } from './runMetrics';
import { reasonOf } from './tasks/nextRules';

import type { FeedLine } from './monitor';

/**
 * Each line of a run's log as the activity says it, to a person following the run: in words — never a command line with
 * its flags and token — every action the CLI writes, none left out on purpose. The task a line is about is its own
 * column, never said again in its words: "approved (round 2)", not "approved t-shell (round 2)".
 *
 * Two texts a line: `text`, what a glance reads — `SHORT` at most, in its own words where the whole would be cut — and
 * `detail`, the whole, opened under it. A run's activity ran to 499 characters a line (a failed check naming every
 * file of every other task), and a tenth of its lines past 200: a person following the run read none of them.
 */

/** The longest a line's `text` is: what a glance down the activity reads. */
export const SHORT = 72;

/** A line whose text is past `SHORT`: cut, the whole kept as its detail — one that says its own short words has both. */
export const briefLine = (line: FeedLine): FeedLine =>
  line.detail === undefined && line.text.length > SHORT
    ? { ...line, text: glimpse(line.text, SHORT - 1), detail: line.text }
    : line;

/** A check's failure in a few words: the steps that failed — the acceptance's lines counted — and the files of others. */
const failedText = (failed: readonly string[]): string => {
  // A file another task holds is said "<file> is <task>'s" (`notOwn.ts`).
  const theirs = failed.filter(each => / is \S+'s$/.test(each));
  const steps = failed.filter(each => !theirs.includes(each));
  const accepted = steps.filter(each => each.startsWith('acceptance'));
  const named = [
    ...steps.filter(each => !accepted.includes(each)),
    ...(accepted.length === 0
      ? []
      : [accepted.length === 1 ? 'an acceptance line' : `${String(accepted.length)} acceptance lines`])
  ];

  return [
    named.join(', '),
    theirs.length === 0 ? '' : `${String(theirs.length)} file${theirs.length === 1 ? '' : 's'} of other tasks`
  ]
    .filter(Boolean)
    .join(' + ');
};

/** Why an agent stopped, in a few words: the whole is the line's detail. */
const stopText = (why: string): string =>
  /fresh context|freshContextAt/.test(why)
    ? 'stops for a fresh context — started again for what comes'
    : /on demand/.test(why)
      ? 'stops — on demand, nothing came for it'
      : /no review came|other leads review/.test(why)
        ? 'stops — no reviews for it now'
        : /every one is done|nothing is left|no task is left/.test(why)
          ? 'stops — nothing is left for it'
          : 'stops';

/** A refusal's or an error's first sentence, as a line says it: what went wrong, its details left to the command. */
const firstSentence = (text: string): string => glimpse(text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)[0] ?? '');

export const glimpse = (text: string, length = 140): string =>
  text.length <= length ? text : `${text.slice(0, length).trimEnd()}…`;

/** One line of the run's log, said — `undefined` for what is not worth a person's look (a heartbeat, a brake event). */
export const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
const listOf = (value: unknown): string =>
  Array.isArray(value) ? value.filter(each => typeof each === 'string').join(', ') : '';

/** One line of the run's activity, as the feed says it — every action the CLI writes, none left out on purpose. */
export const feedOf = (entry: Record<string, unknown>): FeedLine | undefined => {
  const said = lineOf(entry);

  return said === undefined ? undefined : briefLine(said);
};

const lineOf = (entry: Record<string, unknown>): FeedLine | undefined => {
  const at = textOf(entry.at);
  const by = textOf(entry.by);
  const task = textOf(entry.task);
  const round = typeof entry.round === 'number' ? ` (round ${String(entry.round)})` : '';
  const line = (kind: FeedLine['kind'], text: string, detail?: string): FeedLine => ({
    at,
    by,
    kind,
    text,
    ...(detail !== undefined && detail !== text ? { detail } : {}),
    ...(task ? { task } : {})
  });
  switch (entry.action) {
    case 'take':
      return line('take', 'took it');
    case 'spike':
      return line('agent', `went back to finding out: ${textOf(entry.question)}`);
    case 'spike-done': {
      const outcome =
        entry.status === 'done'
          ? 'research alone: done'
          : entry.status === 'pending' || entry.status === 'ready'
            ? `kept, not built now (${textOf(entry.status)})`
            : 'building it now';

      return line(
        entry.status === 'done' ? 'approved' : 'agent',
        `found out — ${outcome}`,
        `found out (${textOf(entry.question)}) — ${outcome}`
      );
    }
    case 'joined':
      return line('agent', `joined the run${entry.quality ? ` at ${textOf(entry.quality)}` : ''}`);
    case 'complete':
      return line('complete', 'sent it to review');
    case 'check': {
      if (entry.ok === true) {
        return line('other', 'checked: passes');
      }

      const failed = Array.isArray(entry.failed) ? entry.failed.filter(each => typeof each === 'string') : [];
      const notOwn = Array.isArray(entry.notOwn) ? entry.notOwn.filter(each => typeof each === 'string') : [];
      const theirs = notOwn.length > 0 && failed.every(each => notOwn.includes(each));

      return {
        ...line(
          theirs ? 'other' : 'problem',
          theirs ? 'checked: what fails is not its own' : `checks fail: ${failedText(failed) || 'see its check'}`,
          theirs
            ? `checked: what fails is not its own — ${notOwn.join(', ')}`
            : `checked: fails — ${failed.join(', ') || 'see its check'}`
        ),
        group: `check:${task}`
      };
    }
    case 'look':
      return line(
        'review',
        `looked at it${entry.ok === false ? ' — findings' : ''}`,
        `looked at it (${listOf(entry.paths)})${entry.ok === false ? ': findings' : ''}`
      );
    case 'review-taken':
      return line('review', `took its ${textOf(entry.review)} review`);
    case 'review':
      return entry.verdict === 'approve'
        ? line(
            'approved',
            `approved${round}${entry.design === 'skipped' ? (entry.designSkip === 'no-ui' ? ' — no UI' : ' — its UI by its reviewer') : ''}`,
            `approved${round}${entry.design === 'skipped' ? ` — ${designSkipText(isDesignSkip(entry.designSkip) ? entry.designSkip : undefined)}${typeof entry.designBy === 'string' ? ` (${entry.designBy} had it)` : ''}` : ''}`
          )
        : line('sent-back', `sent back${round}`);
    case 'handed-on':
      return line(
        'run',
        [
          ...(Array.isArray(entry.granted) && entry.granted.length > 0
            ? [`its files handed to ${listOf(entry.granted)}`]
            : []),
          ...(Array.isArray(entry.ready) && entry.ready.length > 0 ? [`ready now: ${listOf(entry.ready)}`] : [])
        ].join(' · ')
      );
    case 'design-review':
      return entry.verdict === 'approve'
        ? line('approved', 'approved its UI')
        : line('sent-back', `sent its UI back${round}`);
    // Its reason alone — what it waits for is said to the agent at length, and filled a row of the activity.
    case 'waiting':
      return line('agent', `waits for work — ${reasonOf(textOf(entry.why))}`);
    case 'resumes':
      return line('agent', `goes on — ${textOf(entry.question)} answered`);
    case 'question-taken':
      return line('agent', `answers its ${textOf(entry.message)}`);
    case 'stops':
      return line('agent', stopText(textOf(entry.why)), `stops: ${textOf(entry.why)}`);
    case 'settle':
      return line('run', `merged the requests that waited: ${listOf(entry.settled)}`);
    case 'settle-failed':
      return line(
        'run',
        `could not merge the requests that waited: ${listOf(entry.requests)} — ${textOf(entry.reason)}`
      );
    case 'all-approved':
      return line(
        'run',
        `every task is approved (${String(entry.tasks)})`,
        `every task is approved (${String(entry.tasks)}) — next: ${textOf(entry.next)}`
      );
    case 'ready':
      return line(
        'run',
        'the run is ready to finish — a person applies it',
        `the run is ready: its ${String(entry.files)} files checked whole, ${String(entry.acceptance)} acceptance lines hold — next: ${textOf(entry.next)}`
      );
    case 'note':
      // The note itself is in the feed, in its words, to every task.
      return undefined;
    // A piece of work's spend is the spend panel's, beside the activity: a line each would say a number twice.
    case 'spent':
      return undefined;
    // Said by the command's name and the refusal's first sentence: a command line with its flags and token read as
    // noise to a person following the run.
    case 'refused':
      return {
        ...line(
          'problem',
          `${commandName(textOf(entry.command)) || 'a command'} refused — ${textOf(entry.code).replace(/-/g, ' ')}`,
          `${commandName(textOf(entry.command)) || 'a command'} was refused (${textOf(entry.code)}): ${firstSentence(textOf(entry.message))}`
        ),
        group: `refused:${textOf(entry.code)}:${commandName(textOf(entry.command))}`
      };
    case 'crashed':
      return line(
        'problem',
        `${commandName(textOf(entry.command)) || 'a command'} crashed`,
        `${commandName(textOf(entry.command)) || 'a command'} crashed: ${firstSentence(textOf(entry.error))}`
      );
    case 'preview-sync-failed':
      return line('problem', `the preview did not take it in: ${textOf(entry.error).slice(0, 120)}`);
    case 'ask':
    case 'tell':
      // The message itself is in the feed, in its words: a second line saying it was sent says nothing more.
      return undefined;
    case 'notice':
      return line(
        'message',
        `${entry.about === 'plitzi' ? 'noticed of Plitzi' : 'noticed'}: ${textOf(entry.text)}`,
        `${entry.about === 'plitzi' ? 'noticed of Plitzi' : 'noticed, owned by no task'}: ${textOf(entry.text)}${typeof entry.on === 'string' ? ` (on ${entry.on})` : ''}`
      );
    case 'propose':
      return line('message', `proposed ${textOf(entry.proposal)} to ${textOf(entry.to)}`);
    case 'answer':
      return line('message', `answered ${textOf(entry.proposal)}: ${textOf(entry.verdict)}`);
    case 'integration':
      return line('run', `integration task, for ${textOf(entry.file)}`);
    case 'summary':
      return line('run', 'wrote the run’s summary, its report’s first part');
    // A bare "tokens" said nothing of what was kept.
    case 'tokens':
      return line('run', `kept what the harness counted each agent spent: ${listOf(entry.agents)}`);
    case 'launch':
      return line(
        'run',
        `started ${textOf(entry.agent)} in ${textOf(entry.harness)}${entry.resumed === true ? ', resuming its session' : ''}`
      );
    case 'message':
      // Each message is in the feed by its own words, read from the messages.
      return undefined;
    case 'stop':
    case 'resume':
    case 'extend':
    case 'amend':
    case 'attach':
    case 'brake':
    case 'open': {
      const said: Record<string, string> = {
        stop: 'stopped the run',
        resume: 'opened the run again',
        extend: `stacked a stage${typeof entry.stage === 'string' ? ` (${entry.stage})` : ''}`,
        amend: `amended the plan${Array.isArray(entry.tasks) ? ` (${entry.tasks.flatMap(each => (isRecord(each) && typeof each.task === 'string' ? [each.task] : [])).join(', ')})` : ''}${Array.isArray(entry.removed) ? `, removed ${listOf(entry.removed)}` : ''}`,
        attach: 'attached the run',
        brake: 'the brake stopped the run',
        open: `opened the run${typeof entry.tasks === 'number' ? ` — ${String(entry.tasks)} tasks${typeof entry.inventory === 'number' ? `, ${String(entry.inventory)} pieces` : ''}` : ''}`
      };

      return line(
        entry.action === 'brake' ? 'problem' : 'run',
        `${said[entry.action] ?? ''}${typeof entry.reason === 'string' ? ` — ${entry.reason}` : ''}`
      );
    }
    default:
      // An action this feed has no words for yet is said as it is written: never dropped.
      return line('other', textOf(entry.action));
  }
};
