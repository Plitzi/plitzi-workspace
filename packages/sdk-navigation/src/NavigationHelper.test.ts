import { pick } from '@plitzi/plitzi-ui/helpers';
import { describe, it, expect } from 'vitest';

import { getPageFullPath, getPaths } from './NavigationHelper';

import type { Schema } from '@plitzi/sdk-shared';

describe('Testing NavigationHelper', () => {
  const pages = [
    '64599fe5e07288d4094abbed',
    '645f2945e07288d4094abbf1',
    '64669d67e07288d4094abbf2',
    '64b0cc5612b6aa7fe0bd6e62',
    '64bba0dbde52766b70ce322c',
    '6500448795e141eac765c372',
    '655606a327a07efc899aabb2',
    '657425e280b5b09c93b4a284',
    '67001330e33d456df96630f4',
    '67091af172e7bddf906e07d7'
  ];
  const schemaFlat = {
    '64599fe5e07288d4094abbed': {
      id: '64599fe5e07288d4094abbed',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: ''
        },
        bindings: undefined,
        interactions: {
          node_65bcebb6ba6a23b040bf4779: {
            id: 'node_65bcebb6ba6a23b040bf4779',
            title: 'New Trigger',
            type: 'trigger',
            action: 'onPageLoad',
            params: {},
            preview: {
              pageId: '',
              routeParams: '',
              queryParams: {
                access_token: ''
              }
            },
            elementId: '64599fe5e07288d4094abbed',
            beforeNode: '',
            afterNode: 'node_65bcebd45b7e990c363f45af',
            flowId: 'node_65bcebb6ba6a23b040bf4779',
            enabled: true,
            when: {
              id: '92682254-d56a-4025-a626-04cfcf3c3744',
              combinator: 'and',
              rules: [
                {
                  id: '46386c6e-a8b6-439d-9e8e-6f46c4c5b9fd',
                  field: 'node_65bcebb6ba6a23b040bf4779.queryParams.access_token',
                  operator: 'notEmpty',
                  value: '',
                  enabled: true
                }
              ]
            }
          },
          node_65bcebd45b7e990c363f45af: {
            id: 'node_65bcebd45b7e990c363f45af',
            title: 'Perform Login',
            type: 'globalCallback',
            action: 'login',
            params: {
              mode: 'token',
              username: '',
              password: '',
              token: '{{ node_65bcebb6ba6a23b040bf4779.queryParams.access_token }}'
            },
            preview: {
              errors: {
                mode: '',
                username: '',
                password: ''
              },
              success: '',
              access_token: '',
              expires_at: '',
              expires_in: '',
              details: {
                id: '',
                username: '',
                email: '',
                verified: '',
                permissions: ''
              }
            },
            elementId: 'user',
            beforeNode: 'node_65bcebb6ba6a23b040bf4779',
            afterNode: 'node_65bd0fd3b00a3cf7f17a2775',
            flowId: 'node_65bcebb6ba6a23b040bf4779',
            enabled: true,
            when: {
              id: '80284c02-f38b-479f-af8d-c898065afe88',
              combinator: 'and',
              rules: [
                {
                  id: '19e9a1ad-4bdd-4724-b55b-cc48fb3222c0',
                  field: 'node_65bcebb6ba6a23b040bf4779.queryParams.access_token',
                  operator: 'notEmpty',
                  value: '',
                  enabled: true
                }
              ]
            }
          },
          node_65bd0fd3b00a3cf7f17a2775: {
            id: 'node_65bd0fd3b00a3cf7f17a2775',
            title: 'New Callback',
            type: 'utility',
            action: 'twigTemplate',
            params: {
              returnMode: 'text',
              template: 'Welcome back {{node_65bcebd45b7e990c363f45af.details.username}}!'
            },
            preview: {
              template: '',
              content: ''
            },
            elementId: 'undefined',
            beforeNode: 'node_65bcebd45b7e990c363f45af',
            afterNode: 'node_65bd0fe646d20be75cccc616',
            flowId: 'node_65bcebb6ba6a23b040bf4779',
            enabled: true
          },
          node_65bd0fe646d20be75cccc616: {
            id: 'node_65bd0fe646d20be75cccc616',
            title: 'New Callback',
            type: 'globalCallback',
            action: 'addNotification',
            params: {
              content: '{{ node_65bd0fd3b00a3cf7f17a2775.content }}',
              placement: 'top-right',
              appeareance: 'success',
              autoDismiss: true,
              autoDismissTimeout: 5000
            },
            preview: {},
            elementId: 'space',
            beforeNode: 'node_65bd0fd3b00a3cf7f17a2775',
            afterNode: '',
            flowId: 'node_65bcebb6ba6a23b040bf4779',
            enabled: true
          }
        },
        parentId: undefined,
        rootId: '64599fe5e07288d4094abbed',
        items: ['6459a23a6bb2deec6c8bd4fe']
      },
      attributes: {
        slug: 'login',
        default: false,
        name: 'Login Page',
        layout: '6459a0233dea81d4c98ee7a9',
        layoutContainer: '6459abbeaf7f4d9e74b9b878',
        userProvider: 'plitzi',
        auth0Domain: '',
        auth0ClientId: '',
        accessLevel: 'public',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '645f2945e07288d4094abbf1',
        folder: '6516b93a960079dafdade5c7',
        seoEnabled: true,
        seoPageTitle: 'Plitzi - Login',
        seoPageDescription: 'Login Page'
      }
    },
    '645f2945e07288d4094abbf1': {
      id: '645f2945e07288d4094abbf1',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: 'page'
        },
        bindings: undefined,
        interactions: {},
        parentId: undefined,
        rootId: '645f2945e07288d4094abbf1',
        items: ['646090965afc9374a32ee03e', '653f7c2a7e4ab0256ece1752', '65a22a91016c0e049647e6de']
      },
      attributes: {
        slug: '',
        default: false,
        name: 'Home - Authenticated',
        layout: '645f5645ef87abd76b9d2a5c',
        layoutContainer: '64608fd1a6c1fccf3bc19fae',
        userProvider: 'plitzi',
        auth0Domain: '',
        auth0ClientId: '',
        accessLevel: 'authenticated',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '64b9102cf6359d8ddeae853c',
        seoEnabled: true,
        keepState: true,
        stateStorage: 'local',
        seoPageTitle: 'Home',
        seoPageDescription: ''
      }
    },
    '64669d67e07288d4094abbf2': {
      id: '64669d67e07288d4094abbf2',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: 'page-LUD1'
        },
        bindings: undefined,
        interactions: {},
        parentId: undefined,
        rootId: '64669d67e07288d4094abbf2',
        items: ['64fd46de946ecbf7def1e09d']
      },
      attributes: {
        slug: ':spaceId/update/*',
        default: false,
        name: 'Space Record Builder',
        layout: '',
        layoutContainer: '',
        userProvider: 'plitzi',
        auth0Domain: '',
        auth0ClientId: '',
        accessLevel: 'authenticated',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '64b9102cf6359d8ddeae853c',
        keepState: true,
        stateStorage: 'local',
        folder: '6516b927960079dafdade5c6',
        seoEnabled: true,
        seoPageTitle: 'Plitzi - Space Builder',
        seoPageDescription: 'Space Builder'
      }
    },
    '64b0cc5612b6aa7fe0bd6e62': {
      id: '64b0cc5612b6aa7fe0bd6e62',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: 'page-ZDXD'
        },
        bindings: undefined,
        interactions: undefined,
        parentId: undefined,
        rootId: '64b0cc5612b6aa7fe0bd6e62',
        items: ['64bca3a02b991e21d981a160']
      },
      attributes: {
        slug: 'demo',
        default: false,
        name: 'Demo',
        layout: '64b911926c7f6d981631266c',
        layoutContainer: '64b911a9d8cd37d813400fdf',
        folder: '67091b0472e7bddf906e07d8',
        enabled: false
      }
    },
    '64bba0dbde52766b70ce322c': {
      id: '64bba0dbde52766b70ce322c',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: ''
        },
        bindings: undefined,
        interactions: {},
        parentId: undefined,
        rootId: '64bba0dbde52766b70ce322c',
        items: ['6562a802fddb6cfc5a9e96e9', '64bba6ba18c98fb0e08905b9', '6545d72295fd266625202c76']
      },
      attributes: {
        slug: ':spaceId',
        default: false,
        name: 'Space Record',
        layout: '645f5645ef87abd76b9d2a5c',
        layoutContainer: '64608fd1a6c1fccf3bc19fae',
        accessLevel: 'authenticated',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '64b9102cf6359d8ddeae853c',
        folder: '6516b927960079dafdade5c6',
        seoEnabled: true,
        seoPageTitle: 'Plitzi - Space Details',
        seoPageDescription: 'Space Details'
      }
    },
    '6500448795e141eac765c372': {
      id: '6500448795e141eac765c372',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: ''
        },
        bindings: undefined,
        interactions: undefined,
        parentId: undefined,
        rootId: '6500448795e141eac765c372',
        items: ['6500449998e11133ea7ffad8']
      },
      attributes: {
        slug: 'signup',
        default: false,
        name: 'Sign Up',
        layout: '6459a0233dea81d4c98ee7a9',
        layoutContainer: '6459abbeaf7f4d9e74b9b878',
        accessLevel: 'public',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        folder: '6516b93a960079dafdade5c7'
      }
    },
    '655606a327a07efc899aabb2': {
      id: '655606a327a07efc899aabb2',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: 'page-Vx4N'
        },
        bindings: undefined,
        interactions: undefined,
        parentId: undefined,
        rootId: '655606a327a07efc899aabb2',
        items: [
          '65560cb0f676bdaf45102c2f',
          '65560c4bc094c9ac7b190323',
          '65560c4c28cad2e3ec68d14a',
          '65560c4dcc88325d42a09442',
          '661922edf3a0453e4479daea'
        ]
      },
      attributes: {
        slug: '',
        default: false,
        name: 'Coming Soon',
        folder: '67091b0472e7bddf906e07d8',
        accessLevel: 'public',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        seoEnabled: true,
        seoPageTitle: 'Plitzi - Coming Soon',
        seoPageDescription: 'Coming Soon',
        enabled: false
      }
    },
    '657425e280b5b09c93b4a284': {
      id: '657425e280b5b09c93b4a284',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: 'page-ihWe'
        },
        bindings: undefined,
        interactions: undefined,
        parentId: undefined,
        rootId: '657425e280b5b09c93b4a284',
        items: ['672a10680e69f90f255f81ed', '672a9fb7d8a5a53321f3f52c', '678226237479ee7d61c55cc2']
      },
      attributes: {
        slug: 'test',
        default: false,
        name: 'Test',
        folder: '67091b0472e7bddf906e07d8',
        layout: '',
        layoutContainer: ''
      }
    },
    '67001330e33d456df96630f4': {
      id: '67001330e33d456df96630f4',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: {
          visibility: true
        },
        styleSelectors: {
          base: ''
        },
        bindings: undefined,
        interactions: undefined,
        parentId: undefined,
        rootId: '67001330e33d456df96630f4',
        items: [
          '67001384f9a7555bcde6a7e7',
          '67001385fd07db2e2fb41bfb',
          '67001386ad042efdce5bb1be',
          '67001387301a6d472dc314d2',
          '670013883b7f3f457aee279e',
          '67001388a2afe134500c7a6d'
        ]
      },
      attributes: {
        slug: '',
        default: true,
        name: 'Home - Guest',
        folder: '',
        enabled: true,
        layout: '',
        layoutContainer: '',
        accessLevel: 'public',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '645f2945e07288d4094abbf1',
        seoEnabled: true,
        seoPageTitle: 'Plitzi',
        seoPageDescription: 'Plitzi - Your Space, but Supercharged'
      }
    },
    '67091af172e7bddf906e07d7': {
      id: '67091af172e7bddf906e07d7',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: 'page-c7mf'
        },
        bindings: undefined,
        interactions: undefined,
        parentId: undefined,
        rootId: '67091af172e7bddf906e07d7',
        items: [
          '67091b25a1b019ff1655c9cc',
          '671dd285d54714c9c1452c05',
          '671dd81251704331a76fbf3b',
          '672882ce72640b4b5386d78c'
        ]
      },
      attributes: {
        slug: '',
        default: false,
        name: 'Guideline',
        folder: '67091b0472e7bddf906e07d8',
        enabled: false
      }
    },
    '679caf7c745d763d2aca2743': {
      id: '679caf7c745d763d2aca2743',
      definition: {
        label: 'Page',
        type: 'page',
        initialState: undefined,
        styleSelectors: {
          base: ''
        },
        bindings: undefined,
        interactions: undefined,
        parentId: undefined,
        rootId: '679caf7c745d763d2aca2743',
        items: []
      },
      attributes: {
        slug: 'test-page',
        default: false,
        name: 'test page nested',
        folder: '679caf6b745d763d2aca2742'
      }
    }
  } as Schema['flat'];
  const pageFolders = [
    {
      id: '6516b927960079dafdade5c6',
      name: 'Spaces',
      slug: 'spaces',
      parentId: ''
    },
    {
      id: '6516b93a960079dafdade5c7',
      name: 'Auth',
      slug: 'auth',
      parentId: ''
    },
    {
      id: '67091b0472e7bddf906e07d8',
      name: 'No Published',
      slug: 'no-published',
      parentId: ''
    },
    {
      id: '679caf48745d763d2aca2741',
      name: 'test 1',
      slug: 'test-1',
      parentId: ''
    },
    {
      id: '679caf6b745d763d2aca2742',
      name: 'test 2',
      slug: 'test-2',
      parentId: '679caf48745d763d2aca2741'
    }
  ];

  it('NavigationHelper getPaths', () => {
    const authenticated = true;
    const basePath = '/';
    const previewMode = false;
    const strictMode = true;

    expect(getPaths(pick(schemaFlat, pages), pageFolders, authenticated, basePath, previewMode, strictMode)).toEqual([
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
      {
        pageId: '67091af172e7bddf906e07d7',
        path: '/no-published/67091af172e7bddf906e07d7',
        enabled: false,
        isRaw: false,
        hasAccess: true,
        accessLevel: undefined,
        unauthorizedBehaviour: undefined,
        unauthorizedPageRedirect: undefined
      },
      {
        pageId: '655606a327a07efc899aabb2',
        path: '/no-published/655606a327a07efc899aabb2',
        accessLevel: 'public',
        enabled: false,
        isRaw: false,
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '',
        hasAccess: true
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

    expect(getPaths(pick(schemaFlat, pages), pageFolders, authenticated, basePath, !previewMode, strictMode)).toEqual([
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

    expect(getPaths(pick(schemaFlat, pages), pageFolders, authenticated, basePath, !previewMode, !strictMode)).toEqual([
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
      },
      {
        accessLevel: 'authenticated',
        enabled: true,
        hasAccess: false,
        isRaw: true,
        pageId: '645f2945e07288d4094abbf1',
        path: '*',
        unauthorizedBehaviour: 'redirect',
        unauthorizedPageRedirect: '/'
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
