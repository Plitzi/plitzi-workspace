import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { packSource } from './source';

let root = '';

const write = async (files: Record<string, string>): Promise<void> => {
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
};

const text = (base64: string | undefined): string => Buffer.from(base64 ?? '', 'base64').toString('utf-8');

beforeEach(async () => {
  // Inside this package, so the project's TypeScript resolves to the workspace's as a real project's would to its own.
  const parent = path.join(import.meta.dirname, '../../node_modules/.tmp');
  await fs.mkdir(parent, { recursive: true });
  root = await fs.mkdtemp(path.join(parent, 'source-'));
  await write({
    'package.json': JSON.stringify({
      name: 'board',
      dependencies: { ioredis: '^5.4.0', react: '^19.0.0' },
      devDependencies: { '@types/geojson': '^7946.0.16' }
    }),
    'runtime.ts': [
      'import { Redis } from "ioredis";',
      'import { readFile } from "node:fs/promises";',
      'import type { Board } from "./board/model";',
      'import { agent } from "./agent/index.js";',
      'export const start = (board: Board) => [Redis, readFile, agent, board];'
    ].join('\n'),
    'board/model.ts': 'import type { Feature } from "geojson";\nexport type Board = { id: string; shape?: Feature };\n',
    'agent/index.ts': 'import guide from "./guide.md?raw";\nexport const agent = guide;\n',
    'agent/guide.md': '# The agent\n',
    'plugins/Board/index.tsx':
      'import { useState } from "react";\nimport "./Board.css";\nimport type { Board } from "../../board/model";\nexport const B = (b: Board) => useState(b);\n',
    'plugins/Board/Board.css':
      '@font-face { src: url("./hand.woff2"); }\n.board { background: url(data:image/png;base64,AAA); }\n',
    'plugins/Board/hand.woff2': 'FONT',
    'unrelated.ts': 'export const nobody = 1;\n'
  });
});

afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

describe('the source an artifact is built from', () => {
  it('is every file its entries reach — through types, `.js` names and stylesheets — and the packages they import', async () => {
    const { snapshot, bytes } = await packSource({
      root,
      kind: 'runtime',
      name: 'runtime',
      entries: [path.join(root, 'runtime.ts')]
    });

    expect(Object.keys(snapshot.files).sort()).toEqual([
      'agent/guide.md',
      'agent/index.ts',
      'board/model.ts',
      'runtime.ts'
    ]);
    expect(snapshot.entries).toEqual(['runtime.ts']);
    // `geojson` is only types: what the project needs is the package of its declarations.
    expect(snapshot.dependencies).toEqual({ '@types/geojson': '^7946.0.16', ioredis: '^5.4.0' });
    // As it travels: gzipped JSON, read back to the same snapshot.
    expect(JSON.parse(gunzipSync(bytes).toString('utf-8'))).toEqual(snapshot);
  });

  it('carries what a plugin’s stylesheet points at, and the file it shares with the runtime under the same path', async () => {
    const { snapshot } = await packSource({
      root,
      kind: 'plugin',
      name: 'board',
      entries: [path.join(root, 'plugins/Board/index.tsx')]
    });

    expect(Object.keys(snapshot.files).sort()).toEqual([
      'board/model.ts',
      'plugins/Board/Board.css',
      'plugins/Board/hand.woff2',
      'plugins/Board/index.tsx'
    ]);
    expect(text(snapshot.files['plugins/Board/hand.woff2'])).toBe('FONT');
    expect(snapshot.dependencies).toEqual({ '@types/geojson': '^7946.0.16', react: '^19.0.0' });
  });

  it('is refused, every reason at once, for what a project could not be rebuilt from', async () => {
    await write({
      'broken.ts': [
        'import { a } from "./missing";',
        'import { b } from "../outside";',
        'import { c } from "left-pad";',
        'export const key = "-----BEGIN PRIVATE KEY-----";'
      ].join('\n')
    });
    await fs.writeFile(path.join(root, '../outside.ts'), 'export const b = 1;\n');

    const error = await packSource({ root, kind: 'runtime', name: 'runtime', entries: [path.join(root, 'broken.ts')] })
      .then(() => '')
      .catch((thrown: unknown) => (thrown instanceof Error ? thrown.message : ''));
    expect(error).toContain('broken.ts imports "./missing", which is not there');
    expect(error).toContain('../outside.ts is outside the project');
    expect(error).toContain('It imports "left-pad", which the project');
    expect(error).toContain('"broken.ts" holds a private key');

    await fs.rm(path.join(root, '../outside.ts'));
  });
});
