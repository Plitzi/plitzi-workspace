import clsx from 'clsx';

import type { SaveState } from '../../helpers';

export type SaveStateBadgeProps = { state: SaveState };

/** Where the files stand, as a header shows it: a dot and a few words, in the tone of what it says. */
const SaveStateBadge = ({ state }: SaveStateBadgeProps) => (
  <span
    className={clsx('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', {
      'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300': state.tone === 'unsaved',
      'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300': state.tone === 'problems',
      'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300': state.tone === 'saved'
    })}
    title={state.tone === 'saved' ? 'The builder runs the saved draft; the live site, what was last published' : ''}
  >
    <span
      className={clsx('size-1.5 rounded-full', {
        'bg-amber-500': state.tone === 'unsaved',
        'bg-red-500': state.tone === 'problems',
        'bg-green-500': state.tone === 'saved'
      })}
    />
    {state.label}
  </span>
);

export default SaveStateBadge;
