import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { findProject } from './existingProject';
import { askChoice, askText, atTerminal, isEmpty, refuseWithoutTerminal, writeFiles } from './terminal';
import { pluginNameProblem, pluginNames, scaffoldElement } from '../scaffold';

import type { ExistingProject } from './existingProject';
import type { PluginNames } from '../scaffold';

/**
 * An element of the project's own, added to a project that already exists: the component, its declaration, the panel
 * the builder edits it with and the `index.ts` that puts them together — the folder a Plitzi element is.
 *
 * In a project `plitzi create` wrote, the folder goes in `src/plugins`, which the project registers by itself. Anywhere
 * else the folder is asked for, and what registering it takes is printed for the way that project renders a space.
 */

export interface AddPluginOptions {
  dir?: string;
  title?: string;
  description?: string;
  force?: boolean;
}

const DEFAULT_NAME = 'my-element';

/** Where a project keeps its components, most likely first: offered as where the element goes. */
const COMPONENT_FOLDERS = ['src/plugins', 'src/components', 'src/elements'];

const isDirectory = async (dir: string): Promise<boolean> => {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
};

/** The folders offered: the ones the project already has, and `src/plugins` whatever it has. */
const folderOptions = async (project: ExistingProject, component: string) => {
  const present = [];
  for (const folder of COMPONENT_FOLDERS) {
    if (folder === 'src/plugins' || (await isDirectory(path.join(project.root, folder)))) {
      present.push(folder);
    }
  }

  return present.map(folder => ({
    label: path.relative(process.cwd(), path.join(project.root, folder, component)),
    value: path.join(project.root, folder)
  }));
};

/**
 * The element's own folder: inside `--dir` when it was given, inside `src/plugins` in a project that finds its plugins
 * there, and otherwise inside the folder the person picks. Every answer names the folder that HOLDS elements, and the
 * element gets a folder of its own in it — the way a component folder sits among its siblings.
 */
const elementFolder = async (
  rl: readline.Interface | undefined,
  project: ExistingProject,
  options: AddPluginOptions,
  component: string
): Promise<string | undefined> => {
  if (options.dir) {
    return path.resolve(options.dir, component);
  }

  if (project.plitzi) {
    return path.join(project.root, 'src/plugins', component);
  }

  if (!rl) {
    return undefined;
  }

  const holder = await askChoice(rl, 'Where should it go?', await folderOptions(project, component), {
    label: 'Somewhere else',
    question: 'Which folder holds the project’s components? (relative to here)',
    fallback: 'src/plugins'
  });

  return path.resolve(holder, component);
};

/** What a project that does not find its plugins by folder has to write, for each way it may render a space. */
const registration = ({ type, component }: PluginNames, target: string): string => {
  const from = `./${path.relative(process.cwd(), target).split(path.sep).join('/')}`;

  return [
    `import ${component} from '${from}';`,
    '',
    '// render(), in the browser:',
    `render('root', options, { ${type}: { component: ${component} } });`,
    '',
    '// <PlitziSdk>, in a React application:',
    `<PlitziSdk {...options}><PlitziSdk.Plugin renderType="${type}" component={${component}} /></PlitziSdk>`,
    '',
    '// createServer(), on a page server of your own — and its name in the deployment’s pluginNames:',
    `plugins: { ${type}: { js: path.resolve('${from}/index.ts'), action: 'compile' } }`
  ].join('\n');
};

const addPlugin = async (nameGiven: string | undefined, options: AddPluginOptions): Promise<void> => {
  const project = await findProject(process.cwd());
  if (!project) {
    console.error(
      chalk.red(
        'plitzi add plugin adds an element to a project, and there is no package.json here or above. ' +
          'For a plugin of its own, run plitzi create <folder> --plugin.'
      )
    );
    process.exitCode = 1;

    return;
  }

  const nameProblem = nameGiven === undefined ? undefined : pluginNameProblem(nameGiven);
  if (nameProblem) {
    console.error(chalk.red(nameProblem));
    process.exitCode = 1;

    return;
  }

  // A project that finds its plugins by folder already says where one goes; anywhere else that is the person's call.
  const folderKnown = options.dir !== undefined || project.plitzi !== undefined;
  const terminal = atTerminal();
  if (!terminal && (nameGiven === undefined || !folderKnown)) {
    refuseWithoutTerminal('element', [
      ...(nameGiven === undefined
        ? [
            {
              flag: '<name> (the argument)',
              choices: ['<name>'],
              question: 'What is the element called? e.g. seat-picker.'
            }
          ]
        : []),
      ...(folderKnown
        ? []
        : [{ flag: '--dir', choices: ['<folder>'], question: 'Which folder holds the project’s components?' }])
    ]);

    return;
  }

  const rl = terminal ? readline.createInterface({ input: process.stdin, output: process.stdout }) : undefined;
  try {
    const name =
      nameGiven ??
      (rl ? await askText(rl, 'What is the element called?', DEFAULT_NAME, pluginNameProblem) : DEFAULT_NAME);
    const names = pluginNames(name);
    const answer = async (question: string, given: string | undefined, fallback: string): Promise<string> =>
      given ?? (rl ? askText(rl, question, fallback) : fallback);
    const title = await answer('What does the builder call it?', options.title, names.title);
    const description = await answer(
      'What is it for, in a sentence? The builder shows it, and an agent reads it to choose the element.',
      options.description,
      ''
    );

    const target = await elementFolder(rl, project, options, names.component);
    if (!target) {
      return;
    }

    if (!options.force && !(await isEmpty(target))) {
      console.error(chalk.red(`${target} is not empty. Pass --force to write into it anyway.`));
      process.exitCode = 1;

      return;
    }

    await writeFiles(target, scaffoldElement(name, { title, description, owner: '' }));

    const relative = path.relative(process.cwd(), target);
    console.log(chalk.green(`\n${relative} — the ${names.type} element.`));
    if (project.plitzi) {
      console.log(
        '\nRegistered: src/main.ts finds every folder of src/plugins. Put it on a page with ' +
          `custom({ id: '${names.base}', renderType: '${names.type}' }) in src/space.ts, or drop it from the builder.`
      );
    } else {
      console.log(`\nRegister it where the project renders its space:\n\n${chalk.dim(registration(names, target))}`);
    }

    // Read for the two dependency lists alone: the file is the project's, and nothing else in it is this command's.
    const { dependencies = {}, devDependencies = {} } = JSON.parse(
      await fs.readFile(path.join(project.root, 'package.json'), 'utf-8')
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    if (!('@plitzi/plitzi-sdk' in { ...dependencies, ...devDependencies })) {
      console.log(chalk.yellow('\nThe element imports @plitzi/plitzi-sdk, which this project does not depend on yet.'));
    }

    console.log('');
  } finally {
    rl?.close();
  }
};

export default addPlugin;
