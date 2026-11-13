import Button from '@plitzi/plitzi-ui/Button';
import clsx from 'clsx';
import { useCallback, useState } from 'react';

import FlagPreviewToggle from './FlagPreviewToggle';
import FlagForm from '../FlagForm';

import type { Field } from '@plitzi/plitzi-ui/QueryBuilder';
import type { SchemaFlag } from '@plitzi/sdk-shared';
import type { FlagResolution } from '@plitzi/sdk-shared/flags';

export type FlagItemProps = {
  name: string;
  flag: SchemaFlag;
  resolution?: FlagResolution;
  forced?: boolean;
  fields: Record<string, Field>;
  onUpdate: (name: string, flag: SchemaFlag) => void;
  onRemove: (name: string) => void;
  onForce: (name: string, value: boolean | undefined) => void;
};

const FlagItem = ({ name, flag, resolution, forced, fields, onUpdate, onRemove, onForce }: FlagItemProps) => {
  const [editing, setEditing] = useState(false);
  const on = resolution?.value ?? false;

  const handleEdit = useCallback(() => setEditing(true), []);
  const handleClose = useCallback(() => setEditing(false), []);
  const handleRemove = useCallback(() => onRemove(name), [name, onRemove]);
  const handleSubmit = useCallback(
    (flagName: string, next: SchemaFlag) => {
      onUpdate(flagName, next);
      setEditing(false);
    },
    [onUpdate]
  );

  if (editing) {
    return <FlagForm name={name} flag={flag} fields={fields} onSubmit={handleSubmit} onClose={handleClose} />;
  }

  return (
    <div className="border-ui-line-strong bg-ui-raised text-ui-fg flex flex-col gap-1.5 rounded-sm border px-2 py-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={clsx('h-2 w-2 shrink-0 rounded-full', {
            'bg-emerald-500': on,
            'bg-ui-line-strong': !on
          })}
          title="What the canvas shows now"
        />
        <span className="min-w-0 grow truncate font-mono font-bold" title={name}>
          {name}
        </span>
        <Button size="xs" intent="secondary" title="Edit" onClick={handleEdit}>
          <Button.Icon icon="fa-solid fa-pen" />
        </Button>
        <Button size="xs" intent="secondary" title="Remove" onClick={handleRemove}>
          <Button.Icon icon="fa-solid fa-trash" />
        </Button>
      </div>
      {flag.description && <div className="text-ui-fg-subtle truncate text-xs">{flag.description}</div>}
      <div className="text-ui-fg-subtle flex items-center justify-between gap-2 text-xs">
        <span>
          {`Default ${flag.value ? 'on' : 'off'}`}
          {flag.rules.length > 0 && ` · ${flag.rules.length} rule${flag.rules.length === 1 ? '' : 's'}`}
        </span>
        <FlagPreviewToggle name={name} forced={forced} onForce={onForce} />
      </div>
    </div>
  );
};

export default FlagItem;
