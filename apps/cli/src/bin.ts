import module from 'node:module';

import { REFUSAL_EXIT_CODES } from './runs/refusal';

/**
 * What `plitzi` runs: V8's compile cache turned on, then the CLI. A run's agents start the CLI hundreds of times — a
 * command each — and parsing its bundle was most of a quick command's start; kept compiled on disk (the system's temp
 * folder, Node's default), a start is ~30% shorter.
 */
module.enableCompileCache();

// A folder removed under the shell — a task's copy, once approved — is no place to run from, and what the CLI loads
// first reads it: a run's tester got Node's stack and its version banner for a `run notice` said there.
try {
  process.cwd();
} catch {
  process.stderr.write(
    'Refused (invalid): the folder this shell is in was removed — a task’s copy goes once its task is approved. Go to the project (cd to its folder) and run the command there.\n'
  );
  process.exit(REFUSAL_EXIT_CODES.invalid);
}

await import('./index');
