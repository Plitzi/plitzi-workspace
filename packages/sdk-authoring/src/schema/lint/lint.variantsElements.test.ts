import { describe, expect, it } from 'vitest';

import { authorSpace, lintSpace, text, variantItem, variants } from '../../index';

import type { ElementSpec } from '../types';

type Documents = ReturnType<typeof authorSpace>;

/** A space whose home page holds these, written by the authoring surface. */
const spaceWith = (...body: ElementSpec[]): Documents =>
  authorSpace({ name: 'Variants', permanentUrl: 'variants', pages: [{ name: 'Home', slug: '', body }] });

/** A test by chance whose variants weigh what is given, each holding a line of its own. */
const hero = (id: string, weights: number[] = [70, 30], attributes: Parameters<typeof variants>[0] = {}) =>
  variants({
    id,
    experiment: 'heroTest',
    ...attributes,
    children: weights.map((weight, index) =>
      variantItem({ weight, children: [text({ content: `Headline ${String(index)}` })] })
    )
  });

const phones = {
  combinator: 'and' as const,
  rules: [{ field: 'visitor.device', operator: '=' as const, value: 'mobile' }]
};

/** Variants by rules: one for phones, and everyone else. */
const welcome = (id = 'welcome') =>
  variants({
    id,
    chooseBy: 'rules',
    children: [
      variantItem({ when: phones, children: [text({ content: 'On the go' })] }),
      variantItem([text({ content: 'Welcome' })])
    ]
  });

const codes = (documents: Documents) => {
  const { errors, warnings } = lintSpace(documents);

  return { errors: errors.map(issue => issue.code), warnings: warnings.map(issue => issue.code) };
};

/** The ids of the variants of an element, in order. */
const variantsOf = (documents: Documents, id: string): string[] => documents.schema.flat[id].definition.items ?? [];

describe('lintSpace — Variants by chance', () => {
  it('finds nothing in a named test of three weighted variants, read by a template', () => {
    const documents = spaceWith(
      hero('hero', [50, 30, 20], { builderVariant: 2 }),
      text({ content: '{{ experiments.heroTest }}' })
    );

    expect(lintSpace(documents)).toEqual({ errors: [], warnings: [] });
  });

  it('finds nothing in one not named: it runs under the element’s own name', () => {
    const documents = spaceWith(
      hero('pricing', [90, 10], { experiment: '' }),
      text({ content: '{{ experiments.pricing }}' })
    );

    expect(lintSpace(documents)).toEqual({ errors: [], warnings: [] });
  });

  it('experiment-name', () => {
    const documents = spaceWith(hero('hero'));
    documents.schema.flat.hero.attributes.experiment = 'hero test';

    expect(codes(documents).errors).toContain('experiment-name');
  });

  it('experiment-weight, for a weight that is not a share and for variants that all weigh 0', () => {
    const unread = spaceWith(hero('hero'));
    const [first = ''] = variantsOf(unread, 'hero');
    unread.schema.flat[first].attributes.weight = 120;
    const none = spaceWith(hero('hero'));
    for (const id of variantsOf(none, 'hero')) {
      none.schema.flat[id].attributes.weight = 0;
    }

    expect(codes(unread).errors).toContain('experiment-weight');
    expect(codes(none).errors).toContain('experiment-weight');
  });

  it('reads one variant left with a weight as a test ended, not as a mistake', () => {
    expect(lintSpace(spaceWith(hero('hero', [0, 100])))).toEqual({ errors: [], warnings: [] });
  });

  it('experiment-weights-total, saying the shares that keep their proportions', () => {
    const problem = lintSpace(spaceWith(hero('hero', [60, 30, 30]))).warnings.find(
      issue => issue.code === 'experiment-weights-total'
    );

    expect(problem?.message).toContain('60/30/30 — 120%, not 100%');
    expect(problem?.message).toContain('50/25/25 keeps their proportions');
    expect(lintSpace(spaceWith(hero('hero', [50, 25, 20, 5])))).toEqual({ errors: [], warnings: [] });
  });

  it('experiment-weights-differ', () => {
    expect(codes(spaceWith(hero('hero'), hero('cta', [60, 40]))).warnings).toContain('experiment-weights-differ');
  });

  it('experiment-unknown, naming the experiment it was likely meant to be', () => {
    const documents = spaceWith(hero('hero'), text({ id: 'said', content: '{{ experiments.heroTest }}' }));
    documents.schema.flat.said.attributes.content = '{{ experiments.heroTset }}';
    const problem = lintSpace(documents).errors.at(0);

    expect(problem?.code).toBe('experiment-unknown');
    expect(problem?.message).toContain('heroTest');
  });
});

describe('lintSpace — Variants by rules', () => {
  it('finds nothing in one whose last variant is for everybody else', () => {
    expect(lintSpace(spaceWith(welcome()))).toEqual({ errors: [], warnings: [] });
  });

  it('variants-rule', () => {
    const documents = spaceWith(welcome());
    const [first = ''] = variantsOf(documents, 'welcome');
    documents.schema.flat[first].attributes.when = 'mobile';

    expect(codes(documents).errors).toContain('variants-rule');
  });

  it('variants-unreachable', () => {
    const documents = spaceWith(welcome());
    documents.schema.flat.welcome.definition.items = [...variantsOf(documents, 'welcome')].reverse();

    expect(codes(documents).warnings).toContain('variants-unreachable');
  });

  it('variants-no-fallback', () => {
    const documents = spaceWith(welcome());
    const [, last = ''] = variantsOf(documents, 'welcome');
    documents.schema.flat[last].attributes.when = phones;

    expect(codes(documents).warnings).toContain('variants-no-fallback');
  });

  it('keeps each variant’s share by rules, and its rule by chance, without a word: switching back finds them', () => {
    const documents = spaceWith(welcome());
    documents.schema.flat.welcome.attributes.chooseBy = 'chance';

    expect(lintSpace(documents)).toEqual({ errors: [], warnings: [] });
  });
});

describe('lintSpace — Variants either way', () => {
  it('variants-choose-by', () => {
    const documents = spaceWith(welcome());
    documents.schema.flat.welcome.attributes.chooseBy = 'random';

    expect(codes(documents).errors).toContain('variants-choose-by');
  });

  it('variants-builder-variant', () => {
    const documents = spaceWith(hero('hero'));
    documents.schema.flat.hero.attributes.builderVariant = 3;

    expect(codes(documents).warnings).toContain('variants-builder-variant');
  });

  it('variants-items, with six by chance, with none by rules, and with something else beside them', () => {
    const changed = (
      make: () => Documents,
      id: string,
      items: (flat: Documents['schema']['flat'], all: string[]) => string[]
    ) => {
      const documents = make();
      const { flat } = documents.schema;
      flat[id].definition.items = items(flat, variantsOf(documents, id));

      return codes(documents).errors;
    };

    expect(
      changed(
        () => spaceWith(hero('hero')),
        'hero',
        (_, [a = '', b = '']) => [a, b, a, b, a, b]
      )
    ).toContain('variants-items');
    expect(
      changed(
        () => spaceWith(welcome()),
        'welcome',
        () => []
      )
    ).toContain('variants-items');
    expect(
      changed(
        () => spaceWith(hero('hero')),
        'hero',
        (flat, all) => [...all, Object.keys(flat).find(id => flat[id].definition.type === 'text') ?? '']
      )
    ).toContain('variants-items');
  });
});
