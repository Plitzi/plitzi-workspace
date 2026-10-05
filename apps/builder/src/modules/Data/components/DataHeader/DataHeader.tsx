import Button from '@plitzi/plitzi-ui/Button';

import { SaveStateBadge } from '@pmodules/FileTree';

import type { SaveState } from '@pmodules/FileTree';

export type DataHeaderProps = {
  /** Where the files stand — none for data never saved. */
  state?: SaveState;
  canSave: boolean;
  isSaving: boolean;
  /** Whether there are changes to discard. */
  canDiscard: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

/** The panel's name and what it is for, where the files stand, and saving them. */
const DataHeader = ({ state, canSave, isSaving, canDiscard, onSave, onDiscard }: DataHeaderProps) => (
  <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-6 dark:border-zinc-800">
    <p className="min-w-0 truncate text-sm text-gray-600 dark:text-zinc-400">
      JSON the pages read on the server — <code>query: &apos;/data/&lt;file&gt;&apos;</code> with{' '}
      <code>runtime: &apos;server&apos;</code> — and never serve.
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
      <Button size="sm" disabled={!canSave} title="Save — ⌘S" onClick={onSave}>
        {isSaving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  </header>
);

export default DataHeader;
