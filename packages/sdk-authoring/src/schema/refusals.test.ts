import { afterEach, describe, expect, it, vi } from 'vitest';

import { authorSpace, container, link, styles, text } from '../index';
import { SpaceRefusedError } from './refusals';
import { markWrittenAt, writtenAt } from './writtenAt';

import type { SpaceRefusal } from './refusals';
import type { SpaceSpec } from './types';

const card = styles('card', { css: { padding: '8px' } });

const space = (): SpaceSpec => ({
  name: 'Refused',
  permanentUrl: 'refused',
  classes: { card },
  pages: [
    {
      id: 'home',
      name: 'Home',
      slug: '',
      body: [
        container({ id: 'hero', class: card, css: { margin: '0' } }),
        container({
          id: 'footer',
          children: [container([text({ class: card, states: { hover: { color: 'red' } } })])]
        }),
        link({ id: 'plans', href: 'home', hash: 'pricing', children: [text('Plans')] }),
        container({ class: card, selector: 'own' })
      ]
    }
  ]
});

const refusalsOf = (spec: SpaceSpec): readonly SpaceRefusal[] => {
  try {
    authorSpace(spec);
  } catch (error) {
    if (error instanceof SpaceRefusedError) {
      return error.refusals;
    }

    throw error;
  }

  return [];
};

describe('authorSpace refusals', () => {
  it('reports every element it cannot write in one run, not the first', () => {
    const refusals = refusalsOf(space());

    expect(refusals).toHaveLength(4);
  });

  it('finds each by the nearest named element and the steps from it, not by indices from the page', () => {
    const places = refusalsOf(space()).map(refusal => refusal.place);

    // What could not be written as declared first, then what the linter found in the rest of the space.
    expect(places).toEqual(['"hero"', '"footer" › container[0] › text[0]', 'Page "Home" › container[3]', '"plans"']);
    expect(places.join(' ')).not.toMatch(/\/\d+\//);
  });

  it('files each under the code its row in authoring-errors.md has', () => {
    expect(refusalsOf(space()).map(refusal => refusal.code)).toEqual([
      'class-and-css',
      'class-and-css',
      'class-and-selector',
      'anchor-missing'
    ]);
  });

  it('says it in one message, numbered, with what to change', () => {
    expect(() => authorSpace(space())).toThrow(
      /was not written — 4 problems:[^]*1\. "hero"[^]*\[class-and-css\] [^]*declares both a shared class[^]*authoring-errors\.md/
    );
  });
});

describe('writtenAt', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const writtenFrom = (stack: string): string | undefined => {
    const spec = markWrittenAt({});
    const [marker] = Object.getOwnPropertySymbols(spec).map(symbol => Reflect.get(spec, symbol) as Error);
    marker.stack = stack;

    return writtenAt(spec);
  };

  it('is the first line of the author’s own code, past this package and its dependencies', () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/work');
    const at = writtenFrom(
      [
        'Error',
        '    at buildSpec (/work/node_modules/@plitzi/sdk-authoring/dist/index.js:120:5)',
        '    at node:internal/modules/run:1:1',
        '    at heroSection (file:///work/src/site/home.ts:417:12)',
        '    at main (/work/src/space.ts:9:3)'
      ].join('\n')
    );

    expect(at).toBe('src/site/home.ts:417');
  });

  it('is nothing for a spec no factory wrote, or in production', () => {
    expect(writtenAt({ type: 'text' })).toBeUndefined();

    vi.stubEnv('NODE_ENV', 'production');
    expect(Object.getOwnPropertySymbols(markWrittenAt({}))).toEqual([]);
  });
});
