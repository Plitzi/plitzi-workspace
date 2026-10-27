import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { logMark, serverLoggedIssues } from './serverLog';

let dir: string | undefined;

afterEach(async () => {
  if (dir !== undefined) {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// A run's tester started a server of its own to read what the copy's logged as a page rendered, and its line ("no
// '[RSC] element dmThread' line") had no command to hold it.
describe('what the server logged as a command’s pages were opened', () => {
  it('is a finding of the page when it says something failed — only what came after the mark', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-server-log-'));
    const log = path.join(dir, 'acceptance-server.log');
    await fs.writeFile(log, '.env not found. Continuing without it.\nError: an old failure, before the check\n');
    const mark = await logMark(log);
    await fs.appendFile(
      log,
      'GET /messages/nobody 200\n[RSC] element dmThread failed to resolve: Action dm-thread ended as failed\n'
    );

    expect(await serverLoggedIssues(log, mark, 1440)).toEqual([
      {
        code: 'server-logged',
        message: `the server logged as these pages were opened: [RSC] element dmThread failed to resolve: Action dm-thread ended as failed — its log: ${log}`,
        width: 1440
      }
    ]);
    expect(await serverLoggedIssues(log, await logMark(log), 1440)).toEqual([]);
    // A server the CLI did not start logs nowhere it reads: nothing said.
    expect(await serverLoggedIssues(undefined, undefined, 1440)).toEqual([]);
  });
});
