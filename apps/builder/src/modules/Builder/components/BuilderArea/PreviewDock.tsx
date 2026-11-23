import PreviewPanel from '@pmodules/StateManager/components/PreviewPanel';

import { PANEL_WIDTH } from './previewDockRoom';

/** The visitor the preview shows the page to, and its choices, docked right of the canvas. */
const PreviewDock = () => (
  <aside
    aria-label="The visitor the preview shows the page to"
    className="border-ui-line bg-ui-panel text-ui-fg absolute top-4 right-4 flex max-h-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl border p-3 shadow-xl"
    style={{ width: PANEL_WIDTH }}
  >
    <PreviewPanel />
  </aside>
);

export default PreviewDock;
