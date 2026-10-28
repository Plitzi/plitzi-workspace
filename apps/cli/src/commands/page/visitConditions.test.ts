import { afterEach, describe, expect, it, vi } from 'vitest';

import { sayConditions } from './visit';

afterEach(() => {
  vi.restoreAllMocks();
});

// The conditions were said back by nothing: a page read with its player held back, or a font failed, read as any page.
describe('the browser a page command was asked to read in', () => {
  it('is said once as it starts — and nothing is, when it is a visitor’s ordinary one', () => {
    const said: string[] = [];
    vi.spyOn(process.stderr, 'write').mockImplementation(chunk => {
      said.push(String(chunk));

      return true;
    });

    sayConditions({ hold: ['iframe_api'], block: ['fonts.gstatic'] });
    sayConditions({ timezone: 'Europe/Madrid' });

    expect(said).toHaveLength(1);
    expect(said[0]).toContain('blocked: fonts.gstatic · held unanswered: iframe_api');
  });
});
