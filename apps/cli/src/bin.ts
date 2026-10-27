import module from 'node:module';

import { removedFolder } from './removedFolder';

/**
 * What `plitzi` runs: V8's compile cache turned on, then the CLI. A run's agents start the CLI hundreds of times — a
 * command each — and parsing its bundle was most of a quick command's start; kept compiled on disk (the system's temp
 * folder, Node's default), a start is ~30% shorter.
 */
module.enableCompileCache();

const removed = removedFolder();
if (removed) {
  process.stderr.write(`${removed.text}\n`);
  process.exit(removed.code);
}

await import('./index');
