import Button from '@plitzi/plitzi-ui/Button';

import { SaveStateBadge } from '@pmodules/FileTree';

import type { SaveState } from '@pmodules/FileTree';

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
      {state && <SaveStateBadge state={state} />}
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
