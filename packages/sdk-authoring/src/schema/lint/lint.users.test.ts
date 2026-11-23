import { describe, expect, it } from 'vitest';

import { account, authorSpace, lintSpace } from '../../index';

import type { ElementSpec } from '../types';

const spaceWith = (userProvider: 'basic' | 'server', ...body: ElementSpec[]) =>
  authorSpace({
    name: 'Members',
    permanentUrl: 'members',
    settings: { userProvider },
    pages: [{ name: 'Home', slug: '', body }]
  });

const warnings = (documents: ReturnType<typeof authorSpace>) => lintSpace(documents).warnings.map(issue => issue.code);

describe('lintSpace — users', () => {
  it('account-sign-in-unreachable: a space that signs in with a password, and nowhere to type it', () => {
    expect(warnings(spaceWith('basic', account()))).toContain('account-sign-in-unreachable');
    expect(warnings(spaceWith('basic', account({ signInHref: '/sign-in' })))).not.toContain(
      'account-sign-in-unreachable'
    );
    expect(warnings(spaceWith('server', account()))).not.toContain('account-sign-in-unreachable');
  });
});
