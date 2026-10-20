import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/** What a folder holds besides its code — never a reason for it to need an entry. */
export const NOT_SOURCE: ReadonlySet<string> = new Set(['.gitkeep', 'README.md', '.DS_Store']);

export const JAVASCRIPT_ENTRY = /^index\.(?:js|jsx|mjs|cjs)$/;

/** An element type: what a folder of `src/plugins/` is registered as, and a space renders it by. */
export const TYPE_NAME = /^[A-Za-z][A-Za-z0-9]*$/;

interface Entries {
  files: string[];
  folders: string[];
}

/**
 * A folder's files and folders, by the names they have — never by a lookup, which a macOS or Windows disk answers
 * ignoring case: `Index.ts` is found as `index.ts` there, and not on the Linux the project is deployed to.
 */
export const entriesOf = (dir: string): Entries => {
  const found: Entries = { files: [], folders: [] };
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // A link is what it points at: a `.env` linked from elsewhere is the project's `.env`.
      const linked = entry.isSymbolicLink()
        ? statSync(path.join(dir, entry.name), { throwIfNoEntry: false })
        : undefined;
      if (entry.isFile() || linked?.isFile()) {
        found.files.push(entry.name);
      } else if (entry.isDirectory() || linked?.isDirectory()) {
        found.folders.push(entry.name);
      }
    }
  } catch {
    return found;
  }

  return { files: found.files.sort(), folders: found.folders.sort() };
};

/** Whether `relative` is there under `root`, every part of it named exactly so. */
export const exists = (root: string, relative: string, kind: 'file' | 'folder'): boolean => {
  const parts = relative.split('/').filter(part => part !== '' && part !== '.');
  let dir = root;
  for (const [index, part] of parts.entries()) {
    const { files, folders } = entriesOf(dir);
    const last = index === parts.length - 1;
    if (!(last && kind === 'file' ? files : folders).includes(part)) {
      return false;
    }

    dir = path.join(dir, part);
  }

  return true;
};

/** Every file under a folder, relative to the root — none of a folder named in `skipping`. */
export const filesUnder = (root: string, folder: string, skipping: ReadonlySet<string> = new Set()): string[] => {
  const { files, folders } = entriesOf(path.join(root, folder));

  return [
    ...files.map(file => `${folder}/${file}`),
    ...folders.filter(each => !skipping.has(each)).flatMap(each => filesUnder(root, `${folder}/${each}`, skipping))
  ];
};

export const holdsSource = ({ files, folders }: Entries): boolean =>
  folders.length > 0 || files.some(file => !NOT_SOURCE.has(file));

export const sameIgnoringCase = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

export const capitalized = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/** How many single-letter edits — a letter added, taken, changed, or two swapped — turn `a` into `b`. */
const editDistance = (a: string, b: string): number => {
  const rows = Array.from({ length: a.length + 1 }, (_row, i) =>
    Array.from({ length: b.length + 1 }, (_cell, j) => Math.max(i, j) * Number(i === 0 || j === 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }

  return rows[a.length][b.length];
};

/**
 * Whether `name` is `wanted` mistyped: the same but for case, one `s` more or less, or — for a name long enough that one
 * letter does not make another word — one edit away. `wanted` itself is not.
 */
export const nearName = (name: string, wanted: string): boolean => {
  if (name === wanted) {
    return false;
  }

  const a = name.toLowerCase();
  const b = wanted.toLowerCase();

  return a === b || a === `${b}s` || `${a}s` === b || (b.length >= 5 && editDistance(a, b) <= 1);
};

/** On a disk that ignores case — macOS's, Windows' — two names that differ only in case are one file. */
export const CASE_NOTE =
  'macOS and Windows disks ignore case, so it is found there — and not on Linux, where the project is deployed.';

/** A rename git makes on a disk that ignores case too: through a name of its own, when only case changes. */
export const gitMove = (from: string, to: string): string =>
  sameIgnoringCase(from, to) ? `git mv ${from} ${from}-tmp && git mv ${from}-tmp ${to}` : `git mv ${from} ${to}`;
