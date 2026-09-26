import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { findProject } from './existingProject';
import { askText, atTerminal, refuseWithoutTerminal } from './terminal';
import { PackError, packPlugin } from '../pack';
import { pluginNames } from '../scaffold';

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

export interface PackPluginOptions {
  out?: string;
  zip?: boolean;
  pluginVersion?: string;
}

const hasElement = async (folder: string): Promise<boolean> => {
  try {
    await Promise.all(['index.ts', 'declaration.ts'].map(file => fs.access(path.join(folder, file))));

    return true;
  } catch {
    return false;
  }
};

/** The element folders a project keeps in `src/plugins` — the ones with a declaration, which is what packs. */
const elementFolders = async (project: ExistingProject): Promise<string[]> => {
  const dir = path.join(project.root, 'src/plugins');
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

const readVersion = async (root: string): Promise<string> => {
  // Read for its version alone: the file is the project's.
  const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf-8')) as { version?: string };

  return version ?? '0.0.0';
};

/** The `-kebab-` spelling of a type, for the files it names: `seatPicker` writes `seat-picker.mjs`. */
const fileNameOf = (folder: string): string =>
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
    console.error(
      chalk.red(
        'No element to pack: name its folder (plitzi pack plugin src/components/SeatPicker), or add one with ' +
          'plitzi add plugin.'
      )
    );
    process.exitCode = 1;

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
    console.error(
      chalk.red('plitzi pack plugin packs a plugin of a project, and there is no package.json here or above.')
    );
    process.exitCode = 1;

    return;
  }

  const inPackage = project.plitzi?.kind === 'plugin' && foldersGiven.length === 0;
  const folders = inPackage ? [] : await chosenFolders(project, foldersGiven);
  if (!folders) {
    return;
  }

  const packageName = JSON.parse(await fs.readFile(path.join(project.root, 'package.json'), 'utf-8')) as {
    name?: string;
  };
  const base = inPackage ? pluginNames(packageName.name ?? path.basename(project.root)).base : fileNameOf(folders[0]);
  const version = options.pluginVersion ?? (await readVersion(project.root));
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

  try {
    // A package also gets its type declarations, for a project that installs it; elements of a project go to the builder.
    const result = await packPlugin({ root: project.root, source, base, version, outDir, zip, types: inPackage });
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

    console.log('');
  } catch (error) {
    if (!(error instanceof PackError)) {
      throw error;
    }

    console.error(chalk.red(error.message));
    process.exitCode = 1;
  }
};

export default packPluginCommand;
