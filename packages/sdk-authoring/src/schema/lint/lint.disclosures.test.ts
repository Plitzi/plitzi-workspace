import { describe, expect, it } from 'vitest';

import { authorSpace, button, disclosure, disclosureSummary, lintSpace, paragraph, text } from '../../index';

import type { ElementSpec } from '../types';

type Documents = ReturnType<typeof authorSpace>;

const spaceWith = (...body: ElementSpec[]): Documents =>
  authorSpace({ name: 'Questions', permanentUrl: 'questions', pages: [{ name: 'Home', slug: '', body }] });

const question = (summary: ElementSpec[] = [text({ content: 'Can I cancel?' })]) =>
  disclosure({
    id: 'cancel',
    name: 'faq',
    children: [disclosureSummary({ id: 'cancel-summary', children: summary }), paragraph({ content: 'Any time.' })]
  });

const codes = (documents: Documents) => {
  const { errors, warnings } = lintSpace(documents);

  return { errors: errors.map(issue => issue.code), warnings: warnings.map(issue => issue.code) };
};

describe('lintSpace — disclosures', () => {
  it('finds nothing in a question with its summary first and words in it', () => {
    expect(lintSpace(spaceWith(question()))).toEqual({ errors: [], warnings: [] });
  });

  it('disclosure-summary-first: after what it shows, or twice', () => {
    const after = spaceWith(question());
    after.schema.flat.cancel.definition.items?.reverse();

    expect(codes(after).errors).toContain('disclosure-summary-first');

    const twice = spaceWith(question());
    const summary = twice.schema.flat['cancel-summary'];
    twice.schema.flat.again = { ...summary, id: 'again' };
    twice.schema.flat.cancel.definition.items?.push('again');

    expect(codes(twice).errors).toContain('disclosure-summary-first');
  });

  it('part-missing: a disclosure with no summary at all', () => {
    const none = spaceWith(question());
    none.schema.flat.cancel.definition.items = none.schema.flat.cancel.definition.items?.filter(
      id => id !== 'cancel-summary'
    );

    expect(codes(none).errors).toContain('part-missing');
  });

  it('disclosure-summary-control: a button inside the summary, however deep', () => {
    const documents = spaceWith(question(), button({ id: 'buy', content: 'Buy' }));
    documents.schema.flat['cancel-summary'].definition.items?.push('buy');

    expect(codes(documents).errors).toContain('disclosure-summary-control');
  });

  it('disclosure-summary-unnamed: a summary with nothing in it', () => {
    expect(codes(spaceWith(question([]))).warnings).toContain('disclosure-summary-unnamed');
  });
});
