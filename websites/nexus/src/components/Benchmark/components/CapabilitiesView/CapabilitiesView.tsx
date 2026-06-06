import ComparisonTable from '../ComparisonTable';

const CapabilitiesView = () => (
  <div className="space-y-6">
    <ComparisonTable />
    <div className="mx-auto max-w-3xl rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
      <h3 className="text-sm font-semibold text-white">Scaling to millions of items</h3>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
        The number that matters at scale is <strong className="text-zinc-200">notification cost</strong>: a path-scoped
        update is <code className="text-brand-300">O(depth)</code> — a few <code>Map</code> lookups —{' '}
        <strong className="text-zinc-200">no matter how many subscribers exist</strong>. A million subscribers cost the
        same as one for an unrelated change, where selector stores re-run every selector and Context re-renders
        everything.
      </p>
      <p className="mt-2 text-xs leading-relaxed text-zinc-400">
        The <em>write</em> still copies the containers on the changed path (immutable structural sharing — the same
        cost Redux, Zustand and Jotai pay). So model state as a{' '}
        <strong className="text-zinc-200">tree / normalized map</strong> so a write touches a small path — a flat
        million-key object is the wrong shape for any immutable store.
      </p>
    </div>
  </div>
);

export default CapabilitiesView;
