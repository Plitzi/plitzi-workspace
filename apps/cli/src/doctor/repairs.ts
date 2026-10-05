import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers/isRecord';

import type { Repair } from './types';

/**
 * The few edits `plitzi doctor --fix` makes itself — each small, local and safe to make without asking: a field of
 * `package.json`, lines of `.gitignore`, a folder, a secret no signature was made with yet. Anything that replaces a
 * file of the project's, installs, or touches git is recommended instead.
 */

const readText = (file: string): Promise<string | undefined> => fs.readFile(file, 'utf-8').catch(() => undefined);

/** `package.json` changed by `edit`, written with the indentation it has — so the diff is the lines that changed. */
export const editManifest = (
  root: string,
  says: string,
  edit: (manifest: Record<string, unknown>) => void
): Repair => ({
  says,
  run: async () => {
    const file = path.join(root, 'package.json');
    const text = (await readText(file)) ?? '{}';
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) {
      throw new Error('package.json is not an object');
    }

    edit(parsed);
    const indent = /^\{\n([ \t]+)"/.exec(text)?.[1] ?? '  ';
    await fs.writeFile(file, `${JSON.stringify(parsed, null, indent)}\n`);
  }
});

/** Lines added to the end of `.gitignore`, one each. */
export const ignoreLines = (root: string, lines: readonly string[]): Repair => ({
  says: `adds ${lines.join(', ')} to .gitignore`,
  run: async () => {
    const file = path.join(root, '.gitignore');
    const text = (await readText(file)) ?? '';
    await fs.writeFile(file, `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${lines.join('\n')}\n`);
  }
});

/** The lines of `.gitignore` that keep `name` out, taken away. */
export const unignore = (root: string, name: string): Repair => ({
  says: `takes ${name} out of .gitignore`,
  run: async () => {
    const file = path.join(root, '.gitignore');
    const text = (await readText(file)) ?? '';
    const kept = text.split('\n').filter(line => line.trim().replace(/^\//, '').replace(/\/$/, '') !== name);
    await fs.writeFile(file, kept.join('\n'));
  }
});

/** A folder made, with the `.gitkeep` that keeps it in git while it is empty. */
export const keepFolder = (root: string, folder: string): Repair => ({
  says: `creates ${folder} (with a .gitkeep)`,
  run: async () => {
    await fs.mkdir(path.join(root, folder), { recursive: true });
    await fs.writeFile(path.join(root, folder, '.gitkeep'), '');
  }
});

/** `.env`'s value of `name` set to a fresh random secret — the line replaced where it is, or added. */
export const freshSecret = (root: string, name: string): Repair => ({
  says: `writes a new ${name} to .env`,
  run: async () => {
    const file = path.join(root, '.env');
    const text = (await readText(file)) ?? '';
    const line = `${name}=${randomBytes(32).toString('hex')}`;
    const pattern = new RegExp(`^${name}=.*$`, 'm');
    await fs.writeFile(
      file,
      pattern.test(text)
        ? text.replace(pattern, line)
        : `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${line}\n`
    );
  }
});

/**
 * A `tsconfig` changed by `edit` — only one written as plain JSON: rewriting one with comments would lose them, so that
 * one is left to its author.
 */
export const editTsConfig = async (
  root: string,
  file: string,
  says: string,
  edit: (config: Record<string, unknown>) => void
): Promise<Repair | undefined> => {
  const text = await readText(path.join(root, file));
  let parsed: unknown;
  try {
    parsed = JSON.parse(text ?? '');
  } catch {
    return undefined;
  }

  if (!isRecord(parsed)) {
    return undefined;
  }

  const config = parsed;

  return {
    says,
    run: async () => {
      edit(config);
      const indent = /^\{\n([ \t]+)"/.exec(text ?? '')?.[1] ?? '  ';
      await fs.writeFile(path.join(root, file), `${JSON.stringify(config, null, indent)}\n`);
    }
  };
};
