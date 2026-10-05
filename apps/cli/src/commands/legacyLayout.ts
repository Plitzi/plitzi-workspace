import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ACTIONS_ENTRY,
  AUTHOR_FILE,
  CLI_DIR,
  FUNCTIONS_DIR,
  PROJECT_TMP,
  SPACE_DIR,
  SPACE_ENTRY
} from '../scaffold/paths';

/**
 * What an older CLI left where this one no longer looks — said, never read in its old place: there are no shims for a
 * layout a release moved. `blocking` is a part the project's commands would not find at all (the space, its actions,
 * its functions, the CLI's own files): until it is moved, what the project is cannot be told — a project whose space is
 * still `src/space.ts` reads as one whose space is on Plitzi — so `doctor` checks nothing else and `upgrade` writes no
 * file. The rest is only dead weight, said so it goes.
 *
 * Each says what moves it (`action`): `plitzi doctor --fix` does it, every import and script kept pointing at it.
 */
export interface LegacyPlace {
  /** Where an older CLI kept it, relative to the project's root. */
  found: string;
  /** Where this CLI keeps it — none for what nothing reads any more. */
  now?: string;
  blocking: boolean;
  /**
   * - `move`: the file or folder goes to `now`, and what names it follows;
   * - `remove`: it is dead — a cache, a copy of what the CLI keeps elsewhere now;
   * - `remove-unread`: dead once nothing imports it (an older `src/main.ts` still may).
   */
  action: 'move' | 'remove' | 'remove-unread';
  /** What to do by hand, in the order to do it. */
  fix: string;
}

const exists = (file: string, kind: 'file' | 'folder' | 'any' = 'any'): Promise<boolean> =>
  fs.stat(file).then(
    stat => kind === 'any' || (kind === 'file' ? stat.isFile() : stat.isDirectory()),
    () => false
  );

/** Where each part of an older CLI's layout went, as this CLI reads the project. */
export const legacyLayout = async (root: string): Promise<LegacyPlace[]> => {
  const at = (file: string): string => path.join(root, file);
  const places: LegacyPlace[] = [];
  if (await exists(at('src/space.ts'), 'file')) {
    places.push({
      found: 'src/space.ts',
      now: SPACE_ENTRY,
      blocking: true,
      action: 'move',
      fix: `git mv src/space.ts ${SPACE_ENTRY}, and point its relative imports at where they are from there`
    });
  }

  if (await exists(at('src/site'), 'folder')) {
    places.push({
      found: 'src/site/',
      now: `${SPACE_DIR}/`,
      blocking: true,
      action: 'move',
      fix: `git mv src/site/* ${SPACE_DIR}/ — the space's parts, beside its index`
    });
  }

  if (await exists(at('src/actions.ts'), 'file')) {
    places.push({
      found: 'src/actions.ts',
      now: ACTIONS_ENTRY,
      blocking: true,
      action: 'move',
      fix: `git mv src/actions.ts ${ACTIONS_ENTRY}, and point its relative imports at where they are from there`
    });
  }

  if (await exists(at('functions/index.ts'), 'file')) {
    places.push({
      found: 'functions/',
      now: `${FUNCTIONS_DIR}/`,
      blocking: true,
      action: 'move',
      fix: `git mv functions ${FUNCTIONS_DIR}: functions pull and push, and the server, read them there`
    });
  }

  for (const [file, moved] of [
    ['src/author.ts', AUTHOR_FILE],
    ['src/preflight.css', `${CLI_DIR}/preflight.css`]
  ] as const) {
    if (await exists(at(file), 'file')) {
      const already = await exists(at(moved), 'file');
      places.push({
        found: file,
        now: moved,
        blocking: true,
        action: already ? 'remove' : 'move',
        fix: already
          ? `${moved} is already there: delete ${file}`
          : `git mv ${file} ${moved}, then plitzi upgrade --write brings it up to this CLI`
      });
    }
  }

  if (await exists(at('src/plugins/declarations.ts'), 'file')) {
    places.push({
      found: 'src/plugins/declarations.ts',
      blocking: false,
      action: 'remove-unread',
      fix: 'Each plugin folder’s declaration.ts is found by itself now: delete it once src/main.ts is the CLI’s'
    });
  }

  if (await exists(at('src/plugins/README.md'), 'file')) {
    places.push({
      found: 'src/plugins/README.md',
      blocking: false,
      action: 'remove',
      fix: `What it said is in ${CLI_DIR}/README.md now: delete it`
    });
  }

  if (await exists(at('.sdk-plugins'), 'folder')) {
    places.push({
      found: '.sdk-plugins/',
      now: `${PROJECT_TMP}/.sdk-plugins/`,
      blocking: false,
      action: 'remove',
      fix: `A cache the server keeps in ${PROJECT_TMP}/ now: delete it, and its line in .gitignore`
    });
  }

  for (const file of ['.plitzi/dev-server.json', '.plitzi/images']) {
    if (await exists(at(file))) {
      places.push({
        found: file,
        now: `${PROJECT_TMP}/`,
        blocking: false,
        action: 'remove',
        fix: `What an older CLI wrote while developing, kept in ${PROJECT_TMP}/ now: delete it — .plitzi/ is committed`
      });
    }
  }

  return places;
};

/** The parts of an older layout that keep the project's commands from finding it: what `upgrade` waits on. */
export const blockingLegacy = async (root: string): Promise<LegacyPlace[]> =>
  (await legacyLayout(root)).filter(place => place.blocking);
