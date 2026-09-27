import { createWorker } from '@valtown/codemirror-ts/worker';
import { expose } from 'comlink';

import { createFunctionsEnvironment } from './functionsEnvironment';

/**
 * The Functions panel's TypeScript, in a worker of its own: completion, hover and diagnostics against the contract a
 * space's code is written for — `@plitzi/sdk-server/functions`, as that package rolls it up (`functions-api.d.ts`), so
 * the types here are never written twice. Built apart from the builder (`vite.functions-worker.config.ts`) and loaded
 * only when the panel opens: nobody else in the builder pays for a compiler.
 */
expose(createWorker(createFunctionsEnvironment));
