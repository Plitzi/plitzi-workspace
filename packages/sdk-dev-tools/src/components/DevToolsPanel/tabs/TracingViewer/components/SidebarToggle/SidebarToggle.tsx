import clsx from 'clsx';

export type SidebarToggleProps = {
  open: boolean;
  onToggle: () => void;
  className?: string;
};

// VSCode-style show/hide control for the detail panel, so it can be opened without first selecting an element.
const SidebarToggle = ({ open, onToggle, className }: SidebarToggleProps) => (
  <button
    onClick={onToggle}
    title={open ? 'Hide detail panel' : 'Show detail panel'}
    aria-pressed={open}
    className={clsx(
      'flex h-4 w-4 items-center justify-center rounded text-[10px]',
      open
        ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300'
        : 'text-zinc-400 hover:bg-zinc-500/10 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300',
      className
    )}
  >
    <i className="fa-solid fa-circle-info" />
  </button>
);

export default SidebarToggle;
