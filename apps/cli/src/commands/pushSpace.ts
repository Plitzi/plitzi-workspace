import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import chalk from 'chalk';

import { authorSpace } from '@plitzi/sdk-authoring';
import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';
import { SPACE_IMPORT_FORMAT } from '@plitzi/sdk-shared/source';

import { loadProjectSpace } from './projectSpace';
import { fail } from './terminal';
import { authorizedRequest } from '../account/session';
import { ACTIONS_ENTRY } from '../scaffold/paths';

import type { PushOutcome } from './pushOutcome';
import type { ConnectedSpace, Connection } from '../account/connection';
import type { SpaceImport } from '@plitzi/sdk-shared/source';

/**
 * The space part of `plitzi push`: the project's `src/space/`, authored as `npm run author` authors it, with the
 * server actions and connectors the project keeps — put back as the space's draft (`PUT /spaces/:id/import`).
 *
 * The actions are the ones the project serves: what `src/actions/index.ts` lists. The
 * connectors are the manifests in `src/connectors/`. A project without either keeps none of its own, and the space's
 * are left as they are.
 */

type Entries = { identifier: string; name: string }[];

/** The JSON documents of a folder, by file: none when there is no such folder. */
const readJsonFolder = async (dir: string): Promise<{ file: string; value: unknown }[] | undefined> => {
  let files: string[];
  try {
    files = (await fs.readdir(dir)).filter(file => file.endsWith('.json')).sort();
  } catch {
    return undefined;
  }

  return Promise.all(
    files.map(async file => ({ file, value: JSON.parse(await fs.readFile(path.join(dir, file), 'utf-8')) as unknown }))
  );
};

/** The project's server actions, as its `src/actions/index.ts` serves them — `undefined` when it has no such module. */
const projectActions = async (root: string): Promise<SpaceImport['actions'] | { problem: string }> => {
  const file = path.join(root, ACTIONS_ENTRY);
  try {
    await fs.access(file);
  } catch {
    return undefined;
  }

  const loaded: unknown = await import(pathToFileURL(file).href);
  const listed = isRecord(loaded) ? loaded.actions : undefined;
  if (!Array.isArray(listed)) {
    return { problem: `${ACTIONS_ENTRY} exports no \`actions\` list: it is where the project’s actions are.` };
  }

  return listed.flatMap((entry: unknown) =>
    isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.document)
      ? [
          {
            identifier: entry.id,
            name: typeof entry.document.name === 'string' ? entry.document.name : entry.id,
            document: entry.document
          }
        ]
      : []
  );
};

/**
 * The connectors in `src/connectors/`, one manifest a file — `undefined` when it holds none: a project that never had
 * any leaves the space's as they are, rather than removing one added in the builder since.
 */
const projectConnectors = async (root: string): Promise<SpaceImport['connectors'] | { problem: string }> => {
  const read = await readJsonFolder(path.join(root, 'src/connectors'));
  if (!read || read.length === 0) {
    return undefined;
  }

  const broken = read.find(
    ({ value }) => !isRecord(value) || typeof value.id !== 'string' || !isRecord(value.manifest)
  );

  return broken
    ? { problem: `src/connectors/${broken.file} is not a connector: { "id", "name", "manifest" }.` }
    : read.flatMap(({ value }) =>
        isRecord(value) && typeof value.id === 'string' && isRecord(value.manifest)
          ? [
              {
                identifier: value.id,
                name: typeof value.name === 'string' ? value.name : value.id,
                manifest: value.manifest
              }
            ]
          : []
      );
};

const count = (entries: Entries | undefined, noun: string): string =>
  entries ? `${String(entries.length)} ${noun}${entries.length === 1 ? '' : 's'}` : `the space’s ${noun}s as they are`;

export type SpacePush = { outcome: PushOutcome; draft?: string };

/**
 * The project's space sent as the draft of the space the connection works in: refused when the draft moved on since
 * `base` (the draft the project last had), or — with no base — when the space holds work of its own; `force` takes it
 * anyway.
 */
export const pushSpaceOf = async (
  root: string,
  connection: Connection,
  space: ConnectedSpace,
  { base, force }: { base: string | null; force: boolean }
): Promise<SpacePush> => {
  const project = await loadProjectSpace(root);
  if ('problem' in project) {
    fail(project.problem);

    return { outcome: 'failed' };
  }

  let documents: SpaceImport['documents'];
  try {
    const { schema, style } = authorSpace(project.space, {
      plugins: project.plugins,
      pluginTypes: project.pluginTypes
    });
    documents = { schema, style };
  } catch (error) {
    fail(
      `The space does not author, so nothing was pushed — npm run author says why:\n${String(error instanceof Error ? error.message : error)}`
    );

    return { outcome: 'failed' };
  }

  const [actions, connectors] = await Promise.all([projectActions(root), projectConnectors(root)]);
  for (const read of [actions, connectors]) {
    if (read && 'problem' in read) {
      fail(read.problem);

      return { outcome: 'failed' };
    }
  }

  const sent: SpaceImport = {
    format: SPACE_IMPORT_FORMAT,
    documents,
    ...(Array.isArray(actions) ? { actions } : {}),
    ...(Array.isArray(connectors) ? { connectors } : {}),
    base,
    force
  };
  const answered = await authorizedRequest<{
    ok?: boolean;
    changed?: boolean;
    draft?: string;
    refusal?: { code?: string; error?: string };
    problems?: string[];
    error?: string;
  }>(connection, `/spaces/${String(space.id)}/import`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sent)
  });
  if (!answered.ok) {
    fail(answered.error);

    return { outcome: 'failed' };
  }

  const { status, data } = answered.value.reply;
  if (status === 409) {
    fail(
      data.refusal?.code === 'DRAFT_NOT_EMPTY'
        ? `${space.name} already holds work of its own, and this project never had it: pushing would replace it.\n` +
            `Take it out first (plitzi create --from ${space.permanentUrl}), or pass --force to replace it with this project.`
        : `${space.name}’s draft changed since this project last had it — in the builder, or from another copy.\n` +
            'Pull first (plitzi pull) and push again, or pass --force to replace it with this project.'
    );

    return { outcome: 'failed' };
  }

  if (status === 422 && data.problems) {
    fail(`${space.name} would not take the space as it is:${data.problems.map(problem => `\n  ${problem}`).join('')}`);

    return { outcome: 'failed' };
  }

  if (status !== 200 || !data.draft) {
    fail(data.error ?? `The space was not pushed (${String(status)}).`);

    return { outcome: 'failed' };
  }

  if (!data.changed) {
    return { outcome: 'unchanged', draft: data.draft };
  }

  console.log(
    chalk.green(
      `The space is ${space.name}’s draft now — its pages and styles, ${count(sent.actions, 'action')}, ` +
        `${count(sent.connectors, 'connector')}.`
    ) + chalk.dim(' Any builder open on it shows it now.')
  );

  return { outcome: 'pushed', draft: data.draft };
};
