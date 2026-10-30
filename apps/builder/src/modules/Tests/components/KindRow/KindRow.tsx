import Button from '@plitzi/plitzi-ui/Button';
import Select from '@plitzi/plitzi-ui/Select';
import { useCallback } from 'react';

import FieldInput from './components/FieldInput';
import { emptyOf } from '../../helpers';

import type { KindSpec } from '../../helpers';

export type KindRowProps = {
  index: number;
  count: number;
  row: { kind: string } & Record<string, unknown>;
  kinds: Record<string, KindSpec>;
  elements: { value: string; label: string }[];
  /** The element a new row of a kind that names one starts on. */
  elementId: string;
  onChange: (index: number, row: { kind: string } & Record<string, unknown>) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, by: number) => void;
};

/**
 * One row of a list a test is made of — an expectation of a unit test, a step of an e2e test: its kind, the fields that
 * kind takes, and its place in the list.
 */
const KindRow = ({ index, count, row, kinds, elements, elementId, onChange, onRemove, onMove }: KindRowProps) => {
  const spec = kinds[row.kind] as KindSpec | undefined;

  const handleKind = useCallback(
    (kind: string) => {
      const named = typeof row.element === 'string' ? row.element : elementId;
      onChange(index, { ...emptyOf(kind, kinds[kind], named), kind });
    },
    [elementId, index, kinds, onChange, row.element]
  );
  const handleField = useCallback(
    (name: string, value: unknown) => onChange(index, { ...row, [name]: value }),
    [index, onChange, row]
  );
  const handleRemove = useCallback(() => onRemove(index), [index, onRemove]);
  const handleUp = useCallback(() => onMove(index, -1), [index, onMove]);
  const handleDown = useCallback(() => onMove(index, 1), [index, onMove]);

  return (
    <div className="flex items-end gap-2 rounded-md border border-gray-300 px-3 py-2 dark:border-zinc-700">
      <span className="pb-2 font-mono text-xs text-gray-400 dark:text-zinc-500">{index + 1}</span>
      <Select size="sm" name="kind" label="Kind" value={row.kind} onChange={handleKind}>
        {Object.entries(kinds).map(([kind, each]) => (
          <option key={kind} value={kind}>
            {each.label}
          </option>
        ))}
      </Select>
      {spec?.fields.map(field => (
        <FieldInput key={field.name} field={field} value={row[field.name]} elements={elements} onChange={handleField} />
      ))}
      <div className="ml-auto flex gap-1">
        <Button size="sm" intent="secondary" title="Move up" disabled={index === 0} onClick={handleUp}>
          <i className="fa-solid fa-arrow-up" />
        </Button>
        <Button size="sm" intent="secondary" title="Move down" disabled={index === count - 1} onClick={handleDown}>
          <i className="fa-solid fa-arrow-down" />
        </Button>
        <Button size="sm" intent="danger" title="Remove" onClick={handleRemove}>
          <i className="fa-solid fa-xmark" />
        </Button>
      </div>
    </div>
  );
};

export default KindRow;
