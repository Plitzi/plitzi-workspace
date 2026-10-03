import TreeRow from '../TreeRow';

import type { TreeRow as Row, TreeSection as Section } from '../../helpers/renderTree';

const ICON: Record<Section['kind'], string> = {
  layout: 'fa-solid fa-table-columns',
  page: 'fa-regular fa-file',
  component: 'fa-solid fa-cube'
};

const KIND: Record<Section['kind'], string> = { layout: 'Layout', page: 'Page', component: 'Component' };

export type TreeSectionProps = {
  section: Section;
  rows: Row[];
  /** Rows the section holds beyond those shown. */
  more: number;
  selected?: string;
  onSelect: (id: string) => void;
  onHover: (id?: string) => void;
};

/** One tree of what is on screen — a layout, the page, a component — headed by what it is. */
const TreeSection = ({ section, rows, more, selected, onSelect, onHover }: TreeSectionProps) => (
  <div className="flex flex-col">
    <div className="sticky top-0 flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-2 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
      <i className={ICON[section.kind]} />
      <span>{KIND[section.kind]}</span>
      <span className="truncate font-normal tracking-normal normal-case">{section.title}</span>
    </div>
    {rows.map(row => (
      <TreeRow key={row.id} row={row} isSelected={selected === row.id} onSelect={onSelect} onHover={onHover} />
    ))}
    {more > 0 && (
      <div className="p-2 text-center text-[11px] text-zinc-400 dark:text-zinc-600">
        {more} more — narrow the search to reach them
      </div>
    )}
  </div>
);

export default TreeSection;
