import { program } from 'commander';

import create from './commands/create';

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
  .option('-m, --mode <mode>', 'server (SSR + RSC on a Node tier) or client (browser only)', 'server')
  .option('-s, --source <source>', 'local (the space travels in the project) or cloud (read it from Plitzi)', 'local')
  .option('-k, --key <key>', 'Cloud only: the space key (asked for when omitted)')
  .option('-e, --environment <environment>', 'Which version to serve: main, or a published environment', 'main')
  .option('--no-install', 'Write the files without installing dependencies')
  .option('-f, --force', 'Write into a directory that is not empty')
  .action(create);

program.parse(process.argv);
