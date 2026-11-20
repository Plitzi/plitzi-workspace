import { describe, expect, it } from 'vitest';

import { abTest, abTestVariant, authorSpace, lintSpace, text } from '../../index';

import type { ElementSpec } from '../types';

type Documents = ReturnType<typeof authorSpace>;

/** A space whose home page holds these, written by the authoring surface. */
const spaceWith = (...body: ElementSpec[]): Documents =>
  authorSpace({ name: 'Experiments', permanentUrl: 'experiments', pages: [{ name: 'Home', slug: '', body }] });

/** An A/B test whose variants weigh what is given, each holding a line of its own. */
const hero = (id: string, weights: number[] = [70, 30], attributes: Parameters<typeof abTest>[0] = {}) =>
  abTest({
    id,
    experiment: 'heroTest',
    ...attributes,
    children: weights.map((weight, index) =>
      abTestVariant({ weight, children: [text({ content: `Headline ${String(index)}` })] })
    )
  });

const codes = (documents: Documents) => {
  const { errors, warnings } = lintSpace(documents);

  return { errors: errors.map(issue => issue.code), warnings: warnings.map(issue => issue.code) };
};

/** The ids of the variants of a test, in order. */
const variantsOf = (documents: Documents, id: string): string[] => documents.schema.flat[id].definition.items ?? [];

describe('lintSpace — A/B tests', () => {
  it('finds nothing in a named A/B test of three weighted variants, read by a template', () => {
    const documents = spaceWith(
      hero('hero', [50, 30, 20], { builderVariant: 'c' }),
      text({ content: '{{ experiments.heroTest }}' })
    );

    expect(lintSpace(documents)).toEqual({ errors: [], warnings: [] });
  });

  it('experiment-unnamed', () => {
    expect(codes(spaceWith(hero('hero', [50, 50], { experiment: '' }))).warnings).toContain('experiment-unnamed');
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

  it('reads one variant left with a weight as an experiment ended, not as a mistake', () => {
    expect(lintSpace(spaceWith(hero('hero', [0, 100])))).toEqual({ errors: [], warnings: [] });
  });

  it('experiment-weights-differ', () => {
    expect(codes(spaceWith(hero('hero'), hero('cta', [60, 40]))).warnings).toContain('experiment-weights-differ');
  });

  it('experiment-builder-variant', () => {
    const documents = spaceWith(hero('hero'));
    documents.schema.flat.hero.attributes.builderVariant = 'd';

    expect(codes(documents).warnings).toContain('experiment-builder-variant');
  });

  it('experiment-variants, with six variants, with one, and with something else beside them', () => {
    const changed = (items: (flat: Documents['schema']['flat'], variants: string[]) => string[]) => {
      const documents = spaceWith(hero('hero'));
      const { flat } = documents.schema;
      flat.hero.definition.items = items(flat, variantsOf(documents, 'hero'));

      return codes(documents).errors;
    };

    expect(changed((_, [a = '', b = '']) => [a, b, a, b, a, b])).toContain('experiment-variants');
    expect(changed((_, [a = '']) => [a])).toContain('experiment-variants');
    expect(
      changed((flat, variants) => [
        ...variants,
        Object.keys(flat).find(id => flat[id].definition.type === 'text') ?? ''
      ])
    ).toContain('experiment-variants');
  });

  it('experiment-unknown, naming the experiment it was likely meant to be', () => {
    const documents = spaceWith(hero('hero'), text({ id: 'said', content: '{{ experiments.heroTest }}' }));
    documents.schema.flat.said.attributes.content = '{{ experiments.heroTset }}';
    const problem = lintSpace(documents).errors.at(0);

    expect(problem?.code).toBe('experiment-unknown');
    expect(problem?.message).toContain('heroTest');
  });
});
