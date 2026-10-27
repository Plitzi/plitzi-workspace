import { durationText, FOLLOW_MS } from '../../../options';
import { runPaths } from '../../../runs/core/paths';
import { RunRefusal } from '../../../runs/core/refusal';
import { runChanged } from '../../../runs/core/runChanged';
import {
  addBacklogItem,
  BACKLOG_FILE,
  backlogText,
  closeBacklogItem,
  openBacklog,
  readBacklog
} from '../../../runs/plan/backlog';
import { writeFeedback } from '../../../runs/report/feedback';
import { loadRun } from '../../../runs/run';
import { proposalsOf } from '../../../runs/talk/agreements';
import { noticeRun, noticeText } from '../../../runs/talk/notices';
import { answerProposal, proposeChange } from '../../../runs/talk/proposals';
import { askLead, messageTasks, readInbox, tellLead, tellLeadAbout, unheardOf } from '../../../runs/talk/talk';
import { followWait } from '../../../runs/tasks';
import { act, holder, projectCaller, runOf, taskOf } from '../shell';
import { exchangeLines, messageLines } from '../text';

import type { BacklogItem } from '../../../runs/plan/backlog';
import type { RunContext } from '../../../runs/run';
import type { Message, Standing } from '../../../runs/talk/messages';
import type { RunCommandOptions } from '../shell';

/**
 * Tasks and the lead talking: proposals and their answers, questions, tells, messages and the inbox.
 */

export interface ProposeOptions extends RunCommandOptions {
  change?: string;
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
      if (options.change === undefined) {
        throw new RunRefusal('invalid', `A proposal says the change it asks of ${toTask}: --change "…"`, {
          next: `plitzi task propose ${toTask} --change "the card takes a \`lang\` prop"`
        });
      }

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
          : `Proposed to ${proposed.proposal.to} as ${proposed.proposal.id}. Its answer is listed by plitzi task propose (no task named).`,
    0
  );

export interface AnswerOptions extends RunCommandOptions {
  accept?: boolean;
  reject?: string;
  counter?: string;
  withdraw?: string;
  note?: string;
}

export const taskAnswer = (proposal: string, options: AnswerOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const verdicts = [
        options.accept ? 'accept' : '',
        options.reject ? 'reject' : '',
        options.counter ? 'counter' : '',
        options.withdraw ? 'withdraw' : ''
      ].filter(Boolean);
      const [verdict] = verdicts;
      if (
        verdicts.length !== 1 ||
        (verdict !== 'accept' && verdict !== 'reject' && verdict !== 'counter' && verdict !== 'withdraw')
      ) {
        throw new RunRefusal(
          'invalid',
          'Answer with one of --accept, --reject "why" or --counter "the change instead" — or, its proposer, --withdraw "why"'
        );
      }

      return answerProposal(ctx, await runOf(ctx, options), proposal, {
        verdict,
        ...(options.reject
          ? { note: options.reject }
          : options.withdraw
            ? { note: options.withdraw }
            : options.note
              ? { note: options.note }
              : {}),
        ...(options.counter ? { counter: options.counter } : {})
      });
    },
    answered =>
      answered.counter
        ? `${answered.answer.proposal}: countered with ${answered.counter.id}, to ${answered.counter.to}.`
        : `${answered.answer.proposal}: ${answered.answer.verdict === 'accept' ? 'accepted — an agreement both tasks carry into review' : answered.answer.verdict === 'withdraw' ? 'withdrawn — the task asked no longer has it to answer' : 'rejected'}.`
  );

export const taskProposals = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const all = await proposalsOf(
        await loadRun(ctx, await runOf(ctx, options, undefined, { anyone: true }), { anyVersion: true })
      );
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

export interface TellOptions extends RunCommandOptions {
  about?: string;
  standing?: boolean;
  fraction?: number;
  eta?: number;
  done?: string;
  left?: string;
  blocked?: string;
}

/** The standing said with `task tell --standing`: what is missing of it is the run's to refuse, named whole. */
const standingOf = (options: TellOptions): Standing | undefined =>
  options.standing === true
    ? {
        fraction: options.fraction ?? Number.NaN,
        etaMinutes: options.eta ?? Number.NaN,
        done: options.done ?? '',
        left: options.left ?? '',
        ...(options.blocked ? { blocked: options.blocked } : {})
      }
    : undefined;

/**
 * Whether `task tell --about` speaks of a task not the caller's own — a reviewer's finding, an agent's word on another's
 * task — said by its name: one holding a task was refused telling the lead of a spike (a run's dev-1).
 */
export const tellsAbout = (ctx: Pick<RunContext, 'token'>, about: string | undefined): about is string =>
  about !== undefined && about !== (ctx.token === undefined ? undefined : taskOf(ctx));

export const taskTell = (text: string, options: TellOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const standing = standingOf(options);
      if (standing === undefined && text.trim() === '') {
        throw new RunRefusal(
          'invalid',
          'Say what to tell the lead: plitzi task tell "…" — or where your task stands: plitzi task tell --standing …'
        );
      }

      return tellsAbout(ctx, options.about)
        ? tellLeadAbout(ctx, runId, options.about, text, standing)
        : tellLead(ctx, runId, taskOf(ctx, options.about), text, standing);
    },
    told =>
      told.standing
        ? `Your standing is with the lead (${told.id}${told.replyTo ? `, answering ${told.replyTo}` : ''}): it decides on it — what it says comes with your next command. Go on meanwhile.`
        : `Told the lead (${told.id}): no answer is waited for — task ask when you need one.`
  );

/** `plitzi run notice`: something wrong that no task owns, kept for the finish and the next stage. */
export const runNotice = (
  text: string,
  options: RunCommandOptions & { on?: string; plitzi?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx =>
      noticeRun(ctx, await runOf(ctx, options), text, {
        ...(ctx.token === undefined ? {} : { task: taskOf(ctx) }),
        ...(options.on ? { on: options.on } : {}),
        ...(options.plitzi === true ? { plitzi: true } : {})
      }),
    // Said to whoever noticed it: an agent is told to go on with its task; the lead, that the next run takes it up.
    notice =>
      notice.about === 'plitzi'
        ? `Noticed of Plitzi (${noticeText(notice)}): kept for the run's feedback to Plitzi, written as it ends — not the project's backlog. ${notice.task === undefined ? '' : 'Go on with your task.'}`.trim()
        : `Noticed (${noticeText(notice)}): kept in the run's log — the finish says it, the report lists it, and the project's backlog (${BACKLOG_FILE}) keeps it for the next run. ${notice.task === undefined ? 'A stage of this run takes it up now (plitzi run extend), or the next run does.' : 'Go on with your task: it is not yours to fix in it.'}`
  );

/** `plitzi run report --plitzi`: the run's feedback to Plitzi, written now — the finish writes it again as the run ends. */
export const runFeedback = (runId: string | undefined, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const id = await runOf(ctx, options, runId, { anyone: true });

      return { file: await writeFeedback(ctx, await loadRun(ctx, id, { anyVersion: true })) };
    },
    ({ file }) =>
      `What this run says of Plitzi itself — its agents' reports, the lead's and what its records show — for Plitzi's team: ${file}, nothing of the project's code in it. The finish writes it again with the run whole, its report and its records beside it`
  );

/** `plitzi run backlog`: what runs noticed and left, open first — `done <id>` closes one, saying how. */
export const runBacklog = (
  action: string | undefined,
  id: string | undefined,
  options: RunCommandOptions & { note?: string; all?: boolean; on?: string }
): Promise<void> =>
  act(
    options,
    async ctx => {
      if (action === 'done') {
        if (id === undefined) {
          throw new RunRefusal('invalid', 'Name the item it closes: plitzi run backlog done b-3 --note "how"');
        }

        return {
          closed: await closeBacklogItem(ctx, id, await projectCaller(ctx, options), options.note),
          items: await openBacklog(ctx.root)
        };
      }

      if (action === 'add') {
        if (id === undefined) {
          throw new RunRefusal('invalid', 'Say the item: plitzi run backlog add "what to do" [--on <where>]');
        }

        return {
          added: await addBacklogItem(ctx, {
            text: id,
            by: await projectCaller(ctx, options),
            ...(options.on ? { on: options.on } : {})
          }),
          items: await openBacklog(ctx.root)
        };
      }

      if (action !== undefined) {
        throw new RunRefusal(
          'invalid',
          `"${action}" is no backlog action: plitzi run backlog, plitzi run backlog add "…", or plitzi run backlog done <id>`
        );
      }

      return { items: options.all === true ? await readBacklog(ctx.root) : await openBacklog(ctx.root) };
    },
    ({ added, closed, items }: { added?: BacklogItem; closed?: BacklogItem; items: BacklogItem[] }) =>
      [
        ...(added
          ? [
              `Kept ${added.id} in ${BACKLOG_FILE}: ${added.text} — a plan takes it up (a task's closes: ["${added.id}"])`
            ]
          : []),
        ...(closed ? [`Closed ${closed.id}: ${closed.text}${closed.done?.note ? ` — ${closed.done.note}` : ''}`] : []),
        items.length === 0
          ? `Nothing open in the project's backlog (${BACKLOG_FILE}).`
          : `The project's backlog (${BACKLOG_FILE}), ${String(items.length)} item${items.length === 1 ? '' : 's'} — a next run takes them up:`,
        ...items.map(item => `  ${item.done ? '✓' : '·'} ${backlogText(item)}`)
      ].join('\n')
  );

export const taskMessage = (
  to: string,
  text: string,
  options: RunCommandOptions & { replyTo?: string; standing?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      const sent = await messageTasks(ctx, runId, to, text, options.replyTo, options.standing === true);

      return { sent, unheard: await unheardOf(ctx, runId, sent) };
    },
    ({ sent, unheard }) =>
      sent.length === 0
        ? 'No task is in hand to tell.'
        : [
            `Said to ${sent.map(message => `${message.to}${message.replyTo ? ` (answers ${message.replyTo})` : ''}`).join(', ')}: it reaches them with their next command.`,
            ...unheard.map(
              each =>
                `${each.agent} has run no command for ${String(each.minutes)} min — at something long of its own: it hears this only when that ends.`
            )
          ].join('\n')
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
            ? 'Nothing was said within the wait — your question stays open: run it again to wait on, or go on with what does not need the answer.'
            : 'Nothing unread (--all shows every message, read or not; --follow waits for one).'
        : (options.all ? exchangeLines(messages, taskId) : messageLines(messages)).join('\n')
  );
