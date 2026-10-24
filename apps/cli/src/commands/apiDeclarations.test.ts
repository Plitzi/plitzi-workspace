import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { apiDeclarations, memberDeclarations } from './apiDeclarations';

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

/** What an action is. */
export declare interface ActionSpec {
    /** How a page names it. More on it here. */
    id: string;
    /** The steps it runs, in turn. */
    steps?: unknown[];
}

/** A server action. */
export declare const defineAction: <const Spec extends ActionSpec>(spec: Spec) => void;
`;

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'plitzi-api-'));
  const installed = path.join(root, 'node_modules', '@plitzi', 'sdk-authoring');
  await fs.mkdir(installed, { recursive: true });
  await fs.writeFile(path.join(installed, 'package.json'), JSON.stringify({ types: 'dist/index.d.ts' }));
  await fs.mkdir(path.join(installed, 'dist'));
  await fs.writeFile(path.join(installed, 'dist', 'index.d.ts'), DECLARATIONS);
  const server = path.join(root, 'node_modules', '@plitzi', 'sdk-server');
  await fs.mkdir(path.join(server, 'dist', 'core'), { recursive: true });
  await fs.writeFile(
    path.join(server, 'package.json'),
    JSON.stringify({
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './handlers': { types: './dist/handlers.d.ts', import: './dist/handlers.js' },
        './functions': { types: './dist/functions.d.ts', import: './dist/functions.js' },
        './package.json': './package.json'
      }
    })
  );
  await fs.writeFile(path.join(server, 'dist', 'index.d.ts'), "export { createServer } from './core/createServer';\n");
  await fs.writeFile(path.join(server, 'dist', 'handlers.d.ts'), "export * from './core/guard';\n");
  await fs.writeFile(
    path.join(server, 'dist', 'functions.d.ts'),
    [
      '/** What a function is handed. */',
      'export type FunctionContext = {',
      '    /** Starts an action in so many seconds, whether or not a page is open. A key names it. */',
      '    later: (request: { action: string; in: number }) => Promise<{ id: string; at: number }>;',
      '};',
      '/** What a job is handed besides its input. */',
      'export type FunctionJobHandle = {',
      '    /** Keeps where it is: the next slice starts with it. */',
      '    save(state: unknown): Promise<void>;',
      '};',
      ''
    ].join('\n')
  );
  await fs.writeFile(
    path.join(server, 'dist', 'core', 'createServer.d.ts'),
    '/** The server this package makes: pages and RSC. */\nexport declare const createServer: (config: object) => void;\n'
  );
  await fs.writeFile(
    path.join(server, 'dist', 'core', 'guard.d.ts'),
    '/** Refuses a write another site caused. */\nexport declare function originGuard(): void;\n'
  );
  const mcp = path.join(root, 'node_modules', '@plitzi', 'sdk-mcp');
  await fs.mkdir(path.join(mcp, 'dist'), { recursive: true });
  await fs.writeFile(path.join(mcp, 'package.json'), JSON.stringify({ types: 'dist/index.d.ts' }));
  await fs.writeFile(
    path.join(mcp, 'dist', 'index.d.ts'),
    '/** The lean MCP server. */\nexport declare const createServer: () => void;\n'
  );
  await fs.writeFile(path.join(root, 'package.json'), '{}');
  const typescript = path.dirname(createRequire(import.meta.url).resolve('typescript/package.json'));
  await fs.symlink(typescript, path.join(root, 'node_modules', 'typescript'));
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('an export of a @plitzi package, explained from its published types', () => {
  it('answers its signature and the first paragraph of its doc', () => {
    expect(apiDeclarations(root, 'pageFamily')).toEqual([
      {
        kind: 'api',
        name: 'pageFamily',
        from: '@plitzi/sdk-authoring',
        summary: 'Pages of one shape, each from its entry.',
        written: 'const pageFamily: (family: PageFamily, entries: readonly unknown[]) => PageSpec[];'
      }
    ]);
  });

  it('answers a name the bundle declared under another by the name it is imported by', () => {
    expect(apiDeclarations(root, 'Element')[0]).toMatchObject({
      summary: 'An element, keyed by the one name it answers to.',
      written: 'type Element = {\n    id: string;\n};'
    });
  });

  it('answers one with no doc by its declaration alone, and nothing for a name it does not export', () => {
    expect(apiDeclarations(root, 'Undocumented')[0]).toMatchObject({ summary: '' });
    expect(apiDeclarations(root, 'nothingHere')).toEqual([]);
  });

  // lx-product: `explain defineAction` gave its signature alone, and an agent read the .d.ts for what ActionSpec holds.
  it('says what a function takes, field by field — a generic one by its constraint', () => {
    expect(apiDeclarations(root, 'defineAction')[0]?.takes).toEqual([
      {
        type: 'ActionSpec',
        fields: [
          { name: 'id', optional: false, doc: 'How a page names it.' },
          { name: 'steps', optional: true, doc: 'The steps it runs, in turn.' }
        ]
      }
    ]);
    expect(apiDeclarations(root, 'pageFamily')[0]?.takes).toBeUndefined();
  });

  it('answers an export of another package, through its re-exports, saying where it is imported from', () => {
    expect(apiDeclarations(root, 'originGuard')).toEqual([
      expect.objectContaining({ from: '@plitzi/sdk-server/handlers', summary: 'Refuses a write another site caused.' })
    ]);
  });

  it('answers every package that exports the name, never only the first', () => {
    expect(apiDeclarations(root, 'createServer')).toEqual([
      {
        kind: 'api',
        name: 'createServer',
        from: '@plitzi/sdk-mcp',
        summary: 'The lean MCP server.',
        written: 'const createServer: () => void;'
      },
      {
        kind: 'api',
        name: 'createServer',
        from: '@plitzi/sdk-server',
        summary: 'The server this package makes: pages and RSC.',
        written: 'const createServer: (config: object) => void;'
      }
    ]);
  });
});

// Encore's lead: `plitzi explain later` answered it was nothing, while `ctx.later` is how its shows start.
describe('a member of a type a @plitzi package exports', () => {
  it('is said by what the code calls it — ctx, job — or by its type, with its whole doc', () => {
    expect(memberDeclarations(root, 'ctx.later')).toEqual([
      {
        kind: 'api',
        name: 'ctx.later',
        from: '@plitzi/sdk-server/functions',
        of: 'FunctionContext',
        summary: 'Starts an action in so many seconds, whether or not a page is open. A key names it.',
        written: 'later: (request: { action: string; in: number }) => Promise<{ id: string; at: number }>;'
      }
    ]);
    expect(memberDeclarations(root, 'job.save')[0]).toMatchObject({ name: 'job.save', of: 'FunctionJobHandle' });
    expect(memberDeclarations(root, 'FunctionContext.later')[0]).toMatchObject({ name: 'FunctionContext.later' });
  });

  it('answers a bare name as the member it is, and nothing for a member none has', () => {
    expect(memberDeclarations(root, 'later')[0]).toMatchObject({ name: 'ctx.later', of: 'FunctionContext' });
    expect(memberDeclarations(root, 'ctx.nothing')).toEqual([]);
  });
});
