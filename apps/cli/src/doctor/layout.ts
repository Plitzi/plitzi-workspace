import fs from 'node:fs/promises';
import path from 'node:path';

import { collisions, moveFiles } from './moves';
import { sayer } from './types';
import { legacyLayout } from '../commands/legacyLayout';
import { digestOf, readScaffoldRecord, writeScaffoldRecord } from '../commands/scaffoldRecord';

import type { Moved, Moves } from './moves';
import type { Check, Finding, Repair } from './types';
import type { LegacyPlace } from '../commands/legacyLayout';

/**
 * The project laid out as this CLI lays it out: what an older one left elsewhere, said where it goes now. A part the
 * commands would not find at all stops every other check — read against the wrong layout, they would only say what the
 * move fixes — and `--fix` moves it, every import and script that names it following.
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

export const checkLayout: Check = async ({ root }) => {
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
  const layoutRepair: Repair | undefined =
    taken.length === 0 && moving.length + dropped.length > 0
      ? {
          says: `moves ${moving.map(place => `${place.found} → ${place.now ?? ''}`).join(', ') || 'nothing'}${dropped.length > 0 ? `, deletes ${dropped.map(place => place.found).join(', ')}` : ''} — every import and script naming them follows`,
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

  return findings;
};
