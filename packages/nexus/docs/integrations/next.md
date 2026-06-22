# Nexus + Next.js (App Router)

Two pieces:

- `@plitzi/nexus` → `createServerSnapshot` to hand server-fetched data to the client store without a hydration
  mismatch.
- `@plitzi/nexus/next` → `bindServerAction` for optimistic updates backed by a Server Action + revalidation.
- `@plitzi/nexus/react` → the `'use client'` Provider and hooks.

```tsx
// app/page.tsx  (Server Component)
import { StoreProvider } from '@plitzi/nexus/react';
import { createServerSnapshot } from '@plitzi/nexus';
import Likes from './Likes';

export default async function Page() {
  const likes = await getLikes();
  return (
    <StoreProvider value={createServerSnapshot({ likes })}>
      <Likes />
    </StoreProvider>
  );
}
```

```tsx
// app/Likes.tsx
'use client';
import { createStoreHook } from '@plitzi/nexus/react';

const { useStore } = createStoreHook<{ likes: number }>();

export default function Likes() {
  const [likes, setLikes] = useStore('likes');
  return <button onClick={() => setLikes(n => n + 1)}>♥ {likes}</button>;
}
```

Runnable example: [examples/next](../../examples/next).
