import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { stepsOf, tail, unservedProblem, verifyText } from './verify';

import type { CheckReport } from './check';

describe('what verify says of the pages for signed-in visitors', () => {
  const pages = {
    schemes: ['light' as const],
    passing: 12,
    failing: [],
    unchecked: ['/studio', '/write'],
    unanswered: []
  };

  it('says how to have them checked when the project names no account', () => {
    expect(stripVTControlCharacters(verifyText([], { ...pages, signedIn: { none: true } }))).toContain(
      '- not checked — sent elsewhere (a page for signed-in visitors): /studio, /write — name an account of the project in .env, PLITZI_CHECK_USER and PLITZI_CHECK_PASSWORD, and verify signs in for them'
    );
  });

  it('says why the account could not sign in for them', () => {
    expect(
      stripVTControlCharacters(
        verifyText([], { ...pages, signedIn: { problem: 'carla signs in with the password in …' } })
      )
    ).toContain('/studio, /write — carla signs in with the password in …');
  });

  it('counts the checks made signed in, and names what even the account was sent away from', () => {
    const said = stripVTControlCharacters(
      verifyText([], {
        schemes: ['light', 'dark'],
        passing: 22,
        failing: [],
        unchecked: ['/studio/team'],
        unanswered: ['/live'],
        signedIn: { as: 'carla', checks: 10 }
      })
    );

    // Every theme the space can be painted in, said: a page unreadable in the dark one is not a pass in the light one.
    expect(said).toContain('✓ pages — 22 checks at 1440 and 390 px, light and dark, 10 of them signed in as carla');
    expect(said).toContain('- not checked, even signed in as carla: /studio/team — that account may not see them');
    expect(said).toContain('- not checked — nothing answered: /live');
  });

  // A new project, its server not started: verify checked no page and asked for an account in .env.
  it('says a project nothing serves as such, never as pages for signed-in visitors', () => {
    // Only what the check reads of a report — its path, and its issues by code — so the rest is left out.
    const silent = (path: string) =>
      ({
        path,
        ok: false,
        issues: [{ code: 'no-answer', message: `nothing answers at http://127.0.0.1:8080${path}` }]
      }) as unknown as CheckReport;

    expect(unservedProblem([silent('/'), silent('/about')])).toBe(
      'nothing answers at http://127.0.0.1:8080/ — start it (npm start) and verify again, or --no-pages to leave them'
    );
    expect(unservedProblem([silent('/'), { path: '/about', ok: true, issues: [] } as unknown as CheckReport])).toBe(
      undefined
    );
  });
});

describe('the steps verify runs', () => {
  it('runs the project tests when it has a test script, after the lint', () => {
    const steps = stepsOf({ typecheck: 'tsc --noEmit', lint: 'eslint .', test: 'node --test src' });

    expect(steps.map(step => step.name)).toEqual(['typecheck', 'lint', 'test']);
  });

  it('runs no tests for a project with no test script', () => {
    expect(stepsOf({ lint: 'eslint .' }).map(step => step.name)).toEqual(['lint']);
  });
});

// The run's finish said a line failed and showed only what passed: the failure was above its last 15 lines.
describe('what a failed step says', () => {
  it('keeps the lines that say what failed, in their place, and as much of the end as fits', () => {
    const output = [
      '✗ / at 1440 px — 3 issues',
      '  - an image never loaded: https://cdn.example.com/a.webp',
      ...Array.from({ length: 20 }, (_, index) => `  · read ${String(index)}`),
      '✓ / at 390 px — nothing wrong'
    ].join('\n');

    const said = tail(output);
    expect(said).toHaveLength(15);
    expect(said.slice(0, 2)).toEqual([
      '✗ / at 1440 px — 3 issues',
      '  - an image never loaded: https://cdn.example.com/a.webp'
    ]);
    expect(said.at(-1)).toBe('✓ / at 390 px — nothing wrong');
    expect(tail('one\n\ntwo')).toEqual(['one', 'two']);
  });
});
