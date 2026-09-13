import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { generateExports } from './generate-exports.mjs';

/**
 * The exports map is generated from `dist`, which development builds never empty. Every package's published entry
 * points come from here, so a module that only survives as a stale build file must not become one.
 */
describe('generateExports', () => {
  let packageDir;

  const write = (relative, content = 'export const value = 1;') => {
    const file = path.join(packageDir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  beforeEach(() => {
    packageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'generate-exports-'));
  });

  afterEach(() => {
    fs.rmSync(packageDir, { recursive: true, force: true });
  });

  it('exports a compiled module that still has its source', () => {
    write('src/theme/themeCookie.ts');
    write('dist/theme/themeCookie.mjs');
    write('dist/theme/themeCookie.d.ts', 'export declare const value: number;');

    expect(generateExports(packageDir)['./theme/themeCookie']).toEqual({
      types: './dist/theme/themeCookie.d.ts',
      import: './dist/theme/themeCookie.mjs'
    });
  });

  it('leaves out a build file whose source was deleted', () => {
    write('src/theme/themeCookie.ts');
    write('dist/theme/themeBoot.mjs');
    write('dist/theme/themeBoot.d.ts', 'export declare const value: number;');

    expect(generateExports(packageDir)).not.toHaveProperty('./theme/themeBoot');
  });

  it('exports a folder by its index, and only while the folder still has one', () => {
    write('src/theme/index.ts');
    write('dist/theme/index.mjs');
    write('dist/theme/index.d.ts', 'export declare const value: number;');
    write('dist/gone/index.mjs');
    write('dist/gone/index.d.ts', 'export declare const value: number;');

    const exports = generateExports(packageDir);

    expect(exports).toHaveProperty('./theme');
    expect(exports).not.toHaveProperty('./gone');
  });

  it('skips bundler folders and modules with nothing to export', () => {
    write('src/empty.ts');
    write('dist/empty.mjs', 'export {};');
    write('dist/empty.d.ts', 'export {};');
    write('dist/_virtual/helper.mjs');

    const exports = generateExports(packageDir);

    expect(exports).not.toHaveProperty('./empty');
    expect(Object.keys(exports).some(key => key.includes('_virtual'))).toBe(false);
  });
});
