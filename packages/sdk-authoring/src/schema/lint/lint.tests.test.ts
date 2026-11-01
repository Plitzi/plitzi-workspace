import { describe, expect, it } from 'vitest';

import { button, text } from '../../elements';
import { e2e } from '../../testing/e2e';
import { unit } from '../../testing/unit';
import { authorSpace } from '../space';

/** A space whose tests name what it has — or, once changed, what it no longer has. */
const shop = (cta: string) =>
  authorSpace({
    name: 'Shop',
    permanentUrl: 'shop',
    pages: [{ name: 'Home', slug: '', body: [button({ id: cta, content: 'Buy' }), text('0', { id: 'count' })] }],
    tests: {
      unit: [unit.test({ id: 'count-shows', title: 'The count shows', element: 'count', expect: [unit.visible()] })],
      e2e: [
        e2e.test({
          id: 'buys',
          title: 'A visitor buys',
          page: '/',
          steps: [e2e.click('buy'), e2e.expectShown('count')]
        })
      ]
    }
  });

describe('the space’s own tests, read with the rest of it', () => {
  it('says nothing of tests that read the space as it is', () => {
    expect(shop('buy').warnings.filter(issue => issue.code === 'test-unreadable')).toEqual([]);
  });

  it('test-unreadable: a test the space no longer answers — an element renamed — said as a warning, with what is wrong', () => {
    expect(shop('purchase').warnings.filter(issue => issue.code === 'test-unreadable')).toEqual([
      expect.objectContaining({
        message: 'e2e test "buys", step 1 (click): no element "buy" in the space — name one by its id'
      })
    ]);
  });

  it('test-account-role-gone: a test account holding a role the space removed — warned, and played without it', () => {
    const { warnings } = authorSpace({
      name: 'Console',
      permanentUrl: 'console',
      settings: { visitorRoles: { editor: ['spaceEdit'] } },
      pages: [{ name: 'Home', slug: '', body: [text('Hi', { id: 'hi' })] }],
      tests: { accounts: [e2e.account({ id: 'reviewer', roles: ['editor', 'reviewer'] })] }
    });

    expect(warnings.filter(issue => issue.code === 'test-account-role-gone')).toEqual([
      expect.objectContaining({ message: expect.stringContaining('the space has no role "reviewer"') as unknown })
    ]);
  });

  it('journey-start-access: a journey played as a guest on a page for signed-in visitors — warned, never refused', () => {
    const { warnings } = authorSpace({
      name: 'Console',
      permanentUrl: 'console',
      pages: [
        { name: 'Home', slug: '', body: [text('Hi', { id: 'hi' })] },
        { name: 'Account', slug: 'account', accessLevel: 'authenticated', body: [text('Yours', { id: 'yours' })] }
      ],
      tests: { e2e: [e2e.test({ id: 'yours', title: 'Yours', page: '/account', steps: [e2e.expectShown('yours')] })] }
    });

    expect(warnings.filter(issue => issue.code === 'journey-start-access')).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('as a guest, and that page is for signed-in visitors') as unknown
      })
    ]);
  });
});
