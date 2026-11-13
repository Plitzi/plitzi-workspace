import clsx from 'clsx';
import { useMemo, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import ViewTabs from '@pmodules/App/components/ViewTabs';
import UrlParams from '@pmodules/Variables/components/UrlParams';

import ComputedTab from './components/ComputedTab';
import Scenarios from './components/Scenarios';
import StateTab from './components/StateTab';
import VisitorTab from './components/VisitorTab';
import { stateKeysOf } from './helpers';
import useCanvasVisitor from './hooks/useCanvasVisitor';

export type StateManagerProps = {
  className?: string;
};

type Tab = 'state' | 'visitor' | 'address' | 'computed';

const NO_STATE: Record<string, unknown> = {};

/**
 * The page's context as the canvas runs it — what decides how it looks besides the space itself: its state, who visits
 * it, the address it is opened at and the values the space computes from them. Each can be set here to see the page in
 * that case, and a case kept by name (Scenarios). Nothing of it is saved in the space.
 */
const StateManager = ({ className = '' }: StateManagerProps) => {
  const [[state = NO_STATE, flat, components, computed, urlTest]] = useBuilderStore([
    'runtime.state',
    'schema.flat',
    'schema.components',
    'schema.settings.computed',
    'urlTest'
  ]);
  const { visitor } = useCanvasVisitor();
  const [tab, setTab] = useState<Tab>('state');

  const keys = useMemo(() => {
    const used = stateKeysOf({ flat, components });

    return new Set([...used.keys(), ...Object.keys(state)]).size;
  }, [flat, components, state]);
  // A tab whose case is not the canvas's own says so: what is set there changes the page.
  const tested = Object.keys(urlTest?.routeParams ?? {}).length + Object.keys(urlTest?.queryParams ?? {}).length;
  const marked = (on: boolean) => on && <span className="bg-primary-500 size-1.5 rounded-full" aria-label="set" />;

  return (
    <div className={clsx('flex h-full w-full flex-col gap-2 p-2', className)}>
      <Scenarios />
      <ViewTabs
        tabs={[
          { id: 'state', label: 'State', mark: <span className="text-ui-fg-subtle tabular-nums">{keys}</span> },
          { id: 'visitor', label: 'Visitor', mark: marked(visitor.kind !== 'editor') },
          { id: 'address', label: 'Address', mark: marked(tested > 0) },
          {
            id: 'computed',
            label: 'Computed',
            mark: <span className="text-ui-fg-subtle tabular-nums">{Object.keys(computed ?? {}).length}</span>
          }
        ]}
        selected={tab}
        onSelect={setTab}
      />
      <div className="flex min-h-0 grow basis-0 flex-col overflow-y-auto" role="tabpanel">
        {tab === 'state' && <StateTab />}
        {tab === 'visitor' && <VisitorTab />}
        {tab === 'address' && <UrlParams />}
        {tab === 'computed' && <ComputedTab />}
      </div>
    </div>
  );
};

export default StateManager;
