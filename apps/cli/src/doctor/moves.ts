import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

/**
 * Files moved inside a project with everything that names them kept pointing at them: every relative import of the
 * project's code (and every `new URL('…', import.meta.url)`) is read against where its file WAS, and written against
 * where both ends ARE — so a file that moved and a file that did not still find each other — and every script of
 * `package.json` that names a moved path names the new one. All the moves are made at once, so none is read halfway.
 */

/** Paths relative to the project's root, `/`-separated: a file to a file, or a folder to a folder (everything under it). */
export interface Moves {
  files: ReadonlyMap<string, string>;
  folders: ReadonlyMap<string, string>;
}

/** The folders whose code may import one another — never what is installed, built or written for the project itself. */
const CODE_FOLDERS = ['src', 'plitzi', 'visual', 'functions', 'scripts'];
const CODE = /\.(?:[cm]?[jt]sx?)$/;

/** Where a path is after the moves: its own move, or its folder's. */
export const movedTo = (moves: Moves, file: string): string => {
  const own = moves.files.get(file);
  if (own) {
    return own;
  }

  for (const [from, to] of moves.folders) {
    if (file === from || file.startsWith(`${from}/`)) {
      return `${to}${file.slice(from.length)}`;
    }
  }

  return file;
};

/** How `importer` names `target`, both relative to the root: relative, with the `./` Node wants. */
const specifier = (importer: string, target: string): string => {
  const written = path.posix.relative(path.posix.dirname(importer), target);

  return written.startsWith('.') ? written : `./${written}`;
};

/** Every relative path a file of code names: imports, re-exports, dynamic imports, and URLs off `import.meta.url`. */
const NAMED = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|new\s+URL\(\s*)(['"])(\.{1,2}\/[^'"]*)\2/g;

/** The file's text with every relative path it names written for where it is now — unchanged when nothing moved. */
export const rewritten = (text: string, was: string, is: string, moves: Moves): string =>
  text.replace(NAMED, (whole, lead: string, quote: string, named: string) => {
    const trailing = named.endsWith('/') ? '/' : '';
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(was), named)).replace(/\/$/, '');
    const now = movedTo(moves, target);
    if (now === target && was === is) {
      return whole;
    }

    const next = specifier(is, now);

    return `${lead}${quote}${next}${trailing && !next.endsWith('/') ? '/' : ''}${quote}`;
  });

const codeFiles = async (root: string): Promise<string[]> => {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(path.join(root, dir), { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const file = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
      } else if (CODE.test(entry.name)) {
        found.push(file);
      }
    }
  };
  for (const folder of CODE_FOLDERS) {
    await walk(folder);
  }

  const rootFiles = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  found.push(...rootFiles.filter(entry => entry.isFile() && CODE.test(entry.name)).map(entry => entry.name));

  return found;
};

/** Every file under a folder, relative to the root. */
const filesIn = async (root: string, folder: string): Promise<string[]> => {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true }).catch(() => [])) {
      const file = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(file);
      } else {
        found.push(file);
      }
    }
  };
  await walk(folder);

  return found;
};

/** What the moves would write over: a file already where one of them goes. Moving is refused while there is one. */
export const collisions = async (root: string, moves: Moves): Promise<string[]> => {
  const targets = [
    ...moves.files.values(),
    ...(
      await Promise.all(
        [...moves.folders].map(async ([from]) => (await filesIn(root, from)).map(file => movedTo(moves, file)))
      )
    ).flat()
  ];
  const taken = await Promise.all(
    targets.map(async target =>
      (await fs.stat(path.join(root, target)).then(
        stat => stat.isFile(),
        () => false
      ))
        ? [target]
        : []
    )
  );

  return taken.flat().filter(target => path.basename(target) !== '.gitkeep');
};

/** A script's words that are a moved path — `src/author.ts`, `./functions` — written as where it went. */
const scriptRewritten = (command: string, moves: Moves): string =>
  command.replace(
    /(^|[\s=])(\.\/)?([A-Za-z0-9_.@-][A-Za-z0-9_./@-]*)/g,
    (whole, lead: string, dot = '', named: string) => {
      const trailing = named.endsWith('/') ? '/' : '';
      const bare = named.replace(/\/$/, '');
      const now = movedTo(moves, bare);

      return now === bare ? whole : `${lead}${dot}${now}${trailing}`;
    }
  );

/** What a move wrote: each file as it was and as it is, and each script changed — what a record of them follows. */
export interface Moved {
  files: { was: string; is: string; before: Buffer; after: Buffer | string }[];
  scripts: { name: string; before: string; after: string }[];
}

export const moveFiles = async (root: string, moves: Moves): Promise<Moved> => {
  const moved: Moved = { files: [], scripts: [] };
  const code = await codeFiles(root);
  const everything = [
    ...moves.files.keys(),
    ...(await Promise.all([...moves.folders.keys()].map(folder => filesIn(root, folder)))).flat()
  ];
  // Read first, all of them: a file is rewritten against where everything was, never against a half-moved project.
  const texts = new Map(
    await Promise.all(
      [...new Set([...code, ...everything])].map(
        async file => [file, await fs.readFile(path.join(root, file))] as const
      )
    )
  );
  for (const [was, bytes] of texts) {
    const is = movedTo(moves, was);
    const text = CODE.test(was) ? rewritten(bytes.toString('utf-8'), was, is, moves) : undefined;
    if (is === was && (text === undefined || text === bytes.toString('utf-8'))) {
      continue;
    }

    await fs.mkdir(path.dirname(path.join(root, is)), { recursive: true });
    await fs.writeFile(path.join(root, is), text ?? bytes);
    moved.files.push({ was, is, before: bytes, after: text ?? bytes });
    if (is !== was) {
      await fs.rm(path.join(root, was));
    }
  }

  for (const folder of moves.folders.keys()) {
    await fs.rm(path.join(root, folder), { recursive: true, force: true });
  }

  const manifestFile = path.join(root, 'package.json');
  const manifestText = await fs.readFile(manifestFile, 'utf-8');
  const manifest: unknown = JSON.parse(manifestText);
  if (isRecord(manifest) && isRecord(manifest.scripts)) {
    const scripts = Object.fromEntries(
      Object.entries(manifest.scripts).map(([name, command]) => {
        if (typeof command !== 'string') {
          return [name, command];
        }

        const next = scriptRewritten(command, moves);
        if (next !== command) {
          moved.scripts.push({ name, before: command, after: next });
        }

        return [name, next];
      })
    );
    const indent = /^\{\n([ \t]+)"/.exec(manifestText)?.[1] ?? '  ';
    await fs.writeFile(manifestFile, `${JSON.stringify({ ...manifest, scripts }, null, indent)}\n`);
  }

  return moved;
};
