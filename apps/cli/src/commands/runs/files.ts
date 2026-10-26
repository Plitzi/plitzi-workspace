import { act, holder, runOf } from './shell';
import { list } from './text';
import { durationText, FOLLOW_MS } from '../../options';
import { isRunRefusal, RunRefusal } from '../../runs/refusal';
import {
  answerSpike,
  approveSpike,
  claimFile,
  claims,
  discardFile,
  releaseFile,
  requestShared,
  reworkSpike,
  startSpike,
  followWait,
  waitForFile
} from '../../runs/tasks';

import type { RunCommandOptions } from './shell';

/**
 * A task's files beyond its own: claimed by turns, released, waited for, put back, requested.
 */

export const taskClaims = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => claims(ctx, await runOf(ctx, options, undefined, { anyone: true })),
    found =>
      found.length === 0
        ? 'No file is locked.'
        : found
            .map(
              each =>
                `${each.file}: ${each.lock.taskId} (${each.lock.agent}, ${each.lock.kind === 'turn' ? 'by turns' : 'its own'}) since ${each.lock.since}${each.live ? '' : ' — run out'}`
            )
            .join('\n')
  );

/** `plitzi task claim a.ts b.ts`: each file taken by turns, one after the other — a refusal stops at that file, said. */
export const taskClaim = (files: string[], options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);
      const claimed: string[] = [];
      const ahead: string[] = [];
      for (const file of files) {
        const outcome = await claimFile(ctx, runId, taskId, file);
        claimed.push(outcome.file);
        if (outcome.aheadOf) {
          ahead.push(`${outcome.file} (${outcome.aheadOf})`);
        }
      }

      return { claimed, ...(ahead.length > 0 ? { ahead } : {}) };
    },
    ({ claimed, ahead }) =>
      [
        `${claimed.join(', ')} ${claimed.length === 1 ? 'is' : 'are'} yours by turns: your copy keeps what you wrote in ${claimed.length === 1 ? 'it' : 'them'} (or takes the run's version where you had not touched it), and your change goes into the run when this task is approved.`,
        ...(ahead
          ? [
              `Ahead of the task its plan gives it to, which nobody has taken: ${ahead.join(', ')} — that task is offered once this one is approved, with your change in.`
            ]
          : [])
      ].join('\n')
  );

export const taskRelease = (file: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return { file, granted: await releaseFile(ctx, runId, taskId, file) };
    },
    ({ file: released, granted }) =>
      `Let go of ${released}.${granted.length > 0 ? ` Now: ${granted.join(', ')}` : ' Nobody was waiting for it.'}`
  );

export const taskWait = (
  file: string,
  options: RunCommandOptions & { follow?: boolean; timeout?: number }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);
      const waiting = await waitForFile(ctx, runId, taskId, file);
      if (waiting.granted || !options.follow) {
        return { ...waiting, followed: undefined };
      }

      const followed = await followWait(ctx, runId, taskId, { timeoutMs: options.timeout ?? FOLLOW_MS });
      if (!followed.done) {
        throw new RunRefusal(
          'waiting',
          `Still waiting for ${String(waiting.holder)} on ${waiting.file} after ${durationText(options.timeout ?? FOLLOW_MS)}`,
          {
            file: waiting.file,
            holder: waiting.holder
          }
        );
      }

      return { ...waiting, followed };
    },
    waited =>
      waited.granted
        ? `Nobody held ${waited.file} any more: it is yours now, by turns.${waited.nowhere ? ` It is in neither the project nor the run's work yet: if a task at work or in review is making it, wait for that task (plitzi run status says who works what), not the file.` : ''}`
        : waited.followed
          ? `${waited.file} is yours now. ${waited.followed.note ?? ''}`
          : `Waiting for ${waited.holder} on ${waited.file}: it comes to this task when ${waited.holder} is approved, with the run's version. Go on with what of your task does not need it; \`plitzi task wait ${waited.file} --follow\` waits until it is yours.`,
    // Waiting, without --follow: exit 11 says so to a script. Given at once, or followed until given: 0.
    waited => (waited.granted || options.follow ? 0 : 11)
  );

/** `plitzi task discard <files...>`: each put back in turn — dev-1 discarded one at a time, a command each. */
export const taskDiscard = (files: string[], options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);
      const brought = new Set<string>();
      const done: string[] = [];
      for (const file of files) {
        try {
          for (const each of await discardFile(ctx, runId, taskId, file)) {
            brought.add(each);
          }
        } catch (error) {
          // What went back before it stays back: said with the refusal, never a list read as all or nothing.
          throw isRunRefusal(error) && done.length > 0
            ? new RunRefusal(
                error.code,
                `${list(done)} put back to the run's version; then ${file}: ${error.message}`,
                error.detail
              )
            : error;
        }

        done.push(file);
      }

      return { files, brought: [...brought].filter(each => !files.includes(each)).sort() };
    },
    discarded =>
      `${list(discarded.files)} in your copy ${discarded.files.length === 1 ? 'is' : 'are'} the run's version now, and your copy starts from ${discarded.files.length === 1 ? 'it' : 'them'}.${discarded.brought.length > 0 ? ` Also brought in, approved since your copy was made: ${discarded.brought.join(', ')}` : ''}`
  );

export const taskRequest = (
  file: string,
  options: RunCommandOptions & { summary: string; usedIn?: string; blocking?: boolean }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return requestShared(ctx, runId, taskId, file, {
        summary: options.summary,
        usedIn: (options.usedIn ?? '')
          .split(',')
          .map(each => each.trim())
          .filter(Boolean),
        blocking: options.blocking ?? false
      });
    },
    requested =>
      requested.integration
        ? `Requested, blocking: ${requested.integration} makes it, and this task waits for it. Take another ready task meanwhile.`
        : `Requested: change it in your copy as you need it; one integration task applies every request on ${requested.request.file} together.`
  );

/**
 * `plitzi task spike "…"`, by the agent at work: its task needs something found out — a scout's to find (the lead's with
 * none), the task blocked on it. `plitzi task spike <task> --done "…" [--tasks <stage.json>]`, by a scout or the lead:
 * what a spike found, and the tasks it makes — a scout's proposed to the lead. `--approve` / `--changes "…"`, the
 * lead's: those tasks stacked, or sent back.
 */
export const taskSpike = (
  argument: string | undefined,
  options: RunCommandOptions & { done?: string; tasks?: string; approve?: boolean; changes?: string }
): Promise<void> =>
  act(
    options,
    async ctx => {
      const decided = [options.done !== undefined, options.approve === true, options.changes !== undefined].filter(
        Boolean
      ).length;
      if (decided > 1) {
        throw new RunRefusal('invalid', 'One of --done, --approve or --changes at a time');
      }

      if (decided === 1) {
        const runId = await runOf(ctx, options);
        if (argument === undefined) {
          throw new RunRefusal(
            'invalid',
            'Name the spike: plitzi task spike s-scope --done "…" | --approve | --changes "…"'
          );
        }

        if (options.approve === true) {
          return approveSpike(ctx, runId, argument);
        }

        if (options.changes !== undefined) {
          return reworkSpike(ctx, runId, argument, options.changes);
        }

        return answerSpike(ctx, runId, argument, options.done ?? '', options.tasks ? { tasks: options.tasks } : {});
      }

      if (options.tasks !== undefined) {
        throw new RunRefusal('invalid', '--tasks goes with --done: the tasks the spike it answers makes');
      }

      const { runId, taskId } = await holder(ctx, options);
      if (argument === undefined || argument.trim() === '') {
        throw new RunRefusal(
          'invalid',
          'Say what needs finding out — plitzi task spike "which layers make the original\'s light": a scout finds it'
        );
      }

      return startSpike(ctx, runId, taskId, argument);
    },
    spiked =>
      spiked.proposed !== undefined
        ? [
            `${spiked.task}'s tasks go to the lead, who decides them with the person: ${spiked.proposed.join(', ')} — nothing is stacked until it approves them; what it asks comes with your next command.`,
            ...(spiked.notices ?? []).map(notice => `  · ${notice}`)
          ].join('\n')
        : spiked.finding === undefined
          ? spiked.status === 'blocked'
            ? `${spiked.task} is blocked on its spike — ${spiked.question} — found out by a scout, or the lead. Its files stay yours; the answer comes with your next command (plitzi task next hands the task back) — meanwhile take another task, or go on with what does not need it.`
            : `${spiked.task}'s tasks went back to the scout, with what you asked.`
          : [
              `${spiked.task} is done: its findings go with every task that waits for it.${spiked.added ? ` It made ${spiked.added.join(', ')}.` : ''}${spiked.ready && spiked.ready.length > 0 ? ` Ready now: ${spiked.ready.join(', ')}.` : ''}`,
              ...(spiked.notices ?? []).map(notice => `  · ${notice}`)
            ].join('\n')
  );
