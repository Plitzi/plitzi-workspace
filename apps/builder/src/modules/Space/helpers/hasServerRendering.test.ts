import { describe, expect, it } from 'vitest';

import hasServerRendering from './hasServerRendering';

describe('hasServerRendering', () => {
  it('counts the platform’s own page server — a deployment served by SSR with no credential of the space’s', () => {
    expect(hasServerRendering([{ provider: 'ssr', credential: null }])).toBe(true);
  });

  it('counts a page server of the space’s own, through its SSR credential', () => {
    expect(hasServerRendering([{ provider: 'ssr', credential: { provider: 'ssr' } }])).toBe(true);
  });

  it('does not count a static bucket, and answers yes while the deployments are not known yet', () => {
    expect(hasServerRendering([{ provider: 's3', credential: null }])).toBe(false);
    expect(hasServerRendering([])).toBe(false);
    expect(hasServerRendering(undefined)).toBe(true);
  });
});
