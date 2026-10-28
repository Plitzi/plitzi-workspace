import { leaveTask } from '../../../runs/tasks';
import { act, runOf } from '../shell';

import type { RunCommandOptions } from '../shell';

/** `plitzi task leave <task> --why "…"`: the lead takes a task out of the open run, with those that wait on it. */
export const taskLeave = (taskId: string, options: RunCommandOptions & { why?: string }): Promise<void> =>
  act(
    options,
    async ctx => leaveTask(ctx, await runOf(ctx, options), taskId, options.why ?? ''),
    ({ left, cut }) =>
      [
        `Left out of the run: ${left.join(', ')} — no one takes ${left.length === 1 ? 'it' : 'them'}, and the finish writes the run without ${left.length === 1 ? 'it' : 'them'}, said in its report.`,
        ...(cut.length > 0 ? [`Taken back from whoever held ${cut.join(', ')}: told why on its next command.`] : [])
      ].join('\n')
  );
