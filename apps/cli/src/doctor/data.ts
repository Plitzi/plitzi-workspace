import fs from 'node:fs/promises';
import path from 'node:path';

import { sayer } from './types';
import { filesUnder } from '../commands/filesUnder';
import { DATA_DIR } from '../scaffold/paths';

import type { Check, Finding } from './types';

/**
 * The project's data files, every one JSON: what the server answers a provider with, and what `plitzi push` sends — a
 * file that is not refuses the push. Which of them the space reads is the space's to say (`npm run author`).
 */

const say = sayer('data');

const PUBLIC_DATA = 'public/data';

const jsonChecks = async (root: string, folder: string, server: boolean): Promise<Finding[]> =>
  (
    await Promise.all(
      (await filesUnder(root, folder)).map(async (file): Promise<Finding[]> => {
        if (path.basename(file) === '.gitkeep') {
          return [];
        }

        if (!file.endsWith('.json')) {
          return server
            ? [
                say.warning(
                  'data-not-json',
                  `${file} is not a .json file: no provider reads it, and plitzi push leaves it behind.`,
                  {
                    file
                  }
                )
              ]
            : [];
        }

        try {
          JSON.parse(await fs.readFile(path.join(root, file), 'utf-8'));

          return [];
        } catch (error) {
          return [
            say.error(
              'data-invalid-json',
              `${file} is not JSON: ${error instanceof Error ? error.message : String(error)}.`,
              {
                file
              }
            )
          ];
        }
      })
    )
  ).flat();

export const checkData: Check = async ({ root, answers }) => [
  ...(answers.mode === 'server' ? await jsonChecks(root, DATA_DIR, true) : []),
  ...(await jsonChecks(root, PUBLIC_DATA, false))
];
