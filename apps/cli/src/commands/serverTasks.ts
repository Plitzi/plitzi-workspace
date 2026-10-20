import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isRecord } from '@plitzi/sdk-shared/helpers';

/**
 * The steps a server action runs — `list.put`, `flow.rateLimit`, `http.request` — as the project's own
 * `@plitzi/sdk-server` declares them: read from the version installed, so what is explained is what that project runs.
 * The same catalogue the builder draws its steps from (`describeCatalog`).
 */

export interface ServerTaskParam {
  name: string;
  type: string;
  label?: string;
  defaultValue?: unknown;
  options?: { label: string; value: unknown }[];
}

export interface ServerTask {
  kind: 'server-step';
  name: string;
  title: string;
  description?: string;
  params: ServerTaskParam[];
}

type Catalog = (registry: unknown) => unknown;
type Registry = (functions: unknown[], options: { db: boolean }) => unknown;

const isFunction = (value: unknown): value is (...args: never[]) => unknown => typeof value === 'function';

const paramsOf = (params: unknown): ServerTaskParam[] =>
  isRecord(params)
    ? Object.entries(params).flatMap(([name, param]) =>
        isRecord(param) && typeof param.type === 'string'
          ? [
              {
                name,
                type: param.type,
                ...(typeof param.label === 'string' ? { label: param.label } : {}),
                ...(param.defaultValue === undefined ? {} : { defaultValue: param.defaultValue }),
                ...(Array.isArray(param.options)
                  ? {
                      options: param.options.flatMap(option =>
                        isRecord(option) && typeof option.label === 'string'
                          ? [{ label: option.label, value: option.value }]
                          : []
                      )
                    }
                  : {})
              }
            ]
          : []
      )
    : [];

/**
 * Every step the project's server ships — `db.query` among them, offered when the deployment gives an engine — or why
 * there are none: no `@plitzi/sdk-server` installed (a project with no server runs no server actions), or one too old
 * to say.
 */
export const serverTasks = async (root: string): Promise<{ tasks: ServerTask[] } | { problem: string }> => {
  let entry: string;
  try {
    entry = createRequire(path.join(root, 'package.json')).resolve('@plitzi/sdk-server/actions');
  } catch {
    return { problem: 'this project has no @plitzi/sdk-server installed: it runs no server actions' };
  }

  const loaded: unknown = await import(pathToFileURL(entry).href);
  if (!isRecord(loaded) || !isFunction(loaded.createTaskRegistry) || !isFunction(loaded.describeCatalog)) {
    return { problem: 'the @plitzi/sdk-server installed here is too old to describe its steps: npx plitzi upgrade' };
  }

  // Narrowed to what is called, and checked by what comes back: the module is read at run time.
  const registry = (loaded.createTaskRegistry as Registry)([], { db: true });
  const described = (loaded.describeCatalog as Catalog)(registry);
  if (!Array.isArray(described)) {
    return { problem: 'the @plitzi/sdk-server installed here answered no catalogue of its steps' };
  }

  return {
    tasks: described
      .flatMap(task =>
        isRecord(task) && typeof task.name === 'string' && typeof task.title === 'string'
          ? [
              {
                kind: 'server-step' as const,
                name: task.name,
                title: task.title,
                ...(typeof task.description === 'string' ? { description: task.description } : {}),
                params: paramsOf(task.params)
              }
            ]
          : []
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  };
};

const shown = (value: unknown): string => (typeof value === 'string' ? `'${value}'` : JSON.stringify(value));

export const serverTaskText = (task: ServerTask): string =>
  [
    `${task.name} — ${task.title}, a step of a server action: { task: '${task.name}', params: { … } } in defineAction's steps.`,
    ...(task.description ? [task.description] : []),
    ...(task.params.length > 0
      ? [
          'Params (each a template over the input and the steps before):',
          ...task.params.map(
            param =>
              `  ${param.name} (${param.type})${param.label ? ` — ${param.label}` : ''}${
                param.defaultValue === undefined || param.defaultValue === ''
                  ? ''
                  : `; default ${shown(param.defaultValue)}`
              }${param.options ? `; one of ${param.options.map(option => shown(option.value)).join(', ')}` : ''}`
          )
        ]
      : ['No params.'])
  ].join('\n');
