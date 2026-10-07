import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { apiDeclaration } from './apiDeclarations';

/** A project whose installed `@plitzi/sdk-authoring` publishes these declarations, typed by the CLI's TypeScript. */
let root = '';

const DECLARATIONS = `/** Pages of one shape, each from its entry.
 *
 * The rest of the doc, which the answer leaves out.
 */
export declare const pageFamily: (family: PageFamily, entries: readonly unknown[]) => PageSpec[];

/** An element, keyed by the one name it answers to. */
declare type Element_2 = {
    id: string;
};
export { Element_2 as Element }

export declare interface Undocumented {
    name: string;
}
`;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-api-'));
  const installed = path.join(root, 'node_modules', '@plitzi', 'sdk-authoring');
  await fs.mkdir(installed, { recursive: true });
  await fs.writeFile(path.join(installed, 'package.json'), JSON.stringify({ types: 'dist/index.d.ts' }));
  await fs.mkdir(path.join(installed, 'dist'));
  await fs.writeFile(path.join(installed, 'dist', 'index.d.ts'), DECLARATIONS);
  await fs.writeFile(path.join(root, 'package.json'), '{}');
  const typescript = path.dirname(createRequire(import.meta.url).resolve('typescript/package.json'));
  await fs.symlink(typescript, path.join(root, 'node_modules', 'typescript'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('an export of @plitzi/sdk-authoring, explained from its published types', () => {
  it('answers its signature and the first paragraph of its doc', () => {
    expect(apiDeclaration(root, 'pageFamily')).toEqual({
      kind: 'api',
      name: 'pageFamily',
      summary: 'Pages of one shape, each from its entry.',
      written: 'const pageFamily: (family: PageFamily, entries: readonly unknown[]) => PageSpec[];'
    });
  });

  it('answers a name the bundle declared under another by the name it is imported by', () => {
    expect(apiDeclaration(root, 'Element')).toMatchObject({
      summary: 'An element, keyed by the one name it answers to.',
      written: 'type Element = {\n    id: string;\n};'
    });
  });

  it('answers one with no doc by its declaration alone, and nothing for a name it does not export', () => {
    expect(apiDeclaration(root, 'Undocumented')).toMatchObject({ summary: '' });
    expect(apiDeclaration(root, 'nothingHere')).toBeUndefined();
  });
});
