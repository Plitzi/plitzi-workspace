import CodeBlock from '../../../CodeBlock';

const NextGuide = () => (
  <>
    <h2>Next.js (App Router)</h2>
    <p>
      Use <code>createServerSnapshot</code> (core) to hand server-fetched data to the client store without a hydration
      mismatch, and the <code>'use client'</code> Provider + hooks from <code>@plitzi/nexus/react</code>.
    </p>
    <CodeBlock language="bash" code={`npm install @plitzi/nexus   # peer: react, react-dom`} />

    <CodeBlock
      code={`// app/page.tsx — Server Component
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
}`}
    />
    <CodeBlock
      code={`// app/Likes.tsx
'use client';
import { createStoreHook } from '@plitzi/nexus/react';

const { useStore } = createStoreHook<{ likes: number }>();

export default function Likes() {
  const [likes, setLikes] = useStore('likes');

  return <button onClick={() => setLikes(n => n + 1)}>♥ {likes}</button>;
}`}
    />
    <p>
      For optimistic updates backed by a Server Action, see <code>bindServerAction</code> from{' '}
      <code>@plitzi/nexus/next</code>.
    </p>
  </>
);

export default NextGuide;
