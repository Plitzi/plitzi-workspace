import { Option, program } from 'commander';

import create from './commands/create';
import { PACKAGE_MANAGERS } from './scaffold';

/**
 * The command line for Plitzi.
 *
 * One command, and deliberately: the gap worth closing first is between installing the SDK and having a page on
 * screen. Everything needed for that was documented, which was the problem — a person had to read four things and
 * write three files correctly before they could tell whether any of it worked.
 */

program.name('plitzi').description('Plitzi command line');

program
  .command('create')
  .argument('[directory]', 'Where to write the project. Defaults to the current directory.')
  .description('Scaffold a project that renders a Plitzi space')
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
  .option('--no-install', 'Write the files without installing dependencies')
  .option('-f, --force', 'Write into a directory that is not empty')
  .option(
    '-y, --yes',
    'At a terminal: take the defaults for any choice not passed. Without one, every choice must be passed'
  )
  .action(create);

program.parse(process.argv);
