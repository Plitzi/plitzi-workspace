import { act, holder, runOf } from './shell';
import { durationText, FOLLOW_MS } from '../../options';
import { RunRefusal } from '../../runs/refusal';
import { claimFile, claims, discardFile, releaseFile, requestShared, followWait, waitForFile } from '../../runs/tasks';

import type { RunCommandOptions } from './shell';

/**
 * A task's files beyond its own: claimed by turns, released, waited for, put back, requested.
 */

export const taskClaims = (options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => claims(ctx, await runOf(ctx, options)),
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
      for (const file of files) {
        claimed.push((await claimFile(ctx, runId, taskId, file)).file);
      }

      return { claimed };
    },
    ({ claimed }) =>
      `${claimed.join(', ')} ${claimed.length === 1 ? 'is' : 'are'} yours by turns: your copy keeps what you wrote in ${claimed.length === 1 ? 'it' : 'them'} (or takes the run's version where you had not touched it), and your change goes into the run when this task is approved.`
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
        ? `Nobody held ${waited.file} any more: it is yours now, by turns.`
        : waited.followed
          ? `${waited.file} is yours now. ${waited.followed.note ?? ''}`
          : `Waiting for ${waited.holder} on ${waited.file}: it comes to this task when ${waited.holder} is approved, with the run's version. Go on with what of your task does not need it; \`plitzi task wait ${waited.file} --follow\` waits until it is yours.`,
    // Waiting, without --follow: exit 11 says so to a script. Given at once, or followed until given: 0.
    waited => (waited.granted || options.follow ? 0 : 11)
  );

export const taskDiscard = (file: string, options: RunCommandOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return { file, brought: await discardFile(ctx, runId, taskId, file) };
    },
    discarded =>
      `${discarded.file} in your copy is the run's version now, and your copy starts from it.${discarded.brought.filter(each => each !== discarded.file).length > 0 ? ` Also brought in, approved since your copy was made: ${discarded.brought.filter(each => each !== discarded.file).join(', ')}` : ''}`
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
