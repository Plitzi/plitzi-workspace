import Button from '@plitzi/plitzi-ui/Button';
import Heading from '@plitzi/plitzi-ui/Heading';
import clsx from 'clsx';

import type { SaveState } from '../../helpers';

export type FunctionsHeaderProps = {
  /** Where the files stand — none for a space with no functions yet. */
  state?: SaveState;
  canSave: boolean;
  isSaving: boolean;
  /** Whether there are changes to discard. */
  canDiscard: boolean;
  /** Whether there is a saved draft to remove. */
  canRemove: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onRemove: () => void;
};

/** The panel's name and what it is for, where the files stand, and saving them — the one thing done most. */
const FunctionsHeader = ({
  state,
  canSave,
  isSaving,
  canDiscard,
  canRemove,
  onSave,
  onDiscard,
  onRemove
}: FunctionsHeaderProps) => (
  <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-4 dark:border-zinc-800">
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
        <i className="fa-solid fa-code text-xs" />
      </span>
      <div className="flex min-w-0 flex-col">
        <Heading as="h5">Functions</Heading>
        <span className="truncate text-xs text-gray-500 dark:text-zinc-400">
          Server code in TypeScript: tasks are steps any action runs, routes answer HTTP under /fn.
        </span>
      </div>
    </div>
    <div className="flex shrink-0 items-center gap-2">
      {state && (
        <span
          className={clsx('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', {
            'bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300': state.tone === 'unsaved',
            'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300': state.tone === 'problems',
            'bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300': state.tone === 'saved'
          })}
          title={
            state.tone === 'saved' ? 'The builder runs the saved draft; the live site, what was last published' : ''
          }
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
      )}
      {canDiscard && (
        <Button
          size="sm"
          intent="secondary"
          iconPlacement="before"
          title="Discard every unsaved change and go back to what was last saved"
          onClick={onDiscard}
        >
          <i className="fa-solid fa-rotate-left" />
          Discard
        </Button>
      )}
      {canRemove && (
        <Button size="sm" intent="secondary" title="Remove the space’s functions" onClick={onRemove}>
          <i className="fa-regular fa-trash-can" />
        </Button>
      )}
      <Button size="sm" disabled={!canSave} title="Save — ⌘S" onClick={onSave}>
        {isSaving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  </header>
);

export default FunctionsHeader;
