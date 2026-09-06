import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createLocalFontStore, hostedPathsOf } from './fontStore';

import type { SpaceFont } from '@plitzi/sdk-shared';

const woff2 = Buffer.from([0x77, 0x4f, 0x46, 0x32, 0x00, 0xff, 0xfe, 0x80]);

describe('the local font store', () => {
  let dir = '';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-fonts-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps a file under the space it belongs to, and hands back the path a manifest stores', async () => {
    const store = createLocalFontStore(dir);
    const stored = await store.put(42, { name: 'lato-400.woff2', body: woff2, format: 'woff2' });

    expect(stored).toEqual({ path: '42/lato-400.woff2', size: woff2.byteLength, format: 'woff2' });
    expect(fs.existsSync(path.join(dir, '42', 'lato-400.woff2'))).toBe(true);
  });

  it('writes the bytes exactly, which is the whole point of a font file', async () => {
    const store = createLocalFontStore(dir);
    await store.put(1, { name: 'a.woff2', body: woff2, format: 'woff2' });

    expect(fs.readFileSync(path.join(dir, '1', 'a.woff2'))).toEqual(woff2);
  });

  it('lists one space without seeing another', async () => {
    const store = createLocalFontStore(dir);
    await store.put(1, { name: 'a.woff2', body: woff2, format: 'woff2' });
    await store.put(2, { name: 'b.woff2', body: woff2, format: 'woff2' });

    expect((await store.list(1)).map(font => font.path)).toEqual(['1/a.woff2']);
  });

  it('answers nothing for a space that has uploaded none', async () => {
    expect(await createLocalFontStore(dir).list(9)).toEqual([]);
  });

  it('refuses to delete its way out of the store, however the path is written', async () => {
    const store = createLocalFontStore(dir);
    const outside = path.join(dir, '..', 'plitzi-fonts-secret');
    fs.writeFileSync(outside, 'secret');

    await store.remove('../plitzi-fonts-secret');
    await store.remove('/etc/hosts');

    expect(fs.existsSync(outside)).toBe(true);
    fs.rmSync(outside, { force: true });
  });

  it('removes a file, and shrugs at one that is not there', async () => {
    const store = createLocalFontStore(dir);
    await store.put(1, { name: 'a.woff2', body: woff2, format: 'woff2' });

    await store.remove('1/a.woff2');
    expect(fs.existsSync(path.join(dir, '1', 'a.woff2'))).toBe(false);
    await expect(store.remove('1/gone.woff2')).resolves.toBeUndefined();
  });
});

describe('hostedPathsOf', () => {
  it('names every file a manifest still points at, and nothing else', () => {
    const fonts: SpaceFont[] = [
      { source: 'google', family: 'Lato', fallback: 'sans-serif', weights: [400], styles: ['normal'] },
      {
        source: 'hosted',
        family: 'Acme',
        fallback: 'sans-serif',
        weights: [400, 700],
        styles: ['normal'],
        files: [
          { weight: 400, style: 'normal', format: 'woff2', path: '1/acme-400.woff2' },
          { weight: 700, style: 'normal', format: 'woff2', path: '1/acme-700.woff2' }
        ]
      }
    ];

    expect(hostedPathsOf(fonts)).toEqual(['1/acme-400.woff2', '1/acme-700.woff2']);
  });
});
