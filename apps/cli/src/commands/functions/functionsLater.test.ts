import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isRecord } from '@plitzi/sdk-shared/helpers';
import { LATER_ANSWER_FILE, LATER_ASK_FILE } from '@plitzi/sdk-shared/project';

import { functionsLater } from './functionsLater';

let root: string;
const cwd = process.cwd();

beforeEach(async () => {
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-later-')));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'later-test' }));
  process.chdir(root);
});

afterEach(async () => {
  process.chdir(cwd);
  vi.restoreAllMocks();
  process.exitCode = undefined;
  await fs.rm(root, { recursive: true, force: true });
});

/** The project's server, as far as this command meets it: an ask read from `tmp/`, an answer written beside it. */
const serverAnswers = (answer: (ask: Record<string, unknown>) => Record<string, unknown>): (() => void) => {
  const timer = setInterval(() => {
    void fs
      .readFile(path.join(root, LATER_ASK_FILE), 'utf-8')
      .then(async text => {
        const read: unknown = JSON.parse(text);
        const ask = isRecord(read) ? read : {};
        await fs.rm(path.join(root, LATER_ASK_FILE));
        await fs.writeFile(path.join(root, LATER_ANSWER_FILE), JSON.stringify({ id: ask.id, ...answer(ask) }));
      })
      .catch(() => undefined);
  }, 20);

  return () => clearInterval(timer);
};

const printed = (calls: readonly unknown[][]): string =>
  calls.map(call => stripVTControlCharacters(String(call[0]))).join('\n');

// A spec of a show that starts in five minutes waited the five, every pass.
describe('plitzi functions later', () => {
  it('lists what the served project holds to run later, by key and when it is due', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const stop = serverAnswers(() => ({
      waiting: [{ job: 'later:1:a', action: 'shows-start', key: 'show:s1', dueAt: Date.now() + 5 * 60_000 }]
    }));
    await functionsLater(undefined, {});
    stop();

    expect(printed(log.mock.calls)).toMatch(/show:s1\s+shows-start\s+due in 5 min/);
  });

  it('starts one now, by its key', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const asked: Record<string, unknown>[] = [];
    const stop = serverAnswers(ask => {
      asked.push(ask);

      return { started: { job: 'later:1:a:now', action: 'shows-start', key: 'show:s1', dueAt: Date.now() } };
    });
    await functionsLater('show:s1', { now: true });
    stop();

    expect(asked[0]).toMatchObject({ ask: 'now', key: 'show:s1' });
    expect(printed(log.mock.calls)).toContain('Started show:s1 now — shows-start');
  });

  it('refuses --now with no key, before asking anything', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await functionsLater(undefined, { now: true });

    expect(printed(error.mock.calls)).toContain('name it by its key');
    await expect(fs.access(path.join(root, LATER_ASK_FILE))).rejects.toThrow();
  });
});
