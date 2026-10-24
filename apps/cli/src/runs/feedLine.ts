import { isRecord } from '@plitzi/sdk-shared/helpers';

import { designSkipText, isDesignSkip } from './designSkip';
import { commandName } from './runMetrics';
import { reasonOf } from './tasks/nextRules';

import type { FeedLine } from './monitor';

/**
 * Each line of a run's log as the activity says it, to a person following the run: in words — never a command line with
 * its flags and token — every action the CLI writes, none left out on purpose.
 */

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
  const at = textOf(entry.at);
  const by = textOf(entry.by);
  const task = textOf(entry.task);
  const round = typeof entry.round === 'number' ? ` (round ${String(entry.round)})` : '';
  const line = (kind: FeedLine['kind'], text: string): FeedLine => ({ at, by, kind, text, ...(task ? { task } : {}) });
  switch (entry.action) {
    case 'take':
      return line('take', `took ${task}`);
    case 'spike':
      return line('agent', `went back to finding out for ${task}: ${textOf(entry.question)}`);
    case 'spike-done':
      return line(
        entry.status === 'done' ? 'approved' : 'agent',
        `found out for ${task} (${textOf(entry.question)}) — ${entry.status === 'done' ? 'research alone: done' : entry.status === 'pending' || entry.status === 'ready' ? `kept, not built now (${textOf(entry.status)})` : 'building it now'}`
      );
    case 'joined':
      return line('agent', `joined the run${entry.quality ? ` at ${textOf(entry.quality)}` : ''}`);
    case 'complete':
      return line('complete', `sent ${task} to review`);
    case 'check': {
      if (entry.ok === true) {
        return line('other', `checked ${task}: passes`);
      }

      const failed = Array.isArray(entry.failed) ? entry.failed.filter(each => typeof each === 'string') : [];
      const notOwn = Array.isArray(entry.notOwn) ? entry.notOwn.filter(each => typeof each === 'string') : [];
      const theirs = notOwn.length > 0 && failed.every(each => notOwn.includes(each));

      return {
        ...line(
          theirs ? 'other' : 'problem',
          theirs
            ? `checked ${task}: what fails is not its own — ${notOwn.join(', ')}`
            : `checked ${task}: fails — ${failed.join(', ') || 'see its check'}`
        ),
        group: `check:${task}`
      };
    }
    case 'look':
      return line('review', `looked at ${task} (${listOf(entry.paths)})${entry.ok === false ? ': findings' : ''}`);
    case 'review-taken':
      return line('review', `took the ${textOf(entry.review)} review of ${task}`);
    case 'review':
      return entry.verdict === 'approve'
        ? line(
            'approved',
            `approved ${task}${round}${entry.design === 'skipped' ? ` — ${designSkipText(isDesignSkip(entry.designSkip) ? entry.designSkip : undefined)}${typeof entry.designBy === 'string' ? ` (${entry.designBy} had it)` : ''}` : ''}`
          )
        : line('sent-back', `sent ${task} back${round}`);
    case 'handed-on':
      return line(
        'run',
        [
          ...(Array.isArray(entry.granted) && entry.granted.length > 0
            ? [`${task}'s files handed to ${listOf(entry.granted)}`]
            : []),
          ...(Array.isArray(entry.ready) && entry.ready.length > 0 ? [`ready now: ${listOf(entry.ready)}`] : [])
        ].join(' · ')
      );
    case 'design-review':
      return entry.verdict === 'approve'
        ? line('approved', `approved the UI of ${task}`)
        : line('sent-back', `sent ${task}'s UI back${round}`);
    // Its reason alone — what it waits for is said to the agent at length, and filled a row of the activity.
    case 'waiting':
      return line('agent', `waits for work — ${reasonOf(textOf(entry.why))}`);
    case 'resumes':
      return line('agent', `goes on with ${textOf(entry.task)} — ${textOf(entry.question)} answered`);
    case 'handed-off':
      return line(
        'agent',
        `takes over ${textOf(entry.task)}'s changes from ${textOf(entry.from)}, who is at ${textOf(entry.busyAt)}`
      );
    case 'question-taken':
      return line('agent', `answers ${textOf(entry.task)}'s ${textOf(entry.message)}`);
    case 'stops':
      return line('agent', `stops: ${textOf(entry.why)}`);
    case 'settle':
      return line('run', `merged the requests that waited: ${listOf(entry.settled)}`);
    case 'settle-failed':
      return line(
        'run',
        `could not merge the requests that waited: ${listOf(entry.requests)} — ${textOf(entry.reason)}`
      );
    case 'all-approved':
      return line('run', `every task is approved (${String(entry.tasks)}) — next: ${textOf(entry.next)}`);
    case 'ready':
      return line(
        'run',
        `the run is ready: its ${String(entry.files)} files checked whole, ${String(entry.acceptance)} acceptance lines hold — next: ${textOf(entry.next)}`
      );
    case 'note':
      // The note itself is in the feed, in its words, to every task.
      return undefined;
    // Said by the command's name and the refusal's first sentence: a command line with its flags and token read as
    // noise to a person following the run.
    case 'refused':
      return {
        ...line(
          'problem',
          `${commandName(textOf(entry.command)) || 'a command'} was refused (${textOf(entry.code)}): ${firstSentence(textOf(entry.message))}`
        ),
        group: `refused:${textOf(entry.code)}:${commandName(textOf(entry.command))}`
      };
    case 'crashed':
      return line(
        'problem',
        `${commandName(textOf(entry.command)) || 'a command'} crashed: ${firstSentence(textOf(entry.error))}`
      );
    case 'preview-sync-failed':
      return line('problem', `the preview did not take ${task} in: ${textOf(entry.error).slice(0, 120)}`);
    case 'ask':
    case 'tell':
      // The message itself is in the feed, in its words: a second line saying it was sent says nothing more.
      return undefined;
    case 'notice':
      return line(
        'message',
        `${entry.about === 'plitzi' ? 'noticed of Plitzi' : 'noticed, owned by no task'}: ${textOf(entry.text)}${typeof entry.on === 'string' ? ` (on ${entry.on})` : ''}`
      );
    case 'propose':
      return line('message', `proposed ${textOf(entry.proposal)} to ${textOf(entry.to)}`);
    case 'answer':
      return line('message', `answered ${textOf(entry.proposal)}: ${textOf(entry.verdict)}`);
    case 'integration':
      return line('run', `made ${task} for ${textOf(entry.file)}`);
    case 'summary':
      return line('run', 'wrote the run’s summary, its report’s first part');
    // A bare "tokens" said nothing of what was kept (lx-controls).
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
      return line('other', `${textOf(entry.action)}${task ? ` ${task}` : ''}`);
  }
};
