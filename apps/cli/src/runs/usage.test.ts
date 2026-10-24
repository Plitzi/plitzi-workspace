import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { errorLine, failureLines, unreadByName } from './usage';

let runDir: string;

beforeEach(async () => {
  runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-usage-'));
  await fs.mkdir(path.join(runDir, 'messages'));
  await fs.mkdir(path.join(runDir, 'agents-read'));
});

afterEach(async () => {
  await fs.rm(runDir, { recursive: true, force: true });
});

const say = (id: string, to: string): Promise<void> =>
  fs.writeFile(path.join(runDir, 'messages', `${id}.json`), JSON.stringify({ id, to, from: 'lead', text: 'x' }));

// lx-copy: design-2 measured on through a review the lead had withdrawn — a page command reads no inbox, and the
// message waited for its verdict, refused three times.
describe('the messages a page command points its agent at', () => {
  it('counts what was said to the agent by name and not read — not another’s, not what it read', async () => {
    await say('m1', '@design-2');
    await say('m2', '@design-2');
    await say('m3', '@dev-1');
    await say('m4', 't-blog');
    await fs.writeFile(path.join(runDir, 'agents-read', 'design-2.json'), JSON.stringify(['m1']));

    expect(unreadByName(runDir, 'design-2')).toBe(1);
    expect(unreadByName(runDir, 'dev-1')).toBe(1);
    expect(unreadByName(runDir, 'lead')).toBe(0);
    expect(unreadByName(runDir, 'unnamed')).toBe(0);
  });

  it('counts none for a run with no messages folder', async () => {
    await fs.rm(path.join(runDir, 'messages'), { recursive: true });

    expect(unreadByName(runDir, 'dev-1')).toBe(0);
  });
});

describe('why a command failed, as its usage keeps it', () => {
  it('reads the line that says it is an error, colours and the unread pointer left out, a token cut', () => {
    expect(errorLine("\u001b[31merror: unknown option '--follow'\u001b[39m\n")).toBe(
      "error: unknown option '--follow'"
    );
    expect(errorLine('· 2 messages for you not read yet\nThe page answered 500\nmore\n')).toBe('The page answered 500');
    expect(errorLine('Refused: task t-a is not yours (--token encore.dev-1.0123456789abcdef0123456789abcdef)')).toBe(
      'Refused: task t-a is not yours (--token …'
    );
    expect(errorLine('')).toBeUndefined();
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

  // encore-2's dev-2: a test failing said a diff's fragments, never which test.
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
