import { describe, expect, it } from 'vitest';

import { authorSpace, countdown, lintSpace, timeWindow } from '../../index';

import type { ElementSpec } from '../types';

type Documents = ReturnType<typeof authorSpace>;

const spaceWith = (...body: ElementSpec[]): Documents =>
  authorSpace({ name: 'Launch', permanentUrl: 'launch', pages: [{ name: 'Home', slug: '', body }] });

const codes = (documents: Documents) => {
  const { errors, warnings } = lintSpace(documents);

  return { errors: errors.map(issue => issue.code), warnings: warnings.map(issue => issue.code) };
};

describe('lintSpace — countdowns', () => {
  it('finds nothing in one with its instant, nor in one counting to the end of its window', () => {
    expect(lintSpace(spaceWith(countdown({ to: '2026-12-01T09:00:00Z' })))).toEqual({ errors: [], warnings: [] });
    expect(lintSpace(spaceWith(timeWindow({ endsAt: '2026-12-08T09:00:00Z', children: [countdown()] })))).toEqual({
      errors: [],
      warnings: []
    });
  });

  it('countdown-to', () => {
    const documents = spaceWith(countdown({ id: 'launch', to: '2026-12-01T09:00:00Z' }));
    documents.schema.flat.launch.attributes.to = '2026-12-01 09:00';

    expect(codes(documents).errors).toContain('countdown-to');
  });

  it('countdown-without-end: no instant, and no window with an end around it', () => {
    expect(codes(spaceWith(countdown())).warnings).toContain('countdown-without-end');
    expect(
      codes(spaceWith(timeWindow({ startsAt: '2026-12-01T09:00:00Z', children: [countdown()] }))).warnings
    ).toContain('countdown-without-end');
  });

  it('countdown-units', () => {
    expect(
      codes(spaceWith(countdown({ to: '2026-12-01T09:00:00Z', largest: 'minutes', smallest: 'hours' }))).warnings
    ).toContain('countdown-units');
  });
});
