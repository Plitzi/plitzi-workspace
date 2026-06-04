import CartDemo from '../CartDemo';
import DraftDemo from '../DraftDemo';
import SectionHeading from '../SectionHeading';
import TodoDemo from '../TodoDemo';

const RealWorld = () => (
  <section id="examples" className="mx-auto max-w-6xl px-5 py-24">
    <SectionHeading
      eyebrow="Solve real problems"
      title="From counters to real features"
      subtitle="Three self-contained apps, each a real store wired end to end. Toggle “Code” on any card to see exactly how little it takes."
    />

    <div className="mt-12 grid gap-6 lg:grid-cols-2">
      <CartDemo />
      <TodoDemo />
      <div className="lg:col-span-2">
        <DraftDemo />
      </div>
    </div>
  </section>
);

export default RealWorld;
