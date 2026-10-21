import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { importedApis } from './moduleApis';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })));
});

const projectWith = async (files: Record<string, string>): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'module-apis-'));
  roots.push(root);
  // The project's own TypeScript, as a real one installs it.
  await fs.mkdir(path.join(root, 'node_modules'), { recursive: true });
  await fs.symlink(
    path.dirname(path.dirname(require.resolve('typescript'))),
    path.join(root, 'node_modules/typescript'),
    'dir'
  );
  await fs.writeFile(path.join(root, 'package.json'), '{ "name": "bench", "type": "module" }\n');
  for (const [file, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), text);
  }

  return root;
};

// la-velada's agents read the same shared modules whole, a dozen times each across the run, to learn how to call them.
describe('importedApis', () => {
  it('says each name a task’s file imports — its signature and doc, through a barrel — never the body', async () => {
    const page = [
      "import { card, cardTitle } from '../components/index.ts';",
      "import { shade } from '../theme.ts';",
      "import type { Tone } from '../theme.ts';",
      "import data from '../../data/pets.json' with { type: 'json' };",
      "import { own } from './own.ts';",
      'export const page = card(cardTitle, shade, own, data);'
    ].join('\n');
    const root = await projectWith({
      'src/space/pages/home.ts': page,
      'src/space/pages/own.ts': 'export const own = 1;\n',
      'src/space/components/index.ts': "export { card } from './card.ts';\nexport { cardTitle } from './card.ts';\n",
      'src/space/components/card.ts': [
        '/** A pet’s card: its photo, its name and what it costs. The rest of this says how. */',
        'export const card = (title: string, tone?: string): string => {',
        '  return `${title}${tone ?? ""}`;',
        '};',
        '',
        "export const cardTitle = styles('card-title', { color: 'red' });",
        'declare const styles: (name: string, css: object) => string;'
      ].join('\n'),
      'src/space/theme.ts':
        'export type Tone = "warm";\n/** The shade under a card. */\nexport const shade: string = "#000";\n'
    });

    expect(
      await importedApis(root, [
        { file: 'src/space/pages/home.ts', text: page },
        { file: 'src/space/pages/own.ts', text: 'export const own = 1;\n' }
      ])
    ).toEqual([
      {
        file: 'src/space/components/index.ts',
        names: [
          'card(title: string, tone?: string): string — A pet’s card: its photo, its name and what it costs.',
          "cardTitle = styles('card-title', …)"
        ]
      },
      { file: 'src/space/theme.ts', names: ['shade: string — The shade under a card.'] }
    ]);
  });
});
