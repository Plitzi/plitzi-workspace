import BenchmarkRunner from '../BenchmarkRunner';

const PerformanceView = () => (
  <div className="space-y-6">
    <BenchmarkRunner />
    <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-zinc-600">
      Each number is the <strong className="text-zinc-500">median of several reps</strong> (a single pass swings with
      GC/JIT). No store wins them all, and that’s the point. On the real-world shapes — a <em>normalized map</em>, a{' '}
      <em>live feed</em> streaming across a large collection, or moving a <em>selection</em> in a big list — the
      fine-grained stores (Valtio, MobX, Jotai, and nexus via <code className="text-brand-200">createEntityStore</code>)
      touch a single item, while Zustand and Redux copy the whole collection or re-run every row’s selector on each
      edit. On <em>hot</em> and <em>fan-out</em>, raw notification throughput decides it. nexus stays top-tier across
      every shape — with typed dot-paths, scoped stores, and your choice of a single immutable tree (consistent
      snapshots &amp; time-travel) or an O(1) entity store for big collections. Numbers vary by machine.
    </p>
  </div>
);

export default PerformanceView;
