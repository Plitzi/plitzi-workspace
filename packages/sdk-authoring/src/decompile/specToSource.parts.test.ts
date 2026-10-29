import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { authorSpace } from '../index';
import { compareSpaces } from './compareSpaces';
import { specFromSpace } from './specFromSpace';
import { specToSource } from './specToSource';

import type { ElementSpec, SpaceSpec } from '../schema';

const here = dirname(fileURLToPath(import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'spec-parts-'));
const packageName = join(here, '..', 'index.ts');

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

/** The files written, imported as a project imports them: the space they export. */
const load = async (files: Record<string, string>, name: string): Promise<SpaceSpec> => {
  const root = join(scratch, name);
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  }

  const module = (await import(join(root, 'index.ts'))) as Record<string, SpaceSpec>;

  return module[name];
};

describe('specToSource, a large page', () => {
  // A page of a few hundred elements came out as one file of 4,934 lines, which every task of a run wrote in.
  it('writes a large page as a file a part, each one few enough elements to read whole, and authors the same space', async () => {
    const rows = (prefix: string, count: number): ElementSpec[] =>
      Array.from({ length: count }, (_, index) => ({
        type: 'container',
        id: `${prefix}-row-${String(index)}`,
        children: [
          {
            type: 'text',
            id: `${prefix}-label-${String(index)}`,
            attributes: { content: `${prefix} ${String(index)}` }
          }
        ]
      }));
    const spec: SpaceSpec = {
      name: 'Monitor',
      permanentUrl: 'monitor',
      pages: [
        {
          id: 'page-1',
          name: 'Monitor',
          slug: '',
          body: [
            {
              type: 'container',
              id: 'hud',
              children: [
                { type: 'container', id: 'left-column', children: rows('quake', 20) },
                { type: 'container', id: 'legend', children: rows('legend', 15) },
                { type: 'text', id: 'cursor', attributes: { content: 'CURSOR' } }
              ]
            }
          ]
        }
      ]
    };
    const documents = authorSpace(spec);
    const files = specToSource(specFromSpace(documents).spec, { exportName: 'monitor', packageName, split: true });

    expect(Object.keys(files).sort()).toEqual([
      'index.ts',
      'pages/monitor.ts',
      'pages/monitor/hud.ts',
      'pages/monitor/left-column.ts',
      'pages/monitor/legend.ts',
      'pages/not-found.ts'
    ]);
    expect(files['pages/monitor.ts']).toContain("import { hudPart } from './monitor/hud';");
    expect(files['pages/monitor/hud.ts']).toContain("import { leftColumnPart } from './left-column';");
    expect(files['pages/monitor/legend.ts']).toContain('export const legendPart: ElementSpec');
    expect(compareSpaces(documents, authorSpace(await load(files, 'monitor')))).toEqual([]);
  });
});
