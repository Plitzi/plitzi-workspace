# React example

Plain React 19 (Vite). A single `<StoreProvider>` owns the store; components read/write with the typed `useStore`
hook from `createStoreHook<AppState>()`. `persistMiddleware` mirrors to `localStorage`, `historyMiddleware` powers
`useStoreHistory` (undo/redo).

```bash
yarn dev
```

Imports come from two entries:

- `@plitzi/nexus/react` — Provider + hooks (`StoreProvider`, `createStoreHook`, `useStoreHistory`).
- `@plitzi/nexus` — the agnostic middlewares (`persistMiddleware`, `historyMiddleware`).
