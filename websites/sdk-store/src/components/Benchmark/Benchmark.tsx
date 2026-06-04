import SectionHeading from '../SectionHeading';
import BenchmarkRunner from './components/BenchmarkRunner';
import ComparisonTable from './components/ComparisonTable';

const Benchmark = () => (
  <section id="benchmarks" className="border-y border-ink-800 bg-ink-900/30">
    <div className="mx-auto max-w-6xl px-5 py-24">
      <SectionHeading
        eyebrow="How it compares"
        title="Fine-grained by default"
        subtitle="Other stores can be fine-grained — with selectors or atoms. sdk-store is path-scoped out of the box, and ships scoped stores and time-travel that most don't."
      />

      <div className="mt-12 space-y-8">
        <ComparisonTable />
        <BenchmarkRunner />
      </div>

      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
        <h3 className="text-sm font-semibold text-white">Scaling to millions of items</h3>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          The number that matters at scale is <strong className="text-zinc-200">notification cost</strong>: a
          path-scoped update is <code className="text-brand-300">O(depth)</code> — a few <code>Map</code> lookups —{' '}
          <strong className="text-zinc-200">no matter how many subscribers exist</strong>. A million subscribers cost
          the same as one for an unrelated change, where selector stores re-run every selector and Context re-renders
          everything.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          The <em>write</em> still copies the containers on the changed path (immutable structural sharing — the same
          cost Redux, Zustand and Jotai pay). So the rule for millions of items is structural, not library-specific:
          model state as a <strong className="text-zinc-200">tree / normalized map</strong> so a write touches a small
          path — a flat million-key object is the wrong shape for any immutable store. Reads are{' '}
          <code className="text-brand-300">O(depth)</code> via a cached path parser.
        </p>
      </div>

      <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-zinc-600">
        Each number is the <strong className="text-zinc-500">median of several reps</strong> (a single pass swings
        with GC/JIT — that’s why benchmarks feel noisy). No store wins them all, and that’s the point: proxy and atom
        stores (Valtio, MobX, Jotai) skip the copy entirely on a <em>normalized map</em> edit, while every immutable
        store — sdk-store, Zustand, Redux — pays to copy the changed container; on <em>hot</em> and <em>fan-out</em>{' '}
        notification throughput decides it. sdk-store stays top-tier across every shape — and is the only one here that
        keeps a single immutable tree (consistent snapshots &amp; time-travel) with typed dot-paths and scoped stores.
        Numbers vary by machine.
      </p>
    </div>
  </section>
);

export default Benchmark;
