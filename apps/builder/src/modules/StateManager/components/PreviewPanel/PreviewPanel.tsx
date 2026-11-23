import { use, useState } from 'react';

import { useBuilderStore } from '@plitzi/sdk-shared/store';
import AppContext from '@pmodules/App/AppContext';
import ViewTabs from '@pmodules/App/components/ViewTabs';
import UrlParams from '@pmodules/Variables/components/UrlParams';

import DatePane from './panes/DatePane';
import FlagsPane from './panes/FlagsPane';
import VariantsPane from './panes/VariantsPane';
import VisitorPane from './panes/VisitorPane';
import useCanvasVisitor from '../../hooks/useCanvasVisitor';

import type { ReactNode } from 'react';

type Pane = 'visitor' | 'variants' | 'flags' | 'date' | 'address';

/** A tab's mark: how many of its choices differ from the page left to itself. */
const countMark = (count: number): ReactNode =>
  count > 0 ? (
    <span className="bg-primary-500 rounded-full px-1 text-[9px] leading-tight text-white">{count}</span>
  ) : undefined;

/**
 * Everything the canvas's preview is tried with, in one place: who the visitor is, the variant of each Variants
 * element, the feature flags, the date and the address's parameters — each tab marked with how many of its choices are set — and a
 * reload, as a browser's F5. Docked beside the canvas where there is room, under the address bar's button else.
 */
const PreviewPanel = () => {
  const [pane, setPane] = useState<Pane>('visitor');
  const { reloadPage, newVisitor } = use(AppContext);
  const { visitor } = useCanvasVisitor();
  const [[simulation, experimentsForced, flagsForced, simulatedAt, queryParams]] = useBuilderStore([
    'visitorSimulation',
    'experiments.qa',
    'flags.overrides.qa',
    'simulatedAt',
    'navigation.queryParams'
  ]);
  const visitorSet = (visitor.kind === 'editor' ? 0 : 1) + Object.keys(simulation ?? {}).length;

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-ui-fg grow text-xs font-semibold">Try the preview as</span>
        <button
          type="button"
          title="Reload — as a browser's F5: what the page set for this visit is emptied, what it keeps stays, and so do the variants drawn"
          className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
          onClick={reloadPage}
        >
          <i className="fa-solid fa-rotate-right" />
          Reload
        </button>
        <button
          type="button"
          title="New visitor — a first visit: nothing kept, and the variants set to Draw drawn again by their shares"
          className="text-ui-fg-subtle hover:text-ui-fg hover:bg-ui-hover flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px]"
          onClick={newVisitor}
        >
          <i className="fa-solid fa-user-plus" />
          New visitor
        </button>
      </div>
      {/* Scrolled rather than cut where the tabs are wider than the panel. */}
      <div className="-mx-1 overflow-x-auto px-1">
        <ViewTabs
          size="xs"
          tabs={[
            { id: 'visitor', label: 'Visitor', mark: countMark(visitorSet) },
            { id: 'variants', label: 'Variants', mark: countMark(Object.keys(experimentsForced ?? {}).length) },
            { id: 'flags', label: 'Flags', mark: countMark(Object.keys(flagsForced ?? {}).length) },
            { id: 'date', label: 'Date', mark: countMark(simulatedAt === undefined ? 0 : 1) },
            { id: 'address', label: 'URL', mark: countMark(Object.keys(queryParams).length) }
          ]}
          selected={pane}
          onSelect={setPane}
        />
      </div>
      <div className="min-h-0 overflow-y-auto pr-0.5">
        {pane === 'visitor' && <VisitorPane />}
        {pane === 'variants' && <VariantsPane />}
        {pane === 'flags' && <FlagsPane />}
        {pane === 'date' && <DatePane />}
        {pane === 'address' && <UrlParams />}
      </div>
    </div>
  );
};

export default PreviewPanel;
