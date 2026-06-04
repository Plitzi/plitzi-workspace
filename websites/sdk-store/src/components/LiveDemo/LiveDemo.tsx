import { StoreProvider } from '@plitzi/sdk-store';

import SectionHeading from '../SectionHeading';
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

const LiveDemo = () => (
  <section id="demo" className="mx-auto max-w-6xl px-5 py-24">
    <SectionHeading
      eyebrow="Live, in your browser"
      title="Mutate state. Travel through time."
      subtitle="This is the real @plitzi/sdk-store running on this page — every panel shares one store. Change a value, watch it sync, derive, record, and inherit live. Hit “Code” on any panel for the exact store wiring."
    />

    <div className="mt-12 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/40">
      <StoreProvider value={DEMO_INITIAL_STATE} autoSync={false}>
        <div className="grid gap-px bg-ink-700 md:grid-cols-3">
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

        <div className="grid gap-px border-t border-ink-700 bg-ink-700 md:grid-cols-2">
          <DemoPanel title="useStoreSync · external → store" code={SYNC_CODE}>
            <SyncDemo />
          </DemoPanel>
          <DemoPanel title="useStore · derived & multi-path" code={DERIVED_CODE}>
            <DerivedDemo />
          </DemoPanel>
          <DemoPanel title="useStoreGetter · read on demand" code={GETTER_CODE}>
            <GetterDemo />
          </DemoPanel>
          <DemoPanel title="useStoreSetter · write, no re-render" code={SETTER_CODE}>
            <SetterDemo />
          </DemoPanel>
        </div>

        <DemoPanel title="Scoped store · live vs snapshot" code={SCOPED_CODE} className="border-t border-ink-700">
          <ScopedDemo />
        </DemoPanel>
      </StoreProvider>
    </div>

    <p className="mt-5 text-center text-sm text-zinc-500">
      The History panel is the same primitive that powers the{' '}
      <span className="text-brand-300">sdk-dev-tools</span> History tab.
    </p>
  </section>
);

export default LiveDemo;
