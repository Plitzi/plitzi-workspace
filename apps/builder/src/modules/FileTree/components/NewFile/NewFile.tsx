import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import type { KeyboardEvent } from 'react';

export type NewFileProps = {
  /** An example of a name, shown while there is none: `lib/feed.ts`. */
  placeholder: string;
  /** The file a typed name is — trimmed, with the extension the list's files have when it says none. */
  nameOf: (typed: string) => string;
  onAdd: (file: string) => void;
  onCancel: () => void;
};

/** A new file's name, typed where the list starts: Enter adds it — `lib/feed.ts` makes the folder too — Escape lets it go. */
const NewFile = ({ placeholder, nameOf, onAdd, onCancel }: NewFileProps) => {
  const [name, setName] = useState('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const file = nameOf(name);
      if (e.key === 'Enter' && file) {
        onAdd(file);
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [name, nameOf, onAdd, onCancel]
  );

  return (
    <div className="flex flex-col gap-1" onKeyDown={handleKeyDown}>
      <Input size="xs" value={name} placeholder={placeholder} autoFocus onChange={setName} />
      <span className="text-[10px] text-gray-500 dark:text-zinc-400">Enter to add · Esc to cancel</span>
    </div>
  );
};

export default NewFile;
