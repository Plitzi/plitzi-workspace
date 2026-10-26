import chalk from 'chalk';

import { keepLook, keptLook, lookKey, pagesLooked } from './lookParts';
import { lookText } from './lookText';
import { lookAt } from './review';
import { act, runOf } from './shell';
import { takeOnRead } from './takeOnRead';
import { runPaths, taskPaths } from '../../runs/paths';
import { RunRefusal } from '../../runs/refusal';

import type { LookOptions } from './lookOptions';

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

      const state = await lookKey(ctx, runId, taskId, {});
      const looked = await lookAt(ctx, runId, taskId, paths, options, await pagesLooked(cache, state, ctx.now()));
      await keepLook(cache, key, lookText(looked), ctx.now(), { state, pages: looked.pages });

      return { kind: 'looked' as const, looked };
    },
    answer =>
      answer.kind === 'again'
        ? [
            chalk.dim(
              `As looked at ${answer.again.at.slice(11, 16)} UTC — the task, the run's approved work and what you asked are as they were, so this is that look again (--fresh looks anew):`
            ),
            answer.again.text
          ].join('\n')
        : lookText(answer.looked)
  );
