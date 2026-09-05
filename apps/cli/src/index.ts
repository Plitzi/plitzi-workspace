import { program } from 'commander';

import init from './commands/init';

/**
 * The command line for Plitzi.
 *
 * One command so far, and deliberately: the gap worth closing first is between installing `@plitzi/sdk-server` and
 * having a page on screen. Everything needed for that is documented, which was the problem — a person had to read
 * four things and write three files correctly before they could tell whether any of it worked.
 */

program.name('plitzi').description('Plitzi command line');

program
  .command('init')
  .argument('[directory]', 'Where to write the server. Defaults to the current directory.')
  .description('Scaffold a server that renders a space living in Plitzi')
  .option('-k, --key <key>', 'The self-hosting key of the space (asked for when omitted)')
  .option('-e, --environment <environment>', 'Which version to serve: main, or a published environment', 'main')
  .option('-f, --force', 'Write into a directory that is not empty')
  .action(init);

program.parse(process.argv);
