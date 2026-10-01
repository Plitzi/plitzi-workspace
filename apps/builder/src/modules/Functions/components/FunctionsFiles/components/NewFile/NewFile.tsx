import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useState } from 'react';

import { newFileName } from '../../../../helpers';

import type { KeyboardEvent } from 'react';

export type NewFileProps = {
  onAdd: (file: string) => void;
  onCancel: () => void;
};

/** A new file's name, typed where the list starts: Enter adds it — `lib/feed.ts` makes the folder too — Escape lets it go. */
const NewFile = ({ onAdd, onCancel }: NewFileProps) => {
  const [name, setName] = useState('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const file = newFileName(name);
      if (e.key === 'Enter' && file) {
        onAdd(file);
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [name, onAdd, onCancel]
  );

  return (
    <div className="flex flex-col gap-1" onKeyDown={handleKeyDown}>
      <Input size="xs" value={name} placeholder="lib/feed.ts" autoFocus onChange={setName} />
      <span className="text-[10px] text-gray-500 dark:text-zinc-400">Enter to add · Esc to cancel</span>
    </div>
  );
};

export default NewFile;
