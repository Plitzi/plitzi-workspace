import { describe, expect, it } from 'vitest';

import { unmeasuredNotices } from './measuredValues';

import type { PlannedTask } from './model';

const task = (id: string, acceptance: PlannedTask['acceptance']): PlannedTask => ({
  id,
  title: id,
  files: [`src/space/pages/${id}.ts`],
  dependsOn: [],
  priority: 'medium',
  estimateMinutes: 20,
  acceptance
});

const SITE = 'https://www.example.com';

// The VS sizes were the lead's guess (2.35/2.75/3.35rem; the original's, 3em) — a round to find out.
describe('values a copy is held to, measured', () => {
  it('says a task of a copy whose acceptance names values no check of it measures against the site', () => {
    const [notice] = unmeasuredNotices(
      [
        task('t-vs', [
          'The VS diamond is 2.35rem, with a 1px #c7a86b border',
          { said: 'Whole', check: 'plitzi page check /' }
        ])
      ],
      SITE
    );

    expect(notice).toContain('Task "t-vs" names values (2.35rem, 1px, #c7a86b) no check of it measures');
    expect(notice).toContain(`--compare ${SITE}`);
  });

  it('is quiet for a task that measures, one that names no value, and a plan that copies no site', () => {
    const measured = task('t-vs', [
      'The VS diamond is 3em',
      {
        said: 'As the original',
        check: `plitzi page measure /combates fight-card-vs --compare ${SITE} --there ".vs-medal" --same font-size,border`
      }
    ]);
    const compared = task('t-hero', [
      'A 48px title',
      { said: 'Its dress', check: `plitzi page shot / --compare ${SITE} --dress` }
    ]);

    expect(unmeasuredNotices([measured, compared, task('t-words', ['Reads in Spanish'])], SITE)).toEqual([]);
    expect(unmeasuredNotices([task('t-vs', ['The VS is 2.35rem'])], undefined)).toEqual([]);
  });
});
