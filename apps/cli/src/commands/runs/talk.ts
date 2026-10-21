import { act, holder, runOf, taskOf } from './shell';
import { exchangeLines, messageLines } from './text';
import { durationText, FOLLOW_MS } from '../../options';
import { proposalsOf } from '../../runs/agreements';
import { noticeRun, noticeText } from '../../runs/notices';
import { runPaths } from '../../runs/paths';
import { answerProposal, proposeChange } from '../../runs/proposals';
import { RunRefusal } from '../../runs/refusal';
import { loadRun } from '../../runs/run';
import { runChanged } from '../../runs/runChanged';
import { askLead, messageTasks, readInbox, tellLead, tellLeadAbout } from '../../runs/talk';
import { followWait } from '../../runs/tasks';

import type { RunCommandOptions } from './shell';
import type { Message } from '../../runs/messages';

/**
 * Tasks and the lead talking: proposals and their answers, questions, tells, messages and the inbox.
 */

export interface ProposeOptions extends RunCommandOptions {
  change: string;
  about?: string;
  why?: string;
  wait?: boolean;
  /** With `wait`: stay until the answer comes. */
  follow?: boolean;
}

export const taskPropose = (toTask: string, options: ProposeOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      const proposed = await proposeChange(ctx, runId, taskId, toTask, {
        change: options.change,
        ...(options.about ? { about: options.about } : {}),
        ...(options.why ? { why: options.why } : {}),
        wait: (options.wait ?? false) || (options.follow ?? false)
      });

      return options.follow ? { ...proposed, followed: await followWait(ctx, runId, taskId) } : proposed;
    },
    proposed =>
      'followed' in proposed
        ? `${proposed.proposal.to} answered ${proposed.proposal.id}: ${proposed.followed.note ?? ''}`
        : proposed.waiting
          ? `Proposed to ${proposed.proposal.to} as ${proposed.proposal.id}; this task waits for the answer (--follow stays until it comes). Go on with what does not need it.`
          : `Proposed to ${proposed.proposal.to} as ${proposed.proposal.id}. Its answer comes in plitzi task proposals.`,
    0
  );

export interface AnswerOptions extends RunCommandOptions {
  accept?: boolean;
  reject?: string;
  counter?: string;
  note?: string;
}

export const taskAnswer = (proposal: string, options: AnswerOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const verdicts = [
        options.accept ? 'accept' : '',
        options.reject ? 'reject' : '',
        options.counter ? 'counter' : ''
      ].filter(Boolean);
      const [verdict] = verdicts;
      if (verdicts.length !== 1 || (verdict !== 'accept' && verdict !== 'reject' && verdict !== 'counter')) {
        throw new RunRefusal(
          'invalid',
          'Answer with one of --accept, --reject "why" or --counter "the change instead"'
        );
      }

      return answerProposal(ctx, await runOf(ctx, options), proposal, {
        verdict,
        ...(options.reject ? { note: options.reject } : options.note ? { note: options.note } : {}),
        ...(options.counter ? { counter: options.counter } : {})
      });
    },
    answered =>
      answered.counter
        ? `${answered.answer.proposal}: countered with ${answered.counter.id}, to ${answered.counter.to}.`
        : `${answered.answer.proposal}: ${answered.answer.verdict === 'accept' ? 'accepted — an agreement both tasks carry into review' : 'rejected'}.`
  );

export const taskProposals = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const all = await proposalsOf(await loadRun(ctx, await runOf(ctx, options), { anyVersion: true }));
      const mine = ctx.token ? taskOf(ctx) : undefined;

      return mine ? all.filter(each => each.to === mine || each.from === mine) : all;
    },
    all =>
      all.length === 0
        ? 'No proposals.'
        : all
            .map(
              each =>
                `${each.id} ${each.from} → ${each.to}: ${each.change}${each.about ? ` (${each.about})` : ''} — ${each.answer ? `${each.answer.verdict}${each.answer.note ? `: ${each.answer.note}` : ''}` : 'unanswered'}`
            )
            .join('\n')
  );

export const taskAsk = (
  text: string,
  options: RunCommandOptions & { follow?: boolean; timeout?: number }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return askLead(ctx, runId, taskId, text, {
        follow: options.follow ?? false,
        timeoutMs: options.timeout ?? FOLLOW_MS
      });
    },
    asked =>
      asked.reply
        ? [`The lead answered (${asked.reply.id}): ${asked.reply.text}`, ...messageLines(asked.messages)].join('\n')
        : options.follow
          ? `Asked (${asked.question.id}); no answer yet after ${durationText(options.timeout ?? FOLLOW_MS)} — go on with what you can, it comes with your next heartbeat.`
          : `Asked (${asked.question.id}): the answer comes with your next heartbeat, progress or completion — or stay for it with --follow.`
  );

export const taskTell = (text: string, options: RunCommandOptions & { about?: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);

      // With no task in hand, about one: a reviewer's finding, said by its name.
      return ctx.token === undefined && options.about !== undefined
        ? tellLeadAbout(ctx, runId, options.about, text)
        : tellLead(ctx, runId, taskOf(ctx, options.about), text);
    },
    told => `Told the lead (${told.id}): no answer is waited for — task ask when you need one.`
  );

/** `plitzi run notice`: something wrong that no task owns, kept for the finish and the next stage. */
export const runNotice = (text: string, options: RunCommandOptions & { on?: string }): Promise<void> =>
  act(
    options,
    async ctx =>
      noticeRun(ctx, await runOf(ctx, options), text, {
        ...(ctx.token === undefined ? {} : { task: taskOf(ctx) }),
        ...(options.on ? { on: options.on } : {})
      }),
    notice =>
      `Noticed (${noticeText(notice)}): kept in the run's log — the finish says it and the report lists it, for a stage of its own. Go on with your task: it is not yours to fix in it.`
  );

export const taskMessage = (
  to: string,
  text: string,
  options: RunCommandOptions & { replyTo?: string }
): Promise<void> =>
  act(
    options,
    async ctx => messageTasks(ctx, await runOf(ctx, options), to, text, options.replyTo),
    sent =>
      sent.length === 0
        ? 'No task is in hand to tell.'
        : `Said to ${sent.map(message => message.to).join(', ')}: it reaches them with their next command.`
  );

export const taskInbox = (
  options: RunCommandOptions & { all?: boolean; follow?: boolean; timeout?: number }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const taskId = ctx.token ? taskOf(ctx) : undefined;
      const read = (): Promise<Message[]> => readInbox(ctx, runId, taskId, options.all ?? false);
      let messages = await read();
      // Stays until something is said to it — an answer to a question asked without --follow, an instruction.
      const until = Date.now() + (options.timeout ?? FOLLOW_MS);
      while (options.follow && !options.all && messages.length === 0 && Date.now() < until) {
        await runChanged(runPaths(ctx.root, runId).dir, 5000);
        messages = await read();
      }

      return { messages, taskId, waited: options.follow === true };
    },
    ({ messages, taskId, waited }) =>
      messages.length === 0
        ? options.all
          ? 'Nothing was said yet.'
          : waited
            ? 'Nothing was said within the wait: run it again to go on waiting.'
            : 'Nothing unread (--all shows every message, read or not; --follow waits for one).'
        : (options.all ? exchangeLines(messages, taskId) : messageLines(messages)).join('\n')
  );
