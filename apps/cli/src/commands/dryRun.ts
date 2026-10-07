import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

/**
 * `--dry-run`: what a command would do, said, and nothing of it done — no file written or removed, nothing installed,
 * nothing sent to the platform. It still READS what it needs to say it: the project, the files it would send, and the
 * space it would pull or make a project from — signing in for that when it is not. `upgrade` and `space fix` need none: they
 * only show until `--write`.
 */
export interface DryRunOptions {
  dryRun?: boolean;
}

/** One thing a dry run says would happen. */
export type WouldDo = string;

/** What a dry run prints: what the command is, then one line per thing it would do. */
export const sayDryRun = (heading: string, lines: readonly WouldDo[]): void => {
  console.log(chalk.bold(`${heading} — dry run, nothing done:`));
  for (const line of lines.length > 0 ? lines : ['nothing']) {
    console.log(`  ${line}`);
  }
};

/** A skill is many files written whole: said as its folder and how many. */
const SKILL_FOLDER = /^(\.claude\/skills\/[^/]+)\//;

/**
 * The files a command would write under `root`, one line each — `+` new, `~` replaced — a skill as one line for its
 * folder, sorted as a listing reads.
 */
export const filesWouldWrite = async (root: string, files: readonly string[]): Promise<WouldDo[]> => {
  const skills = new Map<string, number>();
  const lines: WouldDo[] = [];
  for (const file of [...files].sort()) {
    const skill = SKILL_FOLDER.exec(file)?.[1];
    if (skill) {
      skills.set(skill, (skills.get(skill) ?? 0) + 1);
      continue;
    }

    const exists = await fs.access(path.join(root, file)).then(
      () => true,
      () => false
    );
    lines.push(`${exists ? '~' : '+'} ${file}`);
  }

  return [
    ...lines,
    ...[...skills].map(([folder, count]) => `+ ${folder}/ (${String(count)} file${count === 1 ? '' : 's'})`)
  ];
};
