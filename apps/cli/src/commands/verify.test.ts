import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import { stepsOf, verifyText } from './verify';

describe('what verify says of the pages for signed-in visitors', () => {
  const pages = { schemes: ['light' as const], passing: 12, failing: [], unchecked: ['/studio', '/write'] };

  it('says how to have them checked when the project names no account', () => {
    expect(stripVTControlCharacters(verifyText([], { ...pages, signedIn: { none: true } }))).toContain(
      '- not checked — sent elsewhere (a page for signed-in visitors) or not answered: /studio, /write — name an account of the project in .env, PLITZI_CHECK_USER and PLITZI_CHECK_PASSWORD, and verify signs in for them'
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
        signedIn: { as: 'carla', checks: 10 }
      })
    );

    // Every theme the space can be painted in, said: a page unreadable in the dark one is not a pass in the light one.
    expect(said).toContain('✓ pages — 22 checks at 1440 and 390 px, light and dark, 10 of them signed in as carla');
    expect(said).toContain('- not checked, even signed in as carla: /studio/team — that account may not see them');
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
