import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { coveredByWorkspace, findProject } from './existingProject';
import {
  INSTALL_HINTS,
  ask,
  askChoice,
  askText,
  atTerminal,
  cdPrefix,
  install,
  isEmpty,
  nearestExisting,
  refuseWithoutTerminal,
  runScript,
  writeFiles
} from './terminal';
import {
  PACKAGE_MANAGERS,
  detectManagerVersion,
  detectPackageManager,
  installCommand,
  pluginNameProblem,
  pluginNames,
  runCommand,
  scaffoldPlugin
} from '../scaffold';

import type { ExistingProject } from './existingProject';
import type { PackageManager } from '../scaffold';

/**
 * A plugin of its own: a package that builds one element into something any space can load, with a preview to write
 * it in. Blank, or inside a repository that already exists — then the folder it goes in is asked, from the ones that
 * repository keeps its packages in.
 */

export interface CreatePluginOptions {
  name?: string;
  title?: string;
  description?: string;
  owner?: string;
  packageManager?: string;
  install?: boolean;
  force?: boolean;
  yes?: boolean;
}

const DEFAULT_NAME = 'plitzi-plugin-my-element';

/** What an agent is told to ask for, and the flags that carry the answers. */
const QUESTIONS = {
  name: {
    flag: '--name',
    choices: ['<package name>'],
    question: 'What is the plugin called? Its package name, e.g. plitzi-plugin-seat-picker.'
  },
  directory: {
    flag: '<directory> (the first argument)',
    choices: ['<folder>'],
    question: 'Which folder should the plugin be written to?'
  }
};

/** The folders a repository keeps its packages in, as places for this one — or `./<name>` outside of any. */
const folderOptions = (project: ExistingProject | undefined, base: string) => {
  if (!project) {
    return [];
  }

  const root = project.workspaceRoot ?? project.root;
  const folders = [...new Set([...project.workspaceFolders, 'plugins'])];

  return folders.map(folder => {
    const value = path.join(root, folder, base);

    return { label: path.relative(process.cwd(), value) || '.', value };
  });
};

const askDirectory = async (
  rl: readline.Interface,
  project: ExistingProject | undefined,
  base: string
): Promise<string> => {
  const typed = { question: 'Which folder? (relative to here)', fallback: `./${base}` };
  if (!project) {
    return path.resolve(await askText(rl, 'Which folder should the plugin be written to?', typed.fallback));
  }

  const chosen = await askChoice(
    rl,
    `Which folder of ${path.relative(process.cwd(), project.workspaceRoot ?? project.root) || 'this project'} should the plugin go in?`,
    folderOptions(project, base),
    { label: 'Somewhere else', ...typed }
  );

  return path.resolve(chosen);
};

/**
 * The manager: the one the repository already installs with, when it is written into one — asking would only offer a
 * second lockfile — and otherwise asked, as a project's is.
 */
const resolveManager = async (
  rl: readline.Interface | undefined,
  options: CreatePluginOptions,
  project: ExistingProject | undefined
): Promise<PackageManager | undefined> => {
  const given = PACKAGE_MANAGERS.find(manager => manager === options.packageManager);
  if (given ?? project?.packageManager) {
    return given ?? project?.packageManager;
  }

  const detected = detectPackageManager();
  if (!rl || options.yes) {
    return options.yes ? detected : undefined;
  }

  return ask(rl, {
    flag: '--package-manager',
    choices: PACKAGE_MANAGERS,
    question: `Which package manager will you work in? (this was run through ${detected})`,
    fallback: detected
  });
};

const createPlugin = async (directory: string | undefined, options: CreatePluginOptions): Promise<void> => {
  const nameGiven = options.name ?? (directory ? path.basename(path.resolve(directory)) : undefined);
  const nameProblem = nameGiven === undefined ? undefined : pluginNameProblem(nameGiven);
  if (nameProblem) {
    console.error(chalk.red(nameProblem));
    process.exitCode = 1;

    return;
  }

  const here = await findProject(process.cwd());
  const terminal = atTerminal();
  if (!terminal && (nameGiven === undefined || directory === undefined)) {
    refuseWithoutTerminal('plugin', [
      ...(nameGiven === undefined ? [QUESTIONS.name] : []),
      ...(directory === undefined ? [QUESTIONS.directory] : [])
    ]);

    return;
  }

  const rl = terminal ? readline.createInterface({ input: process.stdin, output: process.stdout }) : undefined;
  try {
    /**
     * Everything the plugin is called and says about itself, asked before a file is written — the package name, what
     * the builder's catalogue shows, what an agent reads to choose it, who publishes it. Each has a default, taken
     * whole with Enter; only the name and the folder are ever refused for want of an answer.
     */
    const name =
      nameGiven ?? (rl ? await askText(rl, QUESTIONS.name.question, DEFAULT_NAME, pluginNameProblem) : DEFAULT_NAME);
    const names = pluginNames(name);
    const answer = async (question: string, given: string | undefined, fallback: string): Promise<string> =>
      given ?? (rl && !options.yes ? askText(rl, question, fallback) : fallback);
    const title = await answer('What does the builder call the element?', options.title, names.title);
    const description = await answer(
      'What is it for, in a sentence? The builder shows it, and an agent reads it to choose the element.',
      options.description,
      ''
    );
    const owner = await answer('Who publishes it?', options.owner, '');

    const target = directory ? path.resolve(directory) : rl ? await askDirectory(rl, here, names.base) : undefined;
    if (!target) {
      return;
    }

    const wasEmpty = await isEmpty(target);
    if (!options.force && !wasEmpty) {
      console.error(chalk.red(`${target} is not empty. Pass --force to write into it anyway.`));
      process.exitCode = 1;

      return;
    }

    const project = await findProject(path.dirname(target));
    const packageManager = await resolveManager(rl, options, project);
    if (!packageManager) {
      if (!rl) {
        refuseWithoutTerminal('plugin', [
          {
            flag: '--package-manager',
            choices: PACKAGE_MANAGERS,
            question: 'Which package manager will you work in?'
          }
        ]);
      }

      process.exitCode = 1;

      return;
    }

    await writeFiles(
      target,
      scaffoldPlugin({
        packageName: name,
        title,
        description,
        owner,
        packageManager,
        managerVersion: detectManagerVersion(packageManager, await nearestExisting(target)),
        inProject: project !== undefined
      })
    );

    /**
     * Installed where it will be installed from. Inside a workspace that covers the folder, installing there installs
     * the workspace; inside a repository that does not list it, Yarn refuses to install a package it does not know —
     * so that is said, with the fix, rather than failed at.
     */
    const unlisted = project?.workspaceRoot !== undefined && !coveredByWorkspace(project, target);
    const wantsInstall = options.install !== false && !unlisted;
    const installed = wantsInstall && (await install(packageManager, target));
    if (wantsInstall && !installed) {
      console.error(
        chalk.red(
          `\n\`${installCommand(packageManager)}\` failed. The plugin is written; the reason is in the output above.`
        )
      );
      console.error(chalk.dim(INSTALL_HINTS[packageManager]));
      process.exitCode = 1;
    }

    // Formatted by its own Prettier, once, while nothing in the folder is anybody else's.
    if (installed && wasEmpty) {
      await runScript(packageManager, 'format', target);
    }

    const where = cdPrefix(target);
    console.log(chalk.green(`\n${name} — the ${names.type} element, as a package any space can load.`));
    if (unlisted) {
      console.log(
        chalk.yellow(
          `\n${path.relative(process.cwd(), target)} is not one of the workspace's packages: add it to \`workspaces\`, then install.`
        )
      );
    }

    console.log('');
    if (!installed) {
      console.log(`  ${where}${installCommand(packageManager)}`);
    }

    console.log(`  ${where}${runCommand(packageManager, 'start')}   # the plugin inside a space`);
    console.log(`  ${where}${runCommand(packageManager, 'zip')}     # what the builder takes, under Resources`);
    console.log('');
  } finally {
    rl?.close();
  }
};

export default createPlugin;
