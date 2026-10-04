import QaDivider from './QaDivider';
import QaReplayButton from './QaReplayButton';
import QaToolChip from './QaToolChip';
import QaVisionSelect from './QaVisionSelect';

/**
 * Every tool that draws over the page, in one row that wraps: the inspector first, then layout and what the document
 * wires, motion, and colour.
 */
const QaToolbar = () => (
  <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-zinc-200 px-3 py-2 dark:border-zinc-700">
    <QaToolChip
      setting="inspect"
      label="Inspect"
      icon="fa-solid fa-arrow-pointer"
      title="Point at an element for its box and style; click to keep it here; hold Alt over another to measure. Esc stops."
      primary
    />
    <QaDivider />
    <QaToolChip setting="grid" label="Grid" icon="fa-solid fa-table-columns" title="The page's 12, 8 or 4 columns" />
    <QaToolChip setting="outlines" label="Outlines" icon="fa-regular fa-square" title="Every element's box" />
    <QaToolChip
      setting="xray"
      label="X-ray"
      icon="fa-solid fa-x-ray"
      title="What is bound to data, shown on a condition, runs a flow, moves or sits behind a flag — named on the page"
    />
    <QaToolChip
      setting="tabOrder"
      label="Tab order"
      icon="fa-solid fa-arrow-right-to-bracket"
      title="The order the Tab key walks the controls in"
    />
    <QaToolChip
      setting="viewport"
      label="Viewport"
      icon="fa-solid fa-ruler-horizontal"
      title="The window's size and the breakpoint showing"
    />
    <QaDivider />
    <QaToolChip setting="paused" label="Pause" icon="fa-solid fa-pause" title="Hold every animation where it is" />
    <QaToolChip
      setting="slowMotion"
      label="Slow"
      icon="fa-solid fa-gauge-simple"
      title="Every animation at a quarter of its speed"
    />
    <QaReplayButton />
    <QaToolChip
      setting="reducedMotion"
      label="Reduced motion"
      icon="fa-solid fa-person-walking"
      title="The page as a visitor who asked for less motion gets it"
    />
    <QaVisionSelect />
  </div>
);

export default QaToolbar;
