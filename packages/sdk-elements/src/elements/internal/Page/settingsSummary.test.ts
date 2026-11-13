import { describe, expect, it } from 'vitest';

import { accessHelp, accessSummary, isRestricted, scrollOf, seoSummary } from './settingsSummary';

import type { AccessSettings } from './settingsSummary';

const open: AccessSettings = { accessLevel: '', permissions: [], unauthorizedBehaviour: '', redirectName: '' };

describe('the page settings’ headers', () => {
  it('say who a page is for, and what anybody else gets', () => {
    expect(accessSummary(open)).toBe('Anyone');
    expect(accessSummary({ ...open, accessLevel: 'public' })).toBe('Signed-out visitors only');
    expect(accessSummary({ ...open, accessLevel: 'authenticated', unauthorizedBehaviour: 'notFound' })).toBe(
      'Signed-in visitors · 404 to others'
    );
    expect(
      accessSummary({ ...open, permissions: ['billing'], unauthorizedBehaviour: 'redirect', redirectName: 'Sign in' })
    ).toBe('Needs billing · others to Sign in');
  });

  it('draw a restricted page’s access in the accent, and say how it scrolls and whether it is searched', () => {
    expect(isRestricted(open)).toBe(false);
    expect(isRestricted({ ...open, permissions: ['admin'] })).toBe(true);
    expect(scrollOf('').label).toBe('Scrolls');
    expect(scrollOf('locked').label).toBe('Locked');
    expect(seoSummary(false, 'Pricing')).toBe('Off');
    expect(seoSummary(true, 'Pricing')).toBe('Pricing');
  });

  it('help with the state the fields are in, never every state', () => {
    expect(accessHelp(open)).toBe('Anyone on the internet can open this page.');
    expect(accessHelp({ ...open, accessLevel: 'public' })).toBe(
      'Only visitors who are not signed in can open this page.'
    );
    expect(accessHelp({ ...open, accessLevel: 'authenticated' })).toContain('answered 401 or 403');
    expect(accessHelp({ ...open, permissions: ['billing'], unauthorizedBehaviour: 'notFound' })).toContain(
      'not its name nor its path'
    );
  });
});
