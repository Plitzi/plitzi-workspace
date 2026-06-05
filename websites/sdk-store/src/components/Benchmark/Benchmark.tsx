import { useState } from 'react';

import SectionHeading from '../SectionHeading';
import Segmented from '../Segmented';
import CapabilitiesView from './components/CapabilitiesView';
import PerformanceView from './components/PerformanceView';

import type { ComponentType } from 'react';

type View = { id: string; label: string; Component: ComponentType };

const VIEWS: View[] = [
  { id: 'capabilities', label: 'Capabilities', Component: CapabilitiesView },
  { id: 'performance', label: 'Performance', Component: PerformanceView }
];

const Benchmark = () => {
  const [activeId, setActiveId] = useState(VIEWS[0].id);
  const active = VIEWS.find(view => view.id === activeId) ?? VIEWS[0];
  const ActiveView = active.Component;

  return (
    <section id="benchmarks" className="border-y border-ink-800 bg-ink-900/30">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <SectionHeading
          eyebrow="How it compares"
          title="Fine-grained by default"
          subtitle="Other stores can be fine-grained — with selectors or atoms. sdk-store is path-scoped out of the box, and ships scoped stores and time-travel that most don't."
        />

        <div className="mt-10 flex justify-center">
          <Segmented options={VIEWS} value={activeId} onChange={setActiveId} />
        </div>

        <div className="mt-8">
          <ActiveView />
        </div>
      </div>
    </section>
  );
};

export default Benchmark;
