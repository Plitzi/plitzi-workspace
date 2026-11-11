import fs from 'node:fs/promises';
import path from 'node:path';

import { exists } from '../core/files';

/** A file a check's output names by its path where it ran — Playwright's error context, a screenshot, a trace. */
const NAMED_FILE = /(?<![\w./@:-])(?:\.\/)?([\w@-][\w.@-]*(?:\/[\w.@-]+)+\.(?:md|png|jpe?g|webm|zip|html|txt))\b/g;

/**
 * Each file a check's output names, copied out of where it ran into `kept`, and named there by its whole path. Playwright
 * empties its output folder each time it starts and a mutant's folder is removed once checked: a tester read the
 * error context a failure named, and it was no longer in the copy.
 */
export const keepNamedFiles = async (output: string, ranIn: string, kept: string): Promise<string> => {
  const named = [...new Set([...output.matchAll(NAMED_FILE)].map(match => match[1]))];
  const keptAt = new Map<string, string>();
  for (const file of named) {
    const from = path.resolve(ranIn, file);
    const relative = path.relative(ranIn, from);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !(await exists(from))) {
      continue;
    }

    const to = path.join(kept, relative);
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
    keptAt.set(file, to);
  }

  return keptAt.size === 0
    ? output
    : output.replace(NAMED_FILE, (whole, file: string) => {
        const to = keptAt.get(file);

        return to === undefined ? whole : whole.replace(file, to).replace(/^\.\//, '');
      });
};
