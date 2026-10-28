import { handOver } from './handOver';
import { agentAddress, EVERYONE, LEAD, messagesOf, replyTo, sendMessage, standingText, unreadFor } from './messages';
import { isPrincipal, requireALead, requireLead } from '../agents/leads';
import { readTeam, startedAgents } from '../agents/team';
import { writeJson } from '../core/files';
import { RunRefusal } from '../core/refusal';
import { runChanged } from '../core/runChanged';
import { viewTask } from '../core/taskStore';
import { readUsage } from '../core/usage';
import { assertStatus, loadRun, logRun, readRunLog, requireNoTask } from '../run';
import { findTask, holderOf } from '../tasks';

import type { Message, Standing } from './messages';
import type { RunContext } from '../run';

/**
 * What `plitzi task tell`, `plitzi task message` and `plitzi task inbox` do: the lead and the agents talking while tasks
 * are worked (`messages.ts`).
 */

export interface Asked {
  question: Message;
  /** With `follow`: the lead's answer, once it came. */
  reply?: Message;
  /** What else the lead said to the task and it had not read, handed over with the answer. */
  messages: Message[];
}

/**
 * `plitzi task tell --ask`: the holder of a task asks the lead — stuck, unsure, or with news it needs to hear. With `follow` it
 * stays until the answer comes (its sign of life given meanwhile), up to `timeoutMs`.
 */
export const askLead = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  text: string,
  { follow = false, timeoutMs = 30 * 60_000, everyMs = 10_000 } = {}
): Promise<Asked> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'reconciliation'], 'ask the lead');
  const view = await holderOf(ctx, loaded, findTask(loaded, taskId));
  const question = await sendMessage(ctx, loaded, { from: taskId, to: LEAD, text });
  await logRun(ctx, loaded.paths, { action: 'ask', task: taskId, message: question.id });
  if (!follow) {
    return { question, messages: [] };
  }

  const started = Date.now();
  for (;;) {
    const reply = await replyTo(await loadRun(ctx, runId), question);
    if (reply) {
      // Everything marked read is handed over: a message is never read for the agent without reaching it.
      const unread = await handOver(ctx, loaded, taskId, ctx.agent);

      return { question, reply, messages: unread.filter(message => message.id !== reply.id) };
    }

    if (Date.now() - started >= timeoutMs) {
      return { question, messages: [] };
    }

    await writeJson(view.paths.progress, { ...(view.progress ?? {}), heartbeatAt: ctx.now().toISOString() });
    await runChanged(loaded.paths.dir, everyMs);
  }
};

/**
 * `plitzi task message all`: the lead tells every task — in hand, and taken from now on — what holds for the whole run: a known
 * issue, a decision, how something is done here. The run's memory; each task reads it once, with its take or its next
 * sign of life.
 */
export const noteRun = async (ctx: RunContext, runId: string, text: string): Promise<Message> => {
  requireNoTask(ctx, 'add a note to the run');
  const loaded = await loadRun(ctx, runId);
  await requireLead(ctx, 'add a note to every task');
  const note = await sendMessage(ctx, loaded, { from: LEAD, to: EVERYONE, text });
  await logRun(ctx, loaded.paths, { action: 'note', message: note.id });

  return note;
};

/**
 * What the lead asked of `addresses` — a task, an agent by name — and nobody answered: the standing it waits for.
 */
const standingAsked = (messages: readonly Message[], addresses: readonly string[]): Message | undefined => {
  const answered = new Set(messages.flatMap(message => (message.replyTo ? [message.replyTo] : [])));

  return messages.findLast(
    message =>
      message.from === LEAD &&
      message.asksStanding === true &&
      addresses.includes(message.to) &&
      !answered.has(message.id)
  );
};

/** A standing as its agent says it: checked whole — a lead decides on it, a half one decides nothing. */
const checkedStanding = (standing: Standing): Standing => {
  const problems = [
    ...(standing.fraction >= 0 && standing.fraction <= 1
      ? []
      : ['--fraction is how much is done, 0 to 1 (0.6 is 60 %)']),
    ...(Number.isInteger(standing.etaMinutes) && standing.etaMinutes >= 0
      ? []
      : ['--eta is the minutes it still takes']),
    ...(standing.done.trim() === '' ? ['--done says what is done'] : []),
    ...(standing.left.trim() === '' ? ['--left says what is left'] : [])
  ];
  if (problems.length > 0) {
    throw new RunRefusal(
      'invalid',
      `A standing is said whole: ${problems.join('; ')} — plitzi task tell --standing --fraction <0-1> --eta <minutes> --done "…" --left "…" [--held-by "…"]`
    );
  }

  return standing;
};

/**
 * `plitzi task tell`: the holder of a task tells the lead something it should know — a finding, a choice it made, a
 * risk — without asking: nothing waits for an answer. It is on top of `run status` until the lead reads its inbox.
 * With `standing`, where the task stands — the answer to the lead's asking (`task message --standing`), its progress
 * kept as the task's.
 */
export const tellLead = async (
  ctx: RunContext,
  runId: string,
  taskId: string,
  text: string,
  standing?: Standing
): Promise<Message> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'reconciliation'], 'tell the lead');
  const view = await holderOf(ctx, loaded, findTask(loaded, taskId));
  const said = standing === undefined ? undefined : checkedStanding(standing);
  const asked = said ? standingAsked(await messagesOf(loaded), [taskId, agentAddress(ctx.agent)]) : undefined;
  const told = await sendMessage(ctx, loaded, {
    from: taskId,
    to: LEAD,
    text: said ? `${text === '' ? '' : `${text} — `}${standingText(said)}` : text,
    fyi: true,
    ...(said ? { standing: said } : {}),
    ...(asked ? { replyTo: asked.id } : {})
  });
  if (said) {
    await writeJson(view.paths.progress, {
      ...(view.progress ?? {}),
      fraction: said.fraction,
      step: said.left,
      heartbeatAt: ctx.now().toISOString()
    });
  }

  await logRun(ctx, loaded.paths, { action: said ? 'standing' : 'tell', task: taskId, message: told.id });

  return told;
};

/**
 * `plitzi task tell --about <task>` with no task in hand: an agent of the team that holds none — a designer between
 * reviews — tells the lead what it found on a task, said by its own name. A review the lead decided first had nowhere to
 * go (design-1's finding on t-motion, refused twice).
 */
export const tellLeadAbout = async (
  ctx: RunContext,
  runId: string,
  about: string,
  text: string,
  standing?: Standing
): Promise<Message> => {
  const loaded = await loadRun(ctx, runId);
  assertStatus(loaded, ['open', 'stopping', 'reconciliation'], 'tell the lead');
  const task = findTask(loaded, about);
  const team = await readTeam(ctx.root).catch(() => undefined);
  if (!(team ? startedAgents(team) : []).some(member => member.agent === ctx.agent)) {
    throw new RunRefusal(
      'invalid',
      `${ctx.agent} is no agent of the team: an agent tells the lead as itself, with its own token (--token), a task's holder with its token`,
      { task: task.id }
    );
  }

  // A scout at a spike holds no task: its standing, asked of it by name, is said the same way.
  const said = standing === undefined ? undefined : checkedStanding(standing);
  const asked = said ? standingAsked(await messagesOf(loaded), [task.id, agentAddress(ctx.agent)]) : undefined;
  const told = await sendMessage(ctx, loaded, {
    from: ctx.agent,
    to: LEAD,
    text: `On ${task.id}: ${said ? `${text === '' ? '' : `${text} — `}${standingText(said)}` : text}`,
    fyi: true,
    about: task.id,
    ...(said ? { standing: said } : {}),
    ...(asked ? { replyTo: asked.id } : {})
  });
  await logRun(ctx, loaded.paths, { action: said ? 'standing' : 'tell', task: task.id, message: told.id });

  return told;
};

/**
 * `plitzi task message`: the lead tells a task — or every task in hand, with `all`, or an agent by name, `@dev-1`,
 * whichever task it holds or none — what it needs to know: an instruction, an answer, a change of plan. It reaches the
 * agent with its next command; an agent between tasks, with `task next`.
 */
export const messageTasks = async (
  ctx: RunContext,
  runId: string,
  to: string,
  text: string,
  reply?: string,
  /** Asks where it stands — a task that takes long: its agent answers with `task tell --standing`, which wakes the lead. */
  standing = false
): Promise<Message[]> => {
  requireNoTask(ctx, 'message a task');
  const loaded = await loadRun(ctx, runId);
  requireALead(ctx, 'message a task');
  const inHand = await Promise.all(
    loaded.tasks.map(async task => ({ task, view: await viewTask(loaded.paths, task) }))
  );
  const targets =
    to === 'all'
      ? inHand.filter(each => each.view.owner && each.view.state.status !== 'done').map(each => each.task.id)
      : to.startsWith('@')
        ? [to]
        : [findTask(loaded, to).id];
  // What the lead says to a task with its one question open is its answer, said with --reply-to or not: a run's lead
  // answered t-motion without it, and the monitor said for good that t-motion asked the lead. Said to every task, it
  // answers none — a note to all marked t-artists' question answered — and with two open, it says which.
  const messages = await messagesOf(loaded);
  const answered = new Set(messages.flatMap(message => (message.replyTo ? [message.replyTo] : [])));
  const openQuestions = (target: string): string[] =>
    messages
      .filter(
        message => message.from === target && message.to === LEAD && message.fyi !== true && !answered.has(message.id)
      )
      .map(message => message.id);
  const open = reply === undefined && to !== 'all' && !to.startsWith('@') ? openQuestions(targets[0] ?? '') : [];
  if (open.length > 1) {
    throw new RunRefusal(
      'invalid',
      `${to} has ${String(open.length)} questions open (${open.join(', ')}): say which this answers — plitzi task message ${to} "…" --reply-to ${open.at(-1) ?? ''}`
    );
  }

  // Said to every task, and no standing asked: one note for the whole run — the tasks in hand read it with their next
  // command, the ones taken later with their take (what `task message all` was, beside this).
  if (to === 'all' && !standing && text.trim() !== '') {
    return [await noteRun(ctx, runId, text)];
  }

  if (!standing && text.trim() === '') {
    throw new RunRefusal(
      'invalid',
      'Say what to tell it: plitzi task message <task> "…" — or ask where it stands: plitzi task message <task> --standing'
    );
  }

  // Asked where it stands, it answers whole: how far, how long still, what is done and left, what holds it.
  const said = standing
    ? `${text.trim() === '' ? '' : `${text.trim()} — `}Where do you stand? Answer now: plitzi task tell --standing --fraction <0-1> --eta <minutes left> --done "what is done" --left "what is left" [--held-by "what holds you"]`
    : text;
  const sent: Message[] = [];
  for (const target of targets) {
    const answers = standing ? undefined : (reply ?? open[0]);
    sent.push(
      await sendMessage(ctx, loaded, {
        from: LEAD,
        to: target,
        text: said,
        ...(answers ? { replyTo: answers } : {}),
        ...(standing ? { asksStanding: true as const } : {})
      })
    );
  }

  await logRun(ctx, loaded.paths, { action: 'message', to, messages: sent.map(message => message.id) });
  // Answered by a lead that reviews: the lead hears what was said for it, as of a spike's findings.
  const answeredNow = sent.filter(message => message.replyTo !== undefined);
  if (ctx.agent !== LEAD && answeredNow.length > 0) {
    await sendMessage(ctx, loaded, {
      from: ctx.agent,
      to: LEAD,
      text: `${ctx.agent} answered ${answeredNow.map(message => `${message.to}'s ${message.replyTo ?? ''}`).join(', ')}: ${text}`,
      fyi: true,
      about: answeredNow[0].to
    });
  }

  return sent;
};

/**
 * `plitzi task inbox`: what was said to the caller and it has not read — a task's with its token, the lead's without.
 * With `all`, every message to it and from it, read or not: what it was told before, again.
 */
export const readInbox = async (ctx: RunContext, runId: string, taskId?: string, all = false): Promise<Message[]> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  // An agent holding no task — a designer between reviews — reads what was said to it by name: refused as the lead's
  // inbox, it was told "lead-only" of its own (a run's design-1).
  if (taskId === undefined && !isPrincipal(ctx.agent)) {
    const own = agentAddress(ctx.agent);

    return all
      ? (await messagesOf(loaded)).filter(message => message.to === own || message.from === ctx.agent)
      : unreadFor(loaded, own, true);
  }

  if (taskId === undefined) {
    requireNoTask(ctx, 'read the lead’s inbox');
    await requireLead(ctx, 'read the lead’s inbox');

    return all
      ? (await messagesOf(loaded)).filter(message => message.to === LEAD || message.from === LEAD)
      : unreadFor(loaded, LEAD, true);
  }

  await holderOf(ctx, loaded, findTask(loaded, taskId));
  const agent = agentAddress(ctx.agent);
  if (all) {
    return (await messagesOf(loaded)).filter(
      message => message.to === taskId || message.from === taskId || message.to === agent
    );
  }

  return handOver(ctx, loaded, taskId, ctx.agent);
};

/** Past this long since an agent's last command ended, what is said to it waits on what it runs now: the lead is told. */
const QUIET_MS = 2 * 60_000;

/** A message its agent hears late: it ran no command of the run for `minutes` — at something long of its own. */
export interface Unheard {
  to: string;
  agent: string;
  minutes: number;
}

/**
 * Who of `sent` hears it late: a message reaches an agent only with its next command, and an agent at a long probe of
 * its own — a Playwright suite, a script — runs none for minutes. A run's scout-1 heard "narrow it" 2.5 min late and
 * missed two more: the lead is told then, not left to think it was heard. An agent that ran none yet is not counted.
 */
export const unheardOf = async (
  ctx: RunContext,
  runId: string,
  sent: readonly Message[],
  now = new Date()
): Promise<Unheard[]> => {
  const loaded = await loadRun(ctx, runId, { anyVersion: true });
  const usage = readUsage(loaded.paths.dir);
  const log = await readRunLog(loaded.paths);
  const lastEnded = (agent: string): number | undefined =>
    usage
      .filter(line => line.by === agent)
      .reduce<number | undefined>((last, line) => Math.max(last ?? 0, Date.parse(line.at) + line.ms), undefined);
  // Waiting inside a command of the run — an ask it follows, a `task next` that waits — it hears what is said at once:
  // a lead told one waiting for its very answer that it would hear it late.
  const waitsInside = (agent: string, ended: number): boolean => {
    const last = log.findLast(entry => entry.by === agent && typeof entry.at === 'string');

    return (
      last !== undefined && (last.action === 'ask' || last.action === 'waiting') && Date.parse(String(last.at)) > ended
    );
  };
  const agentOf = async (to: string): Promise<string | undefined> => {
    if (to.startsWith('@')) {
      return to.slice(1);
    }

    const task = loaded.tasks.find(each => each.id === to);

    return task ? (await viewTask(loaded.paths, task)).owner?.agent : undefined;
  };

  const unheard: Unheard[] = [];
  for (const message of sent) {
    const agent = await agentOf(message.to);
    const ended = agent === undefined ? undefined : lastEnded(agent);
    if (agent !== undefined && ended !== undefined && now.getTime() - ended > QUIET_MS && !waitsInside(agent, ended)) {
      unheard.push({ to: message.to, agent, minutes: Math.round((now.getTime() - ended) / 60_000) });
    }
  }

  return unheard;
};
