import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { scaffold } from '../scaffold';

import type { CreateAnswers } from '../scaffold';

/**
 * A project that renders a Plitzi space, ready to run.
 *
 * Two decisions shape it and nothing else does: whether there is a Node tier (`--mode`), and where the space
 * comes from (`--source`). Everything a person had to read four documents to assemble is written out here
 * instead, so the first minute is `install` then `start`.
 */

export interface CreateOptions {
  mode?: string;
  source?: string;
  key?: string;
  environment?: string;
  install?: boolean;
  force?: boolean;
}

/**
 * Which package manager to speak, taken from the one that invoked this.
 *
 * `npm_config_user_agent` is set by every one of them, so `npx`, `yarn dlx` and `pnpm dlx` each get their own
 * commands back — printing `npm install` to somebody who runs yarn is how a scaffold produces a second lockfile.
 */
const packageManager = (): 'npm' | 'yarn' | 'pnpm' => {
  const agent = process.env.npm_config_user_agent ?? '';
  if (agent.startsWith('yarn')) {
    return 'yarn';
  }

  return agent.startsWith('pnpm') ? 'pnpm' : 'npm';
};

const runCommand = (manager: string, args: string[]): string =>
  `${manager}${args.length > 0 ? ` ${args.join(' ')}` : ''}`;

/** A directory that does not exist yet is as empty as one can be, which is the answer this question wants. */
const isEmpty = async (target: string): Promise<boolean> => {
  try {
    return (await fs.readdir(target)).length === 0;
  } catch {
    return true;
  }
};

const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const install = (manager: string, cwd: string): Promise<boolean> =>
  new Promise(resolve => {
    const child = spawn(manager, ['install'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });

const askForKey = async (mode: string): Promise<string> => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const which = mode === 'server' ? 'self-hosting' : 'public render';
    return (await rl.question(`\n${which} key (Credentials, in the builder)\n> `)).trim();
  } finally {
    rl.close();
  }
};

const create = async (directory: string | undefined, options: CreateOptions): Promise<void> => {
  const target = path.resolve(directory ?? '.');
  const name = path.basename(target);

  if (!options.force && !(await isEmpty(target))) {
    console.error(chalk.red(`${target} is not empty. Pass --force to write into it anyway.`));
    process.exitCode = 1;

    return;
  }

  const mode = oneOf(options.mode, ['server', 'client'] as const, 'server');
  const source = oneOf(options.source, ['local', 'cloud'] as const, 'local');

  // A cloud project is nothing without its credential, so it is the one thing worth stopping to ask for.
  const key = source === 'cloud' ? (options.key ?? (await askForKey(mode))) : '';
  if (source === 'cloud' && !key) {
    console.error(chalk.red('\nNo key. Mint one under Credentials in the builder, then run this again.'));
    process.exitCode = 1;

    return;
  }

  const answers: CreateAnswers = {
    name,
    mode,
    source,
    key,
    environment: options.environment ?? 'main'
  };

  const files = scaffold(answers);

  await Promise.all(
    Object.entries(files).map(async ([file, contents]) => {
      const destination = path.join(target, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });

      return fs.writeFile(destination, contents);
    })
  );

  const manager = packageManager();
  const installed = options.install !== false && (await install(manager, target));

  /**
   * How to get there, in whichever form is shorter.
   *
   * A relative path out of a temp directory is six `../` and unreadable; an absolute one to a sibling folder is
   * noise. These lines are meant to be pasted, so they are printed the way somebody would have typed them.
   */
  const relative = path.relative(process.cwd(), target);
  const where = target === process.cwd() ? '' : `cd ${relative.length < target.length ? relative : target} && `;

  console.log(
    chalk.green(
      `\n${name} — ${mode === 'server' ? 'server-rendered' : 'browser-rendered'}, space ${source === 'cloud' ? 'from Plitzi' : 'in the project'}.`
    )
  );
  console.log('');
  if (!installed) {
    console.log(`  ${where}${runCommand(manager, ['install'])}`);
  }

  console.log(`  ${where}${runCommand(manager, manager === 'npm' ? ['start'] : ['start'])}`);
  console.log('');
  console.log(
    chalk.dim(
      `.claude/skills carries Plitzi's authoring skill; \`${manager} run visual\` opens the page and checks it.`
    )
  );
  if (source === 'cloud') {
    console.log(chalk.dim('.env holds the key and is already git-ignored.'));
  }

  console.log('');
};

export default create;
