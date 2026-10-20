import { pick } from '@plitzi/plitzi-ui/helpers';
import { describe, it, expect } from 'vitest';

import { getPageFullPath, getPaths } from './NavigationHelper';
import { pageFolders, pages, schemaFlat } from './tests/NavigationHelper';

describe('Testing NavigationHelper', () => {
  it('NavigationHelper getPaths', () => {
    const authenticated = true;
    const basePath = '/';
    const previewMode = false;

    expect(getPaths(pick(schemaFlat, pages), pageFolders, authenticated, basePath, previewMode)).toEqual([
      {
        pageId: '64669d67e07288d4094abbf2',
        path: '/spaces/:spaceId/update/*',
        accessLevel: 'authenticated',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true
      },
      {
        pageId: '64bba0dbde52766b70ce322c',
        path: '/spaces/:spaceId',
        accessLevel: 'authenticated',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true
      },
      {
        pageId: '657425e280b5b09c93b4a284',
        path: '/no-published/test',
        accessLevel: undefined,
        enabled: true,
        isRaw: false,
        hasAccess: true,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      {
        pageId: '64b0cc5612b6aa7fe0bd6e62',
        path: '/no-published/demo',
        enabled: false,
        isRaw: false,
        hasAccess: true,
        accessLevel: undefined,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      // Neither has a slug, so both answer at the folder itself.
      {
        pageId: '655606a327a07efc899aabb2',
        path: '/no-published',
        accessLevel: 'public',
        enabled: false,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        hasAccess: true
      },
      {
        pageId: '67091af172e7bddf906e07d7',
        path: '/no-published',
        enabled: false,
        isRaw: false,
        hasAccess: true,
        accessLevel: undefined,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      {
        pageId: '6500448795e141eac765c372',
        path: '/auth/signup',
        accessLevel: 'public',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        hasAccess: true
      },
      {
        pageId: '64599fe5e07288d4094abbed',
        path: '/auth/login',
        accessLevel: 'public',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/',
        hasAccess: true
      },
      {
        pageId: '67091af172e7bddf906e07d7',
        path: '/67091af172e7bddf906e07d7',
        enabled: false,
        isRaw: true,
        hasAccess: true,
        accessLevel: undefined,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      {
        pageId: '67001330e33d456df96630f4',
        path: '/67001330e33d456df96630f4',
        accessLevel: 'public',
        enabled: true,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/',
        hasAccess: true
      },
      {
        pageId: '657425e280b5b09c93b4a284',
        path: '/657425e280b5b09c93b4a284',
        isRaw: true,
        hasAccess: true,
        enabled: true,
        accessLevel: undefined,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      {
        pageId: '655606a327a07efc899aabb2',
        path: '/655606a327a07efc899aabb2',
        accessLevel: 'public',
        enabled: false,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        hasAccess: true
      },
      {
        pageId: '6500448795e141eac765c372',
        path: '/6500448795e141eac765c372',
        accessLevel: 'public',
        enabled: true,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        hasAccess: true
      },
      {
        pageId: '64bba0dbde52766b70ce322c',
        path: '/64bba0dbde52766b70ce322c',
        accessLevel: 'authenticated',
        enabled: true,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true
      },
      {
        pageId: '64b0cc5612b6aa7fe0bd6e62',
        path: '/64b0cc5612b6aa7fe0bd6e62',
        enabled: false,
        isRaw: true,
        hasAccess: true,
        accessLevel: undefined,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      {
        pageId: '64669d67e07288d4094abbf2',
        path: '/64669d67e07288d4094abbf2',
        accessLevel: 'authenticated',
        enabled: true,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true
      },
      {
        pageId: '645f2945e07288d4094abbf1',
        path: '/645f2945e07288d4094abbf1',
        accessLevel: 'authenticated',
        enabled: true,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true
      },
      {
        pageId: '64599fe5e07288d4094abbed',
        path: '/64599fe5e07288d4094abbed',
        accessLevel: 'public',
        enabled: true,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/',
        hasAccess: true
      },
      {
        pageId: '645f2945e07288d4094abbf1',
        path: '/',
        accessLevel: 'authenticated',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true
      },
      {
        pageId: '67001330e33d456df96630f4',
        path: '/',
        accessLevel: 'public',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/',
        hasAccess: true
      }
    ]);

    expect(getPaths(pick(schemaFlat, pages), pageFolders, authenticated, basePath, !previewMode)).toEqual([
      {
        pageId: '64669d67e07288d4094abbf2',
        path: '/spaces/:spaceId/update/*',
        accessLevel: 'authenticated',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true
      },
      {
        pageId: '64bba0dbde52766b70ce322c',
        path: '/spaces/:spaceId',
        accessLevel: 'authenticated',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true
      },
      {
        accessLevel: undefined,
        enabled: true,
        pageId: '657425e280b5b09c93b4a284',
        path: '/no-published/test',
        isRaw: false,
        hasAccess: true,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      {
        pageId: '6500448795e141eac765c372',
        path: '/auth/signup',
        accessLevel: 'public',
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        hasAccess: false,
        enabled: true
      },
      {
        pageId: '64599fe5e07288d4094abbed',
        path: '/auth/login',
        accessLevel: 'public',
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/',
        hasAccess: false,
        enabled: true
      },
      {
        pageId: '67001330e33d456df96630f4',
        path: '/67001330e33d456df96630f4',
        accessLevel: 'public',
        enabled: true,
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/',
        hasAccess: false
      },
      {
        pageId: '657425e280b5b09c93b4a284',
        path: '/657425e280b5b09c93b4a284',
        isRaw: true,
        hasAccess: true,
        accessLevel: undefined,
        enabled: true,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      {
        pageId: '6500448795e141eac765c372',
        path: '/6500448795e141eac765c372',
        accessLevel: 'public',
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        hasAccess: false,
        enabled: true
      },
      {
        pageId: '64bba0dbde52766b70ce322c',
        path: '/64bba0dbde52766b70ce322c',
        accessLevel: 'authenticated',
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true,
        enabled: true
      },
      {
        pageId: '64669d67e07288d4094abbf2',
        path: '/64669d67e07288d4094abbf2',
        accessLevel: 'authenticated',
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true,
        enabled: true
      },
      {
        pageId: '645f2945e07288d4094abbf1',
        path: '/645f2945e07288d4094abbf1',
        accessLevel: 'authenticated',
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true,
        enabled: true
      },
      {
        pageId: '64599fe5e07288d4094abbed',
        path: '/64599fe5e07288d4094abbed',
        accessLevel: 'public',
        isRaw: true,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/',
        hasAccess: false,
        enabled: true
      },
      {
        pageId: '645f2945e07288d4094abbf1',
        path: '/',
        accessLevel: 'authenticated',
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/64b9102cf6359d8ddeae853c',
        hasAccess: true,
        enabled: true
      },
      {
        pageId: '67001330e33d456df96630f4',
        path: '/',
        accessLevel: 'public',
        enabled: true,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/',
        hasAccess: false
      }
    ]);
  });
  it('NavigationHelper getPageFullPath', () => {
    expect(getPageFullPath(schemaFlat, pageFolders, '645f2945e07288d4094abbf1', true)).toEqual('/');
    expect(getPageFullPath(schemaFlat, pageFolders, '64b0cc5612b6aa7fe0bd6e62', true)).toEqual('/no-published/demo');
    expect(getPageFullPath(schemaFlat, pageFolders, '6500448795e141eac765c372', true)).toEqual('/auth/signup');
    expect(getPageFullPath(schemaFlat, pageFolders, '679caf7c745d763d2aca2743', true)).toEqual(
      '/test-1/test-2/test-page'
    );
  });
});
