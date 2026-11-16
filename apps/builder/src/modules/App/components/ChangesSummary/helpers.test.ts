import { describe, expect, it } from 'vitest';

import { changeLines } from './helpers';

import type { SpaceVersionChanges } from '@plitzi/sdk-shared';

const none: SpaceVersionChanges = {
  pages: { added: [], removed: [], changed: [] },
  layouts: 0,
  components: 0,
  styles: false,
  fonts: false,
  settings: false,
  plugins: { added: [], removed: [], changed: [] },
  actions: 0,
  connectors: 0,
  functions: false,
  runtime: false,
  total: 0
};

describe('changeLines', () => {
  it('says nothing changes when nothing does', () => {
    expect(changeLines(none)).toEqual({ summary: 'Nothing changes', details: [] });
  });

  it('says the pages first, by what happened to them, then each other part, counted', () => {
    const { summary, details } = changeLines({
      ...none,
      pages: { added: ['About'], removed: [], changed: ['Home', 'Menu'] },
      actions: 1,
      fonts: true,
      plugins: { added: ['chart'], removed: [], changed: [] },
      total: 6
    });

    expect(summary).toBe('2 pages changed · 1 new page · fonts · 1 plugin · 1 action');
    expect(details).toEqual(['Changed: Home, Menu', 'New: About', 'Plugins added: chart']);
  });
});
