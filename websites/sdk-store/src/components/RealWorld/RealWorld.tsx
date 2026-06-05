import AsyncDemo from '../AsyncDemo';
import BatchDemo from '../BatchDemo';
import CartDemo from '../CartDemo';
import DraftDemo from '../DraftDemo';
import EntitiesDemo from '../EntitiesDemo';
import PersistDemo from '../PersistDemo';
import SectionHeading from '../SectionHeading';
import TodoDemo from '../TodoDemo';

const RealWorld = () => (
  <section id="examples" className="mx-auto max-w-6xl px-5 py-24">
    <SectionHeading
      eyebrow="Solve real problems"
      title="From counters to real features"
      subtitle="Self-contained apps, each a real store wired end to end — carts, normalized lists, persistence, async + Suspense, batched updates, drafts. Toggle “Code” on any card to see exactly how little it takes."
    />

    <div className="mt-12 grid gap-6 lg:grid-cols-2">
      <CartDemo />
      <TodoDemo />
      <EntitiesDemo />
      <PersistDemo />
      <AsyncDemo />
      <BatchDemo />
      <div className="lg:col-span-2">
        <DraftDemo />
      </div>
    </div>
  </section>
);

export default RealWorld;
