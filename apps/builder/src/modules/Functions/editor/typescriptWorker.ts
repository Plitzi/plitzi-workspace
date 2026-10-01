import { createWorker } from '@valtown/codemirror-ts/worker';
import { expose } from 'comlink';

import { createFunctionsEnvironment } from './functionsEnvironment';
import { describeSource, withNewTask, withTaskLimits } from './source';

import type { NewTask, SourcePlace } from './source';
import type { FunctionTimeLimits } from '@plitzi/sdk-shared';

/**
 * The Functions panel's TypeScript, in a worker of its own: completion, hover and diagnostics against the contract a
 * space's code is written for — `@plitzi/sdk-server/functions`, as that package rolls it up (`functions-api.d.ts`), so
 * the types here are never written twice. Built apart from the builder (`vite.functions-worker.config.ts`) and loaded
 * only when the panel opens: nobody else in the builder pays for a compiler.
 *
 * Beside the editor's, what the panel itself asks of the same program: what the source declares, as it is written, and
 * the few edits the panel makes to it for you — a task's time, a new task.
 */
const editor = createWorker(createFunctionsEnvironment);

const functionsWorker = {
  ...editor,
  describe: () => describeSource(editor.getEnv()),
  setTaskLimits: (place: SourcePlace, limits: FunctionTimeLimits) => withTaskLimits(editor.getEnv(), place, limits),
  addTask: (task: NewTask) => withNewTask(editor.getEnv(), task)
};

export type FunctionsWorker = typeof functionsWorker;

expose(functionsWorker);
