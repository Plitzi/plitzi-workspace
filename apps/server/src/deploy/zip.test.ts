import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { unzipFiles, zipFiles } from './zip';

import type { SiteFile } from './types';

const file = (filePath: string, body: string | Uint8Array): SiteFile => ({
  path: filePath,
  body: typeof body === 'string' ? new TextEncoder().encode(body) : body,
  type: 'text/html; charset=utf-8',
  cache: 'revalidate'
});

const SITE = [
  file('index.html', '<!doctype html><title>Café</title>'.repeat(40)),
  file('_plitzi/sdk-1/webfonts/fa.woff2', new Uint8Array([0, 1, 2, 3, 250, 251])),
  file('menú/índice.html', 'ñ')
];

describe('a site as a zip', () => {
  it('comes back as the same files', () => {
    const back = unzipFiles(zipFiles(SITE));

    expect(back.map(({ path: name, body }) => [name, Buffer.from(body).toString('hex')])).toEqual(
      SITE.map(({ path: name, body }) => [name, Buffer.from(body).toString('hex')])
    );
    expect(back[1].type).toBe('font/woff2');
  });

  it('is the same bytes for the same files: a deploy kept twice is kept once', () => {
    expect(Buffer.from(zipFiles(SITE)).equals(Buffer.from(zipFiles(SITE)))).toBe(true);
  });

  it('is read by the system’s own unzip', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'plitzi-zip-'));
    try {
      writeFileSync(path.join(dir, 'site.zip'), zipFiles(SITE));
      execFileSync('unzip', ['-q', 'site.zip', '-d', 'out'], { cwd: dir });

      expect(readFileSync(path.join(dir, 'out', 'menú', 'índice.html'), 'utf8')).toBe('ñ');
      expect(readFileSync(path.join(dir, 'out', 'index.html'), 'utf8')).toBe(new TextDecoder().decode(SITE[0].body));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('refuses what is not a zip, saying so', () => {
    expect(() => unzipFiles(new TextEncoder().encode('not a zip'))).toThrow(/no central directory/);
  });
});
