import Button from '@plitzi/plitzi-ui/Button';
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
  <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-6 dark:border-zinc-800">
    <p className="min-w-0 truncate text-sm text-gray-600 dark:text-zinc-400">
      Server code in TypeScript: tasks are steps any action runs, routes answer HTTP under <code>/fn</code>.
    </p>
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
