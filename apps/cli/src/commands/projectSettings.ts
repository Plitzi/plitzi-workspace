import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';

export interface ProjectSettings {
  /** Whether the project has a `.env` at all. */
  file: boolean;
  /** A setting by name, `''` when nothing sets it. */
  value: (name: string) => string;
}

/**
 * What the project's processes start with: what its `.env` sets, under what the environment already has — as its
 * scripts read it (`--env-file-if-exists=.env`). Read, never loaded into this process's own environment.
 */
export const projectSettings = async (root: string): Promise<ProjectSettings> => {
  const text = await fs.readFile(path.join(root, '.env'), 'utf-8').catch(() => undefined);
  const parsed = text === undefined ? {} : parseEnv(text);

  return { file: text !== undefined, value: name => process.env[name] ?? parsed[name] ?? '' };
};
