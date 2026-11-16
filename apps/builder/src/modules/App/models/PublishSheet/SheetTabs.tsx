import clsx from 'clsx';

export type SheetTabsProps = {
  publishing: boolean;
  onPublish: () => void;
  onHistory: () => void;
};

const TAB = 'rounded px-3 py-1 transition-colors';
const ON = 'bg-ui-panel text-ui-fg shadow-sm';
const OFF = 'text-ui-fg-subtle hover:text-ui-fg';

/** The sheet's two views, at its top: publishing, and what was published where. */
const SheetTabs = ({ publishing, onPublish, onHistory }: SheetTabsProps) => (
  <div role="tablist" aria-label="View" className="bg-ui-raised flex self-start rounded-md p-0.5 text-xs">
    <button
      type="button"
      role="tab"
      aria-selected={publishing}
      className={clsx(TAB, publishing ? ON : OFF)}
      onClick={onPublish}
    >
      Publish
    </button>
    <button
      type="button"
      role="tab"
      aria-selected={!publishing}
      className={clsx(TAB, publishing ? OFF : ON)}
      onClick={onHistory}
    >
      History
    </button>
  </div>
);

export default SheetTabs;
