import { use } from 'react';

import QaInspectorDetails from './QaInspectorDetails';
import QaInspectorEmpty from './QaInspectorEmpty';
import QaContext from '../../../../qa/QaContext';

/** The inspector's side of the tab: the element kept with a click, or how to keep one. */
const QaInspectorPanel = () => {
  const { pinned, round } = use(QaContext);
  const kept = pinned?.isConnected ? pinned : undefined;

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
        <i className="fa-solid fa-magnifying-glass" />
        Inspector
      </div>
      {/* Keyed by the round "Look again" bumps: the same element, read anew after the page has changed. */}
      {kept && <QaInspectorDetails key={round} element={kept} />}
      {!kept && <QaInspectorEmpty />}
    </section>
  );
};

export default QaInspectorPanel;
