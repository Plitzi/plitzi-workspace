// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { pageModulesIn } from '.';

let folder: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'plitzi-pages-'));
});

afterEach(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

const write = (file: string): void => {
  fs.mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
  fs.writeFileSync(path.join(folder, file), 'export default {};\n');
};

describe('the modules of a folder of pages', () => {
  it('are its modules and its folders’ index, never a test, a declaration, nor a folder’s other modules', () => {
    [
      'pets.ts',
      'about.tsx',
      'pets.test.ts',
      'types.d.ts',
      'notes.md',
      'home/index.ts',
      'home/hero.ts',
      'empty/x.json'
    ].forEach(write);

    expect(pageModulesIn(folder).map(file => path.relative(folder, file))).toEqual([
      'about.tsx',
      path.join('home', 'index.ts'),
      'pets.ts'
    ]);
  });

  it('are none for a folder that is not there', () => {
    expect(pageModulesIn(path.join(folder, 'nowhere'))).toEqual([]);
  });
});
