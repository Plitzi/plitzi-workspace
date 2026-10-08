import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import { useCallback, useId, useState } from 'react';

import { isTaskWord, titleFromAction } from '../../../../helpers';

import type { NewTask as NewTaskSpec } from '../../../../editor/source';
import type { KeyboardEvent } from 'react';

export type NewTaskProps = {
  /** The namespace the others use, offered first: a space's tasks usually share one. */
  namespace: string;
  onCreate: (task: NewTaskSpec) => void;
  onCancel: () => void;
};

/**
 * A new task, named where the list is: its namespace and action — what a step calls it, `seismic.feed` — and its title.
 * Written into `defineFunctions` for you, with a `run` to start from.
 */
const NewTask = ({ namespace: usual, onCreate, onCancel }: NewTaskProps) => {
  const id = useId();
  const [namespace, setNamespace] = useState(usual);
  const [action, setAction] = useState('');
  const [title, setTitle] = useState('');
  const valid = isTaskWord(namespace) && isTaskWord(action);

  const handleCreate = useCallback(() => {
    if (valid) {
      onCreate({ namespace, action, title: title.trim() || titleFromAction(action) });
    }
  }, [action, namespace, onCreate, title, valid]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCreate();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [handleCreate, onCancel]
  );

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900"
      onKeyDown={handleKeyDown}
    >
      <div className="flex gap-1.5">
        <Input
          id={`${id}-namespace`}
          size="xs"
          label="Namespace"
          placeholder="seismic"
          value={namespace}
          onChange={setNamespace}
        />
        <Input
          id={`${id}-action`}
          size="xs"
          label="Action"
          placeholder="feed"
          value={action}
          autoFocus
          onChange={setAction}
        />
      </div>
      <Input
        id={`${id}-title`}
        size="xs"
        label="Title"
        placeholder={titleFromAction(action) || 'Seismic feed'}
        value={title}
        onChange={setTitle}
      />
      <span className="text-[11px] text-gray-500 dark:text-zinc-400">
        {valid ? `A step called ${namespace}.${action}` : 'Lowercase words and dashes: seismic, feed-week'}
      </span>
      <div className="flex justify-end gap-1.5">
        <Button size="xs" intent="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="xs" disabled={!valid} onClick={handleCreate}>
          Create task
        </Button>
      </div>
    </div>
  );
};

export default NewTask;
