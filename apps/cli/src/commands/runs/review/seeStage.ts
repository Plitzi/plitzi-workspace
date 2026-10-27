import path from 'node:path';

import { triedText } from '../../../runs/plan/tryLines';
import { seeProposal } from '../../../runs/tasks';
import { act, holder } from '../shell';

import type { RunCommandOptions } from '../shell';

/**
 * `plitzi task check --tasks <stage.json>` at a research card: the stage it would propose, seen as the lead would stack
 * it, each line run once on the run's work — what a scout reached `run extend`, the lead's, for.
 */
export const taskSeeStage = (options: RunCommandOptions & { tasks: string }): Promise<void> =>
  act(
    options,
    async ctx => {
      const { runId, taskId } = await holder(ctx, options);

      return { file: options.tasks, seen: await seeProposal(ctx, runId, taskId, path.resolve(options.tasks)) };
    },
    ({ file, seen }) =>
      [
        `Your stage, seen as the lead would stack it — nothing proposed yet: ${seen.added.join(', ')}. Propose it with what you found: plitzi task complete --found "…" --tasks ${file}`,
        ...(seen.checked?.notices ?? []).map(notice => `  · ${notice}`),
        ...(seen.tried && seen.tried.length > 0
          ? ['Each line, run once on the run’s work as it is:', ...triedText(seen.tried)]
          : [])
      ].join('\n')
  );
