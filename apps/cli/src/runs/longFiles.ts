import fs from 'node:fs/promises';
import path from 'node:path';

import { projectPath } from './paths';
import { MAX_LINES } from '../lint/rules/fileTooLong';

/**
 * The files a task makes too long to read whole — past the space's lint's `file-too-long` (`MAX_LINES` lines that say
 * something), for every file of code in the copy's `src/`, not the space's alone: a plugin or an action of 500 lines is
 * the same file nobody reads at once. Said to the lead while the task works (`run watch`), to the agent with
 * its heartbeat, and held at `complete`: a file the task took past the line, it splits before review.
 */

export interface LongFile {
  file: string;
  lines: number;
  /** Its lines in the project, when it is there: a file already past the line that the task made longer. */
  before?: number;
}

const CODE = /\.(?:[cm]?[jt]sx?)$/;
const NOT_CODE = /\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$/;

const linesOf = async (file: string): Promise<number | undefined> => {
  const text = await fs.readFile(file, 'utf-8').catch(() => undefined);

  return text === undefined ? undefined : text.split('\n').filter(line => line.trim() !== '').length;
};

/** Whether the task took it past the line — new, or no longer than the line in the project — rather than longer still. */
export const crossed = (long: LongFile): boolean => long.before === undefined || long.before <= MAX_LINES;

/** The code files under the copy's `src/` past the line that are longer than in the project — in path order. */
export const longFilesIn = async (work: string, root: string): Promise<LongFile[]> => {
  const entries = await fs.readdir(path.join(work, 'src'), { recursive: true, withFileTypes: true }).catch(() => []);
  const found: LongFile[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !CODE.test(entry.name) || NOT_CODE.test(entry.name)) {
      continue;
    }

    const full = path.join(entry.parentPath, entry.name);
    const lines = await linesOf(full);
    if (lines === undefined || lines <= MAX_LINES) {
      continue;
    }

    const file = projectPath(work, full);
    const before = await linesOf(path.join(root, file));
    if (before === undefined || lines > before) {
      found.push({ file, lines, ...(before === undefined ? {} : { before }) });
    }
  }

  return found.sort((a, b) => a.file.localeCompare(b.file));
};

/** A long file as it is said: its lines, the line, and what it was in the project. */
export const longFileText = (long: LongFile): string =>
  `${long.file} is ${String(long.lines)} non-blank lines (more than ${String(MAX_LINES)}${long.before === undefined ? '' : `; ${String(long.before)} in the project`})`;
