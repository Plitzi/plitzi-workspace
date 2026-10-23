import { spawn } from 'node:child_process';
import { existsSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { validateSpace } from './index';
import { buildHandles } from './schema/handles';

import type { LayoutHandle, PageHandle } from './schema/handles';
import type { SpaceRefusal } from './schema/refusals';
import type { AuthoredSpace } from './schema/types';

/**
 * A space module somebody else wrote — an agent's, a visitor's — authored in a process of its own, which may read the
 * module's folder and the packages it imports and nothing else: no file written, no process or worker started, no
 * native addon, no environment variable of this one. What it answers is checked again here (`validateSpace`), so a
 * module that forges its own answer gains nothing by it.
 *
 * Network access is not one Node's permission model takes away before Node 25: serve what it authors on a host of
 * its own (`createAuthoringHost` of `@plitzi/sdk-server`), never the app's, and do not run it where the network it
 * reaches is one to keep it from.
 *
 * ```ts
 * const result = await authorIsolated('tmp/pages/weather.ts');
 * if (result.ok) {
 *   host.put(result.space);
 * } else {
 *   reply(result.message);   // a refusal reads as `authorSpace`'s: every problem, where it is and what to write
 * }
 * ```
 */

export interface IsolatedOptions {
  /** How long the module may take, loaded and authored, before its process is killed. 10 s by default. */
  timeoutMs?: number;
  /** The most memory its process may hold, in MB. 512 by default. */
  memoryMb?: number;
}

export type IsolatedAuthoring =
  | { ok: true; space: AuthoredSpace }
  /** `authorSpace` refused it: `message` is its report, `refusals` the problems as data. */
  | { ok: false; reason: 'refused'; message: string; refusals: SpaceRefusal[] }
  /**
   * `failed`: the module did not load, exports no `space`, or its process died — `message` says which, and where;
   * `timeout`: it ran past `timeoutMs`; `invalid`: what it answered is not a space `validateSpace` passes.
   */
  | { ok: false; reason: 'failed' | 'timeout' | 'invalid'; message: string };

const STDERR_KEPT = 2000;

/** The `node_modules` nearest the module that has `@plitzi/sdk-authoring` in it: where its imports resolve. */
const modulesOf = (dir: string): string | undefined => {
  for (let at = dir; ; at = path.dirname(at)) {
    if (existsSync(path.join(at, 'node_modules', '@plitzi', 'sdk-authoring'))) {
      return path.join(at, 'node_modules');
    }

    if (path.dirname(at) === at) {
      return undefined;
    }
  }
};

/**
 * What the process may read: the module's folder, the packages it imports, and — where a package is linked in from
 * elsewhere (a workspace) — the folder it really is in, which is the path Node reads it by.
 */
const readable = (dir: string, modules: string): string[] => {
  const linked = readdirSync(path.join(modules, '@plitzi')).map(name =>
    realpathSync(path.join(modules, '@plitzi', name))
  );
  // The project's src/ whole, when the module is in it: a space reads beside its folder — its pages by folder
  // (`pagesIn`), its data (`../data/*.json`) — and was refused at its first read (lx-copy's `page check --space`). Never
  // the project's root, where its .env is.
  const root = realpathSync(path.dirname(modules));
  const source = path.join(root, 'src');
  const inSource = dir === source || dir.startsWith(`${source}${path.sep}`);
  // …its package.json alone, which Node reads to know a module's type, and its node_modules by the real path Node walks
  // up to from the module (the path `modules` names may be a link to it).
  const project = inSource ? [source, path.join(root, 'package.json'), path.join(root, 'node_modules')] : [];

  return [...new Set([dir, ...project, modules, realpathSync(modules), ...linked])];
};

/**
 * The module's process: imports it, authors its `space` with the copy of `@plitzi/sdk-authoring` the module itself
 * imports — one copy, so the marks a factory leaves on what it makes are read by the code that made them — and sends
 * back what it answered.
 */
const runner = (file: string): string => `
const FILE = ${JSON.stringify(pathToFileURL(file).href)};
const NAME = ${JSON.stringify(path.basename(file))};
const send = message => new Promise(resolve => process.send(message, () => resolve()));
const firstLine = error => String(error instanceof Error ? error.message : error).split('\\n')[0];
const located = error => {
  const frame = String(error instanceof Error ? error.stack ?? '' : '')
    .split('\\n')
    .map(line => /(file:\\/\\/[^\\s:()]+):(\\d+)/.exec(line))
    .find(match => match && match[1] === FILE);

  return frame ? NAME + ':' + frame[2] + ': ' + firstLine(error) : NAME + ': ' + firstLine(error);
};
try {
  const { authorSpace } = await import('@plitzi/sdk-authoring');
  let loaded;
  try {
    loaded = await import(FILE);
  } catch (error) {
    if (error instanceof Error && (error.name === 'AuthoringError' || error.name === 'SpaceRefusedError')) {
      throw error;
    }

    await send({ ok: false, reason: 'failed', message: located(error) });
    process.exit(0);
  }

  const space = loaded && loaded.space;
  if (!space || typeof space !== 'object') {
    await send({
      ok: false,
      reason: 'failed',
      message: NAME + ' exports no \`space\`: \`export const space: SpaceSpec = { name, permanentUrl, pages, … }\`'
    });
    process.exit(0);
  }

  const { schema, style, handles, warnings, suggestions } = authorSpace(space);
  await send({ ok: true, space: { schema, style, handles, warnings, suggestions } });
} catch (error) {
  await send(
    error instanceof Error && error.name === 'SpaceRefusedError'
      ? { ok: false, reason: 'refused', message: error.message, refusals: error.refusals }
      : { ok: false, reason: 'failed', message: located(error) }
  );
}
process.exit(0);
`;

/** What the process answered, read for its shape and the space checked again: nothing it says is taken on trust. */
const readAnswer = (answer: unknown): IsolatedAuthoring | undefined => {
  if (!isRecord(answer) || typeof answer.ok !== 'boolean') {
    return undefined;
  }

  if (!answer.ok) {
    const message = typeof answer.message === 'string' ? answer.message : 'The module was not authored';

    return answer.reason === 'refused' && Array.isArray(answer.refusals)
      ? { ok: false, reason: 'refused', message, refusals: answer.refusals.filter(isRefusal) }
      : { ok: false, reason: 'failed', message };
  }

  const space = answer.space;
  if (!isWireAuthored(space)) {
    return { ok: false, reason: 'invalid', message: 'The module answered something that is not a space' };
  }

  let checked: ReturnType<typeof validateSpace>;
  try {
    checked = validateSpace({ schema: space.schema, style: space.style });
  } catch (error) {
    // A document of the right outline with the wrong insides: the validator reads it as typed, and stops where it is not.
    return {
      ok: false,
      reason: 'invalid',
      message: `The space the module answered is not one: ${error instanceof Error ? error.message : String(error)}`
    };
  }

  if (!checked.valid) {
    return {
      ok: false,
      reason: 'invalid',
      message: `The space the module answered does not validate: ${checked.errors.map(error => error.message).join('; ')}`
    };
  }

  return { ok: true, space: { ...space, handles: buildHandles(space.handles.pages, space.handles.layouts) } };
};

const isRefusal = (value: unknown): value is SpaceRefusal =>
  isRecord(value) && typeof value.message === 'string' && typeof value.place === 'string';

/** What `authorSpace` answers as it arrives over the wire: data only — its handles' lookups are made again here. */
type WireAuthored = Omit<AuthoredSpace, 'handles'> & {
  handles: { pages: Record<string, PageHandle>; layouts: Record<string, LayoutHandle> };
};

/**
 * The shape of that answer. The documents are what `validateSpace` checks; the rest is what the author said about them,
 * read by whoever asked.
 */
const isWireAuthored = (value: unknown): value is WireAuthored =>
  isRecord(value) &&
  isRecord(value.schema) &&
  isRecord(value.style) &&
  isRecord(value.handles) &&
  isRecord(value.handles.pages) &&
  isRecord(value.handles.layouts) &&
  Array.isArray(value.warnings) &&
  Array.isArray(value.suggestions);

export const authorIsolated = (file: string, options: IsolatedOptions = {}): Promise<IsolatedAuthoring> => {
  const { timeoutMs = 10_000, memoryMb = 512 } = options;
  const module = path.resolve(file);
  if (!existsSync(module)) {
    return Promise.resolve({ ok: false, reason: 'failed', message: `${file} does not exist` });
  }

  const dir = path.dirname(module);
  const modules = modulesOf(dir);
  if (!modules) {
    return Promise.resolve({
      ok: false,
      reason: 'failed',
      message: `No @plitzi/sdk-authoring is installed where ${file} is: put the module inside the project that installs it`
    });
  }

  const reads = readable(realpathSync(dir), modules);

  return new Promise(resolve => {
    const child = spawn(
      process.execPath,
      [
        '--permission',
        ...reads.map(read => `--allow-fs-read=${read}`),
        `--max-old-space-size=${String(memoryMb)}`,
        '--input-type=module',
        '-e',
        runner(realpathSync(module))
      ],
      { cwd: dir, env: {}, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] }
    );
    let answer: unknown;
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('message', message => {
      answer = message;
    });
    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr = (stderr + chunk).slice(-STDERR_KEPT);
    });
    child.on('error', error => {
      clearTimeout(timer);
      resolve({ ok: false, reason: 'failed', message: `The module's process did not start: ${error.message}` });
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        resolve({
          ok: false,
          reason: 'timeout',
          message: `${file} took longer than ${String(timeoutMs)} ms to author`
        });

        return;
      }

      const read = readAnswer(answer);
      resolve(
        read ?? {
          ok: false,
          reason: 'failed',
          message: `The module's process ended (${String(code)}) without an answer${stderr.trim() ? `: ${stderr.trim()}` : ''}`
        }
      );
    });
  });
};
