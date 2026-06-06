import BenchmarkRunner from '../BenchmarkRunner';

const PerformanceView = () => (
  <div className="space-y-6">
    <BenchmarkRunner />
    <p className="mx-auto max-w-3xl text-center text-xs leading-relaxed text-zinc-600">
      Each number is the <strong className="text-zinc-500">median of several reps</strong> (a single pass swings with
      GC/JIT). No store wins them all, and that’s the point: proxy and atom stores (Valtio, MobX, Jotai) skip the copy
      entirely on a <em>normalized map</em> edit, while every immutable store — nexus, Zustand, Redux — pays to copy
      the changed container; on <em>hot</em> and <em>fan-out</em> notification throughput decides it. nexus stays
      top-tier across every shape — and is the only one here that keeps a single immutable tree (consistent snapshots
      &amp; time-travel) with typed dot-paths and scoped stores. Numbers vary by machine.
    </p>
  </div>
);

export default PerformanceView;
