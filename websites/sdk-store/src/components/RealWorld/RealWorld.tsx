import { useState } from 'react';

import AsyncDemo from '../AsyncDemo';
import BatchDemo from '../BatchDemo';
import CartDemo from '../CartDemo';
import DraftDemo from '../DraftDemo';
import EntitiesDemo from '../EntitiesDemo';
import MiddlewareDemo from '../MiddlewareDemo';
import PersistDemo from '../PersistDemo';
import SectionHeading from '../SectionHeading';
import Segmented from '../Segmented';
import TodoDemo from '../TodoDemo';

import type { ComponentType } from 'react';

type Example = { id: string; label: string; Component: ComponentType };

const EXAMPLES: Example[] = [
  { id: 'cart', label: 'Shopping cart', Component: CartDemo },
  { id: 'todo', label: 'To-do list', Component: TodoDemo },
  { id: 'entities', label: 'Entities', Component: EntitiesDemo },
  { id: 'async', label: 'Async + Suspense', Component: AsyncDemo },
  { id: 'batch', label: 'Batched updates', Component: BatchDemo },
  { id: 'middleware', label: 'Middleware', Component: MiddlewareDemo },
  { id: 'persist', label: 'Persistence', Component: PersistDemo },
  { id: 'draft', label: 'Draft editor', Component: DraftDemo }
];

const RealWorld = () => {
  const [activeId, setActiveId] = useState(EXAMPLES[0].id);
  const active = EXAMPLES.find(example => example.id === activeId) ?? EXAMPLES[0];
  const ActiveDemo = active.Component;

  return (
    <section id="examples" className="mx-auto max-w-6xl px-5 py-20">
      <SectionHeading
        eyebrow="Solve real problems"
        title="From counters to real features"
        subtitle="Self-contained apps, each a real store wired end to end. Pick one — toggle “Code” on the card to see exactly how little it takes."
      />

      <div className="mt-10 flex justify-center">
        <Segmented options={EXAMPLES} value={activeId} onChange={setActiveId} />
      </div>

      <div className="mx-auto mt-8 max-w-3xl">
        <ActiveDemo />
      </div>
    </section>
  );
};

export default RealWorld;
