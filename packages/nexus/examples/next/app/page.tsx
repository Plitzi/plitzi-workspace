// Server Component (App Router): fetch on the server, hand the data to the client through `createServerSnapshot` so
// the StoreProvider hydrates without a flash or a mismatch.
import { StoreProvider } from '@plitzi/nexus/react';
import { createServerSnapshot } from '@plitzi/nexus';

import Likes from './Likes';

export type PageState = { likes: number };

export default async function Page() {
  const likes = await Promise.resolve(42); // stand-in for a real fetch

  return (
    <StoreProvider value={createServerSnapshot({ likes })}>
      <Likes />
    </StoreProvider>
  );
}
