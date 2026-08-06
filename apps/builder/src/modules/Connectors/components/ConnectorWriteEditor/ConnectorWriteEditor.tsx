import Button from '@plitzi/plitzi-ui/Button';
import Input from '@plitzi/plitzi-ui/Input';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import { fieldDocs } from '../../helpers/manifestDoc';
import FieldHelp from '../FieldHelp';
import TokenInput from '../TokenInput';

import type { ConnectorWriteAction, ConnectorWriteOperation } from '@plitzi/sdk-shared';

export type ConnectorWriteEditorProps = {
  action: ConnectorWriteAction;
  operation?: ConnectorWriteOperation;
  onChange: (action: ConnectorWriteAction, operation: ConnectorWriteOperation | undefined) => void;
};

const METHODS: ConnectorWriteOperation['method'][] = ['POST', 'PUT', 'PATCH', 'DELETE'];

const DEFAULT_METHOD: Record<ConnectorWriteAction, ConnectorWriteOperation['method']> = {
  create: 'POST',
  update: 'PUT',
  delete: 'DELETE'
};

const ConnectorWriteEditor = ({ action, operation, onChange }: ConnectorWriteEditorProps) => {
  const handleEnable = useCallback(
    () => onChange(action, { method: DEFAULT_METHOD[action], path: '/{{resource}}' }),
    [action, onChange]
  );

  const handleDisable = useCallback(() => onChange(action, undefined), [action, onChange]);

  const handleChangeMethod = useCallback(
    (value: string) => {
      if (operation) {
        onChange(action, { ...operation, method: value as ConnectorWriteOperation['method'] });
      }
    },
    [action, operation, onChange]
  );

  const handleChangePath = useCallback(
    (value: string) => {
      if (operation) {
        onChange(action, { ...operation, path: value });
      }
    },
    [action, operation, onChange]
  );

  const handleChangeBodyPath = useCallback(
    (value: string) => {
      if (operation) {
        onChange(action, { ...operation, bodyPath: value });
      }
    },
    [action, operation, onChange]
  );

  if (!operation) {
    return (
      <div className="flex items-center justify-between rounded-sm border border-dashed border-gray-300 p-2 dark:border-zinc-600">
        <span className="text-xs text-gray-500 capitalize dark:text-zinc-400">{action} — not allowed</span>
        <Button size="xs" intent="secondary" onClick={handleEnable}>
          Allow
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-gray-300 p-2 dark:border-zinc-600">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium capitalize">{action}</span>
        <Button size="xs" intent="secondary" onClick={handleDisable} title="Stop allowing this action">
          <Button.Icon icon="fa-solid fa-xmark" />
        </Button>
      </div>
      <Select value={operation.method} label="Method" size="xs" onChange={handleChangeMethod}>
        {METHODS.map(method => (
          <option key={method} value={method}>
            {method}
          </option>
        ))}
      </Select>
      <TokenInput
        label="Path"
        title={fieldDocs.writePath}
        value={operation.path}
        scope="write"
        onChange={handleChangePath}
      />
      <FieldHelp>{fieldDocs.writePath}</FieldHelp>
      {action !== 'delete' && (
        <Input
          value={operation.bodyPath ?? ''}
          label="Body key"
          placeholder="data"
          title={fieldDocs.writeBodyPath}
          size="xs"
          onChange={handleChangeBodyPath}
        />
      )}
      {action !== 'delete' && <FieldHelp>{fieldDocs.writeBodyPath}</FieldHelp>}
    </div>
  );
};

export default ConnectorWriteEditor;
