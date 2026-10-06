import fs from 'node:fs/promises';
import path from 'node:path';

import { sayer } from './types';
import { filesUnder } from '../commands/filesUnder';
import { DATA_DIR } from '../scaffold/paths';

import type { Check, Finding } from './types';

/**
 * The project's data files that are JSON, read as JSON: what the server answers a provider with, and what `plitzi push`
 * sends — one that does not parse refuses the push. A file of `src/data/` that is not JSON at all is the layout check's
 * to say (`data-not-json`); which of them the space reads, the space's (`npm run author`).
 */

const say = sayer('data');

const PUBLIC_DATA = 'public/data';

const jsonChecks = async (root: string, folder: string): Promise<Finding[]> =>
  (
    await Promise.all(
      (await filesUnder(root, folder))
        .filter(file => file.endsWith('.json'))
        .map(async (file): Promise<Finding[]> => {
          try {
            JSON.parse(await fs.readFile(path.join(root, file), 'utf-8'));

            return [];
          } catch (error) {
            return [
              say.error(
                'data-invalid-json',
                `${file} is not JSON: ${error instanceof Error ? error.message : String(error)}.`,
                { file }
              )
            ];
          }
        })
    )
  ).flat();

export const checkData: Check = async ({ root, answers }) => [
  ...(answers.mode === 'server' ? await jsonChecks(root, DATA_DIR) : []),
  ...(await jsonChecks(root, PUBLIC_DATA))
];
