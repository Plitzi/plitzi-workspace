import fs from 'node:fs/promises';
import path from 'node:path';

import { isRecord } from '@plitzi/sdk-shared/helpers';

import { REPORT_FILES } from './reports';
import { RUN_REPORTS_DIR } from '../../scaffold/paths';

/**
 * The runs of the project whose lead was this harness session, by their reports: a session that led two runs before
 * reads them again on every turn of the next — a run's lead read 33.8M tokens, more than its whole team, most of them
 * the runs it had led. Said at the open, so the person starts the lead afresh.
 */
export const ledBefore = async (root: string, session: string | undefined): Promise<string[]> => {
  if (session === undefined) {
    return [];
  }

  const dir = path.join(root, RUN_REPORTS_DIR);
  const runs = await fs.readdir(dir).catch(() => []);
  const led = await Promise.all(
    runs.map(async run => {
      const usage = await fs
        .readFile(path.join(dir, run, REPORT_FILES.records, 'usage.jsonl'), 'utf-8')
        .catch(() => '');

      return usage.split('\n').some(line => {
        try {
          const value: unknown = JSON.parse(line);

          return isRecord(value) && value.by === 'lead' && value.session === session;
        } catch {
          return false;
        }
      })
        ? [run]
        : [];
    })
  );

  return led.flat().sort();
};
