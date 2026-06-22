// A cross-island component: it binds to the shared module singleton (`appStore`), NOT to a Provider. Mount this in
// two separate islands and they stay in sync — clicking in one updates the number in the other.
import { useStore } from '@plitzi/nexus/react';

import { appStore } from '../store';

import type { AppState } from '../store';

export default function SharedCounter({ label }: { label: string }) {
  const [count, setCount] = useStore<AppState, 'count'>('count', { store: appStore });

  return (
    <button onClick={() => setCount(n => n + 1)}>
      {label}: {count}
    </button>
  );
}
