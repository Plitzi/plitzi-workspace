import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { copyFileAtomic, writeFileAtomic } from './atomicFile';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'atomic-file-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('writeFileAtomic', () => {
  it('replaces a file whole', async () => {
    const file = path.join(dir, 'index.js');
    writeFileSync(file, 'old');

    await writeFileAtomic(file, 'new');

    expect(readFileSync(file, 'utf-8')).toBe('new');
  });

  // What several workers building the same plugin do: many writers, and readers in between. The reader runs on its
  // own thread, truly beside the writers — a plain `writeFile` fails this nearly every read.
  it('never lets a reader see a file half written, however many write it at once', async () => {
    const file = path.join(dir, 'index.js');
    const size = 256 * 1024;
    const reader = new Worker(
      `
      const { readFileSync } = require('node:fs');
      const { parentPort, workerData } = require('node:worker_threads');
      let torn = 0, reads = 0, stop = false;
      parentPort.on('message', () => { stop = true; });
      const tick = () => {
        for (let i = 0; i < 100; i++) {
          try {
            const content = readFileSync(workerData.file, 'utf-8');
            reads++;
            if (content.length !== workerData.size || content !== content[0].repeat(content.length)) torn++;
          } catch {}
        }
        if (stop) parentPort.postMessage({ torn, reads });
        else setImmediate(tick);
      };
      tick();
      `,
      { eval: true, workerData: { file, size } }
    );

    for (let round = 0; round < 20; round++) {
      await Promise.all(Array.from({ length: 8 }, (_, index) => writeFileAtomic(file, String(index).repeat(size))));
    }

    const report = new Promise<{ torn: number; reads: number }>(resolve => reader.once('message', resolve));
    reader.postMessage('stop');
    const { torn, reads } = await report;
    await reader.terminate();

    expect(reads).toBeGreaterThan(0);
    expect(torn).toBe(0);
    expect(readdirSync(dir)).toEqual(['index.js']);
  });

  it('leaves nothing behind when it cannot write', async () => {
    await expect(writeFileAtomic(path.join(dir, 'missing', 'index.js'), 'x')).rejects.toThrow();

    expect(readdirSync(dir)).toEqual([]);
  });
});

describe('copyFileAtomic', () => {
  it('copies a file whole, and leaves nothing behind when the source is missing', async () => {
    const source = path.join(dir, 'source.css');
    writeFileSync(source, 'a{}');

    await copyFileAtomic(source, path.join(dir, 'index.css'));
    await expect(copyFileAtomic(path.join(dir, 'gone.css'), path.join(dir, 'other.css'))).rejects.toThrow();

    expect(readFileSync(path.join(dir, 'index.css'), 'utf-8')).toBe('a{}');
    expect(readdirSync(dir).sort()).toEqual(['index.css', 'source.css']);
  });
});
