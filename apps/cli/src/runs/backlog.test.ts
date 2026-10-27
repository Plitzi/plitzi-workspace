import { describe, expect, it } from 'vitest';

import { namedNotClosed } from './backlog';

// A run's t-listen-untraced, titled "(b-36)", fixed it with no "closes": b-36 was listed open at the next start.
describe('a task that names a backlog item', () => {
  it('is refused unless it closes it — an item already done, or one it closes, is no matter', () => {
    const open = new Set(['b-36', 'b-37', 'b-38']);
    const task = (id: string, title: string, closes?: string[]) => ({
      id,
      title,
      acceptance: [{ said: 'The spec passes traced', check: 'npx playwright test visual/listen.spec.ts' }],
      ...(closes ? { closes } : {})
    });

    expect(
      namedNotClosed(
        [
          task('t-listen', 'listen.spec: the remembered Listen untraced (b-36)'),
          task('t-shows', 'shows.spec: the dismiss (b-38, b-37)', ['b-38']),
          task('t-done', 'Like b-12, which is done'),
          task('t-closed', 'The player (b-37)', ['b-37'])
        ],
        open
      )
    ).toEqual([
      't-listen names b-36 and does not close it: add it to its "closes" — closed when the run is applied — or leave it out of its words',
      't-shows names b-37 and does not close it: add it to its "closes" — closed when the run is applied — or leave it out of its words'
    ]);
  });
});
