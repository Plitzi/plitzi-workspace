import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { elementEntry } from '@plitzi/sdk-shared/project/layout';

import { sayDryRun } from './dryRun';
import { findProject, readPackageJson } from './existingProject';
import { askText, atTerminal, fail, refuseWithoutTerminal } from './terminal';
import { PackError, packPlugin, sourceFileOf } from '../pack';
import { pluginNames } from '../scaffold';
import { PLUGIN_DECLARATION_FILE, PLUGINS_DIR } from '../scaffold/paths';

import type { DryRunOptions } from './dryRun';
import type { ExistingProject } from './existingProject';
import type { PackSource } from '../pack';

/**
 * `plitzi pack plugin`: what the builder takes under Resources, from wherever the plugin lives.
 *
 * - In a plugin package, its elements as the package publishes them.
 * - In any other project, the element folders named — an element added with `plitzi add plugin` to a self-hosted
 *   project is packed from where it is, with no package around it. Several go in one zip: the first is the plugin,
 *   the rest its `plugins`.
 */

export interface PackPluginOptions extends DryRunOptions {
  out?: string;
  zip?: boolean;
  pluginVersion?: string;
  /** The project the source is kept relative to, when the elements are a project of their own inside this one. */
  sourceRoot?: string;
}

/** An element folder: its entry (`index.ts` or `index.tsx`, `elementEntry`) and its declaration. */
const hasElement = async (folder: string): Promise<boolean> => {
  if (!elementEntry(folder)) {
    return false;
  }

  try {
    await fs.access(path.join(folder, PLUGIN_DECLARATION_FILE));

    return true;
  } catch {
    return false;
  }
};

/** The element folders a project keeps in `src/plugins` — the ones with a declaration, which is what packs. */
export const elementFolders = async (project: Pick<ExistingProject, 'root'>): Promise<string[]> => {
  const dir = path.join(project.root, PLUGINS_DIR);
  let entries: string[] = [];
  try {
    entries = (await fs.readdir(dir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch {
    return [];
  }

  const folders = entries.map(name => path.join(dir, name));
  const packable = await Promise.all(folders.map(hasElement));

  return folders.filter((_folder, index) => packable[index]);
};

/** The `-kebab-` spelling of a type, for the files it names: `seatPicker` writes `seat-picker.mjs`. */
export const fileNameOf = (folder: string): string =>
  path
    .basename(folder)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

/** Which folders to pack, when none were named: asked for at a terminal, from the ones the project has. */
const askFolders = async (candidates: string[], root: string): Promise<string[]> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const list = candidates.map((folder, index) => `  ${index + 1}. ${path.relative(root, folder)}`).join('\n');
    const reply = await askText(
      rl,
      `Which elements go in the plugin? The first is the one it is named after.\n${list}\nTheir numbers, separated by commas:`,
      '1',
      answer =>
        answer.split(',').every(part => {
          const index = Number(part.trim()) - 1;

          return Number.isInteger(index) && index >= 0 && index < candidates.length;
        })
          ? undefined
          : `Numbers from 1 to ${candidates.length}, separated by commas.`
    );

    return reply.split(',').map(part => candidates[Number(part.trim()) - 1]);
  } finally {
    rl.close();
  }
};

/**
 * The element folders to pack, when this is not a plugin package packing itself: those named, or else the ones the
 * project keeps in `src/plugins`, asked for at a terminal. `undefined` when there is nothing to pack or nobody to ask.
 */
const chosenFolders = async (project: ExistingProject, foldersGiven: string[]): Promise<string[] | undefined> => {
  if (foldersGiven.length > 0) {
    return foldersGiven.map(folder => path.resolve(folder));
  }

  const candidates = await elementFolders(project);
  if (candidates.length === 0) {
    fail(
      'No element to pack: name its folder (plitzi pack plugin src/components/SeatPicker), or add one with ' +
        'plitzi add plugin.'
    );

    return undefined;
  }

  if (!atTerminal()) {
    refuseWithoutTerminal(
      'plugin',
      [
        {
          flag: '<folders> (the arguments)',
          choices: candidates.map(folder => path.relative(process.cwd(), folder)),
          question: 'Which elements go in the plugin? The first is the one it is named after.'
        }
      ],
      'plitzi pack plugin stopped before building anything: which elements go in it shape the whole plugin'
    );

    return undefined;
  }

  return askFolders(candidates, project.root);
};

const packPluginCommand = async (foldersGiven: string[], options: PackPluginOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project) {
    fail('plitzi pack plugin packs a plugin of a project, and there is no package.json here or above.');

    return;
  }

  const inPackage = project.plitzi?.kind === 'plugin' && foldersGiven.length === 0;
  const folders = inPackage ? [] : await chosenFolders(project, foldersGiven);
  if (!folders) {
    return;
  }

  const manifest = await readPackageJson(project.root);
  const base = inPackage ? pluginNames(manifest?.name ?? path.basename(project.root)).base : fileNameOf(folders[0]);
  const version = options.pluginVersion ?? manifest?.version ?? '0.0.0';
  const source: PackSource = inPackage
    ? {
        kind: 'package',
        entry: path.join(project.root, 'src/index.ts'),
        declarations: path.join(project.root, 'src/declarations.ts')
      }
    : { kind: 'elements', folders };
  const outDir = options.out
    ? path.resolve(options.out)
    : path.join(project.root, inPackage ? 'dist' : `dist/plugins/${base}`);
  const zip =
    options.zip === false
      ? undefined
      : path.join(inPackage ? project.root : path.dirname(outDir), `${base}-${version}.zip`);

  if (options.dryRun) {
    const relative = (file: string): string => path.relative(process.cwd(), file) || '.';
    sayDryRun(`plitzi pack plugin — ${base} ${version}`, [
      `build ${inPackage ? 'the package’s elements (src/index.ts)' : folders.map(relative).join(', ')}, with any server half its folder has`,
      `+ ${relative(outDir)}/ — the module and plugin-manifest.json${inPackage ? ', and types/' : ''}`,
      ...(zip ? [`+ ${relative(zip)}`, `+ ${relative(sourceFileOf(zip))} — its source, when it can be kept`] : [])
    ]);

    return;
  }

  try {
    // A package also gets its type declarations, for a project that installs it; elements of a project go to the builder.
    const result = await packPlugin({
      root: project.root,
      source,
      base,
      version,
      outDir,
      zip,
      sourceRoot: options.sourceRoot ? path.resolve(options.sourceRoot) : project.root,
      types: inPackage
    });
    console.log(chalk.green(`\n${result.types.join(', ')} — packed at ${path.relative(process.cwd(), outDir) || '.'}`));
    for (const file of result.files) {
      console.log(chalk.dim(`  ${file}`));
    }

    if (result.typesOutcome === 'written') {
      console.log(chalk.dim('  types/'));
    } else if (result.typesOutcome === 'no-typescript') {
      console.log(chalk.yellow('  No type declarations: the package has no TypeScript installed to write them with.'));
    }

    if (result.zip) {
      console.log(`\n  ${path.relative(process.cwd(), result.zip)}`);
      console.log(chalk.dim('  Upload it in the builder under Resources, as a plugin.'));
    }

    if ('file' in result.source) {
      console.log(
        chalk.dim(`  ${path.relative(process.cwd(), result.source.file)} — its source, which plitzi upload keeps too`)
      );
    } else {
      console.log(
        chalk.yellow('\n  Its source is not kept, so the space can be taken back out with this plugin built only:')
      );
      console.log(chalk.yellow(`  ${result.source.problem.split('\n').join('\n  ')}`));
    }

    console.log('');
  } catch (error) {
    if (!(error instanceof PackError)) {
      throw error;
    }

    fail(error.message);
  }
};

export default packPluginCommand;
