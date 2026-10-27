import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { cliBuild, keeperLaunch, keptMeasure, readRecord, stopKeptBrowser } from './keptBrowser';
import { keeperRoutes } from '../commands/keeperRoutes';
import { keeperServer } from '../commands/keeperServer';
import { USAGE_OFF } from '../runs/usage';

const record = (root: string): string => path.join(root, 'tmp', 'plitzi-cache', 'kept-browser.json');

let root = '';

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

// Carlos: the browser kept between measures never stays open once a run or its agent is done.
describe('the kept browser', () => {
  it('is stopped at a run’s end — its process ended, its record gone — and a record of a process gone is none', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'plitzi-kept-'));
    await mkdir(path.dirname(record(root)), { recursive: true });
    const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { stdio: 'ignore' });
    const ended = new Promise(resolve => child.on('exit', resolve));
    await writeFile(record(root), JSON.stringify({ port: 1, pid: child.pid, build: 'another' }));

    expect(await stopKeptBrowser(root)).toBe(true);
    await ended;
    await expect(readFile(record(root))).rejects.toThrow();

    // One whose process is gone stops nothing, and is cleared.
    await writeFile(record(root), JSON.stringify({ port: 1, pid: 999_999, build: 'another' }));
    expect(await stopKeptBrowser(root)).toBe(false);
    await expect(readFile(record(root))).rejects.toThrow();
  });

  // A CLI asked the browser an older one kept, and was answered with the older one's properties.
  it('asks only one this CLI started: one another build started, or one that says not, is none to it', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'plitzi-kept-'));
    await mkdir(path.dirname(record(root)), { recursive: true });
    await writeFile(record(root), JSON.stringify({ port: 1, pid: process.pid, build: await cliBuild() }));
    expect(await readRecord(root)).toMatchObject({ port: 1 });

    await writeFile(record(root), JSON.stringify({ port: 1, pid: process.pid, build: 'another@1' }));
    expect(await readRecord(root)).toBeUndefined();
    await writeFile(record(root), JSON.stringify({ port: 1, pid: process.pid }));
    expect(await readRecord(root)).toBeUndefined();
  });

  it('keeps nothing under a test run: the caller reads the other page as before', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'plitzi-kept-'));

    expect(
      await keptMeasure(root, { url: 'https://example.com/', width: 1440, height: 900, targets: ['h1'] })
    ).toBeUndefined();
  });

  it('asks the one its record names and hands back what it read', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'plitzi-kept-'));
    await mkdir(path.dirname(record(root)), { recursive: true });
    const door = keeperServer({
      routes: keeperRoutes<never>({
        measure: asked =>
          Promise.resolve({ readings: asked.targets.map(target => ({ problem: `${target} on ${asked.url}` })) }),
        open: () => Promise.resolve({ problem: 'no page in this test' }),
        measureOn: () => Promise.resolve({ problem: 'unread' }),
        putIn: () => Promise.resolve(undefined),
        outline: () => Promise.resolve({ problem: 'unread' }),
        act: () => Promise.resolve(undefined),
        readState: () => Promise.resolve({ problem: 'unread' }),
        close: () => Promise.resolve()
      }).routes,
      askMs: 5000,
      bodyBytes: 1024
    });
    const port = await door.listen();
    await writeFile(record(root), JSON.stringify({ port, pid: process.pid, build: await cliBuild() }));
    process.env.PLITZI_KEEP_BROWSER = '1';
    try {
      expect(
        await keptMeasure(root, { url: 'https://example.com/', width: 1440, height: 900, targets: ['h1', 'nav'] })
      ).toEqual({ readings: [{ problem: 'h1 on https://example.com/' }, { problem: 'nav on https://example.com/' }] });
    } finally {
      delete process.env.PLITZI_KEEP_BROWSER;
      await door.drain(0);
    }
  });
});

// A run's report counted the kept browser's 641 s alive as the agents' time in the CLI.
describe('the kept browser’s process', () => {
  it('is started out of the run’s usage, apart from the command that starts it', () => {
    const { args, options } = keeperLaunch('/bin/plitzi', '/project');
    expect(args).toEqual(['/bin/plitzi', 'page', 'keep-browser', '--root', '/project']);
    expect(options).toMatchObject({ detached: true, env: { [USAGE_OFF]: '1' } });
  });
});
