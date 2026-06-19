export type DocSearchEntry = {
  slug: string;
  label: string;
  keywords: string[];
  description: string;
};

export const DOCS_SEARCH_INDEX: DocSearchEntry[] = [
  {
    slug: 'getting-started',
    label: 'Getting Started',
    keywords: [
      'install', 'setup', 'quickstart', 'createStoreHook', 'StoreProvider',
      'useStore', 'first store', 'type-safe', 'dot path', 'subscription',
      'initial state', 'create store', 'typescript'
    ],
    description:
      'Installation, first store, typed hooks with createStoreHook, wrapping your tree with StoreProvider, reading and writing state.'
  },
  {
    slug: 'choosing',
    label: 'Choosing the right API',
    keywords: [
      'which', 'choose', 'decision', 'when to use', 'vs', 'difference', 'use case',
      'useStore', 'useStoreGetter', 'useStoreSetter', 'useStoreSync', 'transformer',
      'createDerived', 'useDerived', 'createEntityAdapter', 'createEntityStore',
      'normalized', 'collection', 'map', 'entities', 'scoped', 'storeId', 'inherit',
      'live', 'snapshot', 'useAsync', 'useAsyncValue', 'middleware', 'subscribeChange',
      'beforeChange', 'reactive', 'non-reactive', 'getter', 'setter', 'best practice'
    ],
    description:
      'A decision guide: which nexus API to use for reading, writing, collections, multiple stores, async, and cross-cutting concerns — with the common wrong choices and what they cost.'
  },
  {
    slug: 'api',
    label: 'API Reference',
    keywords: [
      'createStore', 'StoreApi', 'getState', 'getPath', 'setState', 'subscribe',
      'subscribePath', 'subscribeChange', 'destroy', 'createStoreHook',
      'withBase', 'BoundStore', 'base path', 'bound store', 'defaultValue',
      'useStore', 'useStoreSync', 'useStoreGetter', 'useStoreSetter',
      'useStoreById', 'storeId', 'store id', 'named store', 'by id',
      'registry', 'disconnected provider', 'reach ancestor',
      'StoreProvider', 'id', 'inherit', 'live', 'snapshot', 'autoSync',
      'createDerived', 'useDerived', 'createAsync', 'useAsync', 'useAsyncValue',
      'createEntityAdapter', 'createEntityStore', 'useOne', 'useIds', 'useAll', 'normalized', 'middleware', 'persistMiddleware', 'loggerMiddleware',
      'historyMiddleware', 'reduxDevToolsMiddleware', 'beforeChange', 'CANCEL',
      'getStoreHistory', 'useStoreHistory', 'batch', 'PathOf', 'PathValue',
      'scoped store', 'derived', 'entity', 'async', 'suspense', 'time-travel',
      'history', 'memoized', 'computed'
    ],
    description:
      'Full API reference: createStore, hooks, StoreProvider, derived values, async/Suspense, entity adapter, entity store, middleware pipeline, time-travel, and types.'
  },
  {
    slug: 'testing',
    label: 'Testing',
    keywords: [
      'test', 'vitest', 'jest', 'renderHook', 'testing-library', 'store test',
      'component test', 'hook test', 'middleware test', 'mock store',
      'time-travel test', 'getStoreHistory', 'jsdom'
    ],
    description:
      'Testing stores directly, components with StoreProvider, hooks with renderHook, custom middleware, and time-travel with getStoreHistory.'
  },
  {
    slug: 'guides-forms',
    label: 'Forms',
    keywords: [
      'form', 'forms', 'validation', 'field', 'input', 'submit',
      'dirty', 'touched', 'error', 'nested', 'controlled', 'uncontrolled',
      'useStore', 'path', 'line items', 'dynamic array'
    ],
    description:
      'Form patterns: simple fields, dynamic arrays, validation and error tracking, submit and dirty detection with scoped stores.'
  },
  {
    slug: 'guides-data-fetching',
    label: 'Data Fetching',
    keywords: [
      'data fetching', 'fetch', 'API', 'async', 'createAsync', 'useAsync',
      'useAsyncValue', 'Suspense', 'race condition', 'stale request',
      'dependent query', 'mutation', 'POST', 'PUT', 'DELETE', 'loading',
      'error', 'pending'
    ],
    description:
      'Data fetching patterns: createAsync with Suspense, race-condition handling, dependent queries, and mutations (POST/PUT/DELETE).'
  },
  {
    slug: 'frameworks-rsc-ssr',
    label: 'RSC / SSR',
    keywords: [
      'RSC', 'SSR', 'server component', 'server-side rendering', 'hydration',
      'createServerSnapshot', 'isServerSnapshot', 'stripServerFlag',
      'server data', 'seeding', 'middleware hydration', 'deferHydrate',
      'noopStorage', 'use client', 'rsc subpath', 'framework',
      'no use client', 'boundary'
    ],
    description:
      'RSC and SSR patterns: server snapshot markers, seeding data from Server Components, middleware hydration deferral, and the @plitzi/nexus/rsc subpath.'
  },
  {
    slug: 'guides-nextjs',
    label: 'Next.js',
    keywords: [
      'Next.js', 'App Router', 'server component', 'client component',
      'SSR', 'server-side rendering', 'hydration', 'server data',
      'persist', 'cookie', 'Server Action', 'mutation', 'optimistic update',
      'RSC', 'layout', 'provider'
    ],
    description:
      'Next.js integration: App Router with server/client boundaries, hydrating from server data, cookie persistence, and Server Actions with optimistic updates.'
  },
  {
    slug: 'faq',
    label: 'FAQ & Troubleshooting',
    keywords: [
      'faq', 'troubleshooting', 're-render', 'not updating', 'StoreProvider',
      'getState vs getPath', 'batch updates', 'history empty', 'Redux DevTools',
      'scoped store', 'SSR', 'TypeScript', 'performance', 'CSP', 'new Function',
      'setCodegenEnabled', 'recursive fallback', 'no re-render'
    ],
    description:
      'Common questions: re-rendering issues, getState vs getPath, batch, history, Redux DevTools, scoped stores, SSR, CSP and new Function.'
  },
  {
    slug: 'migration',
    label: 'Migration',
    keywords: [
      'migration', 'from Zustand', 'from Redux', 'from RTK', 'from Jotai',
      'from Valtio', 'from MobX', 'from Context', 'selector', 'reducer',
      'action', 'dispatch', 'createSelector', 'createEntityAdapter',
      'atom', 'proxy', 'useSnapshot', 'mobx', 'context api',
      'migrate', 'convert', 'port', 'checklist'
    ],
    description:
      'Migration guides from Zustand, Redux/RTK, Jotai, Valtio, MobX and Context API — mental model shifts and code comparisons.'
  }
];
