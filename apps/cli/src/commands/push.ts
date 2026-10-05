import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { connectToSpace } from './account';
import { askChecks } from './askChecks';
import { requestExport, versionLabel } from './createFrom';
import { sayDryRun } from './dryRun';
import { findProject, readPackageJson } from './existingProject';
import { filesUnder } from './filesUnder';
import { functionsChange, pushFunctionsOf } from './functions';
import { elementFolders, fileNameOf } from './packPlugin';
import { PUBLIC_ASSETS_DIR, projectAssetFiles, projectDataFiles } from './projectFiles';
import { projectFormatter } from './projectFormatter';
import { pushDataOf, pushFilesOf } from './pushProjectFiles';
import { pushSpaceOf } from './pushSpace';
import { DEFAULT_RUNTIME_ENTRY, pushRuntimeOf } from './runtime';
import { digest, digestsOf, givenFiles, readOrigin, writeOrigin } from './spaceOrigin';
import { atTerminal, fail } from './terminal';
import { chooseTarget, listCdns, uploadZip } from './uploadPlugin';
import { PackError, packPlugin } from '../pack';
import { packSource } from '../pack/source';
import { projectEntries, projectFromSpace } from '../scaffold/fromSpace';
import { ACTIONS_DIR, DATA_DIR, FUNCTIONS_DIR, SPACE_DIR, SPACE_ENTRY } from '../scaffold/paths';

import type { AccountOptions } from './account';
import type { DryRunOptions } from './dryRun';
import type { Formatter } from './projectFormatter';
import type { PushOutcome } from './pushOutcome';
import type { SpaceOrigin } from './spaceOrigin';
import type { Target } from './uploadPlugin';
import type { ConnectedSpace, Connection } from '../account/connection';
import type { SourceSnapshotKind, SpaceExport } from '@plitzi/sdk-shared/source';

/**
 * `plitzi push`: the project put back on the space it works with — the way back of `plitzi pull`
 * (docs/en/projects-from-spaces.md). Whatever changed since the project last had the space, or the parts named:
 *
 * - `plugins` — each plugin whose source changed, packed and uploaded to the space's CDN, as `plitzi upload plugin`;
 * - `functions` — `src/functions/`, as `plitzi functions push`;
 * - `runtime` — the runtime module, packed, as `plitzi runtime push`;
 * - `space` — the pages, styles, actions and connectors, as the space's draft.
 *
 * In that order: the pages name the plugins' elements and the actions name the functions' tasks, so what is named goes
 * up before what names it. A part that fails stops the push there.
 *
 * Always to the space the CLI is connected to, which must be the one the project came from; always the draft, never a
 * published environment. A draft edited in the builder since the project last had it is never replaced unseen: the push
 * is refused, and `--force` replaces it.
 */

export const PUSH_PARTS = ['space', 'functions', 'data', 'runtime', 'plugins', 'files'] as const;

export type PushPart = (typeof PUSH_PARTS)[number];

/** What goes up first: what the rest names — the files before the data and the pages that name their addresses. */
const ORDER: readonly PushPart[] = ['plugins', 'files', 'functions', 'data', 'runtime', 'space'];

export interface PushOptions extends AccountOptions, DryRunOptions {
  /** Replace the space's draft even when it moved on since the project last had it, or holds work of its own. */
  force?: boolean;
  /** Which of the space's CDNs a plugin goes to, and which public bucket: asked for when there are several. */
  cdn?: string;
  bucket?: string;
}

/** One thing the project can send: a part, or one plugin. */
type Pushable =
  | { part: 'space' | 'functions'; label: string; changed: boolean }
  | { part: 'runtime'; label: string; changed: boolean; entry: string; files: string[] }
  | { part: 'plugins'; label: string; changed: boolean; folders: string[]; files: string[] }
  | { part: 'data' | 'files'; label: string; changed: boolean; files: string[] };

const isPart = (value: string): value is PushPart => PUSH_PARTS.some(part => part === value);

const exists = async (file: string): Promise<boolean> => {
  try {
    await fs.access(file);

    return true;
  } catch {
    return false;
  }
};

/**
 * Whether any of the files changed since the project last had the space: one not recorded, or not as it was recorded —
 * formatting aside. Everything has, for a project that never had it.
 */
const changedSince = async (
  root: string,
  origin: SpaceOrigin | undefined,
  files: readonly string[],
  format: Formatter
): Promise<boolean> => {
  if (!origin) {
    return true;
  }

  for (const file of files) {
    const was = origin.files[file];
    const here = await digestsOf(root, file, format);
    if (!was || !here || (here.raw !== was && here.formatted !== was)) {
      return true;
    }
  }

  return false;
};

/** The project's files a build of the runtime or of a plugin is made of — none when that cannot be told. */
const closureOf = async (
  root: string,
  kind: SourceSnapshotKind,
  name: string,
  entries: string[]
): Promise<string[] | undefined> => {
  try {
    return Object.keys((await packSource({ root, kind, name, entries })).snapshot.files);
  } catch {
    return undefined;
  }
};

/** The folders the space part is made of: the pages, the actions, the connectors. */
const SPACE_FOLDERS = [`${SPACE_DIR}/`, `${ACTIONS_DIR}/`, 'src/connectors/'];

/** The space is code and JSON: a folder's `.gitkeep`, or a note beside its files, is never part of it. */
const isSpaceFile = (file: string): boolean =>
  SPACE_FOLDERS.some(folder => file.startsWith(folder)) && /\.(ts|json)$/.test(file);

/** A plugin's type as the project's folder spells it: `src/plugins/SeatPicker` is `seatPicker`. */
const typeOfFolder = (folder: string): string => {
  const name = path.basename(folder);

  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
};

/**
 * What the project can send, and whether each changed since the project last had the space. The plugins are grouped as
 * the space keeps them — a plugin can be several elements — and an element folder the space has no plugin of is a
 * plugin of its own.
 */
const survey = async (
  root: string,
  {
    origin,
    source,
    before,
    spaceId,
    format
  }: {
    origin: SpaceOrigin | undefined;
    source: 'local' | 'cloud';
    before: SpaceExport | undefined;
    spaceId: number;
    format: Formatter;
  }
): Promise<Pushable[]> => {
  const found: Pushable[] = [];
  if (source === 'local' && (await exists(path.join(root, SPACE_ENTRY)))) {
    const files = (await Promise.all(SPACE_FOLDERS.map(folder => filesUnder(root, folder)))).flat();
    const gone = Object.keys(origin?.files ?? {}).some(file => isSpaceFile(file) && !files.includes(file));
    found.push({
      part: 'space',
      label: 'space — its pages, styles, actions and connectors',
      changed:
        gone ||
        (await changedSince(
          root,
          origin,
          files.filter(file => isSpaceFile(file)),
          format
        ))
    });
  }

  // The space's data, where the project's server reads it: `src/data/`, or what the project had of it and removed.
  const data = await projectDataFiles(root);
  const dataGone = Object.keys(origin?.files ?? {}).some(
    file => file.startsWith(`${DATA_DIR}/`) && !data.includes(file)
  );
  if (data.length > 0 || dataGone) {
    found.push({
      part: 'data',
      label: `data — ${DATA_DIR}/`,
      changed: dataGone || (await changedSince(root, origin, data, format)),
      files: data
    });
  }

  // The files its space serves from the CDN: what of `public/assets/` is new, or not what was recorded.
  const assets = await projectAssetFiles(root);
  const changedAssets: string[] = [];
  for (const file of assets) {
    const here = await digestsOf(root, file, format);
    const was = origin?.files[file];
    if (!was || !here || (here.raw !== was && here.formatted !== was)) {
      changedAssets.push(file);
    }
  }

  if (assets.length > 0) {
    found.push({
      part: 'files',
      label: `files — ${PUBLIC_ASSETS_DIR}/${changedAssets.length > 0 ? ` (${String(changedAssets.length)} changed)` : ''}`,
      changed: changedAssets.length > 0,
      files: changedAssets
    });
  }

  const functions = await functionsChange(root, spaceId);
  if (functions !== 'none') {
    found.push({ part: 'functions', label: `functions — ${FUNCTIONS_DIR}/`, changed: functions === 'changed' });
  }

  const entries = before && projectEntries(before);
  // Where the space's runtime is, as `plitzi add runtime` and `create --from` write it alike.
  if (await exists(path.join(root, DEFAULT_RUNTIME_ENTRY))) {
    const runtimeEntry = DEFAULT_RUNTIME_ENTRY;
    const entry = path.join(root, runtimeEntry);
    const files = await closureOf(root, 'runtime', 'runtime', [entry]);
    found.push({
      part: 'runtime',
      label: `runtime — ${runtimeEntry}`,
      changed: !files || (await changedSince(root, origin, files, format)),
      entry,
      files: files ?? []
    });
  }

  const folders = await elementFolders({ root });
  const grouped = (entries?.plugins ?? [])
    .map(({ type, entries: starts }) => ({
      type,
      folders: starts.map(start => path.join(root, path.dirname(start)))
    }))
    .filter(group => group.folders.every(folder => folders.includes(folder)));
  const alone = folders
    .filter(folder => !grouped.some(group => group.folders.includes(folder)))
    .map(folder => ({ type: typeOfFolder(folder), folders: [folder] }));
  for (const { type, folders: group } of [...grouped, ...alone]) {
    const files = await closureOf(
      root,
      'plugin',
      type,
      group.map(folder => path.join(folder, 'index.ts'))
    );
    found.push({
      part: 'plugins',
      label: `plugin ${type} — ${group.map(folder => path.relative(root, folder)).join(', ')}`,
      changed: !files || (await changedSince(root, origin, files, format)),
      folders: group,
      files: files ?? []
    });
  }

  return found;
};

/**
 * What to send: the parts named; at a terminal, what the person ticks — what changed, ticked to begin with; with nobody
 * there, what changed. `undefined` when there is nothing to send, said why.
 */
const choose = async (found: Pushable[], asked: string[], spaceName: string): Promise<Pushable[] | undefined> => {
  if (asked.length > 0) {
    const unknown = asked.filter(part => !isPart(part));
    if (unknown.length > 0) {
      fail(`plitzi push sends ${PUSH_PARTS.join(', ')} — not ${unknown.join(', ')}.`);

      return undefined;
    }

    const missing = asked.filter(part => !found.some(item => item.part === part));
    if (missing.length > 0) {
      fail(`This project has no ${missing.join(', ')} to push.`);

      return undefined;
    }

    return found.filter(item => asked.includes(item.part));
  }

  if (found.length === 0) {
    fail('This project has nothing to push: no src/space/, src/functions/, runtime or plugin.');

    return undefined;
  }

  if (!atTerminal()) {
    return found.filter(item => item.changed);
  }

  const chosen = await askChecks(
    `What goes to ${spaceName}? Ticked: what changed since the project last had it.`,
    found.map(item => ({
      label: item.label,
      value: item,
      checked: item.changed,
      hint: item.changed ? 'changed' : 'unchanged'
    }))
  );
  if (!chosen) {
    console.log('Nothing was pushed.');
  }

  return chosen;
};

/** A plugin packed as `plitzi pack plugin` packs it, and uploaded and installed as `plitzi upload plugin` does. */
const pushPlugin = async (
  root: string,
  connection: Connection,
  space: ConnectedSpace,
  { folders, target, version }: { folders: string[]; target: Target; version: string }
): Promise<PushOutcome> => {
  const base = fileNameOf(folders[0]);
  const zip = path.join(root, 'dist/plugins', `${base}-${version}.zip`);
  let packed: Awaited<ReturnType<typeof packPlugin>>;
  try {
    packed = await packPlugin({
      root,
      source: { kind: 'elements', folders },
      base,
      version,
      outDir: path.join(root, 'dist/plugins', base),
      zip
    });
  } catch (error) {
    if (!(error instanceof PackError)) {
      throw error;
    }

    fail(error.message);

    return 'failed';
  }

  if ('problem' in packed.source) {
    console.log(chalk.yellow(`  Its source is not kept, so the space can be taken out with ${base} built only:`));
    console.log(chalk.yellow(`  ${packed.source.problem}`));
  }

  return uploadZip(connection, space, {
    zip: await fs.readFile(zip),
    filename: path.basename(zip),
    target,
    ...('file' in packed.source ? { source: await fs.readFile(packed.source.file) } : {})
  });
};

/**
 * `.plitzi/space.json` as the space now holds the project, so `plitzi pull` compares with it from here on: the files of
 * the parts sent recorded as the space gives them back, the rest as they were — a page changed in the builder and not
 * pushed over is still the builder's change to the next pull. A project that never had the space records it whole.
 */
const recordPush = async (
  root: string,
  connection: Connection,
  space: ConnectedSpace,
  {
    origin,
    source,
    found,
    sent,
    draft,
    uploaded,
    dataVersion
  }: {
    origin: SpaceOrigin | undefined;
    source: 'local' | 'cloud';
    /** Everything the project could send. */
    found: Pushable[];
    /** What the space now holds as the project does: what was sent, and the space part when it already did. */
    sent: Pushable[];
    draft: string | undefined;
    /** What this push put on the space's CDN, by the file's path in the project: its address there. */
    uploaded: Readonly<Record<string, string>>;
    /** The data's version, when this push sent it. */
    dataVersion: string | undefined;
  }
): Promise<void> => {
  const exported = await requestExport(connection, String(space.id), {
    source,
    version: { environment: 'main' },
    name: space.name
  });
  if (!exported.ok) {
    console.log(
      chalk.yellow(
        `Pushed, but .plitzi/space.json is not brought up to date — ${exported.error}\n` +
          'The next plitzi pull compares with what it recorded before.'
      )
    );

    return;
  }

  const format = await projectFormatter(root);
  const next = projectFromSpace(exported.value, source);
  const given = await givenFiles(next, format);
  const parts = new Set(sent.map(item => item.part));
  const codeOf = (items: Pushable[]): string[] =>
    items.flatMap(item => (item.part === 'runtime' || item.part === 'plugins' ? item.files : []));
  const built = new Set(codeOf(sent));
  // What builds are made of — the project's and the space's source tree, its packed runtime and built plugins — is
  // theirs; everything else the space gives, the space part's: its pages, actions and connectors, and the files around.
  const code = new Set([...codeOf(found), ...projectEntries(exported.value).files]);
  const downloads = new Set(Object.keys(origin?.downloads ?? {}));
  const isSent = (file: string): boolean => {
    if (!origin || built.has(file)) {
      return true;
    }

    if (file.startsWith(`${FUNCTIONS_DIR}/`)) {
      return parts.has('functions');
    }

    if (file.startsWith(`${DATA_DIR}/`)) {
      return parts.has('data');
    }

    return !code.has(file) && !file.startsWith('vendor/') && parts.has('space');
  };
  const files: Record<string, string> = Object.fromEntries(
    Object.entries(origin?.files ?? {}).filter(([file]) => downloads.has(file) || !isSent(file) || given.has(file))
  );
  given.forEach((bytes, file) => {
    if (isSent(file)) {
      files[file] = digest(bytes);
    }
  });
  // What went up to the CDN is what the space serves now: recorded as the project has it, at the address it took.
  for (const file of Object.keys(uploaded)) {
    const here = await digestsOf(root, file, format);
    if (here) {
      files[file] = here.formatted;
    }
  }

  // Only a push of the space makes its draft the project's: one that sent anything else leaves it to be refused, as a
  // draft the project never had, until the project has it.
  const recorded = draft ?? origin?.draft;
  await writeOrigin(root, {
    format: 1,
    api: connection.api,
    space: exported.value.space,
    source,
    version: { environment: 'main' },
    ...(recorded ? { draft: recorded } : {}),
    files,
    downloads: { ...(origin?.downloads ?? {}), ...uploaded },
    dependencies: !origin || parts.has('runtime') || parts.has('plugins') ? next.dependencies : origin.dependencies,
    ...(dataVersion ? { data: dataVersion } : origin?.data ? { data: origin.data } : {})
  });
};

export const push = async (asked: string[], options: PushOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project) {
    fail('There is no package.json here or above: run plitzi push in the project to send.');

    return;
  }

  if (project.plitzi?.kind === 'plugin') {
    fail('This is a plugin package: plitzi pack plugin and plitzi upload plugin put it on a space.');

    return;
  }

  const { root } = project;
  const origin = await readOrigin(root);
  if (origin && origin.version.environment !== 'main') {
    fail(
      `This project follows ${versionLabel(origin.version)} of ${origin.space.name}, and a push writes the draft.\n` +
        'Follow the draft first: plitzi pull --environment main.'
    );

    return;
  }

  const connection = await connectToSpace({ ...options, api: options.api ?? origin?.api }, 'to push to');
  const space = connection?.space;
  if (!connection || !space) {
    return;
  }

  if (origin && origin.space.id !== space.id) {
    fail(
      `This project is ${origin.space.name}’s, and the CLI works in ${space.name}. ` +
        'Switch to it with plitzi space, and push again.'
    );

    return;
  }

  const source = origin?.source ?? (project.plitzi?.kind === 'project' ? project.plitzi.source : 'local');
  let before: SpaceExport | undefined;
  if (origin) {
    const exported = await requestExport(connection, String(space.id), {
      source: 'cloud',
      version: { environment: 'main' },
      name: space.name
    });
    if (!exported.ok) {
      fail(exported.error);

      return;
    }

    before = exported.value;
  }

  const format = await projectFormatter(root);
  const found = await survey(root, { origin, source, before, spaceId: space.id, format });
  const chosen = await choose(found, asked, space.name);
  if (!chosen) {
    return;
  }

  if (chosen.length === 0) {
    console.log(`Nothing to push: the project is what ${space.name} last gave it.`);

    return;
  }

  const force = options.force ?? false;
  if (options.dryRun) {
    sayDryRun(
      `plitzi push — to ${space.name}’s draft`,
      [...chosen]
        .sort((a, b) => ORDER.indexOf(a.part) - ORDER.indexOf(b.part))
        .map(item => `→ ${item.label}${force ? ' (--force: over whatever the space holds now)' : ''}`)
    );

    return;
  }

  const sent: Pushable[] = [];
  const settled: Pushable[] = [];
  const unchanged: string[] = [];
  let draft: string | undefined;
  let target: Target | undefined;
  // Where each file of the project is on the space's CDN — what it took from there, and what this push puts there.
  const downloads: Record<string, string> = { ...(origin?.downloads ?? {}) };
  const uploaded: Record<string, string> = {};
  let dataVersion: string | undefined;
  const version = (await readPackageJson(root))?.version ?? '0.0.0';
  const targetOnce = async (): Promise<Target | undefined> => {
    if (!target) {
      const listed = await listCdns(connection, space);
      if (!listed.ok) {
        fail(listed.error);

        return undefined;
      }

      target = await chooseTarget(listed.value.cdns, options, space.name);
    }

    return target;
  };
  for (const item of [...chosen].sort((a, b) => ORDER.indexOf(a.part) - ORDER.indexOf(b.part))) {
    let outcome: PushOutcome;
    if (item.part === 'plugins') {
      const at = await targetOnce();
      if (!at) {
        return;
      }

      outcome = await pushPlugin(root, connection, space, { folders: item.folders, target: at, version });
    } else if (item.part === 'files') {
      const at = await targetOnce();
      if (!at) {
        return;
      }

      const pushed = await pushFilesOf(root, connection, space, { files: item.files, target: at });
      Object.assign(uploaded, pushed.uploaded);
      Object.assign(downloads, pushed.uploaded);
      outcome = pushed.outcome;
    } else if (item.part === 'data') {
      const pushed = await pushDataOf(root, connection, space, { base: origin?.data, force, downloads });
      dataVersion = pushed.version;
      outcome = pushed.outcome;
    } else if (item.part === 'functions') {
      outcome = await pushFunctionsOf(root, connection, space, { force });
    } else if (item.part === 'runtime') {
      outcome = await pushRuntimeOf(root, connection, space, item.entry);
    } else {
      const pushed = await pushSpaceOf(root, connection, space, { base: origin?.draft ?? null, force, downloads });
      outcome = pushed.outcome;
      draft = pushed.draft;
    }

    if (outcome === 'failed') {
      if (sent.length > 0) {
        console.log(chalk.yellow(`\nPushed before it stopped: ${sent.map(done => done.label).join('; ')}.`));
        await recordPush(root, connection, space, {
          origin,
          source,
          found,
          sent: settled,
          draft,
          uploaded,
          dataVersion
        });
      }

      return;
    }

    if (outcome === 'pushed') {
      sent.push(item);
    } else {
      unchanged.push(item.label);
    }

    // The draft the server found already the project's is as good as sent; functions found as pulled are not — the
    // space's copy may have moved on since, and only a pull can say.
    if (outcome === 'pushed' || item.part === 'space') {
      settled.push(item);
    }
  }

  if (settled.length > 0) {
    await recordPush(root, connection, space, { origin, source, found, sent: settled, draft, uploaded, dataVersion });
  }

  if (unchanged.length > 0) {
    console.log(chalk.dim(`Already ${space.name}’s: ${unchanged.join('; ')}.`));
  }

  if (sent.length > 0) {
    console.log(
      chalk.green(`\nPushed to ${space.name}’s draft.`) + chalk.dim(' Publish it in the builder to take it live.')
    );
  }
};
