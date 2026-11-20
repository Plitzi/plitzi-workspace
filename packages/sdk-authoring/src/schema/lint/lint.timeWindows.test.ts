import { describe, expect, it } from 'vitest';

import { authorSpace, lintSpace, text, timeWindow } from '../../index';

import type { ElementSpec } from '../types';

type Documents = ReturnType<typeof authorSpace>;

const spaceWith = (...body: ElementSpec[]): Documents =>
  authorSpace({ name: 'Windows', permanentUrl: 'windows', pages: [{ name: 'Home', slug: '', body }] });

const sale = () =>
  timeWindow({
    id: 'sale',
    startsAt: '2026-12-01T09:00:00Z',
    endsAt: '2026-12-08T09:00:00Z',
    children: [text({ content: 'Sale on' })]
  });

const codes = (documents: Documents) => {
  const { errors, warnings } = lintSpace(documents);

  return { errors: errors.map(issue => issue.code), warnings: warnings.map(issue => issue.code) };
};

describe('lintSpace — time windows', () => {
  it('finds nothing in a window with both bounds, nor in one with none', () => {
    expect(lintSpace(spaceWith(sale()))).toEqual({ errors: [], warnings: [] });
    expect(lintSpace(spaceWith(timeWindow([text({ content: 'Always' })])))).toEqual({ errors: [], warnings: [] });
  });

  it('time-window-bound', () => {
    const documents = spaceWith(sale());
    documents.schema.flat.sale.attributes.startsAt = '2026-12-01 09:00';

    expect(codes(documents).errors).toContain('time-window-bound');
  });

  it('time-window-empty', () => {
    const documents = spaceWith(sale());
    documents.schema.flat.sale.attributes.endsAt = '2026-11-01T09:00:00Z';

    expect(codes(documents).warnings).toContain('time-window-empty');
  });
});
