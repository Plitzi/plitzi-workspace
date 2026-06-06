import type { PageMeta } from './useMeta';

export const DOCS_META: Record<string, PageMeta> = {
  'getting-started': {
    title: 'Getting Started',
    description:
      'Install @plitzi/nexus, create your first store with createStoreHook, wrap your tree with StoreProvider, and read/write by dot-path — all fully type-safe.'
  },
  api: {
    title: 'API Reference',
    description:
      'Full API reference for createStore, createStoreHook, useStore, StoreProvider, createDerived, createAsync, createEntityAdapter, middleware, and type utilities — every signature in one place.'
  },
  'guides-forms': {
    title: 'Patterns: Forms',
    description:
      'Form patterns with @plitzi/nexus: simple fields, dynamic arrays with per-row subscriptions, validation and error tracking in separate paths, submit handling and dirty detection.'
  },
  'guides-data-fetching': {
    title: 'Patterns: Data Fetching',
    description:
      'Data fetching with @plitzi/nexus: createAsync with Suspense, automatic race-condition handling, dependent queries, and mutations (POST/PUT/DELETE).'
  },
  'guides-nextjs': {
    title: 'Patterns: Next.js',
    description:
      'Next.js integration with @plitzi/nexus: App Router with server/client boundaries, hydration from server components, cookie persistence, and Server Actions with optimistic updates.'
  },
  migration: {
    title: 'Migration',
    description:
      'Migrate to @plitzi/nexus from Zustand, Redux/RTK, Jotai, Valtio, MobX, or React Context. Side-by-side code comparisons covering selectors, actions, derived values, and middleware.'
  },
  testing: {
    title: 'Testing',
    description:
      'Test @plitzi/nexus stores directly, test components with StoreProvider wrappers, test hooks with renderHook, test custom middleware interceptions, and test time-travel with getStoreHistory.'
  },
  faq: {
    title: 'FAQ & Troubleshooting',
    description:
      'Common questions about @plitzi/nexus: re-rendering not happening, getState vs getPath, batch updates, empty history panel, Redux DevTools, scoped stores, SSR, CSP and new Function.'
  }
};
