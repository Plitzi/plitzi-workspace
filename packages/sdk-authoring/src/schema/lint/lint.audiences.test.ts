import { describe, expect, it } from 'vitest';

import { audience, audienceVariant, authorSpace, lintSpace, text } from '../../index';

import type { ElementSpec } from '../types';

type Documents = ReturnType<typeof authorSpace>;

/** A space whose home page holds these, written by the authoring surface. */
const spaceWith = (...body: ElementSpec[]): Documents =>
  authorSpace({ name: 'Audiences', permanentUrl: 'audiences', pages: [{ name: 'Home', slug: '', body }] });

const phones = {
  combinator: 'and' as const,
  rules: [{ field: 'visitor.device', operator: '=' as const, value: 'mobile' }]
};

/** An audience for phones, and everyone else. */
const welcome = (id = 'welcome') =>
  audience({
    id,
    children: [
      audienceVariant({ when: phones, children: [text({ content: 'On the go' })] }),
      audienceVariant([text({ content: 'Welcome' })])
    ]
  });

const codes = (documents: Documents) => {
  const { errors, warnings } = lintSpace(documents);

  return { errors: errors.map(issue => issue.code), warnings: warnings.map(issue => issue.code) };
};

const variantsOf = (documents: Documents, id: string): string[] => documents.schema.flat[id].definition.items ?? [];

describe('lintSpace — audiences', () => {
  it('finds nothing in an audience whose last variant is for everybody else', () => {
    expect(lintSpace(spaceWith(welcome()))).toEqual({ errors: [], warnings: [] });
  });

  it('audience-variants', () => {
    const documents = spaceWith(welcome());
    documents.schema.flat.welcome.definition.items = [];

    expect(codes(documents).errors).toContain('audience-variants');
  });

  it('audience-rule', () => {
    const documents = spaceWith(welcome());
    const [first = ''] = variantsOf(documents, 'welcome');
    documents.schema.flat[first].attributes.when = 'mobile';

    expect(codes(documents).errors).toContain('audience-rule');
  });

  it('audience-unreachable', () => {
    const documents = spaceWith(welcome());
    documents.schema.flat.welcome.definition.items = [...variantsOf(documents, 'welcome')].reverse();

    expect(codes(documents).warnings).toContain('audience-unreachable');
  });

  it('audience-no-fallback', () => {
    const documents = spaceWith(welcome());
    const [, last = ''] = variantsOf(documents, 'welcome');
    documents.schema.flat[last].attributes.when = phones;

    expect(codes(documents).warnings).toContain('audience-no-fallback');
  });
});
