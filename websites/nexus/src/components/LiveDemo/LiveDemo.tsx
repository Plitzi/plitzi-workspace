import { useState } from 'react';

import { historyMiddleware, StoreProvider } from '@plitzi/nexus';

import SectionHeading from '../SectionHeading';
import Segmented from '../Segmented';
import ComputedDemo from './components/ComputedDemo';
import DemoControls from './components/DemoControls';
import DemoHistory from './components/DemoHistory';
import DemoPanel from './components/DemoPanel';
import DemoStateView from './components/DemoStateView';
import DerivedDemo from './components/DerivedDemo';
import GetterDemo from './components/GetterDemo';
import ScopedDemo from './components/ScopedDemo';
import SetterDemo from './components/SetterDemo';
import SyncDemo from './components/SyncDemo';
import {
  COMPUTED_CODE,
  CONTROLS_CODE,
  DERIVED_CODE,
  GETTER_CODE,
  HISTORY_CODE,
  SCOPED_CODE,
  SETTER_CODE,
  STATE_CODE,
  SYNC_CODE
} from './demoCode';
import { DEMO_INITIAL_STATE } from './demoStore';

import type { DemoState } from './demoStore';
import type { ComponentType } from 'react';

// `useStoreHistory` (in DemoHistory) reads the history this records; without the middleware the panel would be empty.
const middlewares = [historyMiddleware<DemoState>()];

type Panel = { id: string; label: string; title: string; code: string; Component: ComponentType };

const PANELS: Panel[] = [
  { id: 'sync', label: 'Sync', title: 'useStoreSync · external → store', code: SYNC_CODE, Component: SyncDemo },
  {
    id: 'multi',
    label: 'Multi-path',
    title: 'useStore · transformer & multi-path',
    code: DERIVED_CODE,
    Component: DerivedDemo
  },
  {
    id: 'derived',
    label: 'Derived',
    title: 'createDerived · shared computed',
    code: COMPUTED_CODE,
    Component: ComputedDemo
  },
  { id: 'getter', label: 'Getter', title: 'useStoreGetter · read on demand', code: GETTER_CODE, Component: GetterDemo },
  {
    id: 'setter',
    label: 'Setter',
    title: 'useStoreSetter · write, no re-render',
    code: SETTER_CODE,
    Component: SetterDemo
  },
  { id: 'scoped', label: 'Scoped', title: 'Scoped store · live vs snapshot', code: SCOPED_CODE, Component: ScopedDemo }
];

const LiveDemo = () => {
  const [activeId, setActiveId] = useState(PANELS[0].id);
  const active = PANELS.find(panel => panel.id === activeId) ?? PANELS[0];
  const ActivePanel = active.Component;

  return (
    <section id="demo" className="mx-auto max-w-6xl px-5 py-20">
      <SectionHeading
        eyebrow="Live, in your browser"
        title="Mutate state. Travel through time."
        subtitle="The real @plitzi/nexus running on this page — every panel shares one store. Change a value and watch it sync, derive, record and inherit. Hit “Code” on any panel for the exact wiring."
      />

      <div className="border-ink-700 bg-ink-900/40 mt-10 overflow-hidden rounded-2xl border">
        <StoreProvider<DemoState> value={DEMO_INITIAL_STATE} autoSync={false} middlewares={middlewares}>
          <div className="bg-ink-700 grid gap-px md:grid-cols-3">
            <DemoPanel title="Controls · root scope" code={CONTROLS_CODE}>
              <DemoControls />
            </DemoPanel>
            <DemoPanel title="State" code={STATE_CODE}>
              <DemoStateView />
            </DemoPanel>
            <DemoPanel title="History · time-travel" code={HISTORY_CODE}>
              <DemoHistory />
            </DemoPanel>
          </div>

          <div className="border-ink-700 bg-ink-900/60 border-t px-4 py-4">
            <div className="flex justify-center">
              <Segmented options={PANELS} value={activeId} onChange={setActiveId} />
            </div>
          </div>

          <DemoPanel key={active.id} title={active.title} code={active.code} className="border-ink-700 border-t">
            <ActivePanel />
          </DemoPanel>
        </StoreProvider>
      </div>

      <p className="mt-5 text-center text-sm text-zinc-500">
        The History panel is the same primitive that powers the <span className="text-brand-300">sdk-dev-tools</span>{' '}
        History tab.
      </p>
    </section>
  );
};

export default LiveDemo;
