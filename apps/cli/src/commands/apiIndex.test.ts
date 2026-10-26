import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { apiIndex } from './apiDeclarations';

// Inside the package, so the project's `typescript` resolves from it as it does from a project's root.
const scratch = path.resolve(import.meta.dirname, '../../tmp');
const roots: string[] = [];

/** A project with `@plitzi/sdk-authoring` installed at `version`, declaring one type with `doc`. */
const project = (root: string, version: string, doc: string, at: Date): void => {
  const dir = path.join(root, 'node_modules', '@plitzi', 'sdk-authoring');
  mkdirSync(path.join(dir, 'dist'), { recursive: true });
  writeFileSync(path.join(root, 'package.json'), '{}');
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: '@plitzi/sdk-authoring', version, exports: { '.': { types: './dist/index.d.ts' } } })
  );
  const declarations = path.join(dir, 'dist', 'index.d.ts');
  writeFileSync(declarations, `/** ${doc} */\nexport declare interface BindingSpec {\n  source: string;\n}\n`);
  utimesSync(declarations, at, at);
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('the index of the types a project can import', () => {
  // A build packed for a try is installed under the version before it: its index said what the one before declared.
  it('is read again when the package is installed again under the same version', () => {
    mkdirSync(scratch, { recursive: true });
    const root = mkdtempSync(path.join(scratch, 'api-index-'));
    roots.push(root);

    project(root, '1.0.0', 'Before.', new Date('2026-10-01T00:00:00Z'));
    expect(apiIndex(root).find(each => each.name === 'BindingSpec')?.summary).toBe('Before.');

    project(root, '1.0.0', 'One binding of an element.', new Date('2026-10-02T00:00:00Z'));
    expect(apiIndex(root).find(each => each.name === 'BindingSpec')?.summary).toBe('One binding of an element.');
  });
});
