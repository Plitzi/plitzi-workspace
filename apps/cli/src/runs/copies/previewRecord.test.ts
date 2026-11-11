import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { previewEnded, previewEndedFile, previewRecord, stopServedPreview } from './previewRecord';
import { runPaths } from '../../core/paths';

import type { LoadedRun } from '../run';

let root: string | undefined;

afterEach(async () => {
  if (root !== undefined) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe('a preview another process serves', () => {
  it('is stopped as its own Ctrl-C stops it, and waited for until its record is gone', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-preview-'));
    const paths = runPaths(root, 'es-launch');
    await fs.mkdir(paths.cache, { recursive: true });
    const record = previewRecord(paths);
    // A stand-in for `run preview`: on SIGINT it removes its record and ends, as the preview's own stop does.
    const child = spawn(
      process.execPath,
      [
        '-e',
        `process.on('SIGINT', () => { require('fs').rmSync(${JSON.stringify(record)}); process.exit(0); }); setInterval(() => {}, 1000); console.log('ready');`
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] }
    );
    await new Promise(resolve => child.stdout.once('data', resolve));
    await fs.writeFile(record, JSON.stringify({ pid: child.pid, port: 8300 }));

    expect(await stopServedPreview(paths)).toEqual({ pid: child.pid, stopped: true });
    await expect(fs.access(record)).rejects.toThrow();
    // With none served, nothing is stopped and nothing said stopped.
    expect(await stopServedPreview(paths)).toBeUndefined();
  });
});

// A run's preview stopped during the close with no word, and its lead ran 140 lines against nothing.
describe('a preview that stopped', () => {
  it('says how: as it ended, or its process gone with its record left — nothing while one serves', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-preview-'));
    const paths = runPaths(root, 'es-launch');
    await fs.mkdir(paths.cache, { recursive: true });
    const loaded = { paths } as unknown as LoadedRun; // The record and its end are all previewEnded reads of a run.

    expect(await previewEnded(loaded)).toBeUndefined();
    await fs.writeFile(
      previewEndedFile(paths),
      JSON.stringify({ at: '2026-11-01T22:40:00.000Z', port: 8300, why: 'the server ended (exit 1)' })
    );
    expect(await previewEnded(loaded)).toEqual({
      at: '2026-11-01T22:40:00.000Z',
      port: 8300,
      why: 'the server ended (exit 1)'
    });

    // Its process killed: the record stays with a pid nobody has.
    await fs.writeFile(previewRecord(paths), JSON.stringify({ pid: 999_999_999, port: 8300 }));
    expect(await previewEnded(loaded)).toMatchObject({
      port: 8300,
      why: expect.stringContaining('its process ended') as unknown
    });
    // One serving: nothing to say.
    await fs.writeFile(previewRecord(paths), JSON.stringify({ pid: process.pid, port: 8300 }));
    expect(await previewEnded(loaded)).toBeUndefined();
  });
});
