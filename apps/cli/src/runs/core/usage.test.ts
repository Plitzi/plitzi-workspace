import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { errorLine, failureLines, handUnreadByName, runStillThere } from './usage';

let runDir: string;

beforeEach(async () => {
  runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-usage-'));
  await fs.mkdir(path.join(runDir, 'messages'));
  await fs.mkdir(path.join(runDir, 'agents-read'));
});

afterEach(async () => {
  await fs.rm(runDir, { recursive: true, force: true });
});

const say = (id: string, to: string, at = '2026-10-27T18:00:00.000Z'): Promise<void> =>
  fs.writeFile(
    path.join(runDir, 'messages', `${id}.json`),
    JSON.stringify({ id, to, from: 'lead', text: `x ${id}`, at })
  );

// Design-2 measured on through a review the lead had withdrawn — a page command reads no inbox — and a scout heard the
// lead fifteen times over only at its next task command, its page commands between pointing at an inbox it never read.
describe('the messages a page command hands its agent', () => {
  it('hands what was said to the agent by name and not read, oldest first, once — not another’s, not what it read', async () => {
    await say('m1', '@design-2');
    await say('m2', '@design-2', '2026-10-27T18:02:00.000Z');
    await say('m5', '@design-2', '2026-10-27T18:01:00.000Z');
    await say('m3', '@dev-1');
    await say('m4', 't-blog');
    await fs.writeFile(path.join(runDir, 'agents-read', 'design-2.json'), JSON.stringify(['m1']));

    expect(handUnreadByName(runDir, 'design-2')).toEqual([
      { id: 'm5', from: 'lead', text: 'x m5' },
      { id: 'm2', from: 'lead', text: 'x m2' }
    ]);
    expect(handUnreadByName(runDir, 'design-2')).toEqual([]);
    expect(handUnreadByName(runDir, 'dev-1').map(each => each.id)).toEqual(['m3']);
    expect(handUnreadByName(runDir, 'lead')).toEqual([]);
    expect(handUnreadByName(runDir, 'unnamed')).toEqual([]);
  });

  it('hands none for a run with no messages folder', async () => {
    await fs.rm(path.join(runDir, 'messages'), { recursive: true });

    expect(handUnreadByName(runDir, 'dev-1')).toEqual([]);
  });
});

describe('why a command failed, as its usage keeps it', () => {
  it('reads the line that says it is an error, colours and the unread pointer left out, a token cut', () => {
    expect(errorLine("\u001b[31merror: unknown option '--follow'\u001b[39m\n")).toBe(
      "error: unknown option '--follow'"
    );
    expect(errorLine('· 2 messages for you not read yet\nThe page answered 500\nmore\n')).toBe('The page answered 500');
    expect(errorLine('Refused: task t-a is not yours (--token acme.dev-1.0123456789abcdef0123456789abcdef)')).toBe(
      'Refused: task t-a is not yours (--token …'
    );
    expect(errorLine('')).toBeUndefined();
    // A crashed child's output starts with where Node threw, not why: a run's look said that line for every picture.
    expect(
      errorLine(
        "node:internal/modules/run_main:107\n    triggerUncaughtException(\n    ^\n\nError [ERR_MODULE_NOT_FOUND]: Cannot find module '/x/dist/bin.js'\n    at finalizeResolution (node:internal/modules/esm/resolve:274:11)"
      )
    ).toBe("Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/x/dist/bin.js'");
  });
});

describe('what a failed command said, as its usage keeps it', () => {
  it('keeps the lines that say what failed — a console error, a failed request — else its last ones', () => {
    expect(
      failureLines(
        'Checking /r/night-drive at 390\n  ✓ 42 elements\n  ✗ console: Failed to load resource: 409 /_action\nDone\n'
      )
    ).toEqual(['  ✗ console: Failed to load resource: 409 /_action']);
    expect(failureLines('one\ntwo\n')).toEqual(['one', 'two']);
  });

  // A test failing said a diff's fragments, never which test.
  it('names the tests that failed first, before what their assertions printed', () => {
    const said = [
      '▶ badges',
      '  ✔ counts a play at 05:59 (1ms)',
      '  ✖ counts the night to the millisecond (2ms)',
      '    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:',
      '    - false',
      '    + true',
      'ℹ fail 1'
    ].join('\n');

    expect(failureLines(said).slice(0, 2)).toEqual([
      '  ✖ counts the night to the millisecond (2ms)',
      '    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:'
    ]);
  });
});

// A finish removing a run while an agent's command was still ending: that command wrote its usage line into the
// half-removed folder, and the removal failed on it (ENOTEMPTY), leaving the project claimed.
describe('a run being removed', () => {
  it('is no run to write a usage line into once its record is gone, its folder still there', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-usage-'));
    await fs.writeFile(path.join(dir, 'run.json'), '{}');
    expect(runStillThere(dir)).toBe(true);

    await fs.rm(path.join(dir, 'run.json'));
    expect(runStillThere(dir)).toBe(false);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
