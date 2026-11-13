import { describe, expect, it } from 'vitest';

import { folderProtection, pageProtection } from './protection';

import type { Element, PageFolder } from '@plitzi/sdk-shared';

const page = (id: string, attributes: Record<string, unknown>): Element => ({
  id,
  attributes,
  definition: { rootId: id, label: id, type: 'page', items: [], styleSelectors: { base: '' } }
});

describe('a page’s lock', () => {
  it('says who a protected page is for, and nothing of one anybody may open', () => {
    expect(pageProtection({ accessLevel: 'authenticated' })?.says).toBe('Only for signed-in visitors');
    expect(pageProtection({ access: { permissions: ['billing', 'admin'] } })?.says).toBe(
      'Only for visitors with billing, admin'
    );
    expect(pageProtection({ accessLevel: 'authenticated', unauthorizedBehaviour: 'notFound' })?.says).toBe(
      'Only for signed-in visitors — a 404 to everyone else'
    );
    expect(pageProtection({ accessLevel: 'all' })).toBeUndefined();
    expect(pageProtection({})).toBeUndefined();
  });
});

describe('a folder’s lock', () => {
  const folders: PageFolder[] = [
    { id: 'console', name: 'Console', slug: 'console' },
    { id: 'billing', name: 'Billing', slug: 'billing', parentId: 'console' },
    { id: 'blog', name: 'Blog', slug: 'blog' }
  ];
  const signedIn = { accessLevel: 'authenticated' };

  it('is whole when every page in it — in its folders too — is protected', () => {
    const elements = [
      page('home', { folder: 'console', ...signedIn }),
      page('invoices', { folder: 'billing', access: { permissions: ['billing'] } })
    ];

    expect(folderProtection('console', folders, elements)).toEqual({
      says: 'Every page in it is protected (2)',
      whole: true
    });
  });

  it('says how many when only some are, and nothing when none are or it has no pages', () => {
    const elements = [
      page('home', { folder: 'console', ...signedIn }),
      page('invoices', { folder: 'billing' }),
      page('post', { folder: 'blog' })
    ];

    expect(folderProtection('console', folders, elements)).toEqual({
      says: '1 of its 2 pages are protected',
      whole: false
    });
    expect(folderProtection('blog', folders, elements)).toBeUndefined();
    expect(folderProtection('billing', folders, [])).toBeUndefined();
  });
});
