/* eslint-disable quotes -- the cases are source code, which reads best in the other quotes */
import { describe, expect, it } from 'vitest';

import { movedTo, rewritten } from './moves';

import type { Moves } from './moves';

/**
 * A file's relative paths read against where it WAS, written against where both ends ARE: what keeps a project whole
 * when `doctor --fix` moves an older layout.
 */

const moves: Moves = {
  files: new Map([
    ['src/space.ts', 'src/space/index.ts'],
    ['src/author.ts', 'plitzi/author.ts']
  ]),
  folders: new Map([['functions', 'src/functions']])
};

describe('moving files', () => {
  it('finds a file where its folder went', () => {
    expect(movedTo(moves, 'functions/lib/feed.ts')).toBe('src/functions/lib/feed.ts');
    expect(movedTo(moves, 'functions')).toBe('src/functions');
    expect(movedTo(moves, 'functionsX/a.ts')).toBe('functionsX/a.ts');
  });

  it('points a file that stayed at one that moved', () => {
    expect(rewritten("import { space } from './space.ts';", 'src/main.ts', 'src/main.ts', moves)).toBe(
      "import { space } from './space/index.ts';"
    );
  });

  it('points a file that moved at one that stayed, and at one that moved too', () => {
    const text = "import { space } from './space.ts';\nimport { x } from './plugins/x.ts';\n";

    expect(rewritten(text, 'src/author.ts', 'plitzi/author.ts', moves)).toBe(
      "import { space } from '../src/space/index.ts';\nimport { x } from '../src/plugins/x.ts';\n"
    );
  });

  it('reads re-exports, dynamic imports, side effects and URLs off import.meta.url — and keeps a folder a folder', () => {
    const text = [
      "export * from '../functions/feed.ts';",
      "const lazy = await import('../functions/index.ts');",
      "import '../functions/setup.ts';",
      "const dir = new URL('../functions/', import.meta.url);"
    ].join('\n');

    expect(rewritten(text, 'src/main.ts', 'src/main.ts', moves)).toBe(
      [
        "export * from './functions/feed.ts';",
        "const lazy = await import('./functions/index.ts');",
        "import './functions/setup.ts';",
        "const dir = new URL('./functions/', import.meta.url);"
      ].join('\n')
    );
  });

  it('leaves alone what neither moved nor names a moved file, and every package', () => {
    const text = "import React from 'react';\nimport { a } from './a.ts';\n";

    expect(rewritten(text, 'src/b.ts', 'src/b.ts', moves)).toBe(text);
  });
});
