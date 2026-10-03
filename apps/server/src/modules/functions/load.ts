import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { readFunctionsSource } from '@plitzi/sdk-shared/actions';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import { buildFunctions } from './build';

import type { FunctionsSource } from './build';
import type { FunctionsDefinition } from './contract';
import type { FunctionsSourceReader } from '@plitzi/sdk-shared/actions';

const nodeReader: FunctionsSourceReader = {
  list: async dir =>
    (await readdir(dir, { withFileTypes: true })).map(entry => ({ name: entry.name, directory: entry.isDirectory() })),
  read: file => readFile(file, 'utf8')
};

/** Whether a module's default export has a definition's shape: what a server can register without surprises. */
const isFunctionsDefinition = (value: unknown): value is FunctionsDefinition => {
  if (!isRecord(value)) {
    return false;
  }

  const { tasks, routes, allow } = value;
  const tasksOk =
    tasks === undefined ||
    (Array.isArray(tasks) && tasks.every(task => isRecord(task) && typeof task.run === 'function'));
  const routesOk =
    routes === undefined || (isRecord(routes) && Object.values(routes).every(route => typeof route === 'function'));
  const allowOk =
    allow === undefined ||
    (isRecord(allow) &&
      (allow.hosts === undefined ||
        (Array.isArray(allow.hosts) && allow.hosts.every(host => typeof host === 'string'))));

  return tasksOk && routesOk && allowOk;
};

/**
 * A `functions/` directory as a source — the files the platform's rule counts, by their path inside it: what a space's
 * functions are saved as, and what `loadFunctions` builds.
 */
export const readFunctionsDir = (dir: string | URL): Promise<FunctionsSource> =>
  readFunctionsSource(typeof dir === 'string' ? dir : fileURLToPath(dir), nodeReader);

/**
 * A server's own functions from a directory — a project's `functions/`, the working copy `plitzi functions` keeps —
 * built exactly as the platform builds a space's (the same rules, one bundle) and loaded natively, for
 * `createServer({ functions: { native } })`. The same on `node src/main.ts` and on a compiled server: nothing here
 * depends on how the server itself runs. A directory with nothing in it is no functions; one that does not build, or
 * whose `index.ts` exports no definition, stops the server with where it is wrong.
 */
export const loadFunctions = async (dir: string | URL): Promise<FunctionsDefinition[]> => {
  const source = await readFunctionsDir(dir);
  if (!Object.keys(source).length) {
    return [];
  }

  const { code } = await buildFunctions(source);
  const loaded: unknown = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  const definition = isRecord(loaded) ? loaded.default : undefined;
  if (!isFunctionsDefinition(definition)) {
    throw new Error('functions/index.ts exports its definition by default: export default defineFunctions({ … })');
  }

  return [definition];
};
