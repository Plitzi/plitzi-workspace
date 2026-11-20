import { describe, expect, it } from 'vitest';

import { abTest, abTestVariant, authorSpace, lintSpace, text } from '../../index';

import type { ElementSpec } from '../types';

type Documents = ReturnType<typeof authorSpace>;

/** A space whose home page holds these, written by the authoring surface. */
const spaceWith = (...body: ElementSpec[]): Documents =>
  authorSpace({ name: 'Experiments', permanentUrl: 'experiments', pages: [{ name: 'Home', slug: '', body }] });

const hero = (attributes: Parameters<typeof abTest>[0] = {}) =>
  abTest({
    id: 'hero',
    experiment: 'heroTest',
    split: 30,
    ...attributes,
    children: [abTestVariant([text({ content: 'Build faster' })]), abTestVariant([text({ content: 'Ship today' })])]
  });

const codes = (documents: Documents) => {
  const { errors, warnings } = lintSpace(documents);

  return { errors: errors.map(issue => issue.code), warnings: warnings.map(issue => issue.code) };
};

describe('lintSpace — A/B tests', () => {
  it('finds nothing in an A/B test with a name, a split and its two variants, read by a template', () => {
    const documents = spaceWith(hero(), text({ content: '{{ experiments.heroTest }}' }));

    expect(lintSpace(documents)).toEqual({ errors: [], warnings: [] });
  });

  it('experiment-unnamed', () => {
    expect(codes(spaceWith(hero({ experiment: '' }))).warnings).toContain('experiment-unnamed');
  });

  it('experiment-name', () => {
    const documents = spaceWith(hero());
    documents.schema.flat.hero.attributes.experiment = 'hero test';

    expect(codes(documents).errors).toContain('experiment-name');
  });

  it('experiment-split', () => {
    const documents = spaceWith(hero());
    documents.schema.flat.hero.attributes.split = 120;

    expect(codes(documents).errors).toContain('experiment-split');
  });

  it('experiment-split-differs', () => {
    const documents = spaceWith(
      hero(),
      abTest({
        id: 'cta',
        experiment: 'heroTest',
        split: 60,
        children: [abTestVariant([text({ content: 'Start' })]), abTestVariant([text({ content: 'Try it' })])]
      })
    );

    expect(codes(documents).warnings).toContain('experiment-split-differs');
  });

  it('experiment-variants, with a third variant, with one missing and with something else beside them', () => {
    const changed = (items: (flat: Documents['schema']['flat']) => string[]) => {
      const documents = spaceWith(hero());
      const { flat } = documents.schema;
      flat.hero.definition.items = items(flat);

      return codes(documents).errors;
    };
    const [a = '', b = ''] = spaceWith(hero()).schema.flat.hero.definition.items ?? [];

    expect(changed(() => [a, b, a])).toContain('experiment-variants');
    expect(changed(() => [a])).toContain('experiment-variants');
    expect(changed(flat => [a, b, Object.keys(flat).find(id => flat[id].definition.type === 'text') ?? ''])).toContain(
      'experiment-variants'
    );
  });

  it('experiment-unknown, naming the experiment it was likely meant to be', () => {
    const documents = spaceWith(hero(), text({ id: 'said', content: '{{ experiments.heroTest }}' }));
    documents.schema.flat.said.attributes.content = '{{ experiments.heroTset }}';
    const problem = lintSpace(documents).errors.at(0);

    expect(problem?.code).toBe('experiment-unknown');
    expect(problem?.message).toContain('heroTest');
  });
});
