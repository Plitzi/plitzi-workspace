import fs from 'node:fs/promises';
import path from 'node:path';

import chalk from 'chalk';

import { behindText } from '@plitzi/sdk-shared/clients';
import { isRecord } from '@plitzi/sdk-shared/helpers';

import { configDir } from './connection';
import { CLI_VERSION } from '../scaffold/project';

/**
 * The platform answers a CLI older than itself with its own version (`x-plitzi-current`). It is said once for each
 * version of the platform — not on every command an agent runs — and kept, so `plitzi doctor` says it again while it
 * holds.
 */

type Kept = { api: string; current: string; cli: string };

const keptFile = (): string => path.join(configDir(), 'platform.json');

const isKept = (value: unknown): value is Kept =>
  isRecord(value) &&
  typeof value.api === 'string' &&
  typeof value.current === 'string' &&
  typeof value.cli === 'string';

/** What the platform said last about this CLI being behind it, while this is still the CLI it said it to. */
export const readBehind = async (): Promise<Kept | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(keptFile(), 'utf-8'));

    return isKept(parsed) && parsed.cli === CLI_VERSION ? parsed : undefined;
  } catch {
    return undefined;
  }
};

let toldThisRun = false;

/** Said on stderr the first time a platform's version is heard, kept for the next commands and for `doctor`. */
export const tellBehind = async (api: string, current: string): Promise<void> => {
  if (toldThisRun) {
    return;
  }

  toldThisRun = true;
  const kept = await readBehind();
  if (kept?.api === api && kept.current === current) {
    return;
  }

  process.stderr.write(`${chalk.yellow(behindText('cli', CLI_VERSION, current))}\n`);
  try {
    await fs.mkdir(configDir(), { recursive: true, mode: 0o700 });
    await fs.writeFile(keptFile(), `${JSON.stringify({ api, current, cli: CLI_VERSION }, null, 2)}\n`);
  } catch (error) {
    // Said again on the next command, rather than not at all.
    process.stderr.write(
      chalk.dim(`(not kept: ${error instanceof Error ? error.message : String(error)} — said again next time)\n`)
    );
  }
};
