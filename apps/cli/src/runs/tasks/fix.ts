import path from 'node:path';

import { runScript, scriptsOf } from '../../commands/project/verify';
import { fingerprint } from '../core/files';

/**
 * `task check --fix`: what the project's own linter and formatter fix by themselves, fixed first — on the files the
 * task changed, never another's — then checked. A run's dev-1 ran `task check` three times in twenty seconds,
 * twice, each failing on lint a `--fix` writes: a round of checks for what no one has to think about.
 */

const LINTED = /\.(c|m)?(j|t)sx?$/;

/** Each file the linter or the formatter rewrote, and the steps it ran: the project's scripts' tools, as they are set. */
export const fixChanged = async (
  work: string,
  root: string,
  files: readonly string[]
): Promise<{ fixed: string[]; ran: string[] }> => {
  const scripts = await scriptsOf(work);
  const quoted = (list: readonly string[]) => list.map(file => JSON.stringify(file)).join(' ');
  const steps = [
    ...(Object.hasOwn(scripts, 'lint') && scripts.lint.startsWith('eslint') && files.some(file => LINTED.test(file))
      ? [{ name: 'eslint --fix', command: `eslint --fix ${quoted(files.filter(file => LINTED.test(file)))}` }]
      : []),
    ...(Object.hasOwn(scripts, 'format') && scripts.format.startsWith('prettier') && files.length > 0
      ? [{ name: 'prettier --write', command: `prettier --write --ignore-unknown ${quoted(files)}` }]
      : [])
  ];
  if (steps.length === 0) {
    return { fixed: [], ran: [] };
  }

  const before = await Promise.all(files.map(file => fingerprint(path.join(work, file))));
  for (const step of steps) {
    // What it could not fix is the checks' to say, after: its own exit is not the task's verdict.
    await runScript(work, step.command, root);
  }

  const after = await Promise.all(files.map(file => fingerprint(path.join(work, file))));

  return { fixed: files.filter((_, index) => before[index] !== after[index]), ran: steps.map(step => step.name) };
};
