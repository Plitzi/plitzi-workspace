import { useCallback, useState } from 'react';

import { useDemoStore, useDemoSync } from '../../demoStore';

import type { ChangeEvent } from 'react';

const SyncDemo = () => {
  const [external, setExternal] = useState(50);

  // Write-only: push the external React value INTO the store on every render.
  useDemoSync('synced', external);

  const [stored] = useDemoStore('synced');

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => setExternal(Number(event.target.value)), []);

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-zinc-500">
        Drag the slider — its React value is mirrored into the store, no subscription, no setter call.
      </p>

      <input type="range" min={0} max={100} value={external} onChange={handleChange} className="w-full accent-brand-500" />

      <dl className="space-y-1.5 font-mono text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-zinc-500">external (React)</dt>
          <dd className="text-white">{external}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-zinc-500">store.synced</dt>
          <dd className="text-brand-300">{stored}</dd>
        </div>
      </dl>
    </div>
  );
};

export default SyncDemo;
