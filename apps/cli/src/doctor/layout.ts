import fs from 'node:fs/promises';
import path from 'node:path';

import { checkProjectLayout } from '@plitzi/sdk-shared/project';

import { collisions, moveFiles } from './moves';
import { pathsSaid, textPathsNaming } from './textPaths';
import { sayer } from './types';
import { legacyLayout } from '../commands/project/legacyLayout';
import { digestOf, readScaffoldRecord, writeScaffoldRecord } from '../commands/project/scaffoldRecord';
import { DATA_DIR, FUNCTIONS_DIR, PROJECT_STATE, STATE_DIR_ENV } from '../scaffold/paths';

import type { Moved, Moves } from './moves';
import type { TextPath } from './textPaths';
import type { Check, DoctorContext, Finding, Repair } from './types';
import type { LegacyPlace } from '../commands/project/legacyLayout';
import type { LayoutAutofix, LayoutFinding } from '@plitzi/sdk-shared/project';

/**
 * The project laid out as this CLI lays it out: what an older one left elsewhere, said where it goes now — a part the
 * commands would not find at all stops every other check, since read against the wrong layout they would only say what
 * the move fixes — and everything the server, `npm run author` and the CLI's checks read held to where they read it
 * (`checkProjectLayout`, the one check all three make). `--fix` makes each fix that has one reading: a move — every
 * import and script that names it following — a copy, a file written.
 */

const say = sayer('layout');

const bare = (file: string): string => file.replace(/\/$/, '');

const removeLine = async (root: string, file: string, line: string): Promise<void> => {
  const text = await fs.readFile(path.join(root, file), 'utf-8').catch(() => undefined);
  if (text === undefined) {
    return;
  }

  const kept = text.split('\n').filter(each => bare(each.trim().replace(/^\//, '')) !== bare(line));
  await fs.writeFile(path.join(root, file), kept.join('\n'));
};

const remove = (root: string, place: LegacyPlace): Promise<void> =>
  fs.rm(path.join(root, place.found), { recursive: true, force: true });

/** Whether any code of the project still imports the file — then it is not dead yet. */
const stillImported = async (root: string, file: string): Promise<boolean> => {
  const name = path.posix.basename(file);
  const look = async (dir: string): Promise<boolean> => {
    for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true }).catch(() => [])) {
      const each = path.posix.join(dir, entry.name);
      if (entry.isDirectory() && (await look(each))) {
        return true;
      }

      if (entry.isFile() && each !== file && /\.[cm]?[jt]sx?$/.test(entry.name)) {
        const text = await fs.readFile(path.join(root, each), 'utf-8');
        if (new RegExp(`['"][^'"]*/${name.replace('.', '\\.')}['"]`).test(text)) {
          return true;
        }
      }
    }

    return false;
  };

  return look('src');
};

/**
 * What the CLI recorded of the files and scripts it wrote, following them where they moved: a file nobody changed
 * before the move is still the CLI's after it — rewritten imports and all — so `upgrade` brings it up to date rather
 * than taking it for the project's own.
 */
const carryRecord = async (root: string, moved: Moved): Promise<void> => {
  const record = await readScaffoldRecord(root);
  if (!record) {
    return;
  }

  const files = new Map(Object.entries(record.files));
  for (const { was, is, before, after } of moved.files) {
    if (files.get(was) === digestOf(before.toString('utf-8'))) {
      files.delete(was);
      files.set(is, digestOf(after.toString()));
    }
  }

  const scripts = { ...record.scripts };
  for (const { name, before, after } of moved.scripts) {
    if (scripts[name] === before) {
      scripts[name] = after;
    }
  }

  await writeScaffoldRecord(root, record.cli, {
    files: Object.fromEntries(files),
    ...(record.scripts ? { scripts } : {})
  });
};

/** What code may name, so a move of it says the names follow: a folder, or a file of code. */
const CODE_OR_FOLDER = /(\/|\.[cm]?[jt]sx?)$/;

/** One path moved — a file, or a folder (`/`-ended) and everything under it. */
const movesOf = (from: string, to: string): Moves =>
  from.endsWith('/')
    ? { files: new Map(), folders: new Map([[bare(from), bare(to)]]) }
    : { files: new Map([[from, to]]), folders: new Map() };

const sameIgnoringCase = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** Whether two paths are one file: on a disk that ignores case, `src/Data/x.json` is `src/data/x.json`. */
const oneFile = async (root: string, a: string, b: string): Promise<boolean> => {
  const [first, second] = await Promise.all([a, b].map(file => fs.stat(path.join(root, file)).catch(() => undefined)));

  return first !== undefined && second !== undefined && first.dev === second.dev && first.ino === second.ino;
};

/** What a move would write over: a file already where it goes that is not the one moving there. */
const takenBy = async (root: string, from: string, to: string): Promise<string[]> => {
  const taken = await collisions(root, movesOf(from, to));
  if (!sameIgnoringCase(from, to)) {
    return taken;
  }

  const sourceOf = (target: string): string => `${bare(from)}${target.slice(bare(to).length)}`;
  const others = await Promise.all(
    taken.map(async target => ((await oneFile(root, sourceOf(target), target)) ? [] : [target]))
  );

  return others.flat();
};

/**
 * The move, with every import and script naming it following, and what the CLI recorded of it too. One that only
 * changes case goes through a name of its own: a disk that ignores case has both names as one file.
 */
const move = async (root: string, from: string, to: string): Promise<void> => {
  if (sameIgnoringCase(from, to)) {
    const through = `${bare(from)}-plitzi-move${from.endsWith('/') ? '/' : ''}`;
    await carryRecord(root, await moveFiles(root, movesOf(from, through)));
    await carryRecord(root, await moveFiles(root, movesOf(through, to)));

    return;
  }

  await carryRecord(root, await moveFiles(root, movesOf(from, to)));
};

/**
 * What a move of folders says it carries: the imports and the package's scripts that name them follow; a path the code
 * writes as text does not, and is named — a server that built `data/store.json` from its root kept reading the old
 * place after the move, and its keeper's data looked gone.
 */
const carried = (paths: readonly TextPath[], to: string): string =>
  ` — every import and package script naming it follows${
    paths.length > 0
      ? `; ${String(paths.length)} ${paths.length === 1 ? 'path' : 'paths'} the code writes as text ${paths.length === 1 ? 'does' : 'do'} not, and ${paths.length === 1 ? 'is' : 'are'} said until ${paths.length === 1 ? 'it names' : 'they name'} ${to}: ${pathsSaid(paths)}`
      : ''
  }`;

/**
 * What the code writes to while it runs is the server's state, not data it reads: moved into the source, it would be
 * committed, watched and mixed with what is written by hand. The doctor moves it nowhere and says where it belongs.
 */
const keptByCode = (from: string, paths: readonly TextPath[]): string =>
  `${from} is written by the project's code as it runs (${pathsSaid(paths.filter(each => each.writes))}): that is what the server keeps, not data it reads, so it is not moved into ${DATA_DIR}/. Move it to ${PROJECT_STATE}/ — ignored by git, kept across restarts — and point that code at \`process.env.${STATE_DIR_ENV} ?? '${PROJECT_STATE}'\` (the visual suite gives the server a state of its own there); what the server only reads goes in ${DATA_DIR}/.`;

type Fixed = { repair: Repair } | { blocked: string[] } | { kept: string };

/** A layout fix as a repair `--fix` makes: said, and only when it writes over nothing — or what it would write over. */
const repairOf = async (root: string, autofix: LayoutAutofix): Promise<Fixed> => {
  if (autofix.action === 'write') {
    return {
      repair: {
        says: `writes ${autofix.file}`,
        run: () => fs.writeFile(path.join(root, autofix.file), autofix.contents)
      }
    };
  }

  if (autofix.action === 'copy') {
    return {
      repair: {
        says: `copies ${autofix.from} to ${autofix.to}`,
        run: () => fs.copyFile(path.join(root, autofix.from), path.join(root, autofix.to), fs.constants.COPYFILE_EXCL)
      }
    };
  }

  const { from, to } = autofix;
  const taken = await takenBy(root, from, to);
  if (taken.length > 0) {
    return { blocked: taken };
  }

  const paths = from.endsWith('/') ? await textPathsNaming(root, [bare(from)]) : [];
  if (bare(to) === DATA_DIR && paths.some(each => each.writes)) {
    return { kept: keptByCode(from, paths) };
  }

  return {
    repair: {
      says: `moves ${from} → ${to}${CODE_OR_FOLDER.test(from) ? carried(paths, to) : ''}`,
      run: () => move(root, from, to)
    }
  };
};

/** What the server, the authoring and the CLI's checks say of the project's layout, said by the doctor with its fixes. */
const layoutFindings = async (
  { root, answers }: Pick<DoctorContext, 'root' | 'answers'>,
  older: readonly LegacyPlace[]
): Promise<Finding[]> => {
  // What an older CLI left is said above, as that; its space found by its files, not by an index it may have lost.
  const said = new Set(older.map(place => place.found));
  const findings = checkProjectLayout(root, { mode: answers.mode }).filter(each => !said.has(each.file));

  return Promise.all(
    findings.map(async (each: LayoutFinding): Promise<Finding> => {
      const fixed = each.autofix ? await repairOf(root, each.autofix) : undefined;
      const blocked = fixed && 'blocked' in fixed ? fixed.blocked : [];
      let message = each.message;
      if (blocked.length > 0) {
        message = `${each.message} It cannot be moved by itself: ${blocked.join(', ')} ${blocked.length === 1 ? 'is' : 'are'} already there.`;
      } else if (fixed && 'kept' in fixed) {
        message = `${each.message} ${fixed.kept}`;
      }

      return (each.level === 'error' ? say.error : say.warning)(each.code, message, {
        file: each.file,
        fix: each.fix,
        ...(fixed && 'repair' in fixed ? { repair: fixed.repair } : {})
      });
    })
  );
};

export const checkLayout: Check = async ({ root, answers }) => {
  const places = await legacyLayout(root);
  const moving = places.filter(place => place.blocking && place.action === 'move');
  const moves: Moves = {
    files: new Map(
      moving.filter(place => !place.found.endsWith('/')).map(place => [place.found, bare(place.now ?? '')])
    ),
    folders: new Map(
      moving.filter(place => place.found.endsWith('/')).map(place => [bare(place.found), bare(place.now ?? '')])
    )
  };
  const taken = moving.length > 0 ? await collisions(root, moves) : [];
  const dropped = places.filter(place => place.blocking && place.action === 'remove');
  const paths = await textPathsNaming(
    root,
    moving.filter(place => place.found.endsWith('/')).map(place => bare(place.found))
  );
  const layoutRepair: Repair | undefined =
    taken.length === 0 && moving.length + dropped.length > 0
      ? {
          says: `moves ${moving.map(place => `${place.found} → ${place.now ?? ''}`).join(', ') || 'nothing'}${dropped.length > 0 ? `, deletes ${dropped.map(place => place.found).join(', ')}` : ''}${carried(paths, 'where each is now')}`,
          run: async () => {
            if (moving.length > 0) {
              await carryRecord(root, await moveFiles(root, moves));
            }

            for (const place of dropped) {
              await remove(root, place);
            }
          }
        }
      : undefined;

  const findings: Finding[] = [];
  for (const place of places) {
    if (place.blocking) {
      findings.push(
        say.error(
          'older-layout',
          `${place.found} is where an older CLI kept it${place.now ? `; this one reads ${place.now}` : ''}.${taken.length > 0 ? ` It cannot be moved by itself: ${taken.join(', ')} ${taken.length === 1 ? 'is' : 'are'} already there.` : ''}`,
          { file: place.found, fix: place.fix, ...(layoutRepair ? { repair: layoutRepair } : {}) }
        )
      );
      continue;
    }

    const unread = place.action === 'remove-unread' ? !(await stillImported(root, place.found)) : true;
    findings.push(
      say.warning(
        'older-leftover',
        `${place.found} is an older CLI's${place.now ? `, kept in ${place.now} now` : ''}${unread ? '' : ' — and still imported'}.`,
        {
          file: place.found,
          fix: unread
            ? place.fix
            : 'src/main.ts still imports it, as an older CLI wrote it; today’s reads none: plitzi upgrade files shows it, --take src/main.ts --write takes it — then delete this file',
          ...(unread
            ? {
                repair: {
                  says: `deletes ${place.found}`,
                  run: async () => {
                    await remove(root, place);
                    if (place.found === '.sdk-plugins/') {
                      await removeLine(root, '.gitignore', '.sdk-plugins');
                    }
                  }
                }
              }
            : {})
        }
      )
    );
  }

  // Once the older layout is moved: read against it, a misplaced part would only be said twice.
  return places.some(place => place.blocking)
    ? findings
    : [...findings, ...(await layoutFindings({ root, answers }, places)), ...(await pathsToMovedFolders(root))];
};

/** Folders an older layout kept at the root, and where they are now: a path the code writes to the old one is stale. */
const MOVED_FOLDERS: readonly (readonly [string, string])[] = [
  ['data', DATA_DIR],
  ['functions', FUNCTIONS_DIR]
];

const isFolder = (root: string, folder: string): Promise<boolean> =>
  fs.stat(path.join(root, folder)).then(
    stat => stat.isDirectory(),
    () => false
  );

/**
 * A path the code writes as text to a folder that moved: the move said it would not follow; said again here until it
 * names where the folder is — a server reading the old place starts with nothing there.
 */
const pathsToMovedFolders = async (root: string): Promise<Finding[]> => {
  const moved = await Promise.all(
    MOVED_FOLDERS.map(async ([was, now]) =>
      !(await isFolder(root, was)) && (await isFolder(root, now)) ? [[was, now] as const] : []
    )
  );

  return (
    await Promise.all(
      moved.flat().map(async ([was, now]) =>
        (await textPathsNaming(root, [was])).map(each =>
          say.warning(
            'path-to-moved-folder',
            `${each.file}:${String(each.line)} names '${each.text}', where an older layout kept ${was}/ — it is ${now}/ now, and nothing is at the old place.`,
            {
              file: each.file,
              fix: `Name ${now}/ there: '${now}${each.text.replace(/^\.\//, '').slice(was.length)}'.`
            }
          )
        )
      )
    )
  ).flat();
};
