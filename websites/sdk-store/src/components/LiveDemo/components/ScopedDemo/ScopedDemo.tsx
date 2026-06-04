import { StoreProvider } from '@plitzi/sdk-store';

import ScopedChild from '../ScopedChild';

const ScopedDemo = () => (
  <div>
    <p className="text-sm leading-relaxed text-zinc-400">
      Two nested scopes derive from the same root, each owning its own{' '}
      <code className="font-mono text-brand-300">theme</code>. Edit <code className="font-mono text-brand-300">user.name</code>{' '}
      or <code className="font-mono text-brand-300">count</code> in Controls:{' '}
      <code className="font-mono text-brand-300">inherit="live"</code> flows through,{' '}
      <code className="font-mono text-brand-300">inherit="snapshot"</code> stays frozen at its mount-time copy. Toggle a
      child’s theme — it’s a local write that shadows the root and never leaks out.
    </p>

    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <StoreProvider inherit="live" value={{ theme: 'light' }} autoSync={false}>
        <ScopedChild mode="live" />
      </StoreProvider>
      <StoreProvider inherit="snapshot" value={{ theme: 'light' }} autoSync={false}>
        <ScopedChild mode="snapshot" />
      </StoreProvider>
    </div>
  </div>
);

export default ScopedDemo;
