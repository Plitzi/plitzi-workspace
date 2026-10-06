import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { runtimeModule } from './runtimeModule';

const root = mkdtempSync(path.join(os.tmpdir(), 'plitzi-runtime-module-'));
mkdirSync(path.join(root, 'src'));
mkdirSync(path.join(root, 'dist'));
writeFileSync(path.join(root, 'src/main.ts'), '');
writeFileSync(path.join(root, 'dist/main.js'), '');

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('where the server finds the space’s runtime', () => {
  it('is its source while the server runs from its source', () => {
    expect(runtimeModule(root, path.join(root, 'src/main.ts'))).toBe(path.join(root, 'src/runtime/index.ts'));
  });

  // What `build` emitted carries no TypeScript: the compiled server never imports a `.ts` file.
  it('is the compiled one while the server runs compiled', () => {
    expect(runtimeModule(root, path.join(root, 'dist/main.js'))).toBe(path.join(root, 'dist/runtime/index.js'));
  });

  it('follows a link to the compiled server', () => {
    const linked = path.join(root, 'server.js');
    symlinkSync(path.join(root, 'dist/main.js'), linked);

    expect(runtimeModule(root, linked)).toBe(path.join(root, 'dist/runtime/index.js'));
  });

  // A folder named like it is not it: only what is under the project's own `dist/`.
  it('is the source for any script outside the project’s dist/ — a test runner, a folder beside it', () => {
    expect(runtimeModule(root, path.join(root, 'dist-old/main.js'))).toBe(path.join(root, 'src/runtime/index.ts'));
    expect(runtimeModule(root, '/usr/local/bin/vitest')).toBe(path.join(root, 'src/runtime/index.ts'));
    expect(runtimeModule(root, undefined)).toBe(path.join(root, 'src/runtime/index.ts'));
  });
});
