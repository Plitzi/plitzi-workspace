import { Option, program } from 'commander';

import addPlugin from './commands/addPlugin';
import create from './commands/create';
import createPlugin from './commands/createPlugin';
import { PACKAGE_MANAGERS } from './scaffold';

import type { AddPluginOptions } from './commands/addPlugin';
import type { CreateOptions } from './commands/create';
import type { CreatePluginOptions } from './commands/createPlugin';

/**
 * The command line for Plitzi.
 *
 * The gap it closes first is between installing the SDK and having a page on screen. Everything needed for that was
 * documented, which was the problem — a person had to read four things and write three files correctly before they
 * could tell whether any of it worked. The same holds for an element of one's own, which is the second thing it does.
 */

program.name('plitzi').description('Plitzi command line');

/** The flags that shape a PROJECT: given with `--plugin`, they are a mistake worth saying rather than ignoring. */
const PROJECT_ONLY = ['mode', 'source', 'key'] as const;

program
  .command('create')
  .argument('[directory]', 'Where to write it. Defaults to the current directory, or asked for with --plugin.')
  .description('Scaffold a project that renders a Plitzi space, or with --plugin a plugin package')
  // No defaults written here: a choice left out is ASKED for (or, with nobody at the terminal, refused with the question
  // to put to the person), so it has to arrive as absent rather than already filled in. See `resolveDecisions`.
  .addOption(
    new Option('-m, --mode <mode>', 'server (SSR + RSC on a Node tier) or client (browser only)').choices([
      'server',
      'client'
    ])
  )
  .addOption(
    new Option(
      '-s, --source <source>',
      'local (the space travels in the project) or cloud (read it from Plitzi)'
    ).choices(['local', 'cloud'])
  )
  .option('-k, --key <key>', 'Cloud only: the space key (asked for when omitted)')
  .option('-e, --environment <environment>', 'Which version to serve: main, or a published environment', 'main')
  .addOption(
    new Option(
      '-p, --package-manager <manager>',
      'The package manager the project is written for. Asked for when left out.'
    ).choices([...PACKAGE_MANAGERS])
  )
  .option('--plugin', 'A plugin package instead: one element any space can load, with a preview and a build')
  .option('--name <name>', 'Plugin only: its package name (plitzi-plugin-seat-picker). Asked for when left out.')
  .option('--title <title>', 'Plugin only: what the builder calls the element')
  .option('--description <description>', 'Plugin only: what the element is for, in a sentence')
  .option('--owner <owner>', 'Plugin only: who publishes it')
  .option('--no-install', 'Write the files without installing dependencies')
  .option('-f, --force', 'Write into a directory that is not empty')
  .option(
    '-y, --yes',
    'At a terminal: take the defaults for any choice not passed. Without one, every choice must be passed'
  )
  .action((directory: string | undefined, options: CreateOptions & CreatePluginOptions & { plugin?: boolean }) => {
    if (!options.plugin) {
      return create(directory, options);
    }

    const stray = PROJECT_ONLY.filter(flag => options[flag] !== undefined);
    if (stray.length > 0) {
      program.error(`--${stray.join(', --')} shape a project, not a plugin: leave them out with --plugin.`);
    }

    return createPlugin(directory, options);
  });

const add = program.command('add').description('Add something to the project you are in');

add
  .command('plugin')
  .argument('[name]', 'What the element is called: seat-picker. Asked for when left out.')
  .description('Add an element of your own to this project: its component, declaration and builder panel')
  .option('-d, --dir <folder>', 'The folder that holds the project’s components. Asked for, unless the project says.')
  .option('--title <title>', 'What the builder calls the element')
  .option('--description <description>', 'What the element is for, in a sentence')
  .option('-f, --force', 'Write into a folder that is not empty')
  .action((name: string | undefined, options: AddPluginOptions) => addPlugin(name, options));

program.parse(process.argv);
