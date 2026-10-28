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
import { blockTask, followWait, noteTask } from '../../../runs/tasks';
import { act, either, holder, projectCaller, runIfOpen, runOf, taskOf } from '../shell';
import { exchangeLines, messageLines } from '../text';

import type { BLOCK_NEEDS } from '../../../runs/core/model';
import type { PlitziHow } from '../../../runs/findings/plitziClass';
import type { BacklogItem } from '../../../runs/plan/backlog';
import type { RunContext } from '../../../runs/run';
import type { Message, Standing } from '../../../runs/talk/messages';
import type { Notice } from '../../../runs/talk/notices';
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
  /** A shared file the change is to, no task asked: one integration task applies every change asked of it. */
  file?: string;
  /** With `file`: where the caller uses it, comma-separated. */
  usedIn?: string;
  /** With `file`: it cannot wait — its integration task is made now, and the caller's task waits for it. */
  blocking?: boolean;
}

/**
 * Which change `task propose` asks: of a task (`<task>`), of a shared file (`--file`), or none — the proposals listed.
 * An option of the other way is refused by name: a change to a shared file asks no task, and is not waited on.
 */
export const proposalOf = (task: string | undefined, options: ProposeOptions): 'task' | 'file' | 'list' => {
  if (options.file === undefined) {
    const misplaced = [
      ...(options.usedIn === undefined ? [] : ['--used-in']),
      ...(options.blocking === true ? ['--blocking'] : [])
    ];
    if (misplaced.length > 0) {
      throw new RunRefusal(
        'invalid',
        `${misplaced.join(' and ')} go with --file <file>: a change asked of a shared file`
      );
    }

    return task === undefined ? 'list' : 'task';
  }

  const misplaced = [
    ...(task === undefined ? [] : [`a task (${task})`]),
    ...(options.about === undefined ? [] : ['--about']),
    ...(options.wait === true ? ['--wait'] : []),
    ...(options.follow === true ? ['--follow'] : [])
  ];
  if (misplaced.length > 0) {
    throw new RunRefusal(
      'invalid',
      `A change to a shared file (--file) asks no task and is not waited on — leave out ${misplaced.join(', ')}; --blocking makes its integration task now and waits for it`
    );
  }

  if (options.change === undefined) {
    throw new RunRefusal('invalid', `Say the change to ${options.file}: --change "…" [--why "…"]`);
  }

  return 'file';
};

export const taskPropose = (toTask: string, options: ProposeOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      proposalOf(toTask, options);
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

export const taskProposals = (options: ProposeOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      proposalOf(undefined, options);
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

export interface TellOptions extends RunCommandOptions {
  about?: string;
  /** A question: the lead's answer comes with the next command — or, with `follow`, is waited for. */
  ask?: boolean;
  follow?: boolean;
  timeout?: number;
  /** Something outside the plan stops the task: who unblocks it, the lead by default. */
  blocked?: boolean;
  needs?: (typeof BLOCK_NEEDS)[number];
  /** What whoever takes the task next must know. */
  handoff?: boolean;
  /** Where the task stands, as the lead asked. */
  standing?: boolean;
  fraction?: number;
  eta?: number;
  done?: string;
  left?: string;
  heldBy?: string;
}

/** What `task tell` says: news for the lead — the default — a question, a block, a handoff or where the task stands. */
type TellKind = 'news' | 'ask' | 'blocked' | 'handoff' | 'standing';

const TELL_KINDS = ['ask', 'blocked', 'handoff', 'standing'] as const;

/** The options each kind takes: one given with another kind is refused by name, never read as nothing. */
const KIND_OPTIONS: Readonly<Record<TellKind, readonly (keyof TellOptions)[]>> = {
  news: [],
  ask: ['follow', 'timeout'],
  blocked: ['needs'],
  handoff: [],
  standing: ['fraction', 'eta', 'done', 'left', 'heldBy']
};

/** Each option a kind takes, and the flag it is said by. */
const KIND_FLAGS: readonly (readonly [keyof TellOptions, string])[] = [
  ['follow', '--follow'],
  ['timeout', '--timeout'],
  ['needs', '--needs'],
  ['fraction', '--fraction'],
  ['eta', '--eta'],
  ['done', '--done'],
  ['left', '--left'],
  ['heldBy', '--held-by']
];

const ALL_KINDS: readonly TellKind[] = ['news', ...TELL_KINDS];

/** The one kind asked, and its text: two kinds at once, an option of another kind, or a kind with no text, refused. */
export const tellKind = (text: string, options: TellOptions): TellKind => {
  const kinds = TELL_KINDS.filter(kind => options[kind] === true);
  if (kinds.length > 1) {
    throw new RunRefusal(
      'invalid',
      `task tell says one thing at a time: --${kinds.join(' and --')} were given — tell them one after the other`
    );
  }

  const kind: TellKind = kinds.at(0) ?? 'news';
  const misplaced = KIND_FLAGS.filter(
    ([option]) => options[option] !== undefined && !KIND_OPTIONS[kind].includes(option)
  );
  if (misplaced.length > 0) {
    const owners = misplaced.map(([option, flag]) => {
      const owner = ALL_KINDS.find(each => KIND_OPTIONS[each].includes(option));

      return `${flag} goes with --${owner ?? kind}`;
    });
    throw new RunRefusal(
      'invalid',
      `task tell ${kind === 'news' ? '' : `--${kind} `}takes none of them: ${owners.join('; ')}`
    );
  }

  if (kind !== 'standing' && text.trim() === '') {
    throw new RunRefusal(
      'invalid',
      kind === 'news'
        ? 'Say what to tell the lead: plitzi task tell "…" — or where your task stands: plitzi task tell --standing …'
        : `Say it: plitzi task tell "…" --${kind}`
    );
  }

  return kind;
};

/** The standing said with `task tell --standing`: what is missing of it is the run's to refuse, named whole. */
const standingOf = (options: TellOptions): Standing => ({
  fraction: options.fraction ?? Number.NaN,
  etaMinutes: options.eta ?? Number.NaN,
  done: options.done ?? '',
  left: options.left ?? '',
  ...(options.heldBy ? { blocked: options.heldBy } : {})
});

/**
 * Whether `task tell --about` speaks of a task not the caller's own — a reviewer's finding, an agent's word on another's
 * task — said by its name: one holding a task was refused telling the lead of a spike (a run's dev-1).
 */
export const tellsAbout = (ctx: Pick<RunContext, 'token'>, about: string | undefined): about is string =>
  about !== undefined && about !== (ctx.token === undefined ? undefined : taskOf(ctx));

type Told =
  | ({ kind: 'news' | 'standing' } & Awaited<ReturnType<typeof tellLead>>)
  | ({ kind: 'ask' } & Awaited<ReturnType<typeof askLead>>)
  | ({ kind: 'blocked'; taskId: string; reason: string; needs: (typeof BLOCK_NEEDS)[number] } & Awaited<
      ReturnType<typeof blockTask>
    >)
  | { kind: 'handoff'; taskId: string };

const toldText = (said: Told, options: TellOptions): string => {
  switch (said.kind) {
    case 'news':
    case 'standing':
      return said.standing
        ? `Your standing is with the lead (${said.id}${said.replyTo ? `, answering ${said.replyTo}` : ''}): it decides on it — what it says comes with your next command. Go on meanwhile.`
        : `Told the lead (${said.id}): no answer is waited for — task tell "…" --ask when you need one.`;
    case 'ask':
      return said.reply
        ? [`The lead answered (${said.reply.id}): ${said.reply.text}`, ...messageLines(said.messages)].join('\n')
        : options.follow
          ? `Asked (${said.question.id}); no answer yet after ${durationText(options.timeout ?? FOLLOW_MS)} — go on with what you can, it comes with your next command.`
          : `Asked (${said.question.id}): the answer comes with your next command — or stay for it with --follow.`;
    case 'blocked':
      return [
        `${said.taskId} is blocked (${said.needs}): ${said.reason.replace(/[.\s]+$/, '')}. Take another ready task meanwhile; once it is unblocked, plitzi task next hands it back to you first.`,
        ...(said.released.length > 0
          ? [
              `Let go, as your copy left them unchanged: ${said.released.join(', ')}${said.granted.length > 0 ? ` (handed on: ${said.granted.join(', ')})` : ''} — claim one again (plitzi task claim) when you need to change it.`
            ]
          : [])
      ].join('\n');
    case 'handoff':
      return 'Noted: whoever takes it next reads it in plitzi task context.';
  }
};

/**
 * `plitzi task tell`: what an agent says to the run, one kind at a time — news for the lead, a question (`--ask`), what
 * stops its task (`--blocked`), a note for whoever takes it next (`--handoff`) or where it stands (`--standing`).
 */
export const taskTell = (text: string, options: TellOptions): Promise<void> =>
  act(
    options,
    async (ctx): Promise<Told> => {
      const kind = tellKind(text, options);
      if (kind === 'ask') {
        const { runId, taskId } = await holder(ctx, options);

        return {
          kind,
          ...(await askLead(ctx, runId, taskId, text, {
            follow: options.follow ?? false,
            timeoutMs: options.timeout ?? FOLLOW_MS
          }))
        };
      }

      if (kind === 'blocked' || kind === 'handoff') {
        const target = await either(ctx, options, options.about);
        if (kind === 'handoff') {
          await noteTask(ctx, target.runId, target.taskId, text);

          return { kind, taskId: target.taskId };
        }

        const needs = options.needs ?? 'lead';

        return {
          kind,
          reason: text,
          needs,
          taskId: target.taskId,
          ...(await blockTask(ctx, target.runId, target.taskId, text, needs))
        };
      }

      const runId = await runOf(ctx, options);
      const standing = kind === 'standing' ? standingOf(options) : undefined;

      return {
        kind,
        ...(tellsAbout(ctx, options.about)
          ? await tellLeadAbout(ctx, runId, options.about, text, standing)
          : await tellLead(ctx, runId, taskOf(ctx, options.about), text, standing))
      };
    },
    said => toldText(said, options)
  );

/**
 * `plitzi run notice`: something wrong that no task owns — while a run is open, kept in its log for the finish and the
 * next stage; with none, in the project's backlog at once. The one way an item is kept for later.
 */
export const runNotice = (
  text: string,
  options: RunCommandOptions & { on?: string; plitzi?: PlitziHow }
): Promise<void> =>
  act(
    options,
    async (ctx): Promise<{ notice: Notice } | { kept: BacklogItem }> => {
      const runId = await runIfOpen(ctx, options);
      if (runId !== undefined) {
        return {
          notice: await noticeRun(ctx, runId, text, {
            ...(ctx.token === undefined ? {} : { task: taskOf(ctx) }),
            ...(options.on ? { on: options.on } : {}),
            ...(options.plitzi === undefined ? {} : { plitzi: options.plitzi })
          })
        };
      }

      if (options.plitzi !== undefined) {
        throw new RunRefusal(
          'invalid',
          'With no run open, what is wrong in Plitzi is a report of its own: plitzi feedback writes it, with the versions in it'
        );
      }

      return {
        kept: await addBacklogItem(ctx, {
          text,
          by: await projectCaller(ctx, options),
          ...(options.on ? { on: options.on } : {})
        })
      };
    },
    // Said to whoever noticed it: an agent is told to go on with its task; the lead, that the next run takes it up.
    said => {
      if ('kept' in said) {
        return `No run is open: kept ${said.kept.id} in ${BACKLOG_FILE} — ${said.kept.text}; a plan takes it up (a task's closes: ["${said.kept.id}"])`;
      }

      const { notice } = said;

      return notice.about === 'plitzi'
        ? `Noticed of Plitzi (${noticeText(notice)}): kept for the run's feedback to Plitzi, written as it ends — not the project's backlog. ${notice.task === undefined ? '' : 'Go on with your task.'}`.trim()
        : `Noticed (${noticeText(notice)}): kept in the run's log — the finish says it, the report lists it, and the project's backlog (${BACKLOG_FILE}) keeps it for the next run. ${notice.task === undefined ? 'A stage of this run takes it up now (plitzi run open <stage>), or the next run does.' : 'Go on with your task: it is not yours to fix in it.'}`;
    }
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

/** `plitzi run backlog`: what is left to do — listed, or one item closed (`done <id>`). Kept by `run notice`. */
export const runBacklog = (
  action: string | undefined,
  id: string | undefined,
  options: RunCommandOptions & { note?: string; all?: boolean }
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

      if (action !== undefined) {
        throw new RunRefusal(
          'invalid',
          `"${action}" is no backlog action: plitzi run backlog lists it, plitzi run backlog done <id> closes an item — an item is kept by plitzi run notice "…"`
        );
      }

      return { items: options.all === true ? await readBacklog(ctx.root) : await openBacklog(ctx.root) };
    },
    ({ closed, items }: { closed?: BacklogItem; items: BacklogItem[] }) =>
      [
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
