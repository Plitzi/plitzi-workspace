import { describe, expect, it } from 'vitest';

import { hasValidToken, processTwig } from '..';

/**
 * Reading an element of a collection, in both spellings.
 *
 * `records.0.title` and `records[0].title` are the same access and used to be neither: the parser dropped a numeric
 * segment on the floor and never looked at a bracket at all, so a template asking for one row resolved to the whole
 * array and printed it. It failed silently at three layers — the detector said the token was malformed, the fast
 * path refused it, and the parser answered the wrong value — which is why the tests below cover all three.
 */

const context = {
  rows: [{ title: 'first', tags: ['a', 'b'] }, { title: 'second' }],
  numbers: [10, 20, 30],
  index: 1,
  field: 'title',
  page: 2,
  apiContainer_stats: { data: { quota: { planName: 'Pro' }, history: [{ used: 5 }, { used: 8 }] } }
};

const render = (template: string) => processTwig(template, context);

describe('processTwig / indexing a collection', () => {
  it('reads an element by dotted index', () => {
    expect(render('{{ numbers.0 }}')).toBe('10');
    expect(render('{{ rows.1.title }}')).toBe('second');
  });

  it('reads the same element by bracket', () => {
    expect(render('{{ numbers[0] }}')).toBe('10');
    expect(render('{{ rows[1].title }}')).toBe('second');
  });

  it('mixes the two spellings in one path, at any depth', () => {
    expect(render('{{ rows.0.tags[1] }}')).toBe('b');
    expect(render('{{ rows[0].tags.0 }}')).toBe('a');
    expect(render('{{ rows[0]["title"] }}')).toBe('first');
  });

  it('resolves a subscript that is only known at render time', () => {
    expect(render('{{ rows[index].title }}')).toBe('second');
    expect(render('{{ rows[0][field] }}')).toBe('first');
    expect(render('{{ rows[page - 1].title }}')).toBe('second');
  });

  it('reads the shape a provider actually publishes', () => {
    expect(render('{{ apiContainer_stats.data.quota.planName }}')).toBe('Pro');
    expect(render('{{ apiContainer_stats.data.history.0.used }}')).toBe('5');
    expect(render('{{ apiContainer_stats.data.history[1].used }}')).toBe('8');
  });

  it('keeps working through filters and arithmetic', () => {
    expect(render('{{ numbers.0 + numbers.1 }}')).toBe('30');
    expect(render('{{ rows.0.title|upper }}')).toBe('FIRST');
    expect(render('{{ rows[0].tags|length }}')).toBe('2');
  });

  it('answers nothing for an element that is not there, rather than the collection', () => {
    expect(render('{{ numbers.9 }}')).toBe('');
    expect(render('{{ numbers[9] }}')).toBe('');
    expect(render('{{ missing.0.title }}')).toBe('');
    expect(render('{{ rows[missing].title }}')).toBe('');
  });

  // The reason a numeric FIRST segment stays out: a path and a decimal number are written the same way.
  it('still reads a decimal literal as a number', () => {
    expect(render('{{ 1.5 }}')).toBe('1.5');
    expect(render('{{ 1.5 + 0.5 }}')).toBe('2');
  });

  it('is detected as a token, so a caller resolves it instead of passing it through as text', () => {
    expect(hasValidToken('{{ rows.0.title }}', true)).toBe(true);
    expect(hasValidToken('{{ rows[0].title }}', true)).toBe(true);
    expect(hasValidToken('{{ rows[index].title }}', true)).toBe(true);
    expect(hasValidToken('{{ rows[0]["title"] }}', true)).toBe(true);
    // Unchanged: a space is not an access, and there is nothing to resolve in an empty token.
    expect(hasValidToken('{{ rows 0 }}', true)).toBe(false);
    expect(hasValidToken('{{}}', true)).toBe(false);
  });
});
