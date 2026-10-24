import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claudeSessionFile, isRunning, resumable, startedWithin } from './launch';
import { DEFAULTS } from './taskStore';

import type { Launch } from './launch';

const launch = (over: Partial<Launch> = {}): Launch => ({
  pid: 999_999_999,
  harness: 'claude',
  startedAt: '2026-10-23T22:00:00.000Z',
  log: '/tmp/agent.log',
  session: 'b5c1f0de-0000-4000-8000-000000000001',
  ...over
});

// encore: the machine went down with four agents mid-task; started again, each read its task anew on a fresh session.
describe('an agent started again after it died', () => {
  let config: string;
  const root = '/Users/someone/htdocs/my.site';
  const before = process.env.CLAUDE_CONFIG_DIR;

  beforeEach(async () => {
    config = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-claude-'));
    process.env.CLAUDE_CONFIG_DIR = config;
  });

  afterEach(async () => {
    if (before === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = before;
    }

    await fs.rm(config, { recursive: true, force: true });
  });

  const keep = async (session: string, bytes: number) => {
    const file = claudeSessionFile(root, session);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, Buffer.alloc(bytes));
  };

  it('finds Claude Code’s session where it keeps one: its folder, every character but a letter or digit a dash', () => {
    expect(claudeSessionFile(root, 'abc')).toBe(
      path.join(config, 'projects', '-Users-someone-htdocs-my-site', 'abc.jsonl')
    );
  });

  it('resumes its session when the team asks it, it died mid-task and the session is there', async () => {
    await keep(launch().session ?? '', 1024);

    expect(await resumable(root, launch(), { asked: true, harness: 'claude', midTask: true })).toEqual({
      session: launch().session
    });
  });

  it('starts fresh, saying why, every other time', async () => {
    await keep(launch().session ?? '', DEFAULTS.resumeMaxBytes + 1);
    const ask = { asked: true, harness: 'claude' as const, midTask: true };

    expect(await resumable(root, launch(), { ...ask, asked: false })).toEqual({ not: 'not-asked' });
    expect(await resumable(root, launch(), { ...ask, harness: 'codex' })).toEqual({ not: 'harness' });
    expect(await resumable(root, launch({ session: undefined }), ask)).toEqual({ not: 'no-session' });
    expect(await resumable(root, undefined, ask)).toEqual({ not: 'no-session' });
    expect(await resumable(root, launch(), { ...ask, midTask: false })).toEqual({ not: 'not-mid-task' });
    expect(await resumable(root, launch({ session: 'gone' }), ask)).toEqual({ not: 'gone' });
    expect(await resumable(root, launch(), ask)).toEqual({ not: 'too-large', bytes: DEFAULTS.resumeMaxBytes + 1 });
  });
});

describe.skipIf(process.platform === 'win32')('whether an agent still runs', () => {
  it('is its process, as its harness — never another process that took its pid', async () => {
    // A process whose command line names the harness, as `claude -p …` does.
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', 'claude'], { stdio: 'ignore' });
    try {
      const pid = child.pid ?? 0;
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(isRunning(launch({ pid }))).toBe(true);
      expect(isRunning(launch({ pid, harness: 'codex' }))).toBe(false);
      expect(isRunning(launch())).toBe(false);
    } finally {
      child.kill();
    }
  });

  it('is just started for as long as its grace', () => {
    const now = new Date('2026-10-23T22:02:00.000Z');

    expect(startedWithin(launch(), now, 3 * 60_000)).toBe(true);
    expect(startedWithin(launch(), now, 60_000)).toBe(false);
  });
});
