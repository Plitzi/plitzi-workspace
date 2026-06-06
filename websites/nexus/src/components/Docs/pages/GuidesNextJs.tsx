import CodeBlock from '../../CodeBlock';
import Prose from '../Prose';

const GuidesNextJs = () => (
  <Prose>
    <p>
      @plitzi/nexus works with Next.js (both Pages and App Router) without special configuration. The store is SSR-safe by
      default — <code>useSyncExternalStore</code> with isomorphic layout effects and snapshot getters keep it server-safe
      out of the box.
    </p>

    <h2 id="app-router">App Router (server components)</h2>
    <p>
      The store and hooks are client code (they need React context and <code>useSyncExternalStore</code>). Keep the store
      setup in a <code>store.ts</code> file and the hooks in <code>'use client'</code> components close to where they
      read or write.
    </p>
    <CodeBlock
      code={`// app/store.ts  — shared types and factory (no 'use client' needed for types)
export type AppState = {
  cart: { items: CartItem[]; total: number };
  user: User | null;
  ui: { sidebar: boolean; theme: 'light' | 'dark' };
};

// app/providers.tsx — 'use client' boundary
'use client';

import { createStoreHook, StoreProvider } from '@plitzi/nexus';

export const { useStore, useStoreGetter, useStoreSetter } =
  createStoreHook<AppState>();

export function StoreProviders({ children, initialState }: {
  children: ReactNode;
  initialState: AppState;
}) {
  return (
    <StoreProvider value={initialState}>
      {children}
    </StoreProvider>
  );
}

// app/layout.tsx — wrap the root layout
import { StoreProviders } from './providers';

export default function RootLayout({ children }: { children: ReactNode }) {
  // Hydrate from API or cookies; server-render with sensible defaults.
  const initialState = { cart: { items: [], total: 0 }, user: null, ui: { sidebar: false, theme: 'light' } };

  return (
    <html>
      <body>
        <StoreProviders initialState={initialState}>
          {children}
        </StoreProviders>
      </body>
    </html>
  );
}`}
      demoId="nextjs-app-router"
    />

    <h2 id="server-data">Hydrating from server data</h2>
    <p>
      Pass server-fetched data as the initial value to <code>StoreProvider</code>. Async server components fetch the
      data, the provider seeds the store, and client components read it reactively — no API round-trip needed on first
      paint.
    </p>
    <CodeBlock
      code={`// app/dashboard/page.tsx — server component
import { StoreProviders } from '../providers';

async function DashboardPage() {
  const [user, orders] = await Promise.all([
    fetch(API + '/me').then(r => r.json()),
    fetch(API + '/orders').then(r => r.json()),
  ]);

  const initialState = { user, cart: { items: orders, total: calcTotal(orders) }, ui: { sidebar: false, theme: 'light' } };

  return (
    <StoreProviders initialState={initialState}>
      <DashboardClient />
    </StoreProviders>
  );
}

// app/dashboard/DashboardClient.tsx — 'use client'
'use client';

import { useStore } from '../providers';

function DashboardClient() {
  const [user] = useStore('user');        // seeded from server, reactive on client
  const [items] = useStore('cart.items'); // ditto

  return (
    <>
      <h1>Welcome, {user.name}</h1>
      <OrderList items={items} />
    </>
  );
}`}
      demoId="nextjs-hydrate"
    />

    <h2 id="persistence">Client persistence with cookies</h2>
    <p>
      Use the <code>persistMiddleware</code> with a custom storage adapter that reads/writes cookies (or localStorage on
      the client). On SSR the middleware falls back to a no-op storage automatically.
    </p>
    <CodeBlock
      code={`// lib/cookieStorage.ts
export const cookieStorage = {
  getItem: (key: string) => {
    if (typeof document === 'undefined') return null;       // SSR
    return document.cookie
      .split('; ')
      .find(row => row.startsWith(key + '='))
      ?.split('=')[1] ?? null;
  },
  setItem: (key: string, value: string) => {
    document.cookie = \`\${key}=\${value}; path=/; max-age=31536000\`;
  },
  removeItem: (key: string) => {
    document.cookie = \`\${key}=; path=/; max-age=0\`;
  },
};

// app/providers.tsx
import { persistMiddleware } from '@plitzi/nexus';

export function StoreProviders({ children, initialState }) {
  return (
    <StoreProvider
      value={initialState}
      middlewares={[persistMiddleware({ key: 'app-state', storage: cookieStorage })]}
    >
      {children}
    </StoreProvider>
  );
}`}
      demoId="nextjs-persist"
    />

    <h2 id="server-actions">Server Actions &amp; mutations</h2>
    <p>
      Server Actions can re-seed the store by returning fresh state that the client reads from the server response. For
      optimistic updates, write optimistically to the store and revert on error — the granular path subscription means
      only the affected component updates.
    </p>
    <CodeBlock
      code={`// app/actions.ts
'use server';

export async function updateName(formData: FormData) {
  const name = formData.get('name') as string;
  const updated = await api.updateUser({ name });
  return { ok: true, user: updated };
}

// app/profile/ProfileForm.tsx
'use client';

import { useStore } from '../providers';

function ProfileForm() {
  const [user, setUser] = useStore('user');
  const prevRef = useRef(user);

  const handleSubmit = useCallback(async (formData: FormData) => {
    const name = formData.get('name') as string;

    // Optimistic update
    setUser({ ...user, name });

    const res = await updateName(formData);
    if (!res.ok) {
      setUser(prevRef.current); // revert
    } else {
      prevRef.current = res.user;
      setUser(res.user); // server-confirmed value
    }
  }, [user, setUser]);

  return (
    <form action={handleSubmit}>
      <input name="name" defaultValue={user.name} />
      <button type="submit">Save</button>
    </form>
  );
}`}
      demoId="nextjs-actions"
    />
  </Prose>
);

export default GuidesNextJs;
