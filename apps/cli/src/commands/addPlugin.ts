import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { findProject } from './existingProject';
import { askChoice, askText, atTerminal, isEmpty, refuseWithoutTerminal, writeFiles } from './terminal';
import { declarationsRegistry, elementsRegistry, pluginNameProblem, pluginNames, scaffoldElement } from '../scaffold';

import type { ExistingProject, PlitziProject } from './existingProject';
import type { PluginNames } from '../scaffold';

/**
 * Elements of your own, added to a project that already exists — one or several, now or one at a time as the need
 * comes: each is a folder holding the component, its declaration, the panel the builder edits it with and the
 * `index.ts` that puts them together, the way a Plitzi element is written.
 *
 * Where it goes and what registering it takes depends on what the project is, and each case is answered as itself:
 *
 * - a project `plitzi create` wrote finds every folder of `src/plugins` by itself;
 * - one written before that lists its plugins in `src/main.ts`, and is told the line to add;
 * - a plugin package gets the element in `src/` and in the two lists it publishes its elements from;
 * - any other project is asked where its components live, and told how to register the element.
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

const splitNames = (list: string): string[] =>
  list
    .split(',')
    .map(name => name.trim())
    .filter(Boolean);

/** What is wrong with the names asked for, if anything: one that makes no element, or two that make the same one. */
const namesProblem = (names: string[]): string | undefined => {
  if (names.length === 0) {
    return 'Name at least one element.';
  }

  for (const name of names) {
    const problem = pluginNameProblem(name);
    if (problem) {
      return problem;
    }
  }

  const types = names.map(name => pluginNames(name).type);
  const repeated = types.find((type, index) => types.indexOf(type) !== index);

  return repeated ? `Two elements would both be "${repeated}": give each a name of its own.` : undefined;
};

const isDirectory = async (dir: string): Promise<boolean> => {
  try {
    return (await fs.stat(dir)).isDirectory();
  } catch {
    return false;
  }
};

/** The folders offered: the ones the project already has, and `src/plugins` whatever it has. */
const folderOptions = async (project: ExistingProject) => {
  const present = [];
  for (const folder of COMPONENT_FOLDERS) {
    if (folder === 'src/plugins' || (await isDirectory(path.join(project.root, folder)))) {
      present.push(folder);
    }
  }

  return present.map(folder => ({ label: folder, value: path.join(project.root, folder) }));
};

/**
 * The folder that HOLDS the elements, each of which gets a folder of its own inside it: `--dir` when it was given,
 * `src/` in a plugin package, `src/plugins` in a project `plitzi create` wrote, and otherwise the one the person picks.
 */
const holderFolder = async (
  rl: readline.Interface | undefined,
  project: ExistingProject,
  options: AddPluginOptions
): Promise<string | undefined> => {
  if (options.dir) {
    return path.resolve(options.dir);
  }

  if (project.plitzi?.kind === 'plugin') {
    return path.join(project.root, 'src');
  }

  if (project.plitzi?.kind === 'project') {
    return path.join(project.root, 'src/plugins');
  }

  if (!rl) {
    return undefined;
  }

  return path.resolve(
    await askChoice(
      rl,
      'Where should it go? (each element gets a folder of its own inside)',
      await folderOptions(project),
      {
        label: 'Somewhere else',
        question: 'Which folder holds the project’s components? (relative to here)',
        fallback: 'src/plugins'
      }
    )
  );
};

const importPath = (from: string, target: string): string =>
  `./${path.relative(from, target).split(path.sep).join('/')}`;

/** What a project that does not find its plugins by folder has to write, for each way it may render a space. */
const registration = (added: { names: PluginNames; target: string }[]): string => {
  const entries = (shape: (names: PluginNames, from: string) => string): string =>
    added.map(({ names, target }) => shape(names, importPath(process.cwd(), target))).join(', ');

  return [
    ...added.map(({ names, target }) => `import ${names.component} from '${importPath(process.cwd(), target)}';`),
    '',
    '// render(), in the browser:',
    `render('root', options, { ${entries(names => `${names.type}: { component: ${names.component} }`)} });`,
    '',
    '// <PlitziSdk>, in a React application — inside <PlitziSdk>:',
    ...added.map(({ names }) => `<PlitziSdk.Plugin renderType="${names.type}" component={${names.component}} />`),
    '',
    '// createServer(), on a page server of your own — and each name in the deployment’s pluginNames:',
    `plugins: { ${entries(
      (names, from) => `${names.type}: { js: path.resolve('${from}/index.ts'), action: 'compile' }`
    )} }`
  ].join('\n');
};

/** The lines a project from before plugins were found by folder adds to the list in its `src/main.ts`. */
const mainEntries = (project: PlitziProject, added: PluginNames[]): string =>
  project.mode === 'server'
    ? added
        .map(
          names =>
            `  ${names.type}: { js: path.resolve(PROJECT_ROOT, 'src/plugins/${names.component}/index.ts'), action: 'compile' as const, version: '1.0.0' },`
        )
        .join('\n')
    : [
        ...added.map(names => `import ${names.component} from './plugins/${names.component}';`),
        '',
        ...added.map(names => `  ${names.type}: { component: ${names.component} },`)
      ].join('\n');

/** How to put the elements on a page, in the project they were added to. */
const placement = (project: PlitziProject, added: PluginNames[]): string => {
  if (project.source === 'cloud') {
    return (
      `In the builder, add a Custom element with the render type ${added.map(names => `"${names.type}"`).join(', ')}. ` +
      'The builder does not load this project’s components, so it shows “Not Found” there; the pages this project ' +
      'serves render them.'
    );
  }

  return `Put them on a page in src/space.ts: ${added
    .map(names => `custom({ id: '${names.base}', renderType: '${names.type}' })`)
    .join(', ')}.`;
};

/** A plugin package's two lists, extended with what was added — or said to be the author's when they were changed. */
const listInPackage = async (root: string, components: string[] | undefined, added: PluginNames[]): Promise<void> => {
  const several = added.length > 1;
  if (!components) {
    console.log(
      chalk.yellow(
        '\nsrc/elements.ts and src/declarations.ts are not the lists the CLI wrote, so they are yours to change: add ' +
          `${added.map(names => `${names.component} (and its declaration)`).join(', ')} to both.`
      )
    );

    return;
  }

  const listed = [...components, ...added.map(names => names.component)];
  await writeFiles(root, {
    'src/elements.ts': elementsRegistry(listed),
    'src/declarations.ts': declarationsRegistry(listed)
  });
  console.log(
    `\nListed in src/elements.ts and src/declarations.ts: the package publishes ${several ? 'them' : 'it'} from now on. ` +
      `Look at ${several ? 'them' : 'it'} in the preview with ${added
        .map(names => `element('${names.type}', { id: '${names.base}' })`)
        .join(', ')} in preview/space.ts.`
  );
};

/** A project the CLI did not write: how to register, and the one dependency the elements import. */
const registerElsewhere = async (root: string, added: { names: PluginNames; target: string }[]): Promise<void> => {
  console.log(
    `\nRegister ${added.length > 1 ? 'them' : 'it'} where the project renders its space:\n\n${chalk.dim(registration(added))}`
  );

  // Read for the dependency lists alone: the file is the project's, and nothing else in it is this command's.
  const { dependencies = {}, devDependencies = {} } = JSON.parse(
    await fs.readFile(path.join(root, 'package.json'), 'utf-8')
  ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  if (!('@plitzi/plitzi-sdk' in { ...dependencies, ...devDependencies })) {
    console.log(chalk.yellow('\nThe elements import @plitzi/plitzi-sdk, which this project does not depend on yet.'));
  }
};

const addPlugin = async (namesGiven: string[], options: AddPluginOptions): Promise<void> => {
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

  if (namesGiven.length > 1 && (options.title !== undefined || options.description !== undefined)) {
    console.error(
      chalk.red('--title and --description describe one element: add several without them, or one at a time.')
    );
    process.exitCode = 1;

    return;
  }

  const givenProblem = namesGiven.length > 0 ? namesProblem(namesGiven) : undefined;
  if (givenProblem) {
    console.error(chalk.red(givenProblem));
    process.exitCode = 1;

    return;
  }

  const folderKnown = options.dir !== undefined || project.plitzi !== undefined;
  const terminal = atTerminal();
  if (!terminal && (namesGiven.length === 0 || !folderKnown)) {
    refuseWithoutTerminal('element', [
      ...(namesGiven.length === 0
        ? [
            {
              flag: '<names> (the arguments)',
              choices: ['<name> …'],
              question: 'What is each element called? e.g. seat-picker.'
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
    const askedNames = async (): Promise<string[]> =>
      rl
        ? splitNames(
            await askText(rl, 'What is the element called? Several: separate them with commas.', DEFAULT_NAME, reply =>
              namesProblem(splitNames(reply))
            )
          )
        : [DEFAULT_NAME];
    const names = namesGiven.length > 0 ? namesGiven : await askedNames();

    const holder = await holderFolder(rl, project, options);
    if (!holder) {
      return;
    }

    // Every folder checked before any is written: a second element refused halfway would leave the first one written
    // and listed nowhere.
    const planned = names.map(name => {
      const elementNames = pluginNames(name);

      return { name, names: elementNames, target: path.join(holder, elementNames.component) };
    });
    for (const { target } of planned) {
      if (!options.force && !(await isEmpty(target))) {
        console.error(chalk.red(`${target} is not empty. Pass --force to write into it anyway.`));
        process.exitCode = 1;

        return;
      }
    }

    const single = planned.length === 1;
    const answer = async (question: string, given: string | undefined, fallback: string): Promise<string> =>
      given ?? (rl ? askText(rl, question, fallback) : fallback);
    const added = [];
    for (const { name, names: elementNames, target } of planned) {
      const called = single ? 'it' : name;
      const title = await answer(
        `What does the builder call ${called}?`,
        single ? options.title : undefined,
        elementNames.title
      );
      const description = await answer(
        `What is ${called} for, in a sentence? The builder shows it, and an agent reads it to choose the element.`,
        single ? options.description : undefined,
        ''
      );
      await writeFiles(target, scaffoldElement(name, { title, description, owner: '' }));
      added.push({ names: { ...elementNames, title }, target });
    }

    const addedNames = added.map(({ names: elementNames }) => elementNames);
    const written = added.map(({ names: elementNames, target }) => {
      return `${path.relative(process.cwd(), target)} — the ${elementNames.type} element`;
    });
    console.log(chalk.green(`\n${written.join('\n')}`));

    const { plitzi } = project;
    if (plitzi?.kind === 'plugin') {
      await listInPackage(project.root, plitzi.components, addedNames);
    } else if (plitzi?.kind === 'project' && plitzi.discovers) {
      console.log(`\nRegistered: src/main.ts finds every folder of src/plugins. ${placement(plitzi, addedNames)}`);
    } else if (plitzi?.kind === 'project') {
      console.log(
        '\nThis project lists its plugins in src/main.ts (projects created since find them by folder). Add to its ' +
          `\`plugins\`:\n\n${chalk.dim(mainEntries(plitzi, addedNames))}\n\n${placement(plitzi, addedNames)}`
      );
    } else {
      await registerElsewhere(project.root, added);
    }

    console.log('');
  } finally {
    rl?.close();
  }
};

export default addPlugin;
