import CodeBlock from '../../../CodeBlock';
import Prose from '../../Prose';

const RscSsr = () => (
  <Prose>
    <p>
      <code>@plitzi/nexus</code> is designed to work with React Server Components and server-side rendering
      without leaks or hydration mismatches. The core patterns are framework-agnostic — the same primitives
      work in Next.js App Router, Remix, or any RSC-compatible setup.
    </p>

    <h2 id="ssr-safety">How SSR safety works</h2>
    <p>
      Every reactive hook (<code>useStore</code>, etc.) uses React's built-in{' '}
      <code>useSyncExternalStore</code> — the standard SSR-safe mechanism. On the server it reads the store
      snapshot directly; on the client it subscribes to changes after hydration.
    </p>
    <p>
      <code>useStoreSync</code> uses <code>useIsomorphicLayoutEffect</code>: <code>useLayoutEffect</code> on
      the client, <code>useEffect</code> on the server. No warnings, no double-renders.
    </p>
    <p>
      The package does <strong>not</strong> include <code>'use client'</code> directives. You add the client
      boundary in your own component — this gives you full control over where the split happens.
    </p>

    <h2 id="seeding">Seeding data from the server</h2>
    <p>
      Server components fetch data, pass it to <code>StoreProvider</code> as the initial value, and client
      components read it reactively — no API round-trip on first paint.
    </p>
    <CodeBlock
      code={`// Server Component — fetches data, seeds the provider
import { createServerSnapshot } from '@plitzi/nexus/rsc';
import { StoreProvider } from '@plitzi/nexus';

async function Page() {
  const data = await fetch('https://api.example.com/user');
  const user = await data.json();

  return (
    <StoreProvider value={createServerSnapshot({ user })}>
      <Profile />
    </StoreProvider>
  );
}

// Client Component — reads the seeded data
'use client';
import { useStore } from '@plitzi/nexus';

function Profile() {
  const [user] = useStore('user');
  return <h1>{user.name}</h1>;
}`}
      demoId="rsc-seed"
    />

    <h2 id="server-snapshot">createServerSnapshot</h2>
    <p>
      Wrapping server data with <code>createServerSnapshot</code> marks it with a non-enumerable Symbol.
      <code>StoreProvider</code> detects the flag and strips it during initialization. The flag is invisible
      in spreads, <code>JSON.stringify</code>, and <code>Object.keys</code> — purely a marker.
    </p>
    <CodeBlock
      code={`import { createServerSnapshot, isServerSnapshot, stripServerFlag } from '@plitzi/nexus/rsc';

const data = { count: 42, user: 'Alice' };
const snapshot = createServerSnapshot(data);

isServerSnapshot(snapshot);  // true
JSON.stringify(snapshot);    // '{"count":42,"user":"Alice"}'
{ ...snapshot }              // { count: 42, user: 'Alice' } — flag stripped by spread

// strip the flag explicitly if you need a plain object
const plain = stripServerFlag(snapshot);
isServerSnapshot(plain);     // false`}
      demoId="rsc-snapshot"
    />

    <h2 id="middleware-hydration">Middleware hydration in SSR</h2>
    <p>
      Persist and other middlewares that depend on browser APIs (like <code>localStorage</code>) use a
      <code>noopStorage</code> fallback during SSR — <code>getItem</code> returns <code>null</code>,
      <code>setItem</code> is a no-op. Real hydration is deferred to a <code>useEffect</code> after React
      hydration completes, preventing mismatches.
    </p>
    <CodeBlock
      code={`import { createStore, persistMiddleware } from '@plitzi/nexus';

// On the server: noopStorage is used (localStorage is undefined).
// On the client: hydration runs after first paint — no mismatch.
const store = createStore<State>(initial, {
  middlewares: [
    persistMiddleware({ key: 'app-state' })
  ]
});

// StoreProvider does this automatically — deferHydrate is set internally.
// standalone usage: createStore() runs hydrate synchronously by default.`}
    />

    <h2 id="subpath">@plitzi/nexus/rsc — RSC subpath</h2>
    <p>
      Server-safe utilities live under <code>@plitzi/nexus/rsc</code>. These functions have no React
      dependencies — safe to import from any Server Component.
    </p>
    <table>
      <thead>
        <tr>
          <th>Export</th>
          <th>Purpose</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>createServerSnapshot(data)</code></td>
          <td>Mark server-fetched data with the SSR flag</td>
        </tr>
        <tr>
          <td><code>isServerSnapshot(value)</code></td>
          <td>Check if a value has the SSR flag</td>
        </tr>
        <tr>
          <td><code>stripServerFlag(value)</code></td>
          <td>Remove the SSR flag (returns a plain copy)</td>
        </tr>
      </tbody>
    </table>
    <p>
      The main <code>@plitzi/nexus</code> entry exports hooks, <code>StoreProvider</code>, middleware, and
      other client code — always import from a <code>'use client'</code> boundary.
    </p>

    <h2 id="no-use-client">Why no 'use client' in the package</h2>
    <p>
      The package deliberately omits <code>'use client'</code> directives. This lets you:
    </p>
    <ul>
      <li>Import types and the <code>rsc</code> subpath from Server Components</li>
      <li>Choose your own client boundary — colocate it where it makes sense for your app</li>
      <li>Avoid forcing every consumer into a single boundary strategy</li>
    </ul>
    <CodeBlock
      code={`// ✅ Server Component — safe, only imports from @plitzi/nexus/rsc
import { createServerSnapshot } from '@plitzi/nexus/rsc';

// ✅ Client boundary in YOUR code
// app/providers.tsx
'use client';
import { StoreProvider, createStoreHook } from '@plitzi/nexus';
export const { useStore } = createStoreHook<AppState>();
// ...`}
    />
  </Prose>
);

export default RscSsr;
