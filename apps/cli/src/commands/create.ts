import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';

import chalk from 'chalk';

import { PACKAGE_MANAGERS, detectPackageManager, installCommand, runCommand, scaffold } from '../scaffold';

import type { CreateAnswers, PackageManager } from '../scaffold';

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
  packageManager?: string;
  install?: boolean;
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

const oneOf = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const install = (manager: PackageManager, cwd: string): Promise<boolean> =>
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

  /**
   * Asked for first, detected second.
   *
   * The invoking agent is a good guess and a bad rule: reaching for `npx` to run a scaffold once and then working
   * in the project with Yarn is an ordinary thing to do, and the guess writes a README, a Playwright config, a
   * `.gitignore` and an install into that project which all name the wrong one. `--package-manager` is how
   * somebody says which one they will actually be using.
   */
  const packageManager: PackageManager = oneOf(options.packageManager, PACKAGE_MANAGERS, detectPackageManager());

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
    environment: options.environment ?? 'main',
    packageManager
  };

  const files = scaffold(answers);

  await Promise.all(
    Object.entries(files).map(async ([file, contents]) => {
      const destination = path.join(target, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });

      return fs.writeFile(destination, contents);
    })
  );

  const installed = options.install !== false && (await install(packageManager, target));

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
    console.log(`  ${where}${installCommand(packageManager)}`);
  }

  console.log(`  ${where}${runCommand(packageManager, 'start')}`);
  console.log('');
  console.log(
    chalk.dim(
      `.claude/skills carries Plitzi's authoring skill; \`${runCommand(packageManager, 'visual')}\` opens the page and checks it.`
    )
  );
  if (source === 'cloud') {
    console.log(chalk.dim('.env holds the key and is already git-ignored.'));
  }

  console.log('');
};

export default create;
