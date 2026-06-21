import { StoreProvider } from '@plitzi/nexus';
import { useState } from 'react';

import Controls from './components/Controls';
import TreeView from './components/TreeView';
import WatchPanel from './components/WatchPanel';
import { type LeafPath, DEMO_INITIAL } from './stateTreeStore';
import SectionHeading from '../SectionHeading';
import useReveal from '../../useReveal';

const StateTree = () => {
  const { ref, visible } = useReveal<HTMLDivElement>();
  const [watched, setWatched] = useState<LeafPath>('user.profile.name');

  return (
    <section id="mental-model" className="relative px-5 py-24">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="The mental model"
          title={
            <>
              State is a <span className="text-gradient">navigable tree</span>
            </>
          }
          subtitle="No selectors, no slices to wire up. Address any value by its path, subscribe to it, and re-render only when that exact node changes. Click a leaf to watch it, then mutate the tree."
        />

        <StoreProvider value={DEMO_INITIAL}>
          <div
            ref={ref}
            className={`reveal mt-12 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] ${visible ? 'is-visible' : ''}`}
          >
            <div className="border-ink-700 bg-ink-900/60 glow rounded-2xl border p-5">
              <div className="mb-4 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400/70" />
                <span className="h-3 w-3 rounded-full bg-amber-400/70" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
                <span className="ml-2 font-mono text-xs text-zinc-500">store.state</span>
              </div>

              <TreeView watched={watched} onWatch={setWatched} />
            </div>

            <div className="flex flex-col gap-5">
              <WatchPanel key={watched} path={watched} />
              <Controls />
            </div>
          </div>
        </StoreProvider>
      </div>
    </section>
  );
};

export default StateTree;
