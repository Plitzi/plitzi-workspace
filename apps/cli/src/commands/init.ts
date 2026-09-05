import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { HOST_KEY_HINT, scaffold } from './scaffold';

/**
 * Scaffolds a server that renders a space living in Plitzi.
 *
 * What it does NOT do is invent a credential. The self-hosting key is minted in the builder and it is secret, so it
 * is written to `.env` — and `.gitignore` is written in the same breath, because a scaffold that puts a secret in a
 * repository has made the problem it was supposed to save somebody from.
 */

export interface InitOptions {
  key?: string;
  environment?: string;
  force?: boolean;
}

/** A directory that does not exist yet is as empty as one can be, which is the answer this question wants. */
const isEmpty = async (target: string): Promise<boolean> => {
  try {
    return (await fs.readdir(target)).length === 0;
  } catch {
    return true;
  }
};

const askFor = async (options: InitOptions, name: string): Promise<{ key: string; environment: string }> => {
  const environment = options.environment ?? 'main';
  if (options.key) {
    return { key: options.key, environment };
  }

  // Asked for only what was not given, so one command serves both a person and a script.
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(chalk.bold(`\nA server for "${name}".\n`));
    const key = (await rl.question(`Self-hosting key (${HOST_KEY_HINT})\n> `)).trim();
    const answered = (await rl.question(`\nEnvironment [${environment}]\n> `)).trim();

    return { key, environment: answered || environment };
  } finally {
    rl.close();
  }
};

const init = async (directory: string | undefined, options: InitOptions): Promise<void> => {
  const target = path.resolve(directory ?? '.');
  const name = path.basename(target);

  if (!options.force && !(await isEmpty(target))) {
    console.error(chalk.red(`${target} is not empty. Pass --force to write into it anyway.`));
    process.exitCode = 1;

    return;
  }

  const { key, environment } = await askFor(options, name);

  if (!key) {
    console.error(chalk.red(`\nNo key. Mint one under ${HOST_KEY_HINT}, then run this again.`));
    process.exitCode = 1;

    return;
  }

  const files = scaffold({ name, key, environment });

  await Promise.all(
    Object.entries(files).map(async ([file, contents]) => {
      const destination = path.join(target, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });

      return fs.writeFile(destination, contents);
    })
  );

  /**
   * How to get there, in whichever form is shorter.
   *
   * A relative path out of a temp directory is six `../` and unreadable; an absolute one to a sibling folder is
   * noise. The next two lines are meant to be pasted, so they are printed the way somebody would have typed them.
   */
  const relative = path.relative(process.cwd(), target);
  const where = target === process.cwd() ? '' : `cd ${relative.length < target.length ? relative : target} && `;
  console.log(chalk.green(`\nWrote ${name}.`));
  console.log(`\n  ${where}npm install`);
  console.log(`  ${where}npm start\n`);
  console.log(chalk.dim('.env holds the key and is already git-ignored.\n'));
};

export default init;
