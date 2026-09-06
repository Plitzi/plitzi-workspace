import { describe, expect, it } from 'vitest';

import { deleteFont } from './deleteFont';
import { upsertFont } from './upsertFont';
import { emptySpace } from '../../../../helpers';
import { fontsToAI } from '../translator';

import type { UpsertFont } from './upsertFont';

const env = 'main';

const lato: UpsertFont = {
  type: 'upsertFont',
  family: 'Lato',
  source: 'google',
  fallback: 'system-ui, sans-serif',
  weights: [400, 700]
};

describe('declaring a font', () => {
  it('adds a family the space did not have, and says what to re-read', () => {
    const space = emptySpace();
    const result = upsertFont(space, env, lato);

    expect(result.created).toBe(1);
    expect(result.staleResources).toEqual(['plitzi://fonts/main/Lato', 'plitzi://fonts/main']);
    expect(space.style.fonts).toEqual([
      {
        source: 'google',
        family: 'Lato',
        fallback: 'system-ui, sans-serif',
        weights: [400, 700],
        styles: ['normal'],
        display: 'swap'
      }
    ]);
  });

  it('replaces what an already declared family says rather than adding a second one', () => {
    const space = emptySpace();
    upsertFont(space, env, lato);
    const result = upsertFont(space, env, { ...lato, weights: [400] });

    expect(result.updated).toBe(1);
    expect(space.style.fonts).toHaveLength(1);
    expect(space.style.fonts?.[0].weights).toEqual([400]);
  });

  it('refuses a remote font that names nowhere to load from, with the reason', () => {
    const space = emptySpace();
    const result = upsertFont(space, env, { ...lato, source: 'remote' });

    expect(result.errors?.[0].message).toContain('either a stylesheet URL or the font files');
    expect(space.style.fonts ?? []).toEqual([]);
  });

  it('refuses a URL that is not plain https, which is the whole point of validating here', () => {
    const space = emptySpace();
    const result = upsertFont(space, env, {
      ...lato,
      source: 'remote',
      stylesheet: 'http://use.typekit.test/abc.css'
    });

    expect(result.errors?.[0].message).toContain('https URL');
  });

  it('drops a family, and shrugs at one nobody declared', () => {
    const space = emptySpace();
    upsertFont(space, env, lato);

    expect(deleteFont(space, env, { type: 'deleteFont', family: 'Lato' }).deleted).toBe(1);
    expect(space.style.fonts).toEqual([]);
    expect(deleteFont(space, env, { type: 'deleteFont', family: 'Nope' }).deleted).toBe(0);
  });
});

describe('what the agent reads back', () => {
  it('reports a family the stylesheet names and nobody declared, which renders in a fallback', () => {
    const space = emptySpace();
    space.style.cache = '.a{font-family:"Playfair Display", serif;}.b{font-family:Arial, sans-serif;}';

    const { declared, namedButNotDeclared } = fontsToAI(space.style);

    expect(declared).toEqual([]);
    // Arial is a system stack every machine has, so it is not a gap; Playfair is.
    expect(namedButNotDeclared).toEqual(['Playfair Display']);
  });

  it('stops reporting it once it is declared', () => {
    const space = emptySpace();
    space.style.cache = '.a{font-family:Lato, sans-serif;}';
    upsertFont(space, env, lato);

    expect(fontsToAI(space.style).namedButNotDeclared).toEqual([]);
  });
});
