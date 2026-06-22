import { FRAMEWORKS } from '../../content';
import SectionHeading from '../SectionHeading';
import FrameworkCard from './components/FrameworkCard';

const Frameworks = () => (
  <section id="frameworks" className="border-t border-ink-800">
    <div className="mx-auto max-w-6xl px-5 py-20">
      <SectionHeading
        eyebrow="Use it anywhere"
        title="One core, every framework"
        subtitle="@plitzi/nexus is a framework-agnostic state core. Import the root for the agnostic store, then reach for the binding that matches your stack — React, Vue, Next.js, Astro, or the bare core for anything else."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FRAMEWORKS.map(framework => (
          <FrameworkCard key={framework.name} framework={framework} />
        ))}
      </div>
    </div>
  </section>
);

export default Frameworks;
