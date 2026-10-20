import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { writeFormatted } from './repairs';

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

/** Where a script's word is a program it runs: its first, after `&&`, `||`, `;`, `|`, or after `npx`. */
const PROGRAM_AT = /(?:^|&&|\|\||;|\||\bnpx)\s*$/;

/**
 * A script's words that are a moved path — `src/author.ts`, `./functions` — written as where it went. A program it runs
 * is never one: `plitzi run preview` stays the CLI when its old folder `plitzi/` moves.
 */
const scriptRewritten = (command: string, moves: Moves): string =>
  command.replace(
    /(^|[\s=])(\.\/)?([A-Za-z0-9_.@-][A-Za-z0-9_./@-]*)/g,
    (whole, lead: string, dot: string | undefined, named: string, offset: number) => {
      if (!dot && PROGRAM_AT.test(command.slice(0, offset + lead.length))) {
        return whole;
      }

      const trailing = named.endsWith('/') ? '/' : '';
      const bare = named.replace(/\/$/, '');
      const now = movedTo(moves, bare);

      return now === bare ? whole : `${lead}${dot ?? ''}${now}${trailing}`;
    }
  );

/** The ignore files that name the project's paths: a line naming a moved one follows it. */
const IGNORE_FILES = ['.prettierignore', '.gitignore', '.eslintignore'];

/** An ignore file's lines that name a moved path — `plitzi/author.ts`, `/functions/` — written as where it went. */
const ignoreRewritten = (text: string, moves: Moves): string =>
  text
    .split('\n')
    .map(line => {
      const [, negated = '', slash = '', named = ''] = /^(!?)(\/?)([^#\s*][^\s*]*)$/.exec(line.trim()) ?? [];
      const bare = named.replace(/\/$/, '');
      const now = bare === '' ? bare : movedTo(moves, bare);

      return now === bare ? line : `${negated}${slash}${now}${named.endsWith('/') ? '/' : ''}`;
    })
    .join('\n');

/**
 * A tsconfig's paths — `extends`, `include`, `files` — written as where they went: each string that names a moved file or
 * folder, the rest of the text (its comments) as it was. Plain JSON has its lists left without a path twice.
 */
const tsconfigRewritten = (text: string, moves: Moves): string => {
  const next = text.replace(/"((?:[^"\\]|\\.)*)"/g, (whole, named: string) => {
    const dot = named.startsWith('./') ? './' : '';
    const bare = named.slice(dot.length).replace(/\/$/, '');
    const now = movedTo(moves, bare);
    // A folder moved to a dot folder is named by its files: TypeScript reads a dot folder named bare as nothing.
    const files = moves.folders.has(bare) && now.split('/').some(part => part.startsWith('.')) ? '/**/*' : '';

    return now === bare ? whole : `"${dot}${now}${files || (named.endsWith('/') ? '/' : '')}"`;
  });
  try {
    const parsed: unknown = JSON.parse(next);
    if (!isRecord(parsed)) {
      return next;
    }

    const unique = (value: unknown): unknown => (Array.isArray(value) ? [...new Set(value)] : value);

    return `${JSON.stringify({ ...parsed, ...('include' in parsed ? { include: unique(parsed.include) } : {}), ...('files' in parsed ? { files: unique(parsed.files) } : {}) }, null, 2)}\n`;
  } catch {
    // Comments in it, as tsconfig allows: the paths rewritten in place, nothing else touched.
    return next;
  }
};

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

  for (const name of (await fs.readdir(root)).filter(file => /^tsconfig.*\.json$/.test(file))) {
    const before = await fs.readFile(path.join(root, name), 'utf-8');
    const after = tsconfigRewritten(before, moves);
    if (after !== before) {
      await writeFormatted(root, name, after);
      moved.files.push({ was: name, is: name, before: Buffer.from(before), after });
    }
  }

  for (const name of IGNORE_FILES) {
    const before = await fs.readFile(path.join(root, name), 'utf-8').catch(() => undefined);
    const after = before === undefined ? undefined : ignoreRewritten(before, moves);
    if (before !== undefined && after !== undefined && after !== before) {
      await fs.writeFile(path.join(root, name), after);
      moved.files.push({ was: name, is: name, before: Buffer.from(before), after });
    }
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
    await writeFormatted(root, 'package.json', `${JSON.stringify({ ...manifest, scripts }, null, indent)}\n`);
  }

  return moved;
};
