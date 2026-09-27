import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import type { PackageManager } from '../scaffold';
import type readline from 'node:readline/promises';

/**
 * What every command shares with the person running it: whether anybody is there, how a choice is put to them, and
 * what happens when nobody is.
 */

/** A choice among a fixed few, put to the person as the flag that would have answered it. */
export type Question<T extends string> = {
  flag: string;
  choices: readonly T[];
  question: string;
  given?: T;
  fallback: T;
};

/** Somebody who can answer a prompt. An agent's shell, CI and a pipe are nobody, whatever they were asked to do. */
export const atTerminal = (): boolean => process.stdin.isTTY && process.stdout.isTTY;

/**
 * Nobody to ask, so the questions go to whoever ran this — in practice an agent — to put to the person.
 *
 * It offers no way around them. It used to end with "or with --yes to take the defaults", and an agent keen to finish
 * took that exit every time: the person was never asked, which is the whole failure this stop exists to prevent.
 */
export const refuseWithoutTerminal = (
  what: string,
  questions: { flag: string; choices: readonly string[]; question: string }[],
  stopped = `plitzi create stopped before writing anything: these choices shape the whole ${what}`
): void => {
  console.error(
    chalk.red(`\n${stopped}, they belong to the person it is for, and nobody is at this terminal to make them.`)
  );
  console.error(
    chalk.bold(
      '\nIf you are an AI agent: ask the user each question below, show them the options, and wait for their answers. ' +
        'Do not choose for them and do not fall back to a default.\n'
    )
  );
  questions.forEach(({ flag, choices, question }, index) => {
    console.error(`  ${index + 1}. ${question}`);
    console.error(`     ${flag} ${choices.join(' | ')}`);
  });

  const flags = questions.map(({ flag }) => `${flag} <their answer>`).join(' ');
  console.error(`\nThen run the same command again with their answers: ${flags}`);
  process.exitCode = 1;
};

/** One choice at the terminal: Enter takes the default, anything off the list is refused rather than guessed at. */
export const ask = async <T extends string>(rl: readline.Interface, question: Question<T>): Promise<T | undefined> => {
  const reply = (
    await rl.question(
      `\n${question.question}\n${question.flag} (${question.choices.join('/')}) [${question.fallback}] > `
    )
  ).trim();
  const chosen = question.choices.find(choice => choice === (reply || question.fallback));
  if (!chosen) {
    console.error(chalk.red(`"${reply}" is not one of ${question.choices.join(', ')}.`));
  }

  return chosen;
};

/**
 * A free answer at the terminal, with the likely one offered. `check` answers what is wrong with a reply, if anything:
 * a refused reply is said and asked again, since a name or a path is typed rather than picked and a typo is the
 * usual reason for one.
 */
export const askText = async (
  rl: readline.Interface,
  question: string,
  fallback: string,
  check: (reply: string) => string | undefined = () => undefined
): Promise<string> => {
  for (;;) {
    // An empty default is a question that may be left unanswered, and says so rather than offering `[]`.
    const offered = fallback ? `[${fallback}]` : '(optional)';
    const reply = (await rl.question(`\n${question}\n${offered} > `)).trim() || fallback;
    const problem = check(reply);
    if (!problem) {
      return reply;
    }

    console.error(chalk.red(problem));
  }
};

/**
 * One of a numbered list, or something else typed out. Enter takes the first entry. `other` is the question for the
 * typed answer, offered as the last number.
 */
export const askChoice = async (
  rl: readline.Interface,
  question: string,
  options: readonly { label: string; value: string }[],
  other: { label: string; question: string; fallback: string; check?: (reply: string) => string | undefined }
): Promise<string> => {
  const menu = [...options.map(option => option.label), other.label]
    .map((label, index) => `  ${index + 1}. ${label}`)
    .join('\n');

  for (;;) {
    const reply = (await rl.question(`\n${question}\n${menu}\n[1] > `)).trim() || '1';
    const index = Number(reply) - 1;
    if (Number.isInteger(index) && index >= 0 && index < options.length) {
      return options[index].value;
    }

    if (index === options.length) {
      return askText(rl, other.question, other.fallback, other.check);
    }

    console.error(chalk.red(`"${reply}" is not a number from 1 to ${options.length + 1}.`));
  }
};

/** One of a numbered list and nothing else. Enter takes the first entry. */
export const askPick = async <T>(
  rl: readline.Interface,
  question: string,
  options: readonly { label: string; value: T }[]
): Promise<T> => {
  const menu = options.map(({ label }, index) => `  ${index + 1}. ${label}`).join('\n');

  for (;;) {
    const reply = (await rl.question(`\n${question}\n${menu}\n[1] > `)).trim() || '1';
    const index = Number(reply) - 1;
    if (Number.isInteger(index) && index >= 0 && index < options.length) {
      return options[index].value;
    }

    console.error(chalk.red(`"${reply}" is not a number from 1 to ${options.length}.`));
  }
};

/** A directory that does not exist yet is as empty as one can be, which is the answer this question wants. */
export const isEmpty = async (target: string): Promise<boolean> => {
  try {
    return (await fs.readdir(target)).length === 0;
  } catch {
    return true;
  }
};

const isDirectory = async (candidate: string): Promise<boolean> => {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
};

/** The closest directory that already exists: the project's own does not until its files are written. */
export const nearestExisting = async (target: string): Promise<string> => {
  let dir = target;
  while (!(await isDirectory(dir)) && path.dirname(dir) !== dir) {
    dir = path.dirname(dir);
  }

  return dir;
};

/** Every file, by the path under `target` it is written to. */
export const writeFiles = async (target: string, files: Record<string, string>): Promise<void> => {
  await Promise.all(
    Object.entries(files).map(async ([file, contents]) => {
      const destination = path.join(target, file);
      await fs.mkdir(path.dirname(destination), { recursive: true });

      return fs.writeFile(destination, contents);
    })
  );
};

/**
 * What a first install is most likely refused over, and what to do about it.
 *
 * The scaffold already exempts what it ships, but not the rest of the tree: a third-party dependency published in
 * the last day is held back by the same age gates, and says so in a code that means nothing to somebody who has
 * not touched the project yet.
 */
export const INSTALL_HINTS: Record<PackageManager, string> = {
  npm: 'A peer-dependency conflict (ERESOLVE) is a bug in this scaffold: please report it. `npm install --legacy-peer-deps` gets past it meanwhile.',
  yarn: 'YN0016 ("quarantined") means a dependency was published less than a day ago. Wait, or add it to `npmPreapprovedPackages` in .yarnrc.yml.',
  pnpm: 'A dependency published too recently is added to `minimumReleaseAgeExclude` in pnpm-workspace.yaml; a skipped build script is approved with `pnpm approve-builds`.'
};

export const install = (manager: PackageManager, cwd: string): Promise<boolean> =>
  new Promise(resolve => {
    const child = spawn(manager, ['install'], { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });

/**
 * One of the project's own scripts, run quietly: what it prints is the project's business, and whether it worked is
 * all this needs. `run` is understood by all three managers alike.
 */
export const runScript = (manager: PackageManager, script: string, cwd: string): Promise<boolean> =>
  new Promise(resolve => {
    const child = spawn(manager, ['run', script], { cwd, stdio: 'ignore', shell: process.platform === 'win32' });
    child.on('error', () => resolve(false));
    child.on('close', code => resolve(code === 0));
  });

/**
 * How to get to `target` from here, in whichever form is shorter.
 *
 * A relative path out of a temp directory is six `../` and unreadable; an absolute one to a sibling folder is noise.
 * These lines are meant to be pasted, so they are printed the way somebody would have typed them.
 */
export const cdPrefix = (target: string): string => {
  const relative = path.relative(process.cwd(), target);

  return target === process.cwd() ? '' : `cd ${relative.length < target.length ? relative : target} && `;
};
