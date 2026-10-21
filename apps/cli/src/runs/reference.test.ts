import fs from 'node:fs/promises';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runPaths } from './paths';
import { runPlanProblems } from './planProblems';
import { keptName, keptPage, referencePages, unnamedSections } from './reference';
import { benchPlan, makeBench } from '../tests/runProject';
import { runSteps } from '../tests/runSteps';

import type { KeptPage } from './reference';
import type { Bench } from '../tests/runProject';

let bench: Bench;

beforeEach(async () => {
  bench = await makeBench();
});

afterEach(async () => {
  await bench.cleanup();
});

const { open, take } = runSteps(() => bench);

const REFERENCE = 'https://www.example.com';

/** A text the page draws, as `pageTexts` measures it: only its words and tag matter here. */
const pageText = {
  text: '',
  tag: 'p',
  x: 0,
  y: 0,
  width: 100,
  height: 20,
  fontSize: 16,
  fontWeight: '400',
  lineHeight: '24px',
  letterSpacing: 'normal',
  fontFamily: 'serif',
  color: 'rgb(0, 0, 0)',
  background: 'transparent',
  padding: '0px',
  radius: '0px'
};

/** A page kept as `plitzi run reference` keeps it, in the run's folder. */
const keep = async (runId: string, pathname: string): Promise<void> => {
  const dir = runPaths(bench.root, runId).reference;
  const name = keptName(pathname, 1440, 'dark');
  const page: KeptPage = {
    url: new URL(pathname, REFERENCE).href,
    width: 1440,
    scheme: 'dark',
    at: '2026-10-21T10:00:00.000Z',
    texts: [],
    unloaded: 0,
    decorations: []
  };
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${name}.png`), new Uint8Array([137, 80, 78, 71]));
  await fs.writeFile(path.join(dir, `${name}.json`), JSON.stringify(page));
};

// la-velada's original redesigned its fighter page after the copy: a comparison with the live site measured another page.
describe('the reference a run keeps', () => {
  it('keeps the home and each page the inventory names — a pattern is no page', () => {
    expect(
      referencePages({
        inventory: [
          { id: 'a', piece: 'The list', page: '/boxeadores' },
          { id: 'b', piece: 'A fighter', page: '/boxeadores/:id' },
          { id: 'c', piece: 'The list again', page: '/boxeadores' },
          { id: 'd', piece: 'The shell' }
        ]
      })
    ).toEqual(['/', '/boxeadores']);
    expect(keptName('/boxeadores/alondrissa', 390, 'light')).toBe('boxeadores-alondrissa-390-light');
  });

  it('is found from the project and from a task’s copy, by the site’s origin — another site’s is not', async () => {
    const runId = await open({ ...benchPlan(), reference: REFERENCE });
    await keep(runId, '/menu');
    const copy = await take('agent-1', 't-menu');

    for (const from of [bench.root, copy.work]) {
      expect(await keptPage(from, `${REFERENCE}/menu`, 1440, 'dark')).toMatchObject({
        runId,
        page: { at: '2026-10-21T10:00:00.000Z' }
      });
    }

    expect(await keptPage(bench.root, `${REFERENCE}/menu`, 390, 'dark')).toBeUndefined();
    expect(await keptPage(bench.root, 'https://other.example.org/menu', 1440, 'dark')).toBeUndefined();
  });

  // la-velada's lead left three pieces of the artist page out of the inventory, found only at review.
  it('says the headings of a kept page no piece of the inventory names — whatever their accents and case', () => {
    let headingAt = 0;
    const heading = (text: string, tag = 'h2') => ({ ...pageText, text, tag, y: (headingAt += 300) });
    const page: KeptPage = {
      url: `${REFERENCE}/artistas/quevedo`,
      width: 1440,
      scheme: 'light',
      at: '2026-10-21T10:00:00.000Z',
      texts: [
        heading('Estadísticas en Spotify'),
        heading('Setlist'),
        heading('SETLIST'),
        heading('Actuación'),
        heading('Quevedo', 'p'),
        heading('Una pregunta del FAQ', 'h3'),
        { ...heading('Solo para lectores'), width: 1, height: 1 },
        // A grid of cards: their titles side by side on one row.
        { ...heading('Bizarrap'), y: 900 },
        { ...heading('Quevedo'), x: 400, y: 900 }
      ],
      unloaded: 0,
      decorations: []
    };

    expect(
      unnamedSections(
        [page],
        [
          { id: 'stats', piece: 'the artist’s Spotify stats (estadisticas)', page: '/artistas/quevedo' },
          { id: 'show', piece: 'Su actuación, the performance video', page: '/artistas/quevedo' },
          { id: 'other', piece: 'the setlist of another page', page: '/artistas/bizarrap' }
        ]
      )
    ).toEqual([{ page: '/artistas/quevedo', headings: ['Setlist'] }]);
  });

  it('is a site’s address in the plan', () => {
    expect(runPlanProblems({ ...benchPlan(), reference: 'infolavelada.com' })).toContainEqual(
      expect.stringContaining('reference: the address of the site it copies')
    );
    expect(runPlanProblems({ ...benchPlan(), reference: REFERENCE })).toEqual([]);
  });
});
