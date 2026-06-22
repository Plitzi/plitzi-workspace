# Next.js (App Router) example

Server → client state handoff with `createServerSnapshot` (`@plitzi/nexus`) and the `'use client'` Provider +
hooks from `@plitzi/nexus/react`.

- [`app/page.tsx`](./app/page.tsx) — Server Component: fetches on the server, wraps the data in `createServerSnapshot`
  so the client store hydrates cleanly.
- [`app/Likes.tsx`](./app/Likes.tsx) — Client Component: reads/writes with `useStore`.

For optimistic updates backed by a Server Action, see `bindServerAction` from `@plitzi/nexus/next`.

```bash
yarn dev
```
