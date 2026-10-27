import chalk from 'chalk';

import { keepLook, keptLook, lookKey, pagesLooked } from './lookParts';
import { pathGroups } from './lookPaths';
import { lookText } from './lookText';
import { lookAt } from './review';
import { act, runOf } from './shell';
import { takeOnRead } from './takeOnRead';
import { runPaths, taskPaths } from '../../runs/paths';
import { RunRefusal } from '../../runs/refusal';
import { actingSteps } from '../shot/steps';

import type { LookOptions } from './lookOptions';
import type { PathGroup } from './lookPaths';

/** `plitzi task look <task> [pages…]`: the look, or the one that still stands for what is asked (`--fresh` looks anew). */
export const taskLook = (taskId: string, paths: string[], options: LookOptions): Promise<void> =>
  act(
    options,
    async ctx => {
      const runId = await runOf(ctx, options);
      await takeOnRead(ctx, runId, taskId);

      if ([options.click, options.hover, options.steps].filter(each => each !== undefined).length > 1) {
        throw new RunRefusal(
          'invalid',
          'One interaction a look: --click an element, --hover one, or --steps — a look for each'
        );
      }

      // A visitor's steps, read and pictured after: a picture among them is page shot's, the look takes its own.
      const steps = actingSteps(options.steps, 'task look');
      if ('problem' in steps) {
        throw new RunRefusal('invalid', steps.problem);
      }

      // Looked at already, as asked now, and nothing changed since — the task, the run's approved work: said again, not
      // looked at again (--fresh looks). A lead looking after the designer, an agent looking twice, paid 8 s each.
      const { cache } = taskPaths(runPaths(ctx.root, runId), taskId);
      const key = await lookKey(ctx, runId, taskId, {
        paths,
        ...options,
        fresh: undefined,
        json: undefined,
        token: undefined
      });
      const before = options.fresh ? undefined : await keptLook(cache, key, ctx.now());
      if (before) {
        return { kind: 'again' as const, again: before };
      }

      // A look a visitor: the paths each say theirs, the next told what the ones before covered.
      const state = await lookKey(ctx, runId, taskId, {});
      const covered = await pagesLooked(cache, state, ctx.now());
      const groups = paths.length === 0 ? [{ paths: [], visitor: {} }] : pathGroups(paths);
      const looks: { said: string | undefined; text: string }[] = [];
      for (const group of groups) {
        const { as, guest, status } = group.visitor;
        const looked = await lookAt(
          ctx,
          runId,
          taskId,
          group.paths,
          {
            ...options,
            ...(as === undefined ? {} : { as, guest: false }),
            ...(guest === true ? { as: undefined, guest: true } : {}),
            ...(status === undefined ? {} : { status })
          },
          covered
        );
        covered.push(...looked.pages);
        looks.push({ said: groups.length > 1 ? visitorText(group) : undefined, text: lookText(looked) });
      }

      const text = looks
        .map(each => (each.said === undefined ? each.text : `${chalk.bold(each.said)}\n${each.text}`))
        .join('\n\n');
      await keepLook(cache, key, text, ctx.now(), { state, pages: [...new Set(covered)] });

      return { kind: 'looked' as const, text };
    },
    answer =>
      answer.kind === 'again'
        ? [
            chalk.dim(
              `As looked at ${answer.again.at.slice(11, 16)} UTC — the task, the run's approved work and what you asked are as they were, so this is that look again (--fresh looks anew):`
            ),
            answer.again.text
          ].join('\n')
        : answer.text
  );

/** A group's paths as the look reads them: who, and what they are sent with. */
const visitorText = (group: PathGroup): string =>
  `${group.paths.join(', ')}${group.visitor.as === undefined ? '' : ` as ${group.visitor.as}`}${group.visitor.guest === true ? ' as a guest' : ''}${group.visitor.status === undefined ? '' : `, sent ${String(group.visitor.status)}`}:`;
