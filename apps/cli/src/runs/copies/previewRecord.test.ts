import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { previewRecord, stopServedPreview } from './previewRecord';
import { runPaths } from '../core/paths';

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
